# Deploy gratuito para testes

Guia pra colocar o AGLAUBE no ar de graça, só pra testar (não é um setup de
produção — ver limitações no fim). Quatro serviços gratuitos, um pra cada
peça do stack:

| Peça | Serviço | Por quê |
|---|---|---|
| Frontend (`apps/web`) | [Vercel](https://vercel.com) | Deploy estático direto do GitHub, sem cold start |
| API (`apps/api`) | [Render](https://render.com) | Web service Node de verdade, 750h/mês grátis |
| Postgres | [Supabase](https://supabase.com) | Free tier, `pg_trgm` já disponível (é o único extension que o projeto usa — apesar do nome do stack mencionar PostGIS, o schema atual não tem nenhuma coluna geométrica) |
| Redis (fila BullMQ) | [Upstash](https://upstash.com) | Free tier serverless, funciona com BullMQ via TLS |

Nenhum pede cartão de crédito pro free tier. Ordem importa: banco e Redis
primeiro (a API precisa das URLs deles pra subir).

---

## 1. Banco de dados (Supabase)

1. Crie conta em supabase.com, "New Project". Anote a senha do banco que
   você definir ali (Supabase pede uma na criação).
2. Depois do projeto criado: **Project Settings → Database → Connection
   string**. Use a opção **"URI"** no modo **direto** (não o "Transaction
   pooler") — a API roda como processo persistente, não serverless, então
   não precisa de pooler.
3. A connection string vem como:
   ```
   postgresql://postgres:[SUA-SENHA]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
   Adicione `?sslmode=require` no final. Essa é a sua `DATABASE_URL`.

## 2. Redis (Upstash)

1. Crie conta em upstash.com, "Create Database" (região mais próxima do
   Render, ex: US East se for usar Oregon/Ohio no Render).
2. Na página do banco, copie a **"UDS" / connection string TLS** — começa
   com `rediss://` (com dois "s", TLS). Essa é a sua `REDIS_URL`.

## 3. API (Render)

1. Faça fork ou dê push deste repositório pro seu GitHub (o Render lê
   direto de lá).
2. No Render: **New → Blueprint**, conecte o repositório. Ele encontra o
   `render.yaml` da raiz sozinho e propõe criar o serviço `aglaube-api`.
3. Antes de confirmar, preencha as variáveis marcadas como obrigatórias:
   - `DATABASE_URL` → a do passo 1
   - `REDIS_URL` → a do passo 2
   - `CORS_ORIGIN` → deixe em branco por enquanto, você volta aqui depois do passo 5
   - `JWT_SECRET` já vem gerado automaticamente pelo Render, não mexa
4. Deploy. A primeira build demora uns 3-5 minutos (build da imagem Docker
   + `prisma migrate deploy` rodando no boot). Acompanhe em **Logs**.
5. Quando subir, teste: `https://aglaube-api-xxxx.onrender.com/health`
   deve responder `{"status":"ok"}`.

### Rodar o seed inicial (uma vez)

O seed roda como script, não como parte do serviço web — mais simples
rodar da sua máquina, apontando pro banco do Supabase:

```bash
cd apps/api
DATABASE_URL="a mesma URL do passo 1" \
JWT_SECRET="qualquer-coisa-aqui-nao-importa-pro-seed" \
pnpm seed          # dado real de Vila Nova do Piauí

DATABASE_URL="a mesma URL do passo 1" \
ADMIN_BOOTSTRAP_EMAIL="seu-email@exemplo.com" \
ADMIN_BOOTSTRAP_SENHA="escolha-uma-senha-forte" \
pnpm seed:admin    # cria o primeiro Administrador
```

(Opcional: `pnpm seed:teste` pra ter uns contatos de teste também.)

## 4. Frontend (Vercel)

1. No Vercel: **Add New → Project**, importe o mesmo repositório.
2. Em **Root Directory**, clique "Edit" e selecione `apps/web` — essencial,
   sem isso ele tenta buildar a raiz do monorepo inteiro.
3. Framework preset: Vercel detecta Vite sozinho.
4. Em **Environment Variables**, adicione:
   - `VITE_API_URL` = a URL do Render do passo 3 (ex:
     `https://aglaube-api-xxxx.onrender.com`, sem barra no final)
5. Deploy. Anote a URL final (ex: `https://aglaube-xxxx.vercel.app`).

## 5. Fechar o CORS

Volte no Render, no serviço `aglaube-api` → **Environment**, preencha
`CORS_ORIGIN` com a URL do Vercel do passo anterior (com `https://`, sem
barra no final). Salvar já dispara um novo deploy automático.

---

## Pronto — testando

Acesse a URL do Vercel, faça login com o e-mail/senha que você definiu no
`pnpm seed:admin`. Primeiro carregamento pode demorar ~30-60s se o Render
já tiver "dormido" por inatividade (ver limitações abaixo).

## Limitações do free tier (não é produção)

- **Render free**: o serviço "dorme" depois de ~15 min sem requisição.
  Próxima requisição acorda ele, mas demora. Sem plano gratuito de deploy
  sempre-ativo.
- **Supabase free**: projeto pausa depois de ~1 semana sem nenhuma
  atividade no banco. Precisa entrar no dashboard e clicar "Restore"
  manualmente quando isso acontecer.
- **Upstash free**: limite de comandos/dia (10 mil no momento em que este
  guia foi escrito) — de sobra pra teste, mas não pra uso real com muitos
  usuários simultâneos.
- **CORS_ORIGIN** fica travado numa origem só — se um dia vocês tiverem
  mais de um domínio de frontend (preview do Vercel + produção, por
  exemplo), vai precisar ajustar `main.ts` pra aceitar uma lista.
- Nada disso substitui a revisão jurídica formal (LGPD + eleitoral) citada
  no `HANDOFF.md` antes de operar com dado real de eleitor — isso aqui é
  só pra validar que o sistema funciona.
