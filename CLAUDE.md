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
- **Auth**: token do **pbxapi** (LoopBack) — ver abaixo. (`@nuxtjs/supabase` foi
  **removido** do `nuxt.config`; ainda há resíduos — ver "Migração".)
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

## Autenticação (pbxapi)

Migrada do Supabase para o **pbxapi** (mesmo padrão do api4com-portal):
- `composables/useAuth.ts`: `login` (`POST /users/login` → `{ id }`), `signup`
  (`POST /accounts/signup`, **não** auto-loga: exige verificação de e-mail),
  `fetchUser` (`GET /users/me`), `logout` (`POST /users/logout`).
- Token guardado em **cookie `pbx_token`** (SSR-safe) e enviado no header
  **`Authorization`** cru (**sem** "Bearer"), exatamente como o pbxapi espera.
- `middleware/auth.global.ts`: proteção global de rotas; públicas = `['/login']`;
  sem token → redireciona pro `/login`.
- Base do pbx vem de `runtimeConfig.public.pbxApiBase` (env **`PBX_API_BASE`**,
  default `http://localhost:3000/api`).

> **Hoje o front chama o pbxapi diretamente** via `pbxApiBase`. O **partner-portal-bff**
> já espelha essas rotas (`/users/login`, `/accounts/signup`, `/users/me`,
> `/users/logout` — passthrough 1:1, mesmo contrato). Para passar a usar o BFF
> como backend único, basta apontar `PBX_API_BASE` para a base do partner-portal-bff
> (as rotas no bff ficam na raiz, **sem** o prefixo `/api`).

## Estrutura (`app/`)

```
app/
  pages/         -> login, index, roadmap, relatorio, agente, admin, clientes/[id]
  components/    -> PortalSidebar/Topbar, roadmap/*, contas/*
  composables/   -> useAuth (pbx), useRoadmap, useIsAdmin, useSubcontas, useUsuarios
  lib/           -> contas.ts, relatorio.ts (mock) · roadmap.ts (supabase, resíduo)
  middleware/    -> auth.global.ts (proteção via token pbx)
  layouts/       -> default.vue (sidebar + topbar)
  assets/css/    -> main.css
```

## Estado atual: o que é real, mock e resíduo

| Área | Fonte hoje | Vai virar |
|---|---|---|
| **Auth** (login/signup/sessão) | **pbxapi** (`useAuth` + middleware) — front bate direto no pbx | mesmas rotas via **partner-portal-bff** (passthrough já existe) |
| **Subcontas** (`lib/contas.ts`, `useSubcontas`) | **mock** determinístico | `GET /subaccounts` (bff) |
| **Usuários por subconta** (`useUsuarios`) | **mock** | `GET /subaccounts/:id/users` (bff) |
| **Relatórios/chamadas** (`lib/relatorio.ts`) | **mock** | `GET /calls` + `GET /reports/summary` (bff) |
| **Roadmap** (`lib/roadmap.ts`, `useRoadmap`, `useIsAdmin`, `admin.vue`) | **resíduo Supabase** (módulo removido do nuxt.config → quebrado) | migrar p/ endpoints do bff |
| **Agente** (chat) | **mock** | a definir |

A tela de **Relatórios** (`pages/relatorio.vue`) é a mais rica: filtros (subcontas
multi, período, busca, sort, paginação) e 5 KPIs (Subcontas, Usuários, Ativos 7d,
Volume, Taxa de atendimento) — tudo client-side sobre os mocks por enquanto.

## Migração (em andamento)

- **Supabase saindo**: `@nuxtjs/supabase` já foi removido de `nuxt.config.ts`,
  mas a **dependência ainda está no `package.json`** e `lib/roadmap.ts` /
  `useIsAdmin.ts` ainda referenciam `supabase` (tipado como `any`). Roadmap fica
  quebrado até migrar para o bff. Remover a dependência quando o roadmap migrar.
- **BFF como backend único**: trocar `PBX_API_BASE` para a base do partner-portal-bff e
  ir substituindo os mocks (subcontas/usuários/relatórios) pelos endpoints REST
  do bff (`/subaccounts`, `/subaccounts/:id/users`, `/calls`, `/reports/summary`).

## Docker / ambiente local

- `Dockerfile` (target `development`) + `docker-compose.yml` sobem o Nuxt em dev
  na rede **`platform_shared`** (mesma de core-service/pbxapi/partner-portal-bff), porta
  host **3010**.
- ⚠️ O `docker-compose.yml` ainda traz placeholders de `SUPABASE_URL`/`KEY`
  (não são mais necessários, módulo removido) e **não** define `PBX_API_BASE`
  (cai no default `http://localhost:3000/api`). Alinhar o env quando consolidar
  o uso do BFF (definir `PBX_API_BASE` para a base do partner-portal-bff).

```bash
docker compose up -d --build   # sobe o partner-portal na platform_shared
docker compose down            # derruba
```

## Pontos em aberto
- **Marcação de conta "partner"**: **decidido** no core (TEL-1979 fase 2, 24/06),
  ainda não codado — `Customer.isPartner` + novo `UserRole.PARTNER`. O front
  decide mostrar o console de parceiro por `accountContext.isPartner` no JWT.
- **Escopo das subcontas** vem do **JWT do core** (`accountContext.allowedCustomerIds`
  = pai + filhos diretos), não de mock/hardcode.
- **Auth alvo**: migrar do login direto no pbx (interino) para **JWT do core**
  (TEL-1979 "Opção A": pbx valida senha → core emite JWT), consumido via bff.
- **Roadmap**: migrar do Supabase para o bff (hoje resíduo quebrado).
- Consolidar o front para falar com o **partner-portal-bff** (em vez do pbxapi direto).
