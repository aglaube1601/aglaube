# Deploy num servidor só (VPS)

Um único servidor, um único cadastro, um script que sobe tudo (Postgres,
Redis, API e frontend) via Docker Compose. Sem domínio, sem HTTPS — acesso
direto por IP (ver limitações no fim). Bom pra teste com o time; pra
produção de verdade, precisa de mais (HTTPS, backup automático, etc).

**Importante**: eu não consigo configurar o servidor remotamente — este
ambiente aqui não tem acesso de saída por SSH (testei). Os passos abaixo
são pra você (ou quem tiver acesso ao servidor) rodar.

---

## 1. Criar o servidor

Qualquer provedor de VPS serve. Recomendo:

- **Hetzner Cloud** — mais barato (plano CX22: 2 vCPU / 4GB RAM / 40GB
  disco, ~€4,35/mês ≈ R$25/mês). Sem datacenter no Brasil (mais perto:
  EUA), mas ótimo custo-benefício.
- **DigitalOcean** — mais caro pela mesma config (~$12/mês ≈ R$65/mês),
  mas interface mais simples e muita documentação em português na
  comunidade.

Na criação, escolha:
- **Imagem/SO**: Ubuntu 24.04 LTS
- **Tamanho**: pelo menos 2GB RAM (Postgres + Redis + API + build do
  frontend juntos precisam de folga — 1GB é arriscado)
- **Autenticação**: SSH key (mais seguro) ou senha root, como preferir

Ao final, você tem um **IP público** (ex: `203.0.113.10`) e acesso root
via SSH.

## 2. Entrar no servidor e clonar o projeto

```bash
ssh root@SEU-IP

apt-get update && apt-get install -y git
git clone https://github.com/aglaube1601/aglaube.git
cd aglaube
git checkout claude/new-session-3t2571   # ou a branch/main que vocês usarem
```

## 3. Configurar as variáveis de ambiente

```bash
cp .env.prod.example .env.prod
nano .env.prod   # ou vim, o que tiver
```

Preencha:
- `POSTGRES_PASSWORD` — senha forte (ex: `openssl rand -hex 24`)
- `JWT_SECRET` — segredo forte (ex: `openssl rand -hex 32`)
- `PUBLIC_API_URL` → `http://SEU-IP:3000` (troque `SEU-IP` pelo IP real)
- `PUBLIC_WEB_URL` → `http://SEU-IP`
- `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_SENHA` — só pra criar o
  primeiro usuário Administrador

## 4. Rodar o setup

```bash
chmod +x deploy/vps-setup.sh
./deploy/vps-setup.sh --seed
```

Isso instala o Docker (se não tiver), builda as imagens (leva alguns
minutos na primeira vez), sobe os 4 containers, espera a API responder, e
com `--seed` já carrega o dado real de Vila Nova do Piauí e cria o
Administrador.

Ao final o script mostra as duas URLs. Abra `http://SEU-IP` no navegador,
faça login com o e-mail/senha do `.env.prod`.

## 5. Abrir as portas no firewall (se o provedor tiver um)

Hetzner e DigitalOcean costumam ter um firewall de rede separado do
Ubuntu. Libere entrada nas portas **80** (frontend) e **3000** (API) —
elas já saem publicadas no `docker-compose.prod.yml`. Se preferir travar
mais, dá pra deixar só a 80 aberta e mudar `PUBLIC_API_URL` pra um
caminho atrás de um proxy — mas isso é além do escopo deste guia rápido.

---

## Depois do primeiro deploy

- **Atualizar o código**: `git pull && ./deploy/vps-setup.sh` (sem
  `--seed` — isso recriaria o dado). Rebuilda e reinicia os containers
  com o código novo, sem mexer no banco.
- **Ver logs**: `docker compose -f docker-compose.prod.yml logs -f api`
  (ou `web`, `postgres`, `redis`).
- **Trocar a senha do admin**: pelo próprio app, ou recriando o usuário.

## Limitações desse setup (é pra teste, não produção)

- **Sem HTTPS** — tudo em `http://`, navegador vai avisar "não seguro".
  Pra testar entre o time isso costuma ser aceitável; pra qualquer coisa
  com dado sensível de verdade, precisa de um domínio + certificado (dá
  pra adicionar depois com Caddy ou Traefik na frente, sem mudar o resto).
- **Sem backup automático do Postgres** — o volume Docker persiste entre
  reinícios do container, mas se o servidor inteiro for perdido, o dado
  vai junto. Pra algo além de teste, configure snapshot do provedor ou
  `pg_dump` agendado.
- **Um servidor só** — se ele cair, tudo cai junto (API, banco, fila,
  frontend). Sem redundância.
- **Sem monitoramento/alerta** — se algo travar de madrugada, ninguém é
  avisado; só descobre quando for usar.
- Nada disso substitui a revisão jurídica formal (LGPD + eleitoral) citada
  no `HANDOFF.md` antes de operar com dado real de eleitor.
