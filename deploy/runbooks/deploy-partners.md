# Runbook — Deploy do Partners (portal + BFF) em staging

Como buildar a imagem, publicar no ECR, baixar no servidor e atualizar a stack.
Vale para os **dois** serviços do Partners. Onde aparecer `<...>`, troque pelos
valores da tabela abaixo.

> **Ambiente:** `cld-orc-staging` (`129.151.33.239`) — **docker compose** (NÃO é
> swarm; nada de `docker stack` / `--with-registry-auth` aqui). A stack do Partners
> é incluída pelo compose raiz de `/opt/staging`.

---

## Referência dos serviços

| | **Portal** | **BFF** |
|---|---|---|
| Repo (git) | `partner-portal` | `partner-portal-bff` |
| Branch | `feat/HACKAFEST-partners` | `feat/HACKAFEST-partners` |
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

## Pré-requisitos

- Acesso SSH ao servidor com a chave `api4com-br.pem` (`ssh -i $KEY $SRV`).
- `aws` CLI logado localmente com permissão no ECR (`aws sts get-caller-identity`).
- Docker local capaz de gerar imagem **linux/amd64** (o servidor é amd64).
- A imagem do serviço já existe na stack (`docker compose config --services` no
  servidor lista `partners-portal` e `partners-bff`). Se for a **1ª vez** de um
  domínio novo, o DNS precisa apontar para `129.151.33.239` **antes** do 1º `up`
  (o cert Let's Encrypt é emitido por HTTP-01 no primeiro acesso).

---

## Passo 1 — Build da imagem (local)

```bash
cd ~/dev/sourcecode/<repo>
git checkout feat/HACKAFEST-partners && git pull
SHA=$(git rev-parse --short HEAD)

docker build --target production -t <repo>:staging .
```

> **Mac / Apple Silicon:** adicione `--platform linux/amd64` no build, senão a
> imagem sai arm64 e não roda no servidor.

## Passo 2 — Login, tag e push no ECR (local)

```bash
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR

docker tag <repo>:staging $ECR/<repo>:staging
docker tag <repo>:staging $ECR/<repo>:$SHA     # tag imutável p/ rollback

docker push $ECR/<repo>:staging
docker push $ECR/<repo>:$SHA
```

> **Sempre** publique a tag `:$SHA` além de `:staging` — é ela que permite
> rollback determinístico (Passo 5).

## Passo 3 — Baixar no servidor e atualizar a stack

### Opção A — `deploy.sh` (recomendado)

O `scripts/deploy.sh` do host já cobre o Partners: faz login no ECR, pull e
`up -d` do serviço. Roda com `sudo` (usa as credenciais/daemon do root):

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

## Passo 4 — Validação

```bash
# App respondendo pelo domínio (TLS + /health):
curl -s -w '\n-> HTTP %{http_code}\n' https://<domínio>/health

# Estado do container (deve ficar "healthy"):
ssh -i $KEY $SRV 'sudo docker inspect -f "{{.State.Health.Status}}" <container>'

# Versão que subiu (confirma o digest/imagem):
ssh -i $KEY $SRV 'sudo docker inspect -f "{{.Config.Image}}" <container>'
```

Aceite: `/health` = 200, container `healthy`, imagem = a que você acabou de publicar.

---

## Passo 5 — Rollback

Como cada deploy publica `:$SHA`, o rollback é apontar a stack para o SHA anterior.
Edite a var de imagem no `.env` **raiz** e recrie:

```bash
ssh -i $KEY $SRV '
  cd /opt/staging
  # ex.: fixar o portal numa versão anterior
  sudo sed -i "s#^PARTNERS_PORTAL_ECR_IMAGE=.*#PARTNERS_PORTAL_ECR_IMAGE=824572654562.dkr.ecr.us-east-1.amazonaws.com/partner-portal:<sha-anterior>#" .env
  sudo docker compose up -d <serviço-compose>
'
```

Depois de estabilizar, volte a var para `:staging` (e garanta que `:staging`
aponte para a versão boa, republicando-a se necessário).

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

## Fallback — `aws login` local expirou (push dá 403)

Sem reautenticar localmente, transfira a imagem para o servidor e publique de lá
(as credenciais do host, `github-staging`, seguem válidas):

```bash
# 1) manda a imagem já tagueada p/ ECR direto pro daemon do servidor
docker save $ECR/<repo>:staging | gzip -1 \
  | ssh -i $KEY $SRV 'gunzip | sudo docker load'

# 2) no servidor: publica no ECR e sobe
ssh -i $KEY $SRV '
  ECR=824572654562.dkr.ecr.us-east-1.amazonaws.com
  sudo aws ecr get-login-password --region us-east-1 \
    | sudo docker login --username AWS --password-stdin $ECR
  sudo docker push $ECR/<repo>:staging
  cd /opt/staging && sudo docker compose up -d --force-recreate <serviço-compose>
'
```

---

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| `403 Forbidden` no pull/push | token do ECR expirou (~12h) | refazer o `docker login` (local e/ou no servidor) |
| `push` dá 403 mesmo logado | sessão do `aws` local expirou | `aws sso login` (ou o fluxo de auth de vocês) ou usar o **Fallback** acima |
| container roda mas `exec format error` | imagem arm64 num host amd64 | rebuild com `--platform linux/amd64` |
| `docker compose` não acha `partners-*` / var vazia | rodou de `apps/partners` | rodar **de `/opt/staging`** |
| cert inválido no domínio | DNS ainda não aponta p/ `129.151.33.239` | criar/propagar o A record; o Traefik reemite sozinho |
| mudou URL do BFF e não pegou | tentou via build args | é runtime: editar `.env` do app + `up -d --force-recreate` |

---

## TL;DR (portal, exemplo completo)

```bash
ECR=824572654562.dkr.ecr.us-east-1.amazonaws.com; REGION=us-east-1
KEY=~/Documents/api4com/security/servers/api4com-br.pem; SRV=rocky@129.151.33.239

cd ~/dev/sourcecode/partner-portal && git pull
SHA=$(git rev-parse --short HEAD)
docker build --target production -t partner-portal:staging .
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR
docker tag partner-portal:staging $ECR/partner-portal:staging
docker tag partner-portal:staging $ECR/partner-portal:$SHA
docker push $ECR/partner-portal:staging && docker push $ECR/partner-portal:$SHA

ssh -i $KEY $SRV '
  ECR=824572654562.dkr.ecr.us-east-1.amazonaws.com
  sudo aws ecr get-login-password --region us-east-1 | sudo docker login --username AWS --password-stdin $ECR
  cd /opt/staging
  sudo docker compose pull partners-portal
  sudo docker compose up -d partners-portal
'
curl -s -w '\n-> HTTP %{http_code}\n' https://partners-staging.api4com.com/health
```
