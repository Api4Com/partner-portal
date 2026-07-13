# Runbook — Deploy do Partners (portal + BFF) em staging

A imagem é **publicada no ECR pelo CI** (GitHub Actions); o **deploy no host é
manual** (pull + recriar container). Vale para os **dois** serviços do Partners.
Onde aparecer `<...>`, troque pelos valores da tabela abaixo.

> **Ambiente:** `cld-orc-staging` (`129.151.33.239`) — **docker compose** (NÃO é
> swarm; nada de `docker stack` / `--with-registry-auth` aqui). A stack do Partners
> é incluída pelo compose raiz de `/opt/staging`.

---

## Referência dos serviços

| | **Portal** | **BFF** |
|---|---|---|
| Repo (git) | `partner-portal` | `partner-portal-bff` |
| Branch de build | `main` | `main` |
| Build target | `production` | `production` |
| ECR repo | `partner-portal` | `partner-portal-bff` |
| Serviço no compose | `partners-portal` | `partners-bff` |
| Container | `staging-partners-portal` | `staging-partners-bff` |
| `.env` do app (host) | `/opt/staging/apps/partners/portal/.env.staging` | `/opt/staging/apps/partners/bff/.env.staging` |
| Var de imagem (raiz) | `PARTNERS_PORTAL_ECR_IMAGE` | `PARTNERS_BFF_ECR_IMAGE` |
| Domínio | `partners-staging.api4com.com` | `partners-bff-staging.api4com.com` |
| Porta interna | `3000` | `3000` |
| Healthcheck | `GET /health` | `GET /health` |

**Constantes**

```bash
ECR=824572654562.dkr.ecr.us-east-1.amazonaws.com
REGION=us-east-1
KEY=~/Documents/api4com/security/servers/api4com-br.pem
SRV=rocky@129.151.33.239
```

---

## Esquema de tags no ECR

Cada build do CI publica **duas** tags: a **de ambiente** (mutável) + uma **imutável**
(pra rollback e pra lifecycle policy escopar a limpeza):

| Origem | Tag de ambiente | Tag imutável | Lifecycle |
|---|---|---|---|
| **Staging** (`workflow_dispatch`) | `staging` | `git-<sha>` | mantém as últimas 30 `git-*` |
| **Produção** (GitHub Release) | `production` | `v<version>` (do `package.json`) | mantém as últimas 50 `v*` |

> Imagens sem tag (órfãs) expiram em 15 dias. A **imagem mais recente** de cada
> ambiente nunca expira (regra por contagem). O repo tem `deny` de deleção — apagar
> manualmente exige break-glass (lift do deny → `batch-delete-image` → reaplicar).

---

## Pré-requisitos

- Acesso SSH ao servidor com a chave `api4com-br.pem` (`ssh -i $KEY $SRV`).
- `aws` CLI logado localmente com permissão no ECR (`aws sts get-caller-identity`) —
  só pro passo de validação/rollback; o push é feito pelo CI.
