# Imagem de desenvolvimento do partner-portal (Nuxt 4).
# Em dev, o docker-compose monta o código e roda `npm install && npm run dev`,
# então esta imagem só precisa do runtime Node.
FROM node:24-alpine AS development

WORKDIR /home/node/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

# --host faz o Nuxt escutar em 0.0.0.0 (acessível de fora do container)
CMD ["npm", "run", "dev", "--", "--host"]
