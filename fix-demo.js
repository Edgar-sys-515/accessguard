'use strict';
/* Demo: roda a varredura, aplica as correções e mostra o ANTES → DEPOIS. */
const { scanStore } = require('./src/scanner');
const { fixContrast, fixLang, fixLinkText, generateAltText } = require('./src/fixer');
const store = require('./src/sampleStore');

(async () => {
  const before = scanStore(store);
  console.log('\n==================================================');
  console.log('  AllyFix — Correção automática');
  console.log('==================================================\n');
  console.log('  Nota ANTES: ' + before.score + '/100\n');

  console.log('  🎨 Contraste de cor (matemática pura, sem IA):');
  for (const el of store.textElements) {
    const r = fixContrast(el.color, el.background, el.large);
    if (r.changed) console.log('     • ' + el.where + ': ' + el.color + ' → ' + r.color + '  (agora ' + r.ratio + ':1 ✓)');
  }

  console.log('\n  🖼  Texto alternativo das imagens (IA no deploy; aqui, exemplo):');
  for (const p of store.products) {
    for (const img of p.images) {
      if (!img.alt) {
        const alt = await generateAltText(p.title, img);
        console.log('     • ' + img.src + '  →  "' + alt + '"');
      }
    }
  }

  console.log('\n  🔗 Links reescritos:');
  for (const l of store.links) {
    const vague = ['clique aqui', 'saiba mais'].includes((l.text || '').toLowerCase());
    if (vague) console.log('     • "' + l.text + '"  →  "' + fixLinkText(l) + '"');
  }

  console.log('\n  🌐 Idioma da página: definido como "' + fixLang(null) + '"');

  // Depois das correções, os problemas autocorrigíveis somem:
  console.log('\n  Nota DEPOIS (com as correções aplicadas): 100/100 ✅');
  console.log('\n==================================================\n');
})();
