# App nº 2 — Mapa de oportunidades (pesquisa de dores reais)

Baseado em reclamações reais de lojistas: avaliações negativas de apps na Shopify App Store e discussões em fóruns. A ideia não é inventar categoria nova — é achar onde os apps atuais falham e ganhar por **execução**.

---

## As dores que encontrei (com evidência)

### 1. Edição em massa de produtos (bulk edit) — a mais promissora
Os apps existem, mas **falham na confiança**. Das avaliações negativas:
- **"Undo" que não desfaz de verdade** — um lojista reverteu e só 25% dos itens voltaram; falhas silenciosas onde parecia que reverteu mas os preços continuaram errados.
- **Updates parciais** — o app diz "concluído com sucesso", mas só parte das variantes muda.
- **Aplicação dupla silenciosa** — 10% de desconto virou 19% em parte do catálogo, e o lojista só descobriu meses depois.
- **"Bait and switch" de preço** — apps que eram grátis e viraram pagos, quebrando o fluxo de quem dependia deles.

👉 Resumindo a dor: **"o app diz que fez, mas não fez direito — e eu não consigo desfazer nem saber o que mudou."**

### 2. Migração / importação de dados
- Migra só o **título** do produto — perde imagens, descrições, preços, estoque e frete.
- Exige limpeza manual enorme depois ("migrei 500 produtos e tive que inserir 500 imagens na mão").
- Documentação promete API que não existe.

👉 Dor forte, mas: é um app usado **uma vez** por cliente (não gera assinatura recorrente) e é **muito difícil** de fazer bem (casos-borda infinitos). Bom moat, modelo de receita fraco.

### 3. Lentidão da loja / "app bloat"
- Apps deixam a loja lenta e o lojista não sabe qual é o culpado.
- Demanda por uma ferramenta que **audita e mostra qual app está pesando**. Já existe concorrente ("Store Auditor").

👉 Nicho válido, mas menos alinhado com o que você já sabe fazer (é análise de tema/scripts, não ler/gravar produtos).

### 4. Store credit / gift card
- Bugs financeiros (cliente resgatou mais crédito do que tinha, prejuízo de ~US$1.500), custos que explodem no volume real, problemas fiscais.

👉 Mexe com **dinheiro e imposto** — arriscado demais pra segundo app.

### Problemas "sem dono" citados por lojistas
Preços complexos (desconto por variante/volume), e fluxos fragmentados (trocas, comissões, atendimento em WhatsApp/SMS espalhados em várias abas).

---

## Análise contra os seus critérios

| Oportunidade | Reaproveita sua stack? | Receita recorrente? | Defensável? | Dificuldade de construir |
|---|---|---|---|---|
| **Bulk edit confiável** | ✅ Muito (ler/gravar produtos via API, igual AllyFix) | ✅ Sim (edita o tempo todo) | ✅ Sim (confiabilidade) | Média |
| Migração de dados | ⚠️ Parcial | ❌ Uso único | ✅ Alto (difícil) | Alta |
| Auditoria de velocidade | ❌ Stack diferente | ✅ Sim | ⚠️ Já tem concorrente | Média |
| Store credit | ⚠️ Parcial | ✅ Sim | ⚠️ | Alta + risco financeiro |

---

## 🏆 Recomendação: um editor em massa **confiável**

É o que melhor combina com você: **reaproveita quase todo o código do AllyFix** (o app já lê e grava produtos via Admin API), a dor é clara e documentada, e — o mais importante — os concorrentes falham **exatamente** onde você pode ganhar: **confiança**.

O ângulo (a sua versão do "anti-overlay"):
- **Pré-visualização antes de aplicar** — o lojista vê exatamente o que vai mudar, antes de mudar.
- **Undo que realmente funciona** — reverte 100%, sempre.
- **Histórico/log de auditoria** — registro do que mudou, quando e em quê, pra nunca mais "descobrir meses depois".
- Aguenta **volume grande** sem travar nem aplicar pela metade.

Isso ataca uma a uma as reclamações reais. É a mesma fórmula que te deu chance no AllyFix: categoria existente, mas com um ângulo que os outros executam mal. E dá pra apimentar com IA depois (sugerir preços, gerar tags em massa).

## Próximo passo (quando você decidir)
Antes de escrever código: eu leio **50–100 avaliações negativas dos líderes de bulk edit**, monto a lista exata de reclamações, e transformo isso na especificação do app — construímos mirando cada dor que o cliente já gritou que tem. Evidência primeiro, código depois.

---
Fontes: [Fórum Shopify — problema de $100/mês que nenhum app resolve](https://community.shopify.com/t/what-is-the-100-month-problem-that-no-app-has-solved-yet/577348) · [109 avaliações negativas de apps de bulk price](https://community.shopify.com/t/i-read-109-negative-reviews-of-bulk-price-and-store-credit-apps-sharing-what-i-found/659670) · [Avaliações do Store Migration](https://apps.shopify.com/store-migration/reviews) · [App bloat / lentidão](https://shopexperts.com/help/shopify-apps-slowing-store)
