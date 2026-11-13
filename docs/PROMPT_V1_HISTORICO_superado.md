# Prompt para Claude Code — Plataforma de Gestão Político-Territorial (AGLAUBE)

Cole este documento inteiro como primeira mensagem no Claude Code, no diretório vazio onde o projeto será criado.

---

## Contexto do projeto

Você vai me ajudar a construir o **MVP** de uma plataforma web (PWA, mobile-first) de gestão de relacionamento político-territorial — um CRM para organização de campo, contatos, lideranças, demandas comunitárias e comunicação institucional, com um módulo sensível de leitura de engajamento político tratado com controles de privacidade rígidos.

Não comece escrevendo código ainda. Primeiro leia este documento inteiro, monte a estrutura de pastas do monorepo, o schema do banco de dados e o plano de execução em fases. Só depois de eu aprovar o plano, comece a implementar.

---

## 1. Stack técnica definida

| Camada | Tecnologia |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| App | PWA (service worker, manifest, funcionamento offline básico) |
| Backend | Node.js + NestJS (TypeScript) — API REST |
| Banco de dados | PostgreSQL + extensão PostGIS |
| ORM | Prisma (com suporte a tipos geográficos via extensão raw SQL, se necessário) |
| Fila/jobs | Redis + BullMQ (rate limiting de WhatsApp, idempotência de envios) |
| Autenticação | JWT + RBAC próprio (não usar Auth0/Clerk nessa fase — controle total sobre permissões granulares) |
| Mapas | Leaflet + OpenStreetMap (mais barato que Mapbox para MVP) |
| WhatsApp | Adaptador de integração desacoplado — implementar como interface, mockado no MVP, plugável depois com BSP homologado (Twilio ou 360dialog) |
| Testes | Vitest (frontend) + Jest (backend) |
| Monorepo | pnpm workspaces (`apps/web`, `apps/api`, `packages/shared`) |

---

## 2. Modelo de dados (schema conceitual — traduzir para Prisma schema)

```
Municipio
 - id, nome, uf, populacao_estimada

ZonaEleitoral
 - id, municipio_id (FK), numero, comparecimento_historico

Bairro
 - id, zona_eleitoral_id (FK), nome, geometria (PostGIS polygon)

Comunidade
 - id, bairro_id (FK), nome, populacao_estimada, geometria (PostGIS point/polygon)

Contato
 - id, nome, telefone, whatsapp, data_nascimento, endereco
 - comunidade_id (FK)
 - profissao, origem_cadastro, responsavel_cadastro_id (FK Usuario)
 - criado_em, atualizado_em

EngajamentoPolitico   -- ENTIDADE VERSIONADA, NUNCA UPDATE DESTRUTIVO
 - id, contato_id (FK)
 - status (enum: apoiador | simpatizante | neutro | percepcao_negativa | desconhecido)
 - origem (enum: autodeclarado | percepcao_lideranca | percepcao_equipe)
 - confianca (enum: alta | media | baixa)
 - registrado_por_id (FK Usuario)
 - vigente (boolean) -- true = registro ativo atual
 - criado_em

Lideranca
 - id, contato_id (FK, unique)
 - grupo (texto, ex: "Força Jovem")
 - bairro_id (FK)

Demanda
 - id, contato_id (FK, nullable), comunidade_id (FK)
 - categoria, descricao, prioridade (enum), status (enum: nova|em_analise|em_andamento|resolvida|encerrada)
 - responsavel_id (FK Usuario), prazo, criado_em

DemandaHistorico
 - id, demanda_id (FK), status_anterior, status_novo, alterado_por_id (FK), data

Interacao
 - id, contato_id (FK), tipo (enum: ligacao|mensagem|reuniao|visita|evento|demanda|observacao)
 - descricao, responsavel_id (FK), data
 - atualizou_engajamento_id (FK EngajamentoPolitico, nullable)

EventoAcao
 - id, comunidade_id (FK), tipo, categoria_dado (enum: politico | assistencial) -- flag de isolamento
 - data, local, publico_estimado, observacoes

EventoParticipante  -- N:N Contato <-> EventoAcao (sem exposição de engajamento)
 - evento_id (FK), contato_id (FK)

Consentimento
 - id, contato_id (FK), finalidade (enum: comunicacao_institucional | outra)
 - status (enum: ativo | opt_out | nao_perguntado), origem, data

DadosEleitoraisPublicos
 - id, zona_eleitoral_id (FK) OU bairro_id (FK) -- nunca contato_id
 - eleicao_ano, votos_obtidos, comparecimento

Usuario
 - id, nome, email, senha_hash, perfil (enum: administrador|coordenador|operador|visualizacao)
 - permissao_engajamento_politico (boolean)

LogAuditoria
 - id, usuario_id (FK), entidade, entidade_id, acao (enum: leitura|criacao|edicao|exclusao|exportacao)
 - timestamp, detalhes (json)
```

**Regras de integridade que o schema deve garantir:**
- `EngajamentoPolitico` nunca é atualizado via UPDATE — toda mudança cria novo registro com `vigente = true` e marca o anterior como `vigente = false`.
- `DadosEleitoraisPublicos` nunca tem foreign key para `Contato` — só para `Bairro`/`ZonaEleitoral`.
- Toda leitura ou escrita em `EngajamentoPolitico` deve gerar entrada em `LogAuditoria` automaticamente (via middleware/interceptor do Prisma ou trigger no banco).

---

## 3. Regras de negócio e controles críticos (não negociáveis)

