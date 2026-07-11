# Runbook — paridade de ajustes no `partner-portal` (espelhando `partner-portal-bff`)

> Contexto: em 11/07/2026 fizemos uma série de ajustes no `partner-portal-bff`
> (rename, promoção template→main, hardening de CI, ECR/IAM, migração de staging,
> gatilhos de deploy, tag de commit, guardrail de deleção no ECR). Este runbook
> mapeia o que disso **se aplica** ao `partner-portal` — e o que **não** se aplica.

## TL;DR

`partner-portal` **não é** um GitHub template repo e **não tem** pipeline de build/push
de imagem no CI (só `ci.yml` com lint+typecheck). Portanto a maioria dos ajustes do
BFF **não tem equivalente a corrigir**. O que de fato se aplica:

- **(A) Regra de não-deleção no ECR** — ✅ já aplicada nesta sessão (repo ECR `partner-portal`).
- **(B) Atualizar referências stale `bff-portal` → `partner-portal-bff`** (fallout do rename do BFF).
- **(C, opcional) Adicionar pipeline automatizado de imagem** com paridade ao BFF — é uma *adição*, não correção.

## Estado atual do `partner-portal` (levantado read-only)

| | |
|---|---|
| Repo GitHub | `Api4Com/partner-portal`, default `main` |
| Template repo? | **Não** — sem branch `template`, sem `${template.project_name}`, sem `configure-project-from-template.yml`, sem `README.example.md` |
| CI | só `.github/workflows/ci.yml`: `on: push`, roda `pnpm lint` + `pnpm typecheck`. **Sem build/push de imagem.** |
| Stack | Nuxt 4 (pnpm), `package.json` name `partner-portal-nuxt` |
| ECR | repo `partner-portal`, imagem `partner-portal:staging` + `:$SHA` |
| Deploy | **manual**, via `deploy/runbooks/deploy-partners.md`. Host `129.151.33.239`, `/opt/staging`, container `staging-partners-portal`, var `PARTNERS_PORTAL_ECR_IMAGE`, domínio `partners-staging.api4com.com` |

## O que NÃO se aplica (e por quê)

| Ajuste feito no BFF | Aplica no portal? | Motivo |
|---|---|---|
| Rename `bff-portal` → nome novo | ❌ | O portal já se chama `partner-portal` |
| Promoção `template` → `main` | ❌ | Não é template repo; `main` já é default |
| Fix "Linter Report só em PR" (eslint-annotate) | ❌ | CI usa `pnpm run lint` simples, sem `eslint-annotate-action` |
| Gating de `build-image` em PR | ❌ | Não há job de build de imagem no CI |
| `workflow_dispatch` / triggers staging-prod | ❌ | Não há pipeline de imagem |
| Push da tag `:$SHA` no ECR | ✅ já resolvido | O runbook manual `deploy-partners.md` já publica `:$SHA` |
| Seleção de branch no deploy manual | ❌ | Deploy manual já builda do checkout local |

## O que SE aplica

### (A) Regra de não-deleção no ECR — ✅ JÁ APLICADO nesta sessão

Aplicado a `partner-portal` e `partner-portal-bff`. Policy de recurso com `Deny`
explícito em `ecr:BatchDeleteImage` + `ecr:DeleteRepository` (bloqueia até admin).

`ecr-deny-delete.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "DenyImageDeletion", "Effect": "Deny", "Principal": "*",
      "Action": ["ecr:BatchDeleteImage", "ecr:DeleteRepository"] }
  ]
}
```
```bash
aws ecr set-repository-policy --repository-name partner-portal \
  --region us-east-1 --policy-text file://ecr-deny-delete.json
```
**Break-glass** (para poder deletar de novo): remover o statement via
`aws ecr set-repository-policy` com uma policy sem o `DenyImageDeletion` (ou
`delete-repository-policy`). O push **não** é afetado (pipeline só faz push).

> Outros repos ECR da conta (billing-service, core-service, pbxapi, etc.) NÃO têm
> a regra. Se quiser org-wide, é o mesmo comando por repositório.

### (B) Atualizar referências stale `bff-portal` → `partner-portal-bff`

O repo e o ECR do BFF foram renomeados de `bff-portal` para `partner-portal-bff`.
No `partner-portal` há referências ao BFF pelo **nome antigo** que devem ser
atualizadas. Descoberta:

```bash
cd <partner-portal>
grep -rniI 'bff-portal' . --exclude-dir=node_modules --exclude-dir=.git
```

Pontos conhecidos (conferir no grep):
- `deploy/runbooks/deploy-partners.md` — tabela com repo/ECR do BFF.
- `deploy/runbooks/bff-portal-signup-ratelimit.md` — nome do arquivo + conteúdo.
- `docker-compose.yml` — comentário (~linha 19) citando `bff-portal`.
- `app/composables/useAuth.ts` — comentário (~linha 1).
- `CLAUDE.md` — várias menções.

⚠️ **Trocar só onde se refere ao repo/imagem ECR do BFF.** NÃO mexer em:
- domínio `partners-bff-staging.api4com.com`
- serviço/container `partners-bff` / `staging-partners-bff`
- var `PARTNERS_BFF_ECR_IMAGE`
(esses não contêm a string `bff-portal`, então o grep acima não os pega — bom.)

Fazer via branch + PR, como no BFF.

### (C) (Opcional) Pipeline automatizado de imagem com paridade ao BFF

Hoje o portal builda/pusha a imagem **manualmente**. Se quiser CI publicando no ECR
como o BFF (staging manual via `workflow_dispatch`, production na Release, tag
`:$SHA`, testes gateando o build):

1. Portar os 4 workflows do BFF, adaptando o reusable de test-and-quality ao stack
   **pnpm/Nuxt** (`pnpm lint` + `pnpm typecheck`; **não** usar `eslint-annotate-action`).
2. Secrets `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` no repo `partner-portal`.
3. **IAM**: a policy `Api4comEcrPushPortalPbxapi` (usuário `ecr-pusher`) hoje cobre
   `api4com-portal`, `api4com-pbxapi`, `partner-portal-bff` — **NÃO** cobre
   `partner-portal` (singular). Adicionar o ARN
   `arn:aws:ecr:us-east-1:824572654562:repository/partner-portal` (nova versão da policy).
4. Deploy no host segue **manual** (`scripts/deploy.sh partners-portal`).

## Referência: o que foi feito no BFF (para espelhar em C, se for o caso)

- `pipeline-staging.yml`: `workflow_dispatch` (tag default `staging`) + PR→main (só testes).
- `pipeline-production.yml`: `on: release: published` → rebuild + push `:production`.
- `reusable-workflow-docker-image-build.yml`: build `--target production`, push da tag
  de ambiente **e** de `github.sha`.
- `reusable-workflow-test-and-quality.yml`: no BFF o step de lint annotate roda só em PR
  (`if: github.event_name == 'pull_request'`) — no portal isso nem existe.
