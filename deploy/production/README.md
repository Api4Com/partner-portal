# Produção — partner-portal (host tools1)

Deploy de **produção** do **portal** no host `tools1.api4com.com` (**136.248.85.42**).

> O **BFF** tem o seu próprio set de deploy no repo
> [`partner-portal-bff`](https://github.com/Api4Com/partner-portal-bff) em
> `deploy/production/`. Os dois serviços sobem na mesma rede `platform_shared`.

## Modelo (nativo do tools1)

Docker **standalone** + **docker-compose** (um dir/compose por serviço); **nginx**
no host termina 443 com o cert **wildcard** `*.api4com.com`
(`/var/www/api4com/certs/`); rede bridge externa `platform_shared`. **Não** é
swarm/traefik (esse é o modelo do `.100`).

| | Portal |
|---|---|
| Container | `partner-portal-prod` |
| Porta (host, só 127.0.0.1) | `3020` |
| Imagem ECR | `partner-portal:production` |
| Domínio | `partners.api4com.com` |
| Réplicas | 1 |

Arquivos (templates versionados; os reais ficam no host):
`docker-compose.production.yml`, `.env.production.example`,
`nginx/partners.api4com.conf`.

## Pré-requisitos (uma vez)

1. **Imagem `partner-portal:production` no ECR** — construída do código real
   (via GitHub Release → pipeline de produção).
2. **DNS** — `partners.api4com.com` (A) → `136.248.85.42`. O cert wildcard já cobre.
3. **Arquivos no host** em `/var/www/html/partner-portal/`:
   `docker-compose.production.yml` + `.env.production` (do `.example`, com a chave
   reCAPTCHA de prod; `chmod 600`).
4. **vhost nginx** — copiar `nginx/partners.api4com.conf` para `/etc/nginx/conf.d/`,
   depois `sudo nginx -t && sudo systemctl reload nginx`.

## Deploy / atualizar

```bash
cd /var/www/html/partner-portal
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin 824572654562.dkr.ecr.us-east-1.amazonaws.com
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml ps
```

## Validação

```bash
curl -fsS http://127.0.0.1:3020/health                       # no host
curl -s -w '\n-> %{http_code}\n' https://partners.api4com.com/health   # externo (TLS)
```

Aceite: `/health` = 200, TLS válido (wildcard), portal carrega o `/login`.

## Rollback

```bash
# fixa o portal numa versão anterior (tags imutáveis git-<sha> / v<version>)
PORTAL_TAG=v1.0.0 docker compose -f docker-compose.production.yml up -d
```
