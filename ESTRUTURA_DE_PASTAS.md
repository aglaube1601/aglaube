# Estrutura de pastas — onde cada arquivo já gerado deve ir

Monorepo pnpm workspaces, conforme decidido na Fase 0.

```
aglaube/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma                          ← schema.prisma
│   │   │   ├── seed.ts                                 ← seed-vila-nova-do-piaui.ts
│   │   │   ├── seed-admin-usuario.ts                   ← seed-admin-usuario.ts (bootstrap do 1º Administrador)
│   │   │   └── migrations/
│   │   │       ├── 0001_enable_pg_trgm/migration.sql   ← 0001_enable_pg_trgm.sql
│   │   │       └── 0002_envio_mensagem_idempotencia/migration.sql ← 0002_envio_mensagem_idempotencia.sql
│   │   ├── src/
│   │   │   ├── prisma/
│   │   │   │   └── prisma.service.ts                   ← prisma.service.ts
│   │   │   ├── auth/
│   │   │   │   ├── dto/
│   │   │   │   │   ├── login.dto.ts
│   │   │   │   │   └── create-usuario.dto.ts
│   │   │   │   ├── jwt-auth.guard.ts                   ← jwt-auth.guard.ts (agora só Strategy + Guard)
│   │   │   │   ├── roles.guard.ts                      ← roles.guard.ts
│   │   │   │   ├── current-user.decorator.ts           ← current-user.decorator.ts
│   │   │   │   ├── auth.service.ts                     ← FECHA a lacuna de login/criação de usuário
│   │   │   │   ├── auth.controller.ts                  ← expõe /auth/login e /usuarios
│   │   │   │   └── auth.service.spec.ts
│   │   │   ├── contatos/
│   │   │   │   ├── dto/
│   │   │   │   │   └── create-contato.dto.ts
│   │   │   │   ├── contatos.service.ts
│   │   │   │   ├── contatos.controller.ts
│   │   │   │   └── contatos.service.spec.ts
│   │   │   ├── comunidades/
│   │   │   │   └── comunidades.controller.ts           ← (contém ComunidadesService também)
│   │   │   ├── demandas/
│   │   │   │   ├── dto/
│   │   │   │   │   └── create-demanda.dto.ts
│   │   │   │   ├── demandas.service.ts
│   │   │   │   ├── demandas.controller.ts
│   │   │   │   └── demandas.service.spec.ts
│   │   │   ├── interacoes/
│   │   │   │   ├── dto/
│   │   │   │   │   └── create-interacao.dto.ts
│   │   │   │   ├── interacoes.service.ts
│   │   │   │   ├── interacoes.controller.ts
│   │   │   │   └── interacoes.service.spec.ts
│   │   │   ├── dashboard/
│   │   │   │   ├── dashboard.service.ts
│   │   │   │   ├── dashboard.controller.ts
│   │   │   │   └── dashboard.service.spec.ts
│   │   │   ├── mapa/
│   │   │   │   ├── mapa.service.ts
│   │   │   │   ├── mapa.controller.ts
│   │   │   │   └── mapa.service.spec.ts
│   │   │   ├── painel-eleitoral/
│   │   │   │   ├── dto/
│   │   │   │   │   └── get-projecao-eleitoral.dto.ts
│   │   │   │   ├── electoral-projection.service.ts
│   │   │   │   ├── electoral-projection.controller.ts
│   │   │   │   ├── electoral-projection.service.spec.ts
│   │   │   │   └── electoral-projection.controller.spec.ts
│   │   │   ├── auditoria/
│   │   │   │   ├── auditoria.service.ts
│   │   │   │   ├── auditoria.controller.ts
│   │   │   │   └── auditoria.service.spec.ts
│   │   │   ├── comunicacao/
│   │   │   │   ├── dto/
│   │   │   │   │   └── create-campanha.dto.ts
│   │   │   │   ├── comunicacao.service.ts
│   │   │   │   ├── comunicacao.controller.ts
│   │   │   │   ├── fila-envio.service.ts
│   │   │   │   └── comunicacao.service.spec.ts
│   │   │   ├── app.module.ts                           ← NÃO EXISTE AINDA, criar amarrando todos os módulos acima
│   │   │   └── main.ts                                 ← NÃO EXISTE AINDA, bootstrap padrão do Nest
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                                            ← frontend, não iniciado nesta fase
│       └── (wireframe-mapa-cadastro.jsx como referência de contrato de UI)
├── packages/
│   └── shared/                                         ← tipos compartilhados entre api e web, não iniciado
├── docker-compose.yml                                  ← NÃO EXISTE AINDA
└── pnpm-workspace.yaml                                 ← NÃO EXISTE AINDA
```

**Nota importante para o Claude Code:** os arquivos `contatos.service.ts`, `contatos.controller.ts` e `contatos.service.spec.ts` foram editados incrementalmente ao longo do desenvolvimento (a lacuna de auditoria foi fechada por último). A versão que você recebeu já é a final e completa — não precisa reconciliar versões.
