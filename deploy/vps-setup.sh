#!/usr/bin/env bash
#
# Setup de uma vez só num VPS Ubuntu limpo: instala Docker se precisar,
# builda e sobe o stack inteiro (Postgres, Redis, API, frontend). Rode
# como root (ou com sudo). Ver VPS_DEPLOY.md para o passo a passo com
# contexto.
#
# Uso:
#   ./deploy/vps-setup.sh --auto SEU-EMAIL@EXEMPLO.COM
#       Gera .env.prod sozinho (senhas fortes aleatórias, IP público
#       detectado automaticamente) e já sobe com seed. É o caminho pra
#       quem não quer editar nenhum arquivo à mão — normalmente chamado
#       através do deploy/quickstart.sh, não direto.
#
#   ./deploy/vps-setup.sh --seed
#       Usa o .env.prod que você mesmo criou (a partir do
#       .env.prod.example) e já roda o seed. Pra quem quer controlar as
#       senhas/URLs.
#
#   ./deploy/vps-setup.sh
#       Só sobe/atualiza o stack com o .env.prod existente, sem seed —
#       é o comando de update depois do primeiro deploy (git pull + isso).
#
# Idempotente: rodar de novo sem --seed só rebuilda e reinicia os
# containers com o código mais recente — não duplica nem apaga dado.
# --seed/--auto rodando de novo NÃO recria o admin se já existir um (ver
# seed-admin-usuario.ts), mas o seed.ts de dado eleitoral não tem essa
# proteção — não rode --seed/--auto uma segunda vez à toa.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

detectar_ip_publico() {
  for url in https://api.ipify.org https://ifconfig.me https://icanhazip.com; do
    ip="$(curl -fsS --max-time 5 "$url" 2>/dev/null | tr -d '[:space:]')" || continue
    if [ -n "$ip" ]; then
      echo "$ip"
      return 0
    fi
  done
  return 1
}

MODO_SEED=""
ADMIN_SENHA_GERADA=""

if [ "${1:-}" = "--auto" ]; then
  EMAIL="${2:?uso: ./deploy/vps-setup.sh --auto seu-email@exemplo.com}"

  if [ -f .env.prod ]; then
    echo ".env.prod já existe — não sobrescrevo. Se quer gerar de novo, apague-o primeiro ou use --seed."
    exit 1
  fi

  if ! command -v openssl >/dev/null 2>&1; then
    apt-get update -y >/dev/null && apt-get install -y openssl >/dev/null
  fi

  echo "Detectando IP público do servidor..."
  IP_PUBLICO="$(detectar_ip_publico)" || {
    echo "Não consegui detectar o IP público automaticamente."
    echo "Copie .env.prod.example para .env.prod, preencha PUBLIC_API_URL/PUBLIC_WEB_URL manualmente e rode com --seed."
    exit 1
  }
  echo "IP detectado: $IP_PUBLICO"

  ADMIN_SENHA_GERADA="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"

  cat > .env.prod <<EOF
POSTGRES_PASSWORD="$(openssl rand -hex 24)"
JWT_SECRET="$(openssl rand -hex 32)"
PUBLIC_API_URL="http://${IP_PUBLICO}:3000"
PUBLIC_WEB_URL="http://${IP_PUBLICO}"
ADMIN_BOOTSTRAP_EMAIL="${EMAIL}"
ADMIN_BOOTSTRAP_SENHA="${ADMIN_SENHA_GERADA}"
EOF
  chmod 600 .env.prod
  echo ".env.prod gerado."
  MODO_SEED="1"
elif [ "${1:-}" = "--seed" ]; then
  MODO_SEED="1"
fi

if [ ! -f .env.prod ]; then
  echo "Não encontrei .env.prod na raiz do repo."
  echo "Ou copie .env.prod.example para .env.prod e preencha à mão, ou rode:"
  echo "  ./deploy/vps-setup.sh --auto seu-email@exemplo.com"
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

if [ -n "$MODO_SEED" ]; then
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
  if [ -z "$ADMIN_SENHA_GERADA" ]; then
    echo "Feito o seed. Pode remover ADMIN_BOOTSTRAP_EMAIL/ADMIN_BOOTSTRAP_SENHA do .env.prod agora"
    echo "(não é usado por nenhum container em execução, só por este script)."
  fi
fi

echo ""
echo "==================================================================="
echo "Frontend: ${PUBLIC_WEB_URL:-http://SEU-IP}"
echo "API:      ${PUBLIC_API_URL:-http://SEU-IP:3000}/health"
if [ -n "$ADMIN_SENHA_GERADA" ]; then
  echo ""
  echo "Login do Administrador (ANOTE — só aparece aqui, uma vez):"
  echo "  e-mail: ${ADMIN_BOOTSTRAP_EMAIL}"
  echo "  senha:  ${ADMIN_SENHA_GERADA}"
  echo ""
  echo "Troque essa senha no primeiro login."
fi
echo "==================================================================="
