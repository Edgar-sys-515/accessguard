'use strict';
/*
 * AccessGuard — corretor (a parte que CONSERTA os problemas).
 * - Contraste de cor: cálculo puro (sem IA) — encontra a cor que passa no WCAG.
 * - Idioma da página: define o atributo.
 * - Texto de link vago: reescreve a partir do destino.
 * - Texto alternativo de imagem: usa IA de visão (ligada no deploy); aqui há um fallback.
 */
const { contrastRatio } = require('./scanner');

function hexToRgb(hex) {
  hex = String(hex).replace('#', '').trim();
  if (hex.length === 3) hex = hex.split('').map((x) => x + x).join('');
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) {
  const h = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

// Ajusta a cor do texto até passar no contraste mínimo (tenta escurecer e clarear; pega o que muda menos)
function fixContrast(fg, bg, large = false) {
  const min = large ? 3 : 4.5;
  if (contrastRatio(fg, bg) >= min) return { color: fg, changed: false };
  const { r, g, b } = hexToRgb(fg);
  let dark = null, light = null;
  for (let t = 1; t <= 100; t++) {
    const f = 1 - t / 100;
    const cand = rgbToHex(r * f, g * f, b * f);
    if (contrastRatio(cand, bg) >= min) { dark = { cand, dist: t }; break; }
  }
  for (let t = 1; t <= 100; t++) {
    const f = t / 100;
    const cand = rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
    if (contrastRatio(cand, bg) >= min) { light = { cand, dist: t }; break; }
  }
  let pick;
  if (dark && light) pick = dark.dist <= light.dist ? dark.cand : light.cand;
  else pick = (dark || light || { cand: '#000000' }).cand;
  return { color: pick, changed: true, ratio: Math.round(contrastRatio(pick, bg) * 100) / 100 };
}

function fixLang(shopLocale) {
  return shopLocale || 'en';
}

// Reescreve link vago usando o destino (heurística + IA no deploy)
function fixLinkText(link) {
  const href = String(link.href || '');
  const map = [
    [/collections\/all/i, 'Ver todos os produtos'],
    [/collections\/([\w-]+)/i, (m) => 'Ver a coleção ' + m[1].replace(/-/g, ' ')],
    [/pages\/about/i, 'Conheça a loja'],
    [/pages\/([\w-]+)/i, (m) => 'Ir para ' + m[1].replace(/-/g, ' ')],
    [/products\/([\w-]+)/i, (m) => 'Ver ' + m[1].replace(/-/g, ' ')],
  ];
  for (const [re, val] of map) {
    const m = href.match(re);
    if (m) return typeof val === 'function' ? val(m) : val;
  }
  return 'Saiba mais sobre esta página';
}

// ---------- IA de visão (descreve a imagem para virar texto alternativo) ----------
// Suporta OpenAI (GPT) ou Anthropic (Claude). A imagem vai pela URL pública da Shopify.
function altPrompt(product) {
  return (
    'Você gera texto alternativo (alt text) para acessibilidade. OLHE a imagem e descreva ' +
    'APENAS o que está visível nela (o objeto principal, cores, contexto), em no máximo 125 caracteres, ' +
    'para uma pessoa que não pode vê-la. Baseie-se no que a imagem mostra, não em suposições. ' +
    'O nome do produto é só um contexto e PODE NÃO corresponder à imagem — se divergir, descreva a IMAGEM, ignore o nome. ' +
    'Nome do produto (contexto): "' + product + '". ' +
    'Não comece com "imagem de" ou "foto de". Responda somente com o texto alternativo, sem aspas.'
  );
}

async function altViaOpenAI(key, src, product, model) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      max_tokens: 120,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: altPrompt(product) },
            { type: 'image_url', image_url: { url: src } },
          ],
        },
      ],
    }),
  });
  if (!r.ok) throw new Error('OpenAI ' + r.status + ': ' + (await r.text()));
  const data = await r.json();
  return data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
}

async function altViaAnthropic(key, src, product, model) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-3-5-haiku-latest',
      max_tokens: 120,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: altPrompt(product) },
            { type: 'image', source: { type: 'url', url: src } },
          ],
        },
      ],
    }),
  });
  if (!r.ok) throw new Error('Anthropic ' + r.status + ': ' + (await r.text()));
  const data = await r.json();
  return data && data.content && data.content[0] && data.content[0].text;
}

// Gera texto alternativo. Com chave de IA, descreve a imagem; sem chave, usa fallback.
async function generateAltText(product, image, opts = {}) {
  const key = opts.aiKey;
  const src = image && image.src;
  if (key && src) {
    const provider = (opts.provider || process.env.AI_PROVIDER || 'openai').toLowerCase();
    const model = opts.model || process.env.AI_MODEL || null;
    try {
      const text = provider === 'anthropic'
        ? await altViaAnthropic(key, src, product, model)
        : await altViaOpenAI(key, src, product, model);
      if (text && text.trim()) return text.trim().replace(/^["']+|["']+$/g, '').slice(0, 250);
    } catch (e) {
      console.error('IA alt text falhou:', e.message);
    }
  }
  return `${product} — foto do produto`;
}

module.exports = { fixContrast, fixLang, fixLinkText, generateAltText };
