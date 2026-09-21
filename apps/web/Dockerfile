# Builda com CONTEXTO na raiz do monorepo — mesmo motivo do Dockerfile da
# API (ver apps/api/Dockerfile): o pnpm workspace precisa enxergar
# pnpm-workspace.yaml + pnpm-lock.yaml na raiz.
#
# VITE_API_URL é assado no BUILD (Vite embute env vars no bundle estático
# em tempo de build, não de execução) — por isso vem como build arg, não
# variável de ambiente do container em runtime. Se a URL pública da API
# mudar, precisa rebuildar esta imagem, não só reiniciar o container.

FROM node:22-slim AS base
RUN corepack enable

FROM base AS deps
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
COPY apps/web apps/web
RUN pnpm --filter @aglaube/web run build

FROM nginx:alpine AS runtime
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
