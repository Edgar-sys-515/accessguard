# AllyFix — Guia de preenchimento da listagem (copie e cole)

Ordem igual à do menu lateral do formulário. Campos não citados = deixar em branco.

═══════════════════════════════════════
## 1) BASIC APP INFORMATION
═══════════════════════════════════════

**App name**
```
AllyFix
```

**App icon** — já sincronizado do Partner Dashboard (o ícone verde). Nada a fazer.

**App category → Primary category** → clica em "Select" e escolhe **Store design**
(se pedir subcategoria, use a mais próxima de acessibilidade/aparência da loja; se houver "Accessibility", escolha ela). Não precisa de categoria secundária.

**Languages** → seleciona **English**.

═══════════════════════════════════════
## 2) APP STORE LISTING CONTENT
═══════════════════════════════════════

**App introduction** (máx. 100)
```
AllyFix scans your store, fixes accessibility issues with AI, and keeps you EAA & WCAG compliant.
```

**App details** (máx. 500)
```
Accessibility is now the law. The European Accessibility Act requires online stores to be usable by people with disabilities. AllyFix scans your store against WCAG 2.1 AA, finds what's broken, and fixes it with AI: it looks at each product image and writes accurate alternative text, then saves it back to your store in one click. No code, no consultants, and no risky overlay widget — just a clear accessibility score and real fixes to your content that keep your store compliant.
```

**Features** (o form já tem 3; clique "+ Add" pra chegar a 5)
```
Feature 1: One-click accessibility scan with a clear 0–100 WCAG score
Feature 2: AI-generated alt text that describes what's actually in each product image
Feature 3: Writes fixes directly back to your products — no code or theme editing
Feature 4: Flags vague links, missing form labels, and language issues
Feature 5: Real content fixes to help you comply with the EAA — never an overlay widget
```

**Demo store URL** → deixar em branco.

**Feature media** → escolhe **Image** e sobe o arquivo:
`site\assets\shots\allyfix-screenshot-1.png`  (a versão com título — é o banner de destaque)

**Screenshots → Desktop screenshots** (sobe os 3 LIMPOS, com o alt text abaixo):
- SCREENSHOT 1 → `allyfix-clean-1.png`
  - alt (máx 64): `AllyFix dashboard showing accessibility issues and a WCAG score`
- SCREENSHOT 2 → `allyfix-clean-2.png`
  - alt: `AI-generated alt text saved to product images in AllyFix`
- SCREENSHOT 3 → `allyfix-clean-3.png`
  - alt: `AllyFix dashboard showing a compliant store with a score of 100`

(Mobile screenshots e POS → deixar em branco.)

**Integrations** → deixar em branco.

**Support → Preferred support channel** → marca "Support email address":
```
edgomendes@gmail.com
```
(troca por support@allyfix.shop quando criar o e-mail do domínio.)

**Resources**
- Privacy policy URL:
```
https://allyfix.shop/privacy
```
- Developer website (optional):
```
https://allyfix.shop
```
- FAQ / Changelog / Tutorial / Additional docs → em branco.

═══════════════════════════════════════
## 3) PRICING DETAILS
═══════════════════════════════════════

Clica em **"Manage"** e adiciona **1 plano público**:
- Nome do plano: `AllyFix Pro`
- Preço: `$39.00 USD / month`
- Free trial: `7 days`
- (Descrição, se pedir): `Unlimited accessibility scans and AI fixes.`

- "Provide a URL where merchants can find more pricing information" → em branco.
- "I have approval to charge merchants outside of the Shopify Billing API" → **NÃO marcar** (usamos Shopify Billing).

═══════════════════════════════════════
## 4) APP DISCOVERY CONTENT
═══════════════════════════════════════

**App card subtitle** (máx. 62)
```
Fix accessibility with AI. Stay EAA & WCAG compliant.
```

**App store search terms** (clica "+ Add" pra cada um)
```
accessibility
alt text
EAA
WCAG
ADA compliance
```

**Web search content** (optional)
- Title tag (máx 60):
```
AllyFix — AI Accessibility for Shopify
```
- Meta description (máx 160):
```
AllyFix scans your store, fixes accessibility issues with AI, and keeps you compliant with the EAA and WCAG 2.1 AA. 7-day free trial.
```

═══════════════════════════════════════
## 5) INSTALL REQUIREMENTS
═══════════════════════════════════════

**Sales channel requirements** → marca **"My app doesn't require the Shopify Online Store or Shopify POS"**
(o AllyFix corrige o alt text pela Admin API, não edita o tema.)

**Geographic requirements** → deixar tudo desmarcado (é global).

═══════════════════════════════════════
## 6) TRACKING INFORMATION
═══════════════════════════════════════
Tudo opcional (Google Analytics, remarketing, Facebook Pixel) → deixar em branco.

═══════════════════════════════════════
## 7) CONTACT INFORMATION
═══════════════════════════════════════
- Merchant review email:
```
edgomendes@gmail.com
```
- App submission email:
```
edgomendes@gmail.com
```

═══════════════════════════════════════
## 8) APP TESTING INFORMATION
═══════════════════════════════════════

**Test account** → marca **"My app doesn't require an account to use it"**
(o app é embutido, usa a sessão da própria Shopify — não tem login próprio.)

**Screencast URL** → em branco por ora (é opcional; se a revisão pedir, gravamos depois).

**Testing instructions** (cola isto)
```
AllyFix is an embedded app — no separate login is required; it uses the store's Shopify session.

To test:
1. Install AllyFix on a development store that has at least one product with an image missing alt text.
2. Open AllyFix from the store admin (Apps > AllyFix).
3. The dashboard automatically runs an accessibility scan and shows a WCAG 2.1 AA score plus a list of issues.
4. Click "Fix all with AI". AllyFix generates descriptive alternative text for each product image and writes it back to the products; the score updates to reflect the fixes.
5. Billing: if no subscription is active, a "Start free trial" prompt appears. Selecting it opens Shopify's standard subscription approval screen (7-day free trial, then $39/month). Billing is handled entirely through the Shopify Billing API.

Note: AllyFix does not access any customer personal data — only products, product images, and public storefront content.
```

═══════════════════════════════════════
Ao final, clica em **Save**. Depois voltamos ao checklist pra rodar as
**Verificações automáticas** (que testam os webhooks + HMAC + TLS) e enviar.
═══════════════════════════════════════
