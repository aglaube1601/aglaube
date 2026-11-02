#!/usr/bin/env bash
#
# Ponto de entrada único — pensado pra rodar via curl | bash num VPS
# Ubuntu recém-criado, sem precisar clonar nada nem editar arquivo
# nenhum antes. Ver VPS_DEPLOY.md.
#
# Uso (como root, ou com sudo):
#   curl -fsSL <RAW_URL_DESTE_ARQUIVO> | bash -s -- seu-email@exemplo.com
#
# O que faz: instala git se faltar, clona (ou atualiza, se já existir) o
# repositório em /opt/aglaube, e chama deploy/vps-setup.sh --auto com o
# e-mail passado — que gera senhas fortes sozinho, detecta o IP público
# do servidor, sobe o stack inteiro e carrega o dado real + cria o
# Administrador. A senha do Administrador só aparece UMA VEZ, no final —
# anote.

set -euo pipefail

EMAIL="${1:-}"
if [ -z "$EMAIL" ]; then
  echo "Uso: curl -fsSL <url-deste-script> | bash -s -- seu-email@exemplo.com"
  exit 1
fi

REPO_URL="${AGLAUBE_REPO_URL:-https://github.com/aglaube1601/aglaube.git}"
BRANCH="${AGLAUBE_BRANCH:-claude/new-session-3t2571}"
INSTALL_DIR="/opt/aglaube"

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode como root (ou com sudo) — este script instala pacotes do sistema."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "Instalando git..."
  apt-get update -y
  apt-get install -y git
fi

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Já existe uma instalação em $INSTALL_DIR — atualizando..."
  git -C "$INSTALL_DIR" fetch origin "$BRANCH"
  git -C "$INSTALL_DIR" checkout "$BRANCH"
  git -C "$INSTALL_DIR" reset --hard "origin/$BRANCH"
else
  echo "Clonando o repositório em $INSTALL_DIR..."
  git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
chmod +x deploy/vps-setup.sh

if [ -f .env.prod ]; then
  echo ".env.prod já existe em $INSTALL_DIR — isto é uma ATUALIZAÇÃO, não a primeira instalação."
  echo "Rebuildando e reiniciando os containers com o código mais recente (sem reseed — o seed.ts"
  echo "não tem proteção contra duplicar o dado eleitoral se rodar de novo)."
  exec ./deploy/vps-setup.sh
else
  exec ./deploy/vps-setup.sh --auto "$EMAIL"
fi
