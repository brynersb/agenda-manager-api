ARG NODE_VERSION=26.13.1

FROM node:${NODE_VERSION}-alpine AS base
ENV CI=true
WORKDIR /app
COPY package.json package-lock.json ./

FROM base AS development
ENV NODE_ENV=development
RUN npm ci --ignore-scripts
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

FROM base AS build
ENV NODE_ENV=development
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:${NODE_VERSION}-alpine AS production

# Atualiza os pacotes do SO da base Alpine sem trocar a versão pinada do Node.
RUN apk upgrade --no-cache

ENV NODE_ENV=production
ENV CI=true
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
# Entrypoint: aplica as migrations (RUN_MIGRATIONS=true) e só então sobe a API.
COPY --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh
# Execução sem privilégios (o usuário `node` já existe na imagem oficial).
USER node
EXPOSE 3000

# start-period folga para as migrations da primeira subida (Neon acordando).
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get(\`http://127.0.0.1:\${process.env.PORT ?? 3000}/health\`, (r) => { r.resume(); process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]
