# Deploy num servidor só (VPS)

Um único servidor, um único cadastro. Sem domínio, sem HTTPS — acesso
direto por IP (ver limitações no fim). Bom pra teste com o time; pra
produção de verdade, precisa de mais (HTTPS, backup automático, etc).

**Importante**: eu não consigo criar o servidor nem configurá-lo
remotamente — este ambiente aqui não tem acesso de saída por SSH nem
pelas APIs dos provedores de nuvem (testei os dois). Os passos abaixo são
pra você (ou quem tiver acesso ao servidor) rodar.

---

## 1. Criar o servidor

Qualquer provedor de VPS serve — o script não depende de nada específico
de um provedor, só precisa de uma VM comum com Ubuntu e root via SSH.
Recomendo:

- **Hostinger** — plano **VPS** (não confundir com "Hospedagem de
  Sites", que não dá root/Docker). Aceita Pix/boleto, o que evita cartão
  internacional. Escolha um plano com pelo menos 4GB RAM.
- **Hetzner Cloud** — mais barato (plano CX22: 2 vCPU / 4GB RAM / 40GB
  disco, ~€4,35/mês ≈ R$25/mês). Sem datacenter no Brasil (mais perto:
  EUA), mas ótimo custo-benefício. Só cartão internacional.
- **DigitalOcean** — mais caro pela mesma config (~$12/mês ≈ R$65/mês),
  mas interface mais simples e muita documentação em português na
  comunidade. Só cartão internacional.

Na criação, escolha:
- **Imagem/SO**: Ubuntu 24.04 LTS
- **Tamanho**: pelo menos 2GB RAM, de preferência 4GB (Postgres + Redis +
  API + build do frontend juntos precisam de folga — 1GB é arriscado)
- **Datacenter**: se tiver opção no Brasil, prefira essa (menor latência)
- **Autenticação**: SSH key (mais seguro) ou senha root, como preferir

Ao final, você tem um **IP público** (ex: `203.0.113.10`) e acesso root
via SSH.

## 2. Entrar no servidor e rodar UM comando

```bash
ssh root@SEU-IP
```

Já dentro do servidor, cole (trocando só o e-mail):

```bash
curl -fsSL https://raw.githubusercontent.com/aglaube1601/aglaube/claude/new-session-3t2571/deploy/quickstart.sh \
  | bash -s -- seu-email@exemplo.com
```

Isso, sozinho:
1. instala Docker (se não tiver);
2. clona o projeto em `/opt/aglaube`;
3. gera senhas fortes aleatórias e detecta o IP público do servidor
   sozinho — **nenhum arquivo pra editar**;
4. builda e sobe os 4 containers (Postgres, Redis, API, frontend);
5. carrega o dado real de Vila Nova do Piauí e cria o Administrador.

Demora uns 5-10 minutos na primeira vez (build das imagens). No final,
ele imprime a URL do site e **a senha do Administrador — aparece só essa
vez, anote antes de fechar o terminal.**

Abra `http://SEU-IP` no navegador e faça login com o e-mail que você
passou + a senha impressa.

### Se o branch já tiver virado `main`

O comando acima aponta pro branch `claude/new-session-3t2571`. Se o
projeto já tiver mergeado isso na `main`, troque a URL do raw.githubusercontent
pra apontar `main` no lugar do nome do branch (ou defina
`AGLAUBE_BRANCH=main` antes do `curl`, ex:
`AGLAUBE_BRANCH=main curl -fsSL ... | bash -s -- seu-email@exemplo.com`).

## 3. Abrir as portas no firewall (se o provedor tiver um)

Hetzner e DigitalOcean costumam ter um firewall de rede separado do
Ubuntu. Libere entrada nas portas **80** (frontend) e **3000** (API) —
elas já saem publicadas pelo Docker Compose.

---

## Opção B — controlando as senhas você mesmo

Se preferir escolher as senhas/URLs em vez do script gerar sozinho:

```bash
git clone https://github.com/aglaube1601/aglaube.git /opt/aglaube
cd /opt/aglaube
git checkout claude/new-session-3t2571

cp .env.prod.example .env.prod
nano .env.prod   # preencha POSTGRES_PASSWORD, JWT_SECRET, PUBLIC_API_URL,
                  # PUBLIC_WEB_URL, ADMIN_BOOTSTRAP_EMAIL/SENHA

chmod +x deploy/vps-setup.sh
./deploy/vps-setup.sh --seed
```

Mesmo resultado do comando único — só que aqui você escolhe cada valor em
vez do script gerar sozinho.

---

## Depois do primeiro deploy

- **Atualizar o código**: rode o mesmo comando `curl ... | bash -s --
  seu-email@exemplo.com` de novo (o script detecta que já existe
  instalação e só faz `git pull` + rebuild — não reseeda, não recria
  admin). Ou, se preferir manual: `cd /opt/aglaube && git pull &&
  ./deploy/vps-setup.sh` (sem `--seed`).
- **Ver logs**: `docker compose -f docker-compose.prod.yml logs -f api`
  (ou `web`, `postgres`, `redis`) dentro de `/opt/aglaube`.
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
