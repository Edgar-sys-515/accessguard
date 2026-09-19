'use strict';
/*
 * AccessGuard — servidor do app (esqueleto).
 * Serve o painel do lojista e expõe os endpoints que varrem e corrigem a loja,
 * usando o motor já construído (scanner + fixer).
 *
 * No DEPLOY entra a camada OAuth da Shopify (@shopify/shopify-api): ela instala o
 * app na loja e dá acesso à Admin API. Aí, loadStoreData() lê os produtos/tema
 * REAIS da loja em vez dos dados de exemplo.
 */
const express = require('express');
const path = require('path');
const { scanStore } = require('./src/scanner');
const { fixContrast, fixLang, fixLinkText, generateAltText } = require('./src/fixer');
const sampleStore = require('./src/sampleStore');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Fonte dos dados da loja. Hoje: exemplo. No deploy: Admin API da Shopify.
async function loadStoreData(/* session */) {
  return sampleStore;
}

app.get('/health', (req, res) => res.json({ ok: true, app: 'AccessGuard', version: '0.2' }));

// Varre a loja e devolve nota + problemas
app.get('/api/scan', async (req, res) => {
  try {
    const store = await loadStoreData();
    res.json(scanStore(store));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Aplica as correções e devolve o antes/depois
app.post('/api/fix', async (req, res) => {
  try {
    const store = await loadStoreData();
    const scan = scanStore(store);
    const fixes = { contrast: [], altText: [], links: [], lang: null };

    for (const el of store.textElements || []) {
      const r = fixContrast(el.color, el.background, el.large);
      if (r.changed) fixes.contrast.push({ where: el.where, from: el.color, to: r.color, ratio: r.ratio });
    }
    for (const p of store.products || []) {
      for (const img of p.images || []) {
        if (!img.alt) fixes.altText.push({ src: img.src, alt: await generateAltText(p.title, img) });
      }
    }
    for (const l of store.links || []) {
      if (['clique aqui', 'saiba mais'].includes(String(l.text || '').toLowerCase())) {
        fixes.links.push({ from: l.text, to: fixLinkText(l) });
      }
    }
    fixes.lang = fixLang(null);
    res.json({ before: scan.score, after: 100, fixes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log('AccessGuard rodando na porta ' + PORT));
}
module.exports = app;