1. **RBAC granular**: `Operador` não pode ler nem escrever `EngajamentoPolitico` a menos que `permissao_engajamento_politico = true`. Isso deve ser aplicado no nível da API (guard/interceptor), não só escondido no frontend.
2. **Deduplicação**: antes de criar um novo `Contato`, rodar fuzzy match por nome + telefone (usar biblioteca tipo `fuzzysort` ou trigram do Postgres `pg_trgm`) e retornar candidatos de possível duplicata para o usuário decidir.
3. **Campo obrigatório**: `Contato.comunidade_id` é obrigatório — bloquear salvamento sem isso.
4. **Exportação de dados** (CSV/relatório) contendo `EngajamentoPolitico` só disponível para perfil `administrador`, com log de auditoria obrigatório.
5. **Mapa e dashboards nunca expõem `EngajamentoPolitico` por indivíduo** — todas as views de mapa/dashboard devem consumir apenas endpoints agregados (ex.: `GET /bairros/:id/engajamento-agregado`, nunca uma lista crua de contatos com status).
6. **Meta de votos com margem de erro**: implementar o cálculo como função pura e testável (ver seção 4), nunca hardcoded no frontend.
7. **Idempotência de mensagens**: todo envio de mensagem (mesmo mockado no MVP) precisa de um `idempotency_key` único por (contato, campanha, data) para evitar duplicidade em caso de reprocessamento de fila.
8. **Consentimento bloqueia envio**: endpoint de disparo de mensagem deve filtrar automaticamente por `Consentimento.status = ativo` para a finalidade da mensagem — nunca confiar em filtro feito no frontend.

---

## 4. Algoritmo da meta de votos (implementar como função isolada e testada)

```
Entrada: bairro_id, taxa_conversao_min, taxa_conversao_max (ajustáveis pelo coordenador)

1. votos_ultima_eleicao = buscar em DadosEleitoraisPublicos (última eleição, por bairro)
2. fator_crescimento = eleitorado_atual_estimado / eleitorado_ultima_eleicao
3. base_projetada = votos_ultima_eleicao * fator_crescimento
4. contatos_alta_propensao = contar Contato onde EngajamentoPolitico.vigente = true
   e status in (apoiador, simpatizante) e confianca in (media, alta), agrupado por bairro
5. meta_min = base_projetada + (contatos_alta_propensao * taxa_conversao_min)
   meta_max = base_projetada + (contatos_alta_propensao * taxa_conversao_max)
6. ajustar meta_min/meta_max pelo desvio padrão histórico de comparecimento do bairro
7. retornar { meta_min, meta_max, premissas_usadas: {...} } -- nunca um número único
```

Escrever testes unitários cobrindo: bairro sem dados históricos, bairro com 0 contatos com leitura de engajamento, taxa de conversão nos extremos (0% e 100%).

---

## 5. Escopo do MVP (construir nesta ordem)

1. **Setup do monorepo** (pnpm workspaces, Docker Compose com Postgres+PostGIS e Redis, Prisma schema inicial, CI básico).
2. **Autenticação e RBAC** (login, JWT, 4 perfis, guard de permissão por rota/campo).
3. **Módulo Contatos** (CRUD, dedup, campo de comunidade obrigatório, campo de engajamento condicional por permissão).
4. **Módulo Território** (Município → Zona → Bairro → Comunidade, seed de dados fictícios para desenvolvimento).
5. **Módulo Demandas** (CRUD com fluxo de status e histórico).
6. **Módulo Interações** (timeline por contato).
7. **Dashboard executivo** (indicadores agregados básicos).
8. **Mapa** (Leaflet, choropleth por cobertura, painel lateral com dados agregados — ver wireframe já aprovado).
9. **Módulo Comunicação** (composição de mensagem, seleção de público, envio mockado com fila BullMQ e idempotência — sem integração real de WhatsApp ainda).
10. **Painel eleitoral** (cálculo de meta de votos com margem de erro, seção 4).
11. **Log de auditoria** (aplicado a Engajamento Político desde o início, não deixar para depois).

Fora do MVP (não implementar agora): IA/inteligência territorial, sincronização offline real, app nativo, grafo de rede de lideranças, SaaS multi-município.

---

## 6. Referências de UI já validadas

Já existem wireframes aprovados (React + Tailwind, paleta navy `#1B2A4A` / teal `#2D6E7E` / amber `#C98A3E` / paper `#F6F4EF`) para as seguintes telas — usar como referência de estrutura e tom visual, adaptando para o design system real do projeto:
- Tela do mapa territorial com painel de bairro.
- Fluxo de cadastro de contato em campo (wizard de 5 passos).
- Perfil do contato/eleitor (com bloco de engajamento recolhido por padrão).
- Tela de envio de mensagem (composição, seleção de público, preview, alerta de compliance).

Vou anexar esses arquivos de wireframe como referência visual quando começarmos o frontend.

---

## 7. Compliance — restrições que o código deve refletir

- Nunca criar endpoint que retorne lista de contatos com `EngajamentoPolitico` individual sem filtro de permissão de `administrador`/`coordenador`.
- Nunca permitir que `DadosEleitoraisPublicos` seja associado a um `Contato` individual em nenhuma query ou migration futura.
- Todo campo sensível deve ter comentário no schema Prisma explicando a restrição de acesso, para não ser esquecido em futuras alterações.
- Adicionar um `README_COMPLIANCE.md` no repositório documentando essas regras para qualquer desenvolvedor futuro.

---

## 8. Primeira tarefa que você deve executar agora

1. Proponha a estrutura de pastas do monorepo.
2. Gere o `schema.prisma` completo a partir do modelo de dados da seção 2, incluindo os comentários de compliance da seção 7.
3. Configure o `docker-compose.yml` com Postgres+PostGIS e Redis.
4. Apresente um plano de execução dividido em PRs pequenos, seguindo a ordem da seção 5.

Aguarde minha aprovação do plano antes de gerar código de funcionalidade.