- `gh` CLI logado (`gh auth status`) pra disparar o pipeline de staging.
- Se for a **1ª vez** de um domínio novo, o DNS precisa apontar para `129.151.33.239`
  **antes** do 1º `up` (o cert Let's Encrypt é emitido por HTTP-01 no primeiro acesso).

---

## Passo 1 — Publicar a imagem no ECR (via CI)

### Staging (manual, `workflow_dispatch`)

Não há push automático de staging: dispare o pipeline e informe a tag (default
`staging`). O job **reprova em erro de lint/typecheck** (gate) antes de buildar.

```bash
gh workflow run "Pipeline (Staging)" --repo Api4Com/<repo> --ref main -f image_tag=staging

# acompanhar até verde:
gh run watch "$(gh run list --repo Api4Com/<repo> --workflow='Pipeline (Staging)' --limit 1 --json databaseId --jq '.[0].databaseId')" --repo Api4Com/<repo> --exit-status
```

Publica `<repo>:staging` **+** `<repo>:git-<sha>` no ECR us-east-1. (Também dá pra
disparar pela aba **Actions → Pipeline (Staging) → Run workflow** no GitHub.)

### Produção (na publicação de uma GitHub Release)

```bash
# a tag da Release deve seguir vX.Y.Z (casa com a lifecycle policy v*) e refletir
# a "version" do package.json do repo:
gh release create v<version> --repo Api4Com/<repo> --target main --title "v<version>" --notes "..."
```

`release: published` dispara o **Pipeline (Production)**: rebuild do zero + push
`<repo>:production` **+** `<repo>:v<version>`. Não promove a `staging`.

> Se o CI estiver indisponível, veja **Fallback — build manual** no fim.

## Passo 2 — Deploy no host (manual)

### Opção A — `deploy.sh` (recomendado)

O `scripts/deploy.sh` do host faz login no ECR, pull e `up -d` do serviço. Roda com
`sudo` (usa as credenciais/daemon do root):

```bash
ssh -i $KEY $SRV 'sudo /opt/staging/scripts/deploy.sh <serviço-compose>'
# serviços válidos: pbxapi, portal, partners-portal, partners-bff
```

### Opção B — `docker compose` manual (equivalente)

O token do ECR expira em ~12h; renove o login **no servidor** antes do pull.
O compose roda de **`/opt/staging`** (a stack do Partners é incluída de lá — rodar
de `apps/partners` falha porque faltam as vars `${PARTNERS_*}` e a rede).

```bash
ssh -i $KEY $SRV '
  ECR=824572654562.dkr.ecr.us-east-1.amazonaws.com
  sudo aws ecr get-login-password --region us-east-1 \
    | sudo docker login --username AWS --password-stdin $ECR
  cd /opt/staging
  sudo docker compose pull <serviço-compose>
  sudo docker compose up -d <serviço-compose>
  sudo docker compose ps <serviço-compose>
'
```

> Produção não tem host ainda — o Passo 2 hoje vale só pra **staging**. Quando existir
> host de produção, o fluxo é o mesmo, apontando a var de imagem pra `:production`.

## Passo 3 — Validação

```bash
# App respondendo pelo domínio (TLS + /health):
curl -s -w '\n-> HTTP %{http_code}\n' https://<domínio>/health

# Estado do container (deve ficar "healthy"):
ssh -i $KEY $SRV 'sudo docker inspect -f "{{.State.Health.Status}}" <container>'

# Imagem/digest que subiu (confirma que recriou):
ssh -i $KEY $SRV 'sudo docker inspect -f "{{.Config.Image}} {{.Image}}" <container>'
```

Aceite: `/health` = 200, container `healthy`, digest = o do build que você acabou de publicar.

---

## Passo 4 — Rollback

Cada build publica a tag imutável `git-<sha>`. O rollback é apontar a stack para o
SHA anterior. Edite a var de imagem no `.env` **raiz** e recrie:

```bash
ssh -i $KEY $SRV '
  cd /opt/staging
  # ex.: fixar o portal num commit anterior
  sudo sed -i "s#^PARTNERS_PORTAL_ECR_IMAGE=.*#PARTNERS_PORTAL_ECR_IMAGE=824572654562.dkr.ecr.us-east-1.amazonaws.com/partner-portal:git-<sha-anterior>#" .env
  sudo docker compose up -d <serviço-compose>
'
```

Depois de estabilizar, volte a var para `:staging` (garantindo que `:staging` aponte
para a versão boa — se preciso, republique-a via novo dispatch do Pipeline (Staging)).

---

## Só mudou `.env` (sem rebuild)

Config de runtime **não** exige nova imagem. No Portal, as `NUXT_PUBLIC_*` são
lidas em runtime pelo Nitro — trocar URL/limite é só editar e recriar:

```bash
ssh -i $KEY $SRV '
  sudo nano /opt/staging/apps/partners/portal/.env.staging   # ou .../bff/.env.staging
  cd /opt/staging
  sudo docker compose up -d --force-recreate <serviço-compose>
'
```

---

## Fallback — build manual (CI indisponível)

Quando o GitHub Actions estiver fora, dá pra buildar/pushar localmente. **Sempre**
publique também a tag imutável (`git-<sha>`), pra manter o rollback e a lifecycle.

```bash
cd ~/dev/sourcecode/<repo> && git checkout main && git pull
SHA=$(git rev-parse HEAD)

# Mac / Apple Silicon: adicione --platform linux/amd64 (o host é amd64)
docker build --target production -t <repo>:staging .

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR
docker tag <repo>:staging $ECR/<repo>:staging
docker tag <repo>:staging $ECR/<repo>:git-$SHA
docker push $ECR/<repo>:staging && docker push $ECR/<repo>:git-$SHA
```

Depois siga o **Passo 2** normalmente.

### Fallback do fallback — `aws login` local expirou (push dá 403)

Transfira a imagem já tagueada pro daemon do servidor e publique de lá (as
credenciais do host, `github-staging`, seguem válidas):

```bash
docker save $ECR/<repo>:staging | gzip -1 | ssh -i $KEY $SRV 'gunzip | sudo docker load'
ssh -i $KEY $SRV '
  ECR=824572654562.dkr.ecr.us-east-1.amazonaws.com
  sudo aws ecr get-login-password --region us-east-1 | sudo docker login --username AWS --password-stdin $ECR
  sudo docker push $ECR/<repo>:staging
  cd /opt/staging && sudo docker compose up -d --force-recreate <serviço-compose>
'
```

---

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| Pipeline reprova antes de buildar | erro de lint/typecheck (gate) | rodar `npm run lint` / `npm run typecheck` local, corrigir, re-disparar |
| `403 Forbidden` no pull | token do ECR expirou (~12h) no host | refazer o `docker login` no servidor |
| `push` do fallback dá 403 | sessão do `aws` local expirou | reautenticar o `aws` local ou usar o **fallback do fallback** |
| container roda mas `exec format error` | imagem arm64 num host amd64 | rebuild com `--platform linux/amd64` |
| `docker compose` não acha `partners-*` / var vazia | rodou de `apps/partners` | rodar **de `/opt/staging`** |
| cert inválido no domínio | DNS ainda não aponta p/ `129.151.33.239` | criar/propagar o A record; o Traefik reemite sozinho |
| mudou URL do BFF e não pegou | tentou via build args | é runtime: editar `.env` do app + `up -d --force-recreate` |

---

## TL;DR (portal, staging, fluxo com CI)

```bash
KEY=~/Documents/api4com/security/servers/api4com-br.pem; SRV=rocky@129.151.33.239

# 1) CI publica a imagem
gh workflow run "Pipeline (Staging)" --repo Api4Com/partner-portal --ref main -f image_tag=staging
gh run watch "$(gh run list --repo Api4Com/partner-portal --workflow='Pipeline (Staging)' --limit 1 --json databaseId --jq '.[0].databaseId')" --repo Api4Com/partner-portal --exit-status

# 2) deploy no host
ssh -i $KEY $SRV 'sudo /opt/staging/scripts/deploy.sh partners-portal'

# 3) valida
curl -s -w '\n-> HTTP %{http_code}\n' https://partners-staging.api4com.com/health
```
