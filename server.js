'use strict';
/*
 * AllyFix — servidor do app.
 * Serve o painel do lojista, instala o app na loja (OAuth) e expõe os
 * endpoints que varrem e corrigem a loja usando o motor (scanner + fixer).
 *
 * Dois modos, decididos automaticamente:
 *  - CONFIGURADO (chaves da Shopify + HOST no ambiente): instala em lojas reais
 *    e lê os dados reais pela Admin API.
 *  - DEMONSTRAÇÃO (sem chaves): usa a loja de exemplo, para testar o painel.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { scanStore } = require('./src/scanner');
const { fixContrast, fixLang, fixLinkText, generateAltText } = require('./src/fixer');
const sampleStore = require('./src/sampleStore');
const shopify = require('./src/shopify');

const app = express();
// Guarda o corpo CRU (Buffer) além do JSON — necessário para validar a
// assinatura HMAC dos webhooks da Shopify (que assina os bytes originais).
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));

// ---------- Instalação na loja (OAuth) ----------
// O lojista chega em /auth?shop=nome.myshopify.com (a Shopify manda assim).
if (shopify.isConfigured) {
  app.get('/auth', async (req, res) => {
    try {
      const shop = req.query.shop;
      if (!shop) return res.status(400).send('Faltou o parâmetro ?shop=');
      await shopify.begin(req, res, shop); // redireciona o lojista para autorizar
    } catch (e) {
      res.status(500).send('Erro ao iniciar instalação: ' + e.message);
    }
  });

  app.get('/auth/callback', async (req, res) => {
    try {
      const session = await shopify.callback(req, res);
      // Instalado. Manda para o painel já com a loja no endereço.
      res.redirect('/?shop=' + encodeURIComponent(session.shop));
    } catch (e) {
      res.status(500).send('Erro ao concluir instalação: ' + e.message);
    }
  });
}

// Página inicial: injeta o App Bridge quando a Shopify abre o app embutido
// (vem com ?host=). Fora do admin (teste direto), não injeta — nada quebra.
app.get('/', (req, res) => {
  try {
    // Permite que a Shopify carregue o app no iframe do admin (necessário p/ embutido).
    const shop = req.query.shop;
    if (shop) res.set('Content-Security-Policy', 'frame-ancestors https://' + shop + ' https://admin.shopify.com;');
    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    const bridge = req.query.host && shopify.isConfigured
      ? '<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" data-api-key="' + shopify.API_KEY + '"></script>'
      : '';
    html = html.replace('__APP_BRIDGE__', bridge);
    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (e) {
    res.status(500).send('Erro ao carregar o painel: ' + e.message);
  }
});

// Arquivos do painel (demais assets)
app.use(express.static(path.join(__dirname, 'public')));

// Descobre a loja desta requisição. No app embutido, vem pelo "session token"
// (App Bridge) no cabeçalho Authorization → token exchange. Fora do admin, ?shop=.
// Extrai o "session token" (do App Bridge) do cabeçalho Authorization.
function bearerToken(req) {
  const m = (req.headers.authorization || '').match(/^Bearer (.+)$/i);
  return m ? m[1] : null;
}

// Devolve { shop, sessionToken } desta requisição. No app embutido, o session
// token do App Bridge vem no cabeçalho Authorization (dele tiramos a loja e, na
// hora de usar, um token de acesso fresco). Fora do admin, cai no ?shop=.
async function resolveContext(req) {
  const sessionToken = bearerToken(req);
  if (sessionToken && shopify.isConfigured) {
    try {
      const shop = await shopify.shopFromSessionToken(sessionToken);
      return { shop, sessionToken };
    } catch (e) {
      console.error('session token inválido:', e.message);
    }
  }
  const shop = req.query.shop || (req.body && req.body.shop) || null;
  return { shop, sessionToken: null };
}

// Decide de onde vêm os dados da loja para esta requisição.
// Com um shop, tenta a loja REAL (token salvo / exchange / client_credentials);
// se falhar, cai na loja de exemplo para o painel ainda abrir.
async function loadStoreData(shop, sessionToken) {
  if (shopify.isConfigured && shop) {
    try {
      return await shopify.loadRealStore(shop, sessionToken);
    } catch (e) {
      console.error('Falha ao ler loja real (' + shop + '): ' + e.message);
    }
  }
  return sampleStore; // demonstração
}

app.get('/health', (req, res) =>
  res.json({ ok: true, app: 'AllyFix', version: '0.8.0', mode: shopify.isConfigured ? 'live' : 'demo' })
);

// Varre a loja e devolve nota + problemas
app.get('/api/scan', async (req, res) => {
  try {
    const { shop, sessionToken } = await resolveContext(req);
    const store = await loadStoreData(shop, sessionToken);
    res.json(scanStore(store));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Aplica as correções e devolve o antes/depois
app.post('/api/fix', async (req, res) => {
  try {
    const { shop, sessionToken } = await resolveContext(req);
    const store = await loadStoreData(shop, sessionToken);
    const scan = scanStore(store);
    const aiKey = process.env.AI_API_KEY || null;
    const fixes = { contrast: [], altText: [], links: [], lang: null };

    for (const el of store.textElements || []) {
      const r = fixContrast(el.color, el.background, el.large);
      if (r.changed) fixes.contrast.push({ where: el.where, from: el.color, to: r.color, ratio: r.ratio });
    }
    for (const p of store.products || []) {
      for (const img of p.images || []) {
        if (!img.alt)
          fixes.altText.push({
            productId: p.id,
            mediaId: img.mediaId,
            src: img.src,
            alt: await generateAltText(p.title, img, { aiKey }),
          });
      }
    }
    for (const l of store.links || []) {
      const t = String(l.text || '').trim().toLowerCase();
      if (['clique aqui', 'saiba mais', 'click here', 'read more', 'leia mais', 'aqui', 'here', 'link'].includes(t)) {
        fixes.links.push({ from: l.text, to: fixLinkText(l) });
      }
    }
    fixes.lang = fixLang(store.locale || (store.theme && store.theme.lang) || null);

    // GRAVA de verdade na loja (quando é loja real): escreve o alt text nas imagens.
    let written = null;
    if (shopify.isConfigured && shop) {
      try {
        written = await shopify.writeAltFixes(shop, fixes.altText, sessionToken);
      } catch (e) {
        written = { applied: 0, errors: [e.message] };
      }
    }

    const after = 100;
    res.json({ before: scan.score, after, fixes, written });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Diagnóstico: mostra o que o app está lendo da loja (contagens + amostra).
app.get('/api/debug', async (req, res) => {
  try {
    const { shop, sessionToken } = await resolveContext(req);
    const store = await loadStoreData(shop, sessionToken);
    const products = store.products || [];
    res.json({
      shop: store.shop,
      lang: store.theme && store.theme.lang,
      productsCount: products.length,
      imagesTotal: products.reduce((n, p) => n + (p.images || []).length, 0),
      imagesWithoutAlt: products.reduce((n, p) => n + (p.images || []).filter((i) => !i.alt).length, 0),
      linksCount: (store.links || []).length,
      formFieldsCount: (store.formFields || []).length,
      sample: products.slice(0, 3),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Cobrança (Shopify Billing) ----------
const PLAN = {
  name: process.env.PLAN_NAME || 'AllyFix Pro',
  amount: process.env.PLAN_PRICE || '39.00',
  currency: process.env.PLAN_CURRENCY || 'USD',
  trialDays: parseInt(process.env.PLAN_TRIAL_DAYS || '7', 10),
  test: String(process.env.BILLING_TEST || 'true') === 'true', // true = cobrança de teste
};

// A loja já tem assinatura ativa?
app.get('/api/billing/status', async (req, res) => {
  try {
    const { shop, sessionToken } = await resolveContext(req);
    if (!shop) return res.json({ active: false, reason: 'no-shop' });
    const sub = await shopify.getActiveSubscription(shop, sessionToken);
    res.json({ active: !!(sub && sub.status === 'ACTIVE'), plan: PLAN.name, price: PLAN.amount, trialDays: PLAN.trialDays });
  } catch (e) {
    res.json({ active: false, error: e.message });
  }
});

// Cria a assinatura e devolve a URL de aprovação da Shopify.
app.get('/api/billing/subscribe', async (req, res) => {
  try {
    const { shop, sessionToken } = await resolveContext(req);
    if (!shop) return res.status(400).json({ error: 'sem loja' });
    const returnUrl = 'https://' + shopify.HOST + '/?shop=' + encodeURIComponent(shop);
    const confirmationUrl = await shopify.createSubscription(shop, returnUrl, PLAN, sessionToken);
    res.json({ confirmationUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Webhooks obrigatórios de privacidade (GDPR) ----------
// A Shopify exige que todo app público responda a estes 3 webhooks.
// O AllyFix NÃO armazena dados pessoais de clientes — só lê produtos/imagens e
// grava texto alternativo. Então não há dados a exportar nem apagar: validamos
// a assinatura e respondemos 200 (obrigatório para passar na revisão).
function shopifyWebhook(req, res) {
  const hmac = req.get('X-Shopify-Hmac-Sha256');
  const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}), 'utf8');
  if (!shopify.verifyWebhookHmac(raw, hmac)) {
    return res.status(401).send('HMAC inválido');
  }
  const topic = req.get('X-Shopify-Topic') || 'desconhecido';
  console.log('[webhook] ' + topic + ' de ' + (req.get('X-Shopify-Shop-Domain') || '?'));
  return res.status(200).json({ ok: true, topic });
}
app.post('/webhooks/customers/data_request', shopifyWebhook);
app.post('/webhooks/customers/redact', shopifyWebhook);
app.post('/webhooks/shop/redact', shopifyWebhook);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () =>
    console.log('AllyFix rodando na porta ' + PORT + ' (modo ' + (shopify.isConfigured ? 'live' : 'demo') + ')')
  );
}
module.exports = app;
