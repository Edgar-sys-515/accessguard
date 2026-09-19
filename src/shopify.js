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

// Atalho: token de um "app personalizado" criado dentro da loja (sem OAuth).
// É o jeito mais simples de ler a própria loja — sem instalar, sem distribuição.
const STATIC_TOKEN = process.env.SHOP_ADMIN_TOKEN || '';
const STATIC_SHOP = (process.env.SHOP_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');

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

// Token por client_credentials — é assim que um app do Dev Dashboard acessa as
// PRÓPRIAS lojas (mesma organização). O app troca Client ID + Secret por um
// token, sem tela de autorização. O token dura ~24h; guardamos em memória.
const ccCache = new Map(); // shop -> { token, exp }
async function clientCredentialsToken(shop) {
  const cached = ccCache.get(shop);
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const r = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: API_KEY, client_secret: API_SECRET, grant_type: 'client_credentials' }),
  });
  if (!r.ok) throw new Error('client_credentials falhou (' + r.status + '): ' + (await r.text()));
  const data = await r.json();
  const ttl = data.expires_in ? data.expires_in * 1000 : 23 * 3600 * 1000;
  ccCache.set(shop, { token: data.access_token, exp: Date.now() + ttl });
  return data.access_token;
}

// Descobre o access token da loja: primeiro o salvo (OAuth de lojista externo,
// via App Store); senão tenta client_credentials (loja própria da organização).
async function accessTokenFor(shop) {
  // 1) Token do app personalizado (mais simples, pra loja própria)
  if (STATIC_TOKEN && (!STATIC_SHOP || shop === STATIC_SHOP)) return STATIC_TOKEN;
  // 2) Token salvo (OAuth de lojista externo, via App Store)
  const t = getToken(shop);
  if (t && t.accessToken) return t.accessToken;
  // 3) client_credentials (loja própria da organização, se o app estiver instalado)
  return clientCredentialsToken(shop);
}

// Monta uma "session" para chamar a Admin API.
async function sessionFor(shop) {
  const accessToken = await accessTokenFor(shop);
  return new Session({
    id: `offline_${shop}`,
    shop,
    state: 'offline',
    isOnline: false,
    accessToken,
    scope: SCOPES.join(','),
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
  // API nova da Shopify: as imagens do produto vêm por "media" (MediaImage).
  const query = `{
    products(first: 50) {
      edges { node {
        title
        media(first: 20) { edges { node { ... on MediaImage { image { url altText } } } } }
      } }
    }
  }`;
  const resp = await client.request(query);
  if (resp && resp.errors) console.error('GraphQL products errors:', JSON.stringify(resp.errors));
  const edges = (resp && resp.data && resp.data.products && resp.data.products.edges) || [];
  return edges.map((e) => ({
    id: e.node.id,
    title: e.node.title,
    images: ((e.node.media && e.node.media.edges) || [])
      .map((m) => m.node)
      .filter((n) => n && n.image)
      .map((n) => ({ mediaId: n.id, src: n.image.url, alt: n.image.altText || '' })),
  }));
}

// GRAVA o texto alternativo de volta na loja (a correção "de verdade").
// Precisa do escopo write_products no app.
async function writeAltFixes(shop, items) {
  const list = (items || []).filter((it) => it && it.productId && it.mediaId);
  if (!list.length) return { applied: 0, errors: [] };
  const session = await sessionFor(shop);
  const client = new shopify.clients.Graphql({ session });
  const mutation = `mutation($productId: ID!, $media: [UpdateMediaInput!]!) {
    productUpdateMedia(productId: $productId, media: $media) {
      media { ... on MediaImage { id alt } }
      mediaUserErrors { field message }
    }
  }`;
  let applied = 0;
  const errors = [];
  for (const it of list) {
    try {
      const resp = await client.request(mutation, {
        variables: { productId: it.productId, media: [{ id: it.mediaId, alt: it.alt }] },
      });
      const ue =
        (resp && resp.data && resp.data.productUpdateMedia && resp.data.productUpdateMedia.mediaUserErrors) || [];
      if (ue.length) errors.push(...ue.map((e) => e.message));
      else applied++;
    } catch (e) {
      errors.push(e.message);
    }
  }
  return { applied, errors };
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
  const session = await sessionFor(shop);

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
  writeAltFixes,
};
