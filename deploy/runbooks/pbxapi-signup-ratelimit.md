# Runbook — pbxapi: rate limit de signup por dois canais

**Repo-alvo:** `pbxapi` (branch `feat/HACKAFEST-partners`)
**Não toca:** `trust proxy`, nem o limite dos demais canais.
**Objetivo:** o canal do parceiro (BFF) passa a ter um limite próprio; portal antigo / API direta continuam **exatamente** como hoje (`5/dia` por `req.ip`).

> **Descoberta (confirmada):** o `bff-portal` **não tem rate limit nenhum hoje** (sem `@nestjs/throttler`/`express-rate-limit`, sem `trust proxy`). Enquanto o limite por-cliente não for construído lá (ver `bff-portal-signup-ratelimit.md`), este **backstop de velocidade é a ÚNICA proteção** do canal parceiro. Por isso: pbx primeiro.

---

## Contexto do que existe hoje

`server/middleware/rate-limiters.js`:

```js
const createAccountLimiter = RateLimit({
  requestPropertyName: 'createAccountLimiter',
  windowMs: 24 * 60 * 60 * 1000,
  max: parseInt(process.env.API4COM_RATE_LIMIT_SIGNUPS_PER_DAY) || 5,
  handler: function (req, res) { /* 429 TooManySignups */ },
  store: new RateLimitStore('signups'),          // -> redis: ratelimit:signups:<key>
  standardHeaders: true,
  legacyHeaders: false,
});
app.post(`/api${version}/accounts/signup`, getRequestLogger('SIGNUP'), createAccountLimiter);
```

- Sem `keyGenerator` → o default do `express-rate-limit` é `req.ip`. **Mantém-se.**
- `common/models/account.js` já valida o canal confiável: `safeEqual(options.partnerSignupKey, process.env.PARTNER_SIGNUP_KEY)` (fail-closed).

## O que muda

1. Um helper `isPartnerChannel(req)` — mesmo teste de segredo, em tempo constante.
2. `createAccountLimiter` ganha `skip: (req) => isPartnerChannel(req)` — passa a **não** contar o tráfego do parceiro. Resto inalterado.
3. Um segundo limiter `createPartnerAccountLimiter` — só conta o canal do parceiro (`skip` invertido), com env e store próprios.
4. Ambos montados na rota, em sequência.

---

## Passo 1 — código (`server/middleware/rate-limiters.js`)

No topo do arquivo (se ainda não houver `crypto`):

```js
const crypto = require('crypto');
```

> Se `account.js` exporta o `safeEqual` de um util compartilhado, prefira reusá-lo em vez do bloco abaixo, pra ter uma implementação só do canal confiável.

Helper (perto dos outros helpers de skip):

```js
// Canal confiável de parceiro: o bff-portal envia o segredo em `x-partner-signup`.
// Comparação em tempo constante; fail-closed se a env não estiver setada.
const isPartnerChannel = (req) => {
  const expected = process.env.PARTNER_SIGNUP_KEY || '';
  if (!expected) return false;
  const got = String(req.headers['x-partner-signup'] || '');
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
```

Ajuste o limiter atual (só adiciona o `skip`):

```js
const createAccountLimiter = RateLimit({
  requestPropertyName: 'createAccountLimiter',
  windowMs: 24 * 60 * 60 * 1000,
  max: parseInt(process.env.API4COM_RATE_LIMIT_SIGNUPS_PER_DAY) || 5,
  skip: (req) => isPartnerChannel(req),          // <-- NOVO: não conta o parceiro
  handler: function (req, res) { /* ...igual, TooManySignups... */ },
  store: new RateLimitStore('signups'),
  standardHeaders: true,
  legacyHeaders: false,
});
```

Adicione o backstop do parceiro (logo abaixo):

```js
// Backstop de VELOCIDADE do canal parceiro. O limite REAL por-cliente vive no
// bff-portal (onde req.ip é o cliente verdadeiro). Aqui a chave é req.ip = a
// FONTE (o BFF) -> é um balde ÚNICO/compartilhado para TODO o tráfego de parceiro.
// Por isso limitamos VELOCIDADE (por minuto), NÃO total diário: cadastro orgânico
// é espalhado no tempo e quase nunca dispara; abuso com segredo vazado é um burst
// e é exatamente o que este teto pega — sem falso-positivo em dia movimentado.
const createPartnerAccountLimiter = RateLimit({
  requestPropertyName: 'createPartnerAccountLimiter',
  windowMs: 60 * 1000,                           // janela curta: 1 minuto
  max: parseInt(process.env.API4COM_RATE_LIMIT_PARTNER_SIGNUPS_PER_MINUTE) || 15,
  skip: (req) => !isPartnerChannel(req),         // <-- só o canal parceiro
  handler: function (req, res) {
    loggerServer.info({
      resource: 'RATE_LIMIT', request: 'BLOCK_SIGNUP_PARTNER',
      message: `${req.ip} ${req.method} ${req.originalUrl.split('?')[0]} → 429 BLOCKED (partner velocity backstop)`,
    });
    return res.status(429).json({
      error: {
        statusCode: 429,
        name: 'TooManySignups',
        message: 'Muitas tentativas de cadastro em pouco tempo, por favor tente novamente em instantes',
      },
    });
  },
  store: new RateLimitStore('signups-partner'),  // -> redis: ratelimit:signups-partner:<key>
  standardHeaders: true,
  legacyHeaders: false,
});
```

