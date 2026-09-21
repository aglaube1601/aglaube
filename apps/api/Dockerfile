# Builda com o CONTEXTO na raiz do monorepo (não em apps/api/), porque o
# pnpm workspace precisa enxergar pnpm-workspace.yaml + pnpm-lock.yaml na
# raiz para resolver as dependências corretamente. No Render: "Docker
# Build Context Directory" = raiz do repo, "Dockerfile Path" = apps/api/Dockerfile
# (já configurado assim em render.yaml).
#
# Copia o workspace inteiro (api + web) na etapa de deps de propósito —
# mais simples e robusto que tentar podar só o necessário, e o custo extra
# de build não importa pra um deploy de teste gratuito.

FROM node:22-slim AS base
RUN corepack enable

FROM base AS deps
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/api apps/api
RUN pnpm --filter @aglaube/api exec prisma generate
RUN pnpm --filter @aglaube/api run build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY apps/api/package.json ./apps/api/package.json

WORKDIR /repo/apps/api
EXPOSE 3000

# migrate deploy roda em TODO boot — idempotente (só aplica o que falta),
# então é seguro em cada deploy/restart, sem precisar de um passo separado
# de "release command" (Render free tier não tem esse recurso).
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
