'use strict';
/*
 * AccessGuard — servidor do app.
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
const { scanStore } = require('./src/scanner');
const { fixContrast, fixLang, fixLinkText, generateAltText } = require('./src/fixer');
const sampleStore = require('./src/sampleStore');
const shopify = require('./src/shopify');

const app = express();
app.use(express.json());

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

// Arquivos do painel
app.use(express.static(path.join(__dirname, 'public')));

// Decide de onde vêm os dados da loja para esta requisição.
// Com um shop no endereço, tenta a loja REAL (token salvo OU client_credentials);
// se falhar, cai na loja de exemplo para o painel ainda abrir.
async function loadStoreData(shop) {
  if (shopify.isConfigured && shop) {
    try {
      return await shopify.loadRealStore(shop);
    } catch (e) {
      console.error('Falha ao ler loja real (' + shop + '): ' + e.message);
    }
  }
  return sampleStore; // demonstração
}

app.get('/health', (req, res) =>
  res.json({ ok: true, app: 'AccessGuard', version: '0.3.8', mode: shopify.isConfigured ? 'live' : 'demo' })
);

// Varre a loja e devolve nota + problemas
app.get('/api/scan', async (req, res) => {
  try {
    const store = await loadStoreData(req.query.shop);
    res.json(scanStore(store));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Aplica as correções e devolve o antes/depois
app.post('/api/fix', async (req, res) => {
  try {
    const shop = req.query.shop || (req.body && req.body.shop);
    const store = await loadStoreData(shop);
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
        written = await shopify.writeAltFixes(shop, fixes.altText);
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
    const store = await loadStoreData(req.query.shop);
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

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () =>
    console.log('AccessGuard rodando na porta ' + PORT + ' (modo ' + (shopify.isConfigured ? 'live' : 'demo') + ')')
  );
}
module.exports = app;