Monte os dois na rota (ordem não importa — cada request passa por um só):

```js
app.post(`/api${version}/accounts/signup`,
  getRequestLogger('SIGNUP'),
  createAccountLimiter,
  createPartnerAccountLimiter);
```

## Passo 2 — env

`.env.example` e `/opt/staging/apps/pbxapi/.env.staging`:

```diff
  API4COM_RATE_LIMIT_SIGNUPS_PER_DAY=5
+ # Backstop de VELOCIDADE do canal parceiro (bff-portal). Balde compartilhado
+ # por FONTE (IP do BFF), por MINUTO — NÃO é total diário (um teto diário
+ # compartilhado bloquearia todo mundo num dia movimentado). O limite por-cliente
+ # real fica no bff-portal. Default do código: 15/min.
+ API4COM_RATE_LIMIT_PARTNER_SIGNUPS_PER_MINUTE=15
```

> **Importante:** em staging, `API4COM_RATE_LIMIT_SIGNUPS_PER_DAY` está em **100** só para teste. Voltar para **5** quando este fix entrar (senão os "demais canais" ficam com limite alto — o que motivou o desenho).

## Passo 3 — deploy (staging)

A imagem do pbx staging vem do ECR (`api4com-pbxapi:staging`), buildada pelo pipeline. Após buildar/publicar a imagem da branch:

```bash
KEY=~/Documents/api4com/security/servers/api4com-br.pem
SSH="ssh -i $KEY rocky@129.151.33.239"
$SSH 'cd /opt/staging && \
  sudo docker compose pull pbxapi && \
  sudo docker compose up -d --force-recreate pbxapi'
```

Mudança só de env (sem código novo): basta editar o `.env.staging` e `up -d --force-recreate pbxapi`.

---

## Validação

```bash
KEY=~/Documents/api4com/security/servers/api4com-br.pem
SSH="ssh -i $KEY rocky@129.151.33.239"

# 1) Canal NÃO-parceiro conta em `signups` e NÃO em `signups-partner`:
#    (dispare alguns signups sem o header x-partner-signup)
$SSH 'sudo docker exec staging-redis redis-cli --scan --pattern "ratelimit:signups:*"'
$SSH 'sudo docker exec staging-redis redis-cli --scan --pattern "ratelimit:signups-partner:*"'

# 2) Canal parceiro (via BFF): só incrementa `signups-partner`, keyado no IP do BFF.
#    Confirme que a chave é o IP do container do BFF:
$SSH 'sudo docker inspect -f "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" staging-partners-bff'

# 3) Limpar baldes durante os testes:
$SSH 'sudo docker exec staging-redis redis-cli DEL ratelimit:signups:<ip> ratelimit:signups-partner:<ip>'
```

**Critérios de aceite**
- [ ] Signup sem segredo → conta em `ratelimit:signups:<ip-cliente>`, `max=5`. **Igual a hoje.**
- [ ] Signup do BFF (segredo válido) → conta só em `ratelimit:signups-partner:<ip-bff>`, janela de 1 min, `max` da env nova.
- [ ] O store `signups` **não** incrementa em request do parceiro (skip funcionando).
- [ ] Portal antigo / API direta: 429 no 6º cadastro do mesmo IP (comportamento preservado).

## Rollback
- Reverter o commit (remove `skip`, o 2º limiter e o mount extra) e remover a env `..._PARTNER_SIGNUPS_PER_DAY`.
- Estado volta a ser o limiter único de hoje. Sem migração de dados; chaves `signups-partner` no redis expiram sozinhas (TTL 24h).

## Notas de segurança
- **Nenhum header de IP é confiado.** O único sinal confiado é `x-partner-signup`, que o pbx já valida. Sem segredo → indistinguível do portal antigo (`5/req.ip`).
- Com segredo, o pior caso (atacante batendo direto no pbx) é limitado pelo **IP real dele** (não forjável, pois não há `trust proxy` novo nem header de IP) até o teto do backstop.
- `trust proxy` **não muda** — prod continua `loopback`, correto para o NGINX local.
