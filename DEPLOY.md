# Como colocar o AllyFix no ar (passo a passo)

Guia feito sob medida para o seu cenário:

- **VPS Hostinger** — Ubuntu 24.04, acesso `root` por SSH, IP `31.97.243.139`
- Já roda **outros apps em Docker** nessa VPS (vamos conviver com eles)
- Domínio **discar.cloud** — vamos usar o subdomínio **accessguard.discar.cloud**
  (esse endereço é só técnico, o lojista não vê; quem instala o app é a Shopify)

A ideia: rodar o AllyFix como **mais um contêiner Docker**, ouvindo só no
localhost da VPS, e deixar o seu **reverse proxy** publicar ele na internet com
HTTPS no endereço `accessguard.discar.cloud`.

Faça na ordem. Se travar em algum passo, me manda o print/erro que eu destravo.

---

## Passo 1 — Apontar o subdomínio para a VPS (DNS)

No painel de DNS do **discar.cloud** (Hostinger → Domínios → Zona DNS), crie um
registro do tipo **A**:

| Tipo | Nome         | Aponta para       | TTL    |
|------|--------------|-------------------|--------|
| A    | `accessguard`| `31.97.243.139`   | padrão |

Isso cria `accessguard.discar.cloud`. Pode levar de alguns minutos a algumas
horas para propagar. Para testar:

```bash
ping accessguard.discar.cloud
```

Quando responder com `31.97.243.139`, o DNS está pronto.

---

## Passo 2 — Colocar o código na VPS

Conecte na VPS por SSH (terminal do seu PC ou o terminal do navegador da Hostinger):

```bash
ssh root@31.97.243.139
```

Baixe o projeto do seu GitHub (troque pela URL do seu repositório):

```bash
cd /opt
git clone https://github.com/SEU_USUARIO/accessguard.git
cd accessguard
```

> Se o repositório for privado, o git vai pedir usuário e um token. Sem problema —
> ou deixe o repo público, ou use um token de acesso pessoal.

---

## Passo 3 — Criar o arquivo de configuração (.env)

Copie o modelo e edite:

```bash
cp .env.example .env
nano .env
```

Preencha:

- `SHOPIFY_API_KEY` → o **Client ID** do app (Partner Dashboard → seu app →
  Configurações do app). Já deixei o seu preenchido no modelo, confira.
- `SHOPIFY_API_SECRET` → o **Client secret** do app. **Só aqui, nunca no chat.**
- `HOST` → `accessguard.discar.cloud`
- O resto pode deixar como está.

Salve no nano com `Ctrl+O`, `Enter`, depois `Ctrl+X`.

---

## Passo 4 — Subir o contêiner

Ainda dentro da pasta do projeto:

```bash
docker compose up -d --build
```

Isso constrói a imagem e sobe o app. Ele fica ouvindo em `127.0.0.1:3011`
(só dentro da VPS). Teste que está vivo:

```bash
curl http://127.0.0.1:3011/health
```

Deve responder algo como `{"ok":true,"app":"AllyFix","version":"0.3","mode":"live"}`.

> `mode:"live"` = leu as chaves da Shopify. Se aparecer `mode:"demo"`, faltou
> preencher alguma variável no `.env` — revise o Passo 3 e rode
> `docker compose up -d --build` de novo.

---

## Passo 5 — Publicar na internet com HTTPS (reverse proxy)

Aqui depende de **qual proxy** já publica os seus outros apps. Descubra com:

```bash
docker ps --format '{{.Names}}  {{.Image}}  {{.Ports}}'
```

Procure na lista por um destes nomes. Siga só o bloco que corresponde ao seu:

