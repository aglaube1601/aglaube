# Prompt para Claude Code — Montagem final do projeto AGLAUBE

Cole isso como primeira mensagem no Claude Code, já dentro desta pasta (ela já vem com a estrutura de monorepo pronta — você não precisa criar pastas nem mover arquivos).

---

## Contexto

Este é o MVP do AGLAUBE — CRM político-territorial — já desenhado, codificado e testado numa sessão de planejamento com Claude (chat). A estrutura de pastas já está montada:

```
aglaube/
├── apps/
│   ├── api/           ← backend NestJS + Prisma, código completo
│   └── web/            ← só wireframes de referência (frontend não iniciado)
├── docs/                ← histórico de decisões e dados eleitorais reais usados no seed
├── docker-compose.yml
├── pnpm-workspace.yaml
├── HANDOFF.md           ← LEIA PRIMEIRO — decisões de compliance, RBAC, o que é mock
└── ESTRUTURA_DE_PASTAS.md
```

## Leia nesta ordem antes de tocar em qualquer código

1. `HANDOFF.md` — visão geral, as 10 decisões de compliance não-óbvias, matriz de RBAC real, o que é mock.
2. `apps/api/prisma/schema.prisma` — modelo de dados completo e final.
3. `ESTRUTURA_DE_PASTAS.md` — só para conferência, a estrutura já está montada.

## O que fazer

1. `cd apps/api && cp .env.example .env` e preencha `JWT_SECRET` (gere um valor aleatório forte) e `ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_SENHA`.
2. Na raiz do monorepo: `pnpm install`.
3. Suba a infra: `docker compose up -d` (Postgres+PostGIS e Redis).
4. `cd apps/api && pnpm prisma:generate && pnpm prisma:migrate` — isso aplica as duas migrations já escritas (pg_trgm e a unique constraint de idempotência) em cima do schema.
5. `pnpm seed` — carrega o dado real de Vila Nova do Piauí (eleição 2024, TSE).
6. `pnpm seed:admin` — cria o primeiro usuário Administrador usando as variáveis do `.env`. **Depois de rodar, remova `ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_SENHA` do `.env`.**
7. Rode a suíte inteira: `pnpm test`. Cada `.spec.ts` prova uma regra de negócio específica (ver `HANDOFF.md` §6) — se algo falhar, não "corrija o teste para passar" sem antes me explicar o que encontrou.
8. Suba a API: `pnpm start:dev`. Teste o login (`POST /auth/login`) com as credenciais do admin, depois um `GET /municipios/:id/dashboard/resumo-executivo` para confirmar que o dado do seed está acessível ponta a ponta.

## Regras não-negociáveis (já implementadas — só preservar)

- `EngajamentoPolitico` nunca sofre UPDATE, sempre versiona (`vigente` boolean).
- Toda leitura ou escrita de `EngajamentoPolitico` gera `LogAuditoria` (ver `ContatosService.buscarPorId` e `.atualizarEngajamento`).
- Mapa nunca expõe engajamento agregado de comunidade com menos de 5 contatos (k-anonimato — `PISO_K_ANONIMATO` em `mapa.service.ts`).
- `DadosEleitoraisPublicos` nunca tem FK para `Contato` — só para `Comunidade`.
- Retrocesso de status de `Demanda` é bloqueado para todos os perfis, sempre.
- Consentimento é checado no backend antes de qualquer envio de comunicação — nunca confiar em filtro de frontend.
- Idempotência de envio é garantida por unique constraint no banco (`idempotency_key`), não só em código.
- Senha de usuário nunca é retornada em nenhuma resposta de API, nem como hash.

Se ao montar/rodar você notar que alguma dessas regras foi comprometida por um detalhe de configuração (import, variável de ambiente faltando etc.), corrija preservando a regra — nunca remova a proteção "para funcionar mais rápido".

## Depois que tudo estiver rodando e os testes passarem

Não comece frontend nem novos módulos ainda. Volte com:
1. Confirmação de que `pnpm test` passou (ou o que falhou e por quê).
2. A lista de pendências do `HANDOFF.md` §7, para decidirmos juntos a próxima prioridade.
