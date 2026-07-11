# Runbook — partner-portal-bff: limite de signup por cliente real

**Repo-alvo:** `partner-portal-bff` (branch `feat/HACKAFEST-partners`) — mantido por outro agente.
**Objetivo:** aplicar o limite **real** de signup por cliente (`5/dia`) aqui, onde `req.ip` é o cliente verdadeiro (o BFF fica atrás do Traefik/NGINX, que entrega o IP real). O pbx só mantém um teto de **velocidade** (backstop por minuto) — ver `pbxapi-signup-ratelimit.md`.

> **Descoberta (confirmada em `feat/HACKAFEST-partners`):** o BFF **não tem rate limit hoje** — nenhuma dep (`@nestjs/throttler`, `express-rate-limit`), nenhum uso no `src`, só guards de auth (`user-auth`, `core-jwt`, `client-auth`). E **não há `trust proxy`** habilitado. Ou seja, isto é greenfield: nada para reaproveitar, e **hoje não existe proteção por-cliente** no fluxo de parceiro. Até este runbook entrar, o único guard é o backstop de velocidade do pbx.

**Por que aqui, e não no pbx:** o pbx vê apenas o IP do *container do BFF* (a fonte), não o cliente. Passar o IP do cliente via header ao pbx abriria superfície de spoofing (só barrável pelo segredo). Enforçar no BFF evita header confiável e mantém o pbx compartilhado intocado.

---

## Contexto do que existe hoje

- `src/application/api/rest/auth/auth.controller.ts` → `@Post('accounts/signup') @Public() signup(@Body() body: SignupDto)`.
- `src/domain/auth/auth.service.ts` → `pbxAuth.signup({ ...payload, isPartner: true })`.
- `src/integration/pbx-api/pbx-auth.client.ts` → `POST /accounts/signup` com header `x-partner-signup`.
- **Confirmado:** nenhum rate limit e nenhum `trust proxy` hoje (ver Descoberta acima). Sem `trust proxy`, `req.ip` é o peer (Traefik), não o cliente — o Passo 1 conserta isso.

## Desenho

1. Habilitar `trust proxy` no Express (Nest) → `req.ip` = cliente real (Traefik/NGINX já setam `X-Forwarded-For`, com `trustedIPs` no edge).
2. Limitar `POST /accounts/signup` a `5/24h` por `req.ip` (cliente), **antes** de chamar o pbx.
3. 429 com corpo claro (essa resposta nasce no BFF, não passa pelo `forward()` que mascara o upstream).

---

## Passo 1 — trust proxy (`src/main.ts`)

```ts
// O BFF fica atrás do Traefik (staging) / NGINX (prod), que setam X-Forwarded-For.
// Sem isto, req.ip é o proxy, não o cliente — e o rate limit por-cliente não funciona.
// Valor por env pra não fixar topologia: nº de hops confiáveis (1 = só o edge imediato).
const trustProxy = process.env.BFF_TRUST_PROXY ?? '1';
app.getHttpAdapter().getInstance()
  .set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
```

> **Segurança:** nunca `true`. Confie só nos hops reais (edge). Como o edge tem `trustedIPs`/`X-Real-IP` configurado, o cliente não consegue injetar `X-Forwarded-For` além do que o edge sobrescreve.

## Passo 2 — throttler no signup

Usando `@nestjs/throttler` (oficial):

```bash
npm i @nestjs/throttler
```

`app.module.ts` — registrar um throttler nomeado `signup`:

```ts
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    // ATENÇÃO à unidade de `ttl` da versão instalada:
    //   @nestjs/throttler v5  -> ttl em SEGUNDOS  (86400)
    //   @nestjs/throttler v6+ -> ttl em MILISSEGUNDOS (86400000)
    ThrottlerModule.forRoot([{ name: 'signup', ttl: 86_400_000, limit: 5 }]),
    // ...
  ],
})
export class AppModule {}
```

> Storage: com **1 réplica** em staging, o storage em memória (default) já serve. Para múltiplas réplicas / não perder contagem em restart, plugar Redis (`staging-redis` já está na `staging_network`) via um `ThrottlerStorage` de Redis. Recomendado antes de produção.

