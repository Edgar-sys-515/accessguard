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

// Gera texto alternativo. Versão real chama IA de visão; sem chave, usa fallback descritivo.
async function generateAltText(product, image, opts = {}) {
  if (opts.aiKey) {
    // No deploy: envia a imagem + contexto do produto para a IA de visão e recebe a descrição.
    // (integração ligada com a chave; omitida aqui de propósito)
  }
  return `${product} — foto do produto`;
}

module.exports = { fixContrast, fixLang, fixLinkText, generateAltText };
