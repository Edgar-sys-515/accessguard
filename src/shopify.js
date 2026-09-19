'use strict';
/*
 * AccessGuard — camada Shopify (instalação + leitura da loja de verdade).
 *
 * O que este arquivo faz:
 *  1) Configura o SDK oficial da Shopify (@shopify/shopify-api).
 *  2) Instala o app na loja pelo fluxo OAuth (begin/callback) e guarda o token.
 *  3) Lê a loja REAL (produtos/imagens pela Admin API + página inicial da
 *     vitrine) e devolve os dados no MESMO formato do sampleStore, para o
 *     motor (scanner/fixer) funcionar sem mudar nada.
 *
 * Modo demonstração: se as chaves da Shopify não estiverem configuradas
 * (SHOPIFY_API_KEY / SHOPIFY_API_SECRET), o app roda com a loja de exemplo.
 * Assim dá para abrir o painel e testar sem loja conectada.
 */
require('@shopify/shopify-api/adapters/node');
const { shopifyApi, LATEST_API_VERSION, Session } = require('@shopify/shopify-api');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.SHOPIFY_API_KEY || '';
const API_SECRET = process.env.SHOPIFY_API_SECRET || '';
// HOST = domínio público https do app, ex.: accessguard.discar.cloud (sem https://)
const HOST = (process.env.HOST || process.env.SHOPIFY_APP_URL || '')
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '');
const SCOPES = (process.env.SHOPIFY_SCOPES || 'read_products,read_themes,read_content')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Está tudo configurado para falar com a Shopify de verdade?
const isConfigured = Boolean(API_KEY && API_SECRET && HOST);

let shopify = null;
if (isConfigured) {
  shopify = shopifyApi({
    apiKey: API_KEY,
    apiSecretKey: API_SECRET,
    scopes: SCOPES,
    hostName: HOST,
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: false, // v0.3: app clássico (não-embutido). Embutido + App Bridge vem depois.
  });
}

// ---------- Armazenamento simples do token (arquivo JSON num volume) ----------
// Cada loja instala uma vez e ganha um token "offline" que não expira.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');

function readTokens() {
  try {
    return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
  } catch (_) {
    return {};
  }
}
function writeTokens(obj) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(obj, null, 2));
}
function saveToken(shop, accessToken, scope) {
  const all = readTokens();
  all[shop] = { accessToken, scope, at: new Date().toISOString() };
  writeTokens(all);
}
function getToken(shop) {
  return readTokens()[shop] || null;
}
function knownShops() {
  return Object.keys(readTokens());
}

// Reconstrói uma "session" a partir do token salvo, para chamar a Admin API.
function sessionFor(shop) {
  const t = getToken(shop);
  if (!t) return null;
  return new Session({
    id: `offline_${shop}`,
    shop,
    state: 'offline',
    isOnline: false,
    accessToken: t.accessToken,
    scope: t.scope,
  });
}

// ---------- OAuth ----------
async function begin(req, res, shop) {
  return shopify.auth.begin({
    shop: shopify.utils.sanitizeShop(shop, true),
    callbackPath: '/auth/callback',
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });
}

async function callback(req, res) {
  const { session } = await shopify.auth.callback({ rawRequest: req, rawResponse: res });
  saveToken(session.shop, session.accessToken, (session.scope || SCOPES.join(',')));
  return session;
}

// ---------- Leitura da loja real ----------
// Produtos + imagens (com/sem alt) pela Admin API (GraphQL).
async function fetchProducts(session) {
  const client = new shopify.clients.Graphql({ session });
  const query = `{
    products(first: 50) {
      edges { node {
        title
        images(first: 20) { edges { node { url altText } } }
      } }
    }
  }`;
  const resp = await client.request(query);
  const edges = (resp && resp.data && resp.data.products && resp.data.products.edges) || [];
  return edges.map((e) => ({
    title: e.node.title,
    images: (e.node.images.edges || []).map((im) => ({
      src: im.node.url,
      alt: im.node.altText || '',
    })),
  }));
}

// Página inicial da vitrine: idioma declarado, links vagos, campos sem rótulo.
// (Feito com fetch simples do HTML público — não precisa de token.)
async function fetchStorefrontSignals(shop) {
  const out = { lang: null, links: [], formFields: [] };
  try {
    const r = await fetch(`https://${shop}/`, {
      headers: { 'User-Agent': 'AccessGuard/0.3 (+accessibility scan)' },
      redirect: 'follow',
    });
    const html = await r.text();

    const langMatch = html.match(/<html[^>]*\blang\s*=\s*["']([^"']+)["']/i);
    out.lang = langMatch ? langMatch[1] : null;

    // Texto dos links <a>...</a> (limpa tags internas)
    const linkRe = /<a\b[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    let count = 0;
    while ((m = linkRe.exec(html)) && count < 400) {
      const href = m[1];
      const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text) out.links.push({ text, href });
      count++;
    }

    // Inputs sem <label for=...> nem aria-label
    const labelFor = new Set();
    let lm;
    const labelRe = /<label\b[^>]*\bfor\s*=\s*["']([^"']+)["']/gi;
    while ((lm = labelRe.exec(html))) labelFor.add(lm[1]);

    const inputRe = /<(input|select|textarea)\b([^>]*)>/gi;
    let im2;
    while ((im2 = inputRe.exec(html))) {
      const attrs = im2[2];
      const type = (attrs.match(/\btype\s*=\s*["']([^"']+)["']/i) || [])[1] || 'text';
      if (/hidden|submit|button|image|reset/i.test(type)) continue;
      const id = (attrs.match(/\bid\s*=\s*["']([^"']+)["']/i) || [])[1];
      const name = (attrs.match(/\bname\s*=\s*["']([^"']+)["']/i) || [])[1] || id || 'campo';
      const hasAria = /\baria-label\s*=|\baria-labelledby\s*=|\btitle\s*=/i.test(attrs);
      const hasLabel = id && labelFor.has(id);
      out.formFields.push({ name, label: hasLabel || hasAria ? name : '' });
    }
  } catch (_) {
    // Se a vitrine não puder ser lida, seguimos só com os produtos.
  }
  return out;
}

// Monta o objeto da loja no formato que o scanner/fixer esperam.
async function loadRealStore(shop) {
  const session = sessionFor(shop);
  if (!session) throw new Error('Loja não instalada: ' + shop);

  const [products, front] = await Promise.all([
    fetchProducts(session),
    fetchStorefrontSignals(shop),
  ]);

  return {
    shop,
    theme: { lang: front.lang }, // null = problema de idioma
    products,
    // Contraste de cor exige renderizar o tema (CSS aplicado). Fica para a
    // próxima versão (varredura headless). Por ora, sem achados falsos aqui.
    textElements: [],
    links: front.links,
    formFields: front.formFields,
    locale: front.lang, // usado pelo fixer para definir o idioma
  };
}

module.exports = {
  isConfigured,
  HOST,
  SCOPES,
  begin,
  callback,
  getToken,
  knownShops,
  loadRealStore,
};
