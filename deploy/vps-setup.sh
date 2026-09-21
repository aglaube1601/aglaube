#!/usr/bin/env bash
#
# Setup de uma vez só num VPS Ubuntu limpo: instala Docker se precisar,
# builda e sobe o stack inteiro (Postgres, Redis, API, frontend). Rode
# como root (ou com sudo). Ver VPS_DEPLOY.md para o passo a passo com
# contexto.
#
# Uso:
#   ./deploy/vps-setup.sh          # sobe/atualiza o stack
#   ./deploy/vps-setup.sh --seed   # + roda o seed de dados e cria o admin
#                                   # (só na primeira vez — ver aviso abaixo)
#
# Idempotente: rodar de novo (sem --seed) só rebuilda e reinicia os
# containers com o código mais recente — não duplica nem apaga dado.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f .env.prod ]; then
  echo "Não encontrei .env.prod na raiz do repo."
  echo "Copie .env.prod.example para .env.prod e preencha antes de rodar este script:"
  echo "  cp .env.prod.example .env.prod && nano .env.prod"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não encontrado — instalando (script oficial get.docker.com)..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose (plugin) não encontrado mesmo depois da instalação."
  echo "Instale manualmente: apt-get install docker-compose-plugin"
  exit 1
fi

echo "Subindo o stack (a primeira build demora alguns minutos)..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo "Aguardando a API responder em /health..."
# shellcheck disable=SC1091
source .env.prod
API_HEALTH_URL="${PUBLIC_API_URL:-http://localhost:3000}/health"
ok=""
for _ in $(seq 1 30); do
  if curl -fsS "$API_HEALTH_URL" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done
if [ -z "$ok" ]; then
  echo "A API não respondeu em /health depois de 60s. Rode 'docker compose -f docker-compose.prod.yml logs api' pra investigar."
  exit 1
fi
echo "API no ar."

if [ "${1:-}" = "--seed" ]; then
  echo ""
  echo "Rodando seed de dados reais (Vila Nova do Piauí, TSE 2024)..."
  docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T api \
    pnpm exec ts-node prisma/seed.ts

  echo "Criando o primeiro Administrador..."
  docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T \
    -e ADMIN_BOOTSTRAP_EMAIL="${ADMIN_BOOTSTRAP_EMAIL:?defina ADMIN_BOOTSTRAP_EMAIL no .env.prod}" \
    -e ADMIN_BOOTSTRAP_SENHA="${ADMIN_BOOTSTRAP_SENHA:?defina ADMIN_BOOTSTRAP_SENHA no .env.prod}" \
    api pnpm exec ts-node prisma/seed-admin-usuario.ts

  echo ""
  echo "Feito o seed. Pode remover ADMIN_BOOTSTRAP_EMAIL/ADMIN_BOOTSTRAP_SENHA do .env.prod agora"
  echo "(não é usado por nenhum container em execução, só por este script)."
fi

echo ""
echo "==================================================================="
echo "Frontend: ${PUBLIC_WEB_URL:-http://SEU-IP}"
echo "API:      ${PUBLIC_API_URL:-http://SEU-IP:3000}/health"
echo "==================================================================="
