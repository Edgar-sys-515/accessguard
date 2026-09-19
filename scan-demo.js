'use strict';
/* Demo: roda o motor na loja de exemplo e imprime o relatório. */
const { scanStore } = require('./src/scanner');
const store = require('./src/sampleStore');

const dot = { critical: '🔴', serious: '🟠', moderate: '🔵' };

const result = scanStore(store);

console.log('\n==================================================');
console.log('  AccessGuard — Relatório de Acessibilidade');
console.log('  Loja: ' + store.shop);
console.log('==================================================\n');
console.log('  NOTA: ' + result.score + '/100');
console.log('  Problemas: ' +
  result.counts.critical + ' críticos · ' +
  result.counts.serious + ' sérios · ' +
  result.counts.moderate + ' moderados\n');
console.log('  Detalhes:');
for (const i of result.issues) {
  console.log('   ' + (dot[i.severity] || '•') + ' [' + i.severity.toUpperCase() + '] ' + i.title +
    (i.autofix ? '  → corrigível por IA' : ''));
}
console.log('\n  Exemplo — imagens sem texto alternativo (a IA vai escrever a descrição de cada uma):');
const alt = result.issues.find((i) => i.id === 'alt');
if (alt) alt.details.slice(0, 3).forEach((d) => console.log('     • ' + d.product + '  (' + d.src + ')'));
console.log('\n  Exemplo — contraste baixo (a IA sugere a cor certa):');
const c = result.issues.find((i) => i.id === 'contrast');
if (c) c.details.forEach((d) => console.log('     • ' + d.where + ': razão ' + d.ratio + ':1 (mínimo ' + d.min + ':1)'));
console.log('\n==================================================\n');