### A) Nginx Proxy Manager (aparece `jc21/nginx-proxy-manager`)
O mais comum e o mais fácil — tudo pela telinha web (porta 81):
1. Abra o Nginx Proxy Manager no navegador.
2. **Hosts → Proxy Hosts → Add Proxy Host.**
3. Domain Names: `accessguard.discar.cloud`
4. Forward Hostname/IP: `127.0.0.1` (ou o IP interno do host) · Forward Port: `3011`
5. Marque **Block Common Exploits** e **Websockets Support**.
6. Aba **SSL** → **Request a new SSL Certificate** (Let's Encrypt) → marque
   **Force SSL** → **Save**.

Pronto. Ele já cuida do certificado HTTPS.

### B) Traefik (aparece `traefik`)
O Traefik trabalha por *labels* no contêiner. No `docker-compose.yml` deste
projeto tem um bloco comentado com as labels prontas — descomente-o, ajuste o
nome da rede externa do seu Traefik e o `certresolver`, apague o bloco `ports`,
e rode `docker compose up -d`.

### C) Nginx "puro" (aparece `nginx`) ou nginx instalado no host
Crie o arquivo `/etc/nginx/sites-available/accessguard.conf`:

```nginx
server {
    server_name accessguard.discar.cloud;
    location / {
        proxy_pass http://127.0.0.1:3011;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Ative e gere o certificado:

```bash
ln -s /etc/nginx/sites-available/accessguard.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d accessguard.discar.cloud
```

### D) Caddy (aparece `caddy`)
Adicione ao seu `Caddyfile` (o Caddy faz o HTTPS sozinho):

```
accessguard.discar.cloud {
    reverse_proxy 127.0.0.1:3011
}
```

E recarregue o Caddy (`caddy reload` ou `docker restart caddy`).

> **Não sabe qual é o seu proxy?** Me manda o resultado do `docker ps` do Passo 5
> que eu te digo exatamente o que fazer.

**Teste final deste passo:** abra `https://accessguard.discar.cloud/health` no
navegador. Tem que carregar com cadeado e mostrar o JSON com `mode:"live"`.

---

## Passo 6 — Apontar o app da Shopify para este endereço

No **Partner Dashboard → seu app → Configurações do app**:

- **App URL:** `https://accessguard.discar.cloud`
- **Allowed redirection URL(s):** `https://accessguard.discar.cloud/auth/callback`

Salve.

---

## Passo 7 — Instalar na sua loja de teste

Ainda no Partner Dashboard, abra o app e mande instalar na loja de
desenvolvimento (`accessguard-dev`). A Shopify vai abrir:

```
https://accessguard.discar.cloud/auth?shop=accessguard-dev.myshopify.com
```

Isso dispara o fluxo de instalação (o app pede permissão para ler produtos e
tema). Ao autorizar, ele te joga no painel já lendo os **produtos reais** da loja.

---

## Passo 8 — Conferir

- Painel abre em `https://accessguard.discar.cloud/?shop=accessguard-dev.myshopify.com`
- A nota e a lista de problemas agora vêm da **loja de verdade** (imagens sem
  texto alternativo, idioma da página, links vagos).
- O botão **"Fix all with AI"** mostra as correções calculadas.

---

## Se algo der errado

| Sintoma | O que olhar |
|---|---|
| `mode:"demo"` no /health | Faltou variável no `.env` (Passo 3), rebuild |
| Site não abre / sem cadeado | DNS ainda propagando (Passo 1) ou proxy (Passo 5) |
| Erro ao instalar na Shopify | Confira a Redirect URL exata (Passo 6) |
| Ver os logs do app | `docker compose logs -f accessguard` |
| Reiniciar o app | `docker compose restart accessguard` |
| Atualizar depois de mexer no código | `git pull && docker compose up -d --build` |

---

## O que ainda fica para depois (não trava o lançamento)

- **Contraste de cor em loja real:** exige "renderizar" o tema para ler as cores
  aplicadas (varredura headless). Nesta versão o contraste aparece na demo, mas
  não é varrido na loja real ainda — é o próximo incremento.
- **Texto alternativo com IA de verdade:** hoje gera um texto padrão; ao ligar a
  `AI_API_KEY`, passa a descrever a imagem com IA de visão.
- **App embutido (dentro do admin da Shopify) com App Bridge:** melhora a
  experiência, mas o app já instala e lê a loja sem isso.
- **Cobrança (Shopify Billing) e a página na App Store.**
