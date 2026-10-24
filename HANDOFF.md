# AGLAUBE — Handoff do MVP

Documento de partida para quem for continuar o desenvolvimento (você mesmo, um dev contratado, ou o Claude Code numa sessão nova). Cobre o que existe, o que é mock, o que ficou pendente de propósito, e por quê cada decisão de compliance foi tomada.

---

## 1. Visão geral

Plataforma de gestão político-territorial (CRM) para um município piloto — **Vila Nova do Piauí, PI** — com dado real já carregado (eleição 2024, TSE). Stack: NestJS + Prisma + PostgreSQL/PostGIS + Redis/BullMQ, RBAC granular de 4 perfis.

O fio condutor de todo o projeto: **engajamento político é dado sensível tratado como percepção da equipe, nunca como fato verificado** — e isso molda quase todas as decisões técnicas abaixo.

---

## 2. Módulos construídos (ordem de dependência)

| Módulo | Status | Arquivos principais |
|---|---|---|
| RBAC / Auth | Guard reutilizável pronto | `roles.guard.ts` |
| Contatos | Completo (CRUD + dedup + leitura c/ auditoria) | `contatos.service.ts`, `contatos.controller.ts`, `create-contato.dto.ts` |
| Território | Mínimo — só leitura (por design, ver §5) | `comunidades.controller.ts` |
| Demandas | Completo (máquina de estado) | `demandas.service.ts`, `demandas.controller.ts`, `create-demanda.dto.ts` |
| Interações | Completo (timeline) | `interacoes.service.ts`, `interacoes.controller.ts` |
| Dashboard | Completo (KPIs agregados) | `dashboard.service.ts`, `dashboard.controller.ts` |
| Mapa | Completo (com k-anonimato) | `mapa.service.ts`, `mapa.controller.ts` |
| Painel Eleitoral | Completo (2 cenários de meta de votos) | `electoral-projection.service.ts`, `.controller.ts` |
| Auditoria | Completo (consulta) | `auditoria.service.ts`, `auditoria.controller.ts` |
| Comunicação | Completo, envio **mockado** | `comunicacao.service.ts`, `fila-envio.service.ts` |
| Seed de dados reais | Completo | `seed-vila-nova-do-piaui.ts` |
| Migrations extras | 2 arquivos SQL | `0001_enable_pg_trgm.sql`, `0002_envio_mensagem_idempotencia.sql` |

Todo módulo tem `.spec.ts` correspondente — não são testes genéricos de CRUD, cada um mapeia uma regra de negócio específica (ver §6).

---

## 3. Modelo de dados — o que mudou desde o desenho original

- `DadosEleitoraisPublicos` ganhou `comunidadeId` como FK (além de bairro/zona), porque o dado real do TSE só permitiu confirmar granularidade de comunidade, não de bairro.
- `EnvioMensagem` (não estava no schema original) — criado para suportar idempotência de campanha, com `idempotencyKey` único.
- `CampanhaComunicacao` (não estava no schema original) — agrupa envios de uma mesma campanha/template.
- Todo o resto segue o schema conceitual definido na Fase 0 do projeto.

**Ação pendente:** essas duas novas entidades (`EnvioMensagem`, `CampanhaComunicacao`) precisam ser formalizadas no `schema.prisma` — hoje só existem referenciadas no código dos services, assumindo que o Prisma Client as conhece.

---

## 4. Dado real já carregado (não é mock)

Vila Nova do Piauí, PI — eleição 2024, 1º turno, conferido byte a byte contra o TSE:
- 1 Município, 1 Zona Eleitoral (68), 2 Bairros (Sede / Zona Rural), 4 Comunidades (cada uma = 1 local de votação real).
- Resultado eleitoral por comunidade (`DadosEleitoraisPublicos`) já populado.
- Cálculo de meta de votos com dois cenários (sucessão unificada vs. fragmentação) já validado com esse dado — ver conversa sobre `electoral-projection.service.ts`.

---

## 5. Decisões de compliance que não são óbvias — leia antes de mexer

Estas não são preferências de estilo — são coisas que, se removidas ou "otimizadas", reabrem risco jurídico ou de privacidade já mapeado.

1. **EngajamentoPolitico nunca sofre UPDATE.** Toda mudança cria novo registro (`vigente=true`) e marca o anterior como `vigente=false`. Histórico é auditável e reversível na leitura.
2. **Toda leitura OU escrita de EngajamentoPolitico gera `LogAuditoria`.** A leitura só foi fechada na última sessão (`ContatosService.buscarPorId`) — se um novo endpoint futuramente expandir esse campo, ele **precisa** chamar `AuditoriaService.registrarLeitura()` antes de retornar.
3. **K-anonimato simples no Mapa.** Comunidade com menos de 5 contatos não expõe distribuição de engajamento, mesmo agregada — evita reidentificação por eliminação em território pequeno. Constante: `PISO_K_ANONIMATO` em `mapa.service.ts`.
4. **RBAC de leitura de auditoria é só Administrador** — nem Coordenador (que pode escrever engajamento) vê quem acessou o quê.
5. **Retrocesso de status de Demanda é bloqueado para todos os perfis**, sempre. Correção é feita via histórico, nunca voltando o estado.
6. **Pulo de etapa em Demanda** só Admin/Coordenador, e só com justificativa obrigatória registrada.
7. **Comunicação: consentimento é checado no backend**, nunca confiado do frontend. Filtro de finalidade obrigatório em toda query de destinatário.
8. **Detecção de propaganda antecipada é heurística de palavras-chave** — nunca decide sozinha, só força `revisadoPelaCoordenacao: true` explícito antes do envio. Não é parecer jurídico.
9. **Idempotência de envio é garantida por unique constraint no banco** (`idempotency_key`), não só por lógica de aplicação — sobrevive a retry de infraestrutura.
10. **Dedup de Contato usa `pg_trgm`** (Postgres), limiar de bloqueio automático em similaridade > 0,6 — número a validar com uso real em campo.

