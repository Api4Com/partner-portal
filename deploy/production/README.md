# Produção — partner-portal (host tools1)

Deploy de **produção** no host `tools1.api4com.com` (**136.248.85.42**).

## Modelo (nativo do tools1)

Docker **standalone** + **docker-compose**; **nginx** no host termina 443 com o
cert **wildcard** `*.api4com.com` (`/var/www/api4com/certs/`); rede bridge externa
`platform_shared`. **Não** é swarm/traefik (esse é o modelo do `.100`).

| | Portal | BFF |
|---|---|---|
| Container | `partner-portal-prod` | `partner-portal-bff-prod` |
| Porta (host, só 127.0.0.1) | `3020` | `3021` |
| Imagem ECR | `partner-portal:production` | `partner-portal-bff:production` |
| Domínio | `partners.api4com.com` | `partners-bff.api4com.com` |
| Réplicas | 1 | 1 (escala p/ 2 depois) |

Arquivos neste diretório (templates versionados; os reais ficam no host):
`docker-compose.production.yml`, `.env.portal.production.example`,
`.env.bff.production.example`, `nginx/partners.api4com.conf`,
`nginx/partners-bff.api4com.conf`.

## Pré-requisitos (uma vez)

1. **Imagens `:production` no ECR** — construídas do código real (via GitHub Release;
   ver o pipeline de produção). Sem isso, `docker compose pull` não acha `:production`.
2. **DNS** — `partners` e `partners-bff` (A) → `136.248.85.42`. O cert wildcard já
   cobre; não há emissão por domínio.
3. **Arquivos no host** em `/var/www/html/partner-portal/`:
   - `docker-compose.production.yml`
   - `.env.portal.production` e `.env.bff.production` (a partir dos `.example`,
     preenchendo reCAPTCHA prod + segredos do BFF; `chmod 600`).
4. **vhosts nginx** — copiar os 2 `.conf` para `/etc/nginx/conf.d/`, depois
   `sudo nginx -t && sudo systemctl reload nginx`.

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
# Local no host (container):
curl -fsS http://127.0.0.1:3020/health        # portal
curl -fsS http://127.0.0.1:3021/health        # bff
# Externo (TLS + nginx):
curl -s -w '\n-> %{http_code}\n' https://partners.api4com.com/health
curl -s -w '\n-> %{http_code}\n' https://partners-bff.api4com.com/health
```

Aceite: `/health` = 200 nos dois, TLS válido (wildcard), portal carrega o `/login`.

## Rollback

As imagens imutáveis por commit/versão (`git-<sha>` / `v<version>`) permitem fixar
uma versão anterior:

```bash
# ex.: fixar o portal numa versão anterior
PORTAL_TAG=v1.0.0 docker compose -f docker-compose.production.yml up -d partner-portal
```

## Escalar o BFF para 2 réplicas (depois)

1. 2º container do BFF publicando `127.0.0.1:3022` (duplicar o serviço no compose,
   ex. `partner-portal-bff-2`, ou `--scale` com portas distintas).
2. Descomentar `server 127.0.0.1:3022;` no `upstream partners_bff` do vhost.
3. `sudo nginx -t && sudo systemctl reload nginx`.
