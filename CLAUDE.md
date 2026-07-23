# Partner Portal

UI (Nuxt 4) do **portal do parceiro** da api4com. Um **partner** acessa este
portal para enxergar a **hierarquia abaixo dele** — suas **subcontas** e os
**usuários** de cada uma — incluindo **chamadas, relatórios e KPIs**.

> O backend-alvo deste front é o **partner-portal-bff** (NestJS), que compõe os dados de
> **core-service** (catálogo: organização, customers/subcontas, usuários,
> hierarquia, status) + **pbxapi** (telefonia: ramais, chamadas/CDR, KPIs).
> Modelo: Partner = `Organization` do core; Subconta = core `Customer` === pbx
> `Organization` (mesmo UUID). Ver o `CLAUDE.md` do partner-portal-bff.

## Stack
- **Framework**: Nuxt 4 (Vue 3, SSR) — `compatibilityDate` 2025-01-15
- **UI**: `@nuxt/ui` v4 + Tailwind v4; ícones lucide / simple-icons
- **Runtime**: Node 24 (ver `.nvmrc`)
- **Auth**: sessão do **pbxapi** (LoopBack) **via partner-portal-bff** — ver abaixo.
  (Supabase foi **removido por completo** do front — código, dep e config.)
- **Lint**: `@nuxt/eslint` (stylistic: sem commaDangle, braceStyle 1tbs)
- **Deploy**: Vercel (`vercel.json`, framework nuxtjs)

## Comandos

```bash
npm run dev         # Nuxt dev server (porta 3000; use -- --host no container)
npm run build       # Build de produção
npm run preview     # Preview do build
npm run lint        # ESLint
npm run typecheck   # vue-tsc
```

## Autenticação (pbxapi via BFF)

O front fala com o **partner-portal-bff**, que faz passthrough pro **pbxapi**:
- `composables/useAuth.ts`: `login` (`POST /users/login` → `{ accessToken }`),
  `signup` (`POST /accounts/signup`, **não** auto-loga: exige verificação de
  e-mail), `fetchUser` (`GET /users/me`), `logout` (`POST /users/logout`).
- Token guardado em **cookie `access_token`** (SSR-safe) e enviado no header
  **`Authorization: Bearer <token>`**. É um token OPACO de sessão do pbx (não é JWT).
- `middleware/auth.global.ts`: proteção global de rotas; públicas = `['/login']`;
  sem token → redireciona pro `/login`.
- Base do BFF: **`runtimeConfig.public.bffBase`** (env `BFF_BASE`/`NUXT_PUBLIC_BFF_BASE_URL`,
  default `http://localhost:3005`). No SSR usa `bffInternalBase` (`BFF_INTERNAL_URL`,
  nome do container na rede docker) — `localhost` não resolve dentro do container.
- `useAuth().bffFetch<T>(path, opts)` é o helper único de chamada ao BFF (baseURL +
  Bearer + tratamento de 401/parceiro-desativado). Todo o roadmap usa ele.

## Estrutura (`app/`)

```
app/
  pages/         -> login, index, roadmap, relatorio, agente, admin, clientes/[id]
  components/    -> PortalSidebar/Topbar, roadmap/*, contas/*
  composables/   -> useAuth (pbx/bff), useRoadmap, useIsAdmin, useRoadmapRequest, useSubcontas, useUsuarios
  lib/           -> contas.ts, relatorio.ts (mock) · roadmap.ts, admin.ts (BFF)
  middleware/    -> auth.global.ts (proteção via token pbx)
  layouts/       -> default.vue (sidebar + topbar)
  assets/css/    -> main.css
```

## Estado atual: o que é real, mock e resíduo

| Área | Fonte hoje | Vai virar |
|---|---|---|
| **Auth** (login/signup/sessão) | **partner-portal-bff** → pbxapi (`useAuth` + middleware) | JWT do core (TEL-1979), quando existir |
| **Subcontas** (`lib/contas.ts`, `useSubcontas`) | **mock** determinístico | `GET /subaccounts` (bff) |
| **Usuários por subconta** (`useUsuarios`) | **mock** | `GET /subaccounts/:id/users` (bff) |
| **Relatórios/chamadas** (`lib/relatorio.ts`) | **mock** | `GET /calls` + `GET /reports/summary` (bff) |
| **Roadmap** (parceiro + admin + anexos) | **partner-portal-bff → engagement-service** (Modelo B), sem Supabase | migração dos dados reais + deploy do serviço |
| **Agente** (chat) | **mock** | a definir |

A tela de **Relatórios** (`pages/relatorio.vue`) é a mais rica: filtros (subcontas
multi, período, busca, sort, paginação) e 5 KPIs (Subcontas, Usuários, Ativos 7d,
Volume, Taxa de atendimento) — tudo client-side sobre os mocks por enquanto.

## Migração (em andamento)

- **Supabase**: ✅ **removido por completo** (código, dep `@supabase/supabase-js`,
  config e envs). O roadmap agora é **Modelo B**: front → **partner-portal-bff** →
  **engagement-service** (NestJS + Mongo, dono do domínio Roadmap). Cobre parceiro
  (ver/curtir/comentar/solicitar), admin (dashboard/editor/feedback) e anexos
  (upload via proxy no BFF → S3). Falta rodar a **migração dos dados reais** do
  Supabase e o **deploy** do engagement-service. Ver `engagement-service/docs/DESIGN.md`.
- **BFF como backend único**: os mocks restantes (subcontas/usuários/relatórios)
  vão sendo trocados pelos endpoints REST do bff (`/subaccounts`,
  `/subaccounts/:id/users`, `/calls`, `/reports/summary`).

## Docker / ambiente local

- `Dockerfile` (target `development`) + `docker-compose.yml` sobem o Nuxt em dev
  na rede externa **`api4com-network`** (mesma de core-service/pbxapi/partner-portal-bff),
  porta host **3010**. O browser alcança o BFF por `localhost:3005`
  (`NUXT_PUBLIC_BFF_BASE_URL`) e o SSR por `http://partner-portal-bff:3000`
  (`BFF_INTERNAL_URL`).
- Em geral roda-se via o orquestrador **`platform`** (`make up-partners`), que sobe
  a stack toda (core/pbxapi/bff/engagement/front + infra) e mapeia o front na 3012.

```bash
docker compose up -d --build   # sobe o partner-portal na api4com-network
docker compose down            # derruba
```

## Pontos em aberto
- **Marcação de conta "partner"**: **decidido** no core (TEL-1979 fase 2, 24/06),
  ainda não codado — `Customer.isPartner` + novo `UserRole.PARTNER`. O front
  decide mostrar o console de parceiro por `accountContext.isPartner` no JWT.
- **Escopo das subcontas** vem do **JWT do core** (`accountContext.allowedCustomerIds`
  = pai + filhos diretos), não de mock/hardcode.
- **Auth alvo**: migrar da sessão opaca do pbx (interino) para **JWT do core**
  (TEL-1979 "Opção A": pbx valida senha → core emite JWT), consumido via bff. Isso
  também troca a allowlist de admin do roadmap (`ROADMAP_ADMIN_*` no bff) por role.
- **Roadmap**: ✅ migrado pro bff/engagement (Modelo B). Falta a migração dos dados
  reais do Supabase e o deploy do engagement-service (Mongo + envs S3/allowlist).
- **Subcontas/relatórios**: consolidar o front no **partner-portal-bff** (trocar os
  mocks restantes pelos endpoints REST).