---

## 6. Cobertura de testes — o que cada suíte realmente prova

Não é "roda sem erro". Cada `.spec.ts` prova uma regra específica:

- `contatos.service.spec.ts` — dedup bloqueia/libera corretamente, engajamento oculto sem permissão, leitura sempre audita (ou nunca audita, quando não deveria).
- `demandas.service.spec.ts` — retrocesso bloqueado para todos, pulo de etapa exige justificativa e perfil certo.
- `interacoes.service.spec.ts` — timeline nunca expande conteúdo de engajamento, só a referência.
- `dashboard.service.spec.ts` — resposta nunca contém chave que sugira lista individual; funciona com município vazio.
- `mapa.service.spec.ts` — k-anonimato testado no limite exato (4 vs. 5 contatos).
- `electoral-projection.service.spec.ts` — os dois cenários batem com o cálculo manual feito com dado real; nunca retorna número único.
- `auditoria.service.spec.ts` — só Administrador acessa, mesmo Coordenador é bloqueado; teto de paginação sempre aplicado.
- `comunicacao.service.spec.ts` — duplicidade de envio tratada como esperado (não erro), mas erro real nunca é mascarado; template sinalizado bloqueia sem revisão explícita.

---

## 7. O que é MOCK ou está PENDENTE (de propósito)

| Item | Situação | O que falta |
|---|---|---|
| Envio real de WhatsApp | Mockado (`fila-envio.service.ts` só loga) | Integrar BSP homologado (Twilio ou 360dialog) — só esse arquivo muda |
| Fila real (BullMQ) | Não instanciada | Trocar o mock por `Queue.add()` real, com rate limit da Meta |
| Sincronização offline (app de campo) | Não iniciado | Definido como pós-MVP no roadmap original |
| Inteligência Territorial (IA) | Não iniciado | Pós-MVP — depende de volume de dado real acumulado |
| CRUD completo de Território (criar/editar município/zona/bairro) | Não construído — só leitura | Só faz sentido na fase SaaS multi-município |
| `schema.prisma` formal com `EnvioMensagem`/`CampanhaComunicacao` | Pendente | Formalizar as 2 entidades que nasceram durante o desenvolvimento do módulo Comunicação |
| Filtro preciso de "aniversariante da semana" | Simplificado | Vira de mês/dia com SQL raw para tratar virada de ano (ex: 30/dez–05/jan) |
| Limiar de dedup (0,6) e k-anonimato (5) | Valores de partida | Calibrar com uso real em campo |
| Frontend | Não iniciado nesta sessão | Wireframes React já aprovados (mapa, cadastro, perfil, mensagem) — próxima fase natural |

---

## 8. Matriz de RBAC consolidada (como está implementada, não só o desenho original)

| Recurso | Administrador | Coordenador | Operador | Visualização |
|---|---|---|---|---|
| Contatos (CRUD básico) | Total | Total | Cadastro/edição | Leitura |
| Engajamento político (ler/escrever) | Total + vê auditoria | Leitura/escrita | **Sem acesso** | Sem acesso |
| Demandas | Total | Total | Cadastro/edição | Leitura |
| Interações | Total | Total | Cadastro/edição | Leitura |
| Dashboard executivo | Sim | Sim | Sim | Sim |
| Mapa (com engajamento agregado) | Sim | Sim | **Não** | Sim |
| Painel Eleitoral | Sim | Sim | **Não** | Sim (agregado) |
| Log de Auditoria | **Só ele** | Não | Não | Não |
| Comunicação (criar campanha) | Sim | Sim | Sim | Não |

---

## 9. Próximo passo recomendado

1. Formalizar `schema.prisma` com as entidades novas (`EnvioMensagem`, `CampanhaComunicacao`) e rodar as migrations já escritas.
2. Subir o projeto localmente (docker-compose com Postgres+PostGIS+Redis) e rodar `seed-vila-nova-do-piaui.ts` para ter dado real de partida.
3. Rodar toda a suíte de testes (`npm test`) antes de qualquer alteração — ela é a documentação viva das regras de compliance.
4. Frontend: usar os wireframes já validados (mapa, cadastro em campo, perfil de contato, envio de mensagem) como referência de contrato com esses endpoints.
5. Antes de operar em produção com dado real de eleitor: revisão jurídica formal (LGPD + eleitoral) do módulo de Engajamento Político — sinalizado como pendência desde a Fase 0 e ainda não feito.
