# AccessGuard

App de acessibilidade com IA para lojas **Shopify** — varre a loja, encontra problemas
de acessibilidade (WCAG 2.1 AA / European Accessibility Act) e **corrige** com IA.

> Nome provisório. Produto self-serve, global, publicado na Shopify App Store.

## Estado atual
- ✅ **Motor de varredura** (`src/scanner.js`) — detecta: imagens sem texto alternativo,
  contraste de cor baixo (cálculo oficial do WCAG), campos de formulário sem rótulo,
  links com texto vago, página sem idioma declarado. Gera uma **nota de 0 a 100**.
- ✅ **Corretor** (`src/fixer.js`) — calcula a cor que passa no contraste (matemática pura),
  reescreve links, define o idioma, e gera texto alternativo (IA de visão ligada no deploy).
- ⬜ Empacotar como app Shopify (OAuth + painel embutido) e hospedar.

## Rodar as demos
```bash
npm run scan   # relatório de problemas na loja de exemplo
npm run fix    # aplica as correções (antes → depois)
```

## Estrutura
- `src/scanner.js` — motor de detecção
- `src/fixer.js` — motor de correção
- `src/sampleStore.js` — loja de exemplo para testes
- `scan-demo.js`, `fix-demo.js` — demonstrações
