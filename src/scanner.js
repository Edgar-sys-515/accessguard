'use strict';
/*
 * AllyFix — motor de acessibilidade (núcleo do app)
 * Verifica uma loja contra critérios do WCAG 2.1 AA / EAA.
 * Este módulo é "puro": recebe os dados da loja e devolve os problemas.
 * Depois ele é ligado à API da Shopify (para ler a loja de verdade) e à IA (para corrigir).
 */

// ---------- Cálculo de contraste de cor (fórmula oficial do WCAG) ----------
function channelLum(c) {
  c = c / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function relLuminance({ r, g, b }) {
  return 0.2126 * channelLum(r) + 0.7152 * channelLum(g) + 0.0722 * channelLum(b);
}
function hexToRgb(hex) {
  hex = String(hex).replace('#', '').trim();
  if (hex.length === 3) hex = hex.split('').map((x) => x + x).join('');
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function contrastRatio(fg, bg) {
  const L1 = relLuminance(hexToRgb(fg));
  const L2 = relLuminance(hexToRgb(bg));
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------- Verificações individuais ----------
function checkAltText(products = []) {
  const missing = [];
  for (const p of products) {
    for (const img of p.images || []) {
      if (!img.alt || String(img.alt).trim() === '') {
        missing.push({ product: p.title, src: img.src });
      }
    }
  }
  return missing;
}

function checkContrast(textElements = []) {
  const fails = [];
  for (const el of textElements) {
    const ratio = contrastRatio(el.color, el.background);
    const min = el.large ? 3 : 4.5; // WCAG AA: texto grande 3:1, normal 4.5:1
    if (ratio < min) {
      fails.push({
        where: el.where,
        color: el.color,
        background: el.background,
        ratio: Math.round(ratio * 100) / 100,
        min,
      });
    }
  }
  return fails;
}

function checkLinkText(links = []) {
  const vague = ['click here', 'clique aqui', 'read more', 'leia mais', 'saiba mais', 'here', 'aqui', 'link', 'this'];
  return links.filter((l) => vague.includes(String(l.text || '').trim().toLowerCase()));
}

function checkFormLabels(fields = []) {
  return fields.filter((f) => !f.label || String(f.label).trim() === '');
}

function checkLang(theme = {}) {
  return theme.lang ? [] : [{ issue: 'A página não declara o idioma (<html lang>)' }];
}

// ---------- Varredura completa ----------
function scanStore(store) {
  const altMissing = checkAltText(store.products);
  const contrastFails = checkContrast(store.textElements);
  const vagueLinks = checkLinkText(store.links);
  const labelMissing = checkFormLabels(store.formFields);
  const langIssues = checkLang(store.theme);

  const issues = [];
  if (labelMissing.length)
    issues.push({ id: 'labels', severity: 'critical', title: `${labelMissing.length} campos de formulário sem rótulo`, autofix: true, weight: 20, details: labelMissing });
  if (altMissing.length)
    issues.push({ id: 'alt', severity: 'serious', title: `${altMissing.length} imagens de produto sem texto alternativo`, autofix: true, weight: 20, details: altMissing });
  if (contrastFails.length)
    issues.push({ id: 'contrast', severity: 'serious', title: `${contrastFails.length} textos com contraste de cor baixo`, autofix: true, weight: 15, details: contrastFails });
  if (vagueLinks.length)
    issues.push({ id: 'links', severity: 'moderate', title: `${vagueLinks.length} links com texto pouco claro`, autofix: true, weight: 8, details: vagueLinks });
  if (langIssues.length)
    issues.push({ id: 'lang', severity: 'moderate', title: `Página sem idioma declarado`, autofix: true, weight: 5, details: langIssues });

  const penalty = issues.reduce((s, i) => s + i.weight, 0);
  const score = Math.max(0, 100 - penalty);
  const counts = {
    critical: issues.filter((i) => i.severity === 'critical').length,
    serious: issues.filter((i) => i.severity === 'serious').length,
    moderate: issues.filter((i) => i.severity === 'moderate').length,
  };
  return { score, counts, issues };
}

module.exports = { scanStore, contrastRatio, checkAltText, checkContrast };