Guard com tracker no IP real (`src/common/guards/signup-throttler.guard.ts`):

```ts
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class SignupThrottlerGuard extends ThrottlerGuard {
  // req.ip já é o cliente real graças ao trust proxy do Passo 1.
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.ip;
  }
}
```

Aplicar **só** no signup (`auth.controller.ts`):

```ts
import { Throttle } from '@nestjs/throttler';
import { SignupThrottlerGuard } from '../../../common/guards/signup-throttler.guard';

@Post('accounts/signup')
@Public()
@UseGuards(SignupThrottlerGuard)
@Throttle({ signup: { limit: 5, ttl: 86_400_000 } })
signup(@Body() body: SignupDto) {
  return this.authService.signup({ ...body });
}
```

## Passo 3 — 429 legível (opcional, recomendado)

O `ThrottlerException` default responde `429 "ThrottlerException: Too Many Requests"`. Para o portal mostrar algo útil, customize o corpo (override `throwThrottlingException` no guard ou um exception filter):

```ts
// no SignupThrottlerGuard
protected async throwThrottlingException(): Promise<void> {
  throw new HttpException(
    { error: { statusCode: 429, name: 'TooManySignups',
      message: 'Você excedeu o limite de criação de conta. Tente novamente mais tarde.' } },
    429,
  );
}
```

---

## Deploy (staging)

```bash
cd ~/dev/sourcecode/partner-portal-bff
ECR=824572654562.dkr.ecr.us-east-1.amazonaws.com
docker build --target production -t partner-portal-bff:staging .
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR
docker tag partner-portal-bff:staging $ECR/partner-portal-bff:staging
docker push $ECR/partner-portal-bff:staging

KEY=~/Documents/api4com/security/servers/api4com-br.pem
ssh -i $KEY rocky@129.151.33.239 'cd /opt/staging && \
  sudo docker compose pull partners-bff && \
  sudo docker compose up -d --force-recreate partners-bff'
```

`BFF_TRUST_PROXY` (default `1`) pode ir no `/opt/staging/apps/partners/bff/.env.staging` se a topologia exigir outro nº de hops.

---

## Validação

```bash
KEY=~/Documents/api4com/security/servers/api4com-br.pem
SSH="ssh -i $KEY rocky@129.151.33.239"

# 1) req.ip é o cliente real? Logue req.ip no signup e confira que NÃO é o IP do Traefik.
$SSH 'sudo docker logs staging-partners-bff --since 5m | grep -i signup'

# 2) 6º cadastro do mesmo cliente em 24h -> 429 vindo do BFF (nem chega no pbx).
#    O pbx NÃO deve registrar esses no store `signups-partner` além do teto.

# 3) Dois clientes distintos -> baldes independentes (5 cada).
```

**Critérios de aceite**
- [ ] `req.ip` no BFF = IP real do cliente (não o do Traefik/NGINX).
- [ ] 5 signups OK do mesmo cliente; o 6º → `429 TooManySignups` **originado no BFF**.
- [ ] Clientes diferentes têm contagem independente.
- [ ] O request bloqueado **não** chega ao pbx (economiza o backstop).

## Rollback
- Remover `@UseGuards/@Throttle` do signup, o guard e o `ThrottlerModule`; reverter o `trust proxy` no `main.ts`.
- Sem estado persistente se o storage for em memória; se for Redis, as chaves expiram no TTL.

## Coordenação com o pbx
- Este runbook e o `pbxapi-signup-ratelimit.md` são um par. Ordem: **pbx primeiro** — como o BFF não tem rate limit hoje, o backstop de velocidade do pbx é a única proteção do canal parceiro até este runbook entrar.
- O backstop do pbx é por **velocidade** (`API4COM_RATE_LIMIT_PARTNER_SIGNUPS_PER_MINUTE`, balde compartilhado por minuto), não um teto diário. Ele não substitui o limite por-cliente daqui.
- Quando ambos estiverem no ar, **reverter** `API4COM_RATE_LIMIT_SIGNUPS_PER_DAY` do pbx staging de 100 → 5.
