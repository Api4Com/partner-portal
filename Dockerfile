# Imagem do partner-portal (Nuxt 4).
#
# development -> usada pelo docker-compose (monta o código, roda `nuxt dev`)
# production  -> Nitro standalone (`node .output/server/index.mjs`), usada no Swarm
#
# As envs `NUXT_PUBLIC_*` são lidas em RUNTIME pelo Nitro e sobrescrevem o
# runtimeConfig. Os `process.env.BFF_BASE` do nuxt.config.ts só valem em build
# time — por isso o stack injeta NUXT_PUBLIC_BFF_BASE / NUXT_PUBLIC_CORE_BASE,
# e não BFF_BASE / CORE_BASE.
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base

WORKDIR /home/node/app

# ---------- development ----------
FROM base AS development

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# --host faz o Nuxt escutar em 0.0.0.0 (acessível de fora do container)
CMD ["npm", "run", "dev", "--", "--host"]

# ---------- builder ----------
FROM base AS builder

# NODE_ENV fica DESLIGADO aqui de propósito: com NODE_ENV=production o `npm ci`
# omite as devDependencies, e o `nuxt build` precisa delas.
# `--ignore-scripts` pula o postinstall (`nuxt prepare`), que exigiria o código
# fonte — ainda não copiado neste ponto. O `nuxt build` roda o prepare sozinho.
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY --chown=node:node . .

RUN npm run build

# ---------- production ----------
FROM base AS production

ENV NODE_ENV=production \
    NITRO_PORT=3000 \
    NITRO_HOST=0.0.0.0

RUN apk --no-cache add dumb-init

# O preset node-server empacota as dependências dentro de .output —
# não é preciso copiar node_modules.
COPY --chown=node:node --from=builder /home/node/app/.output ./.output

USER node

EXPOSE 3000

# `fetch` nativo em vez de curl: a imagem alpine do node não traz curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.NITRO_PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["dumb-init", "node", ".output/server/index.mjs"]
