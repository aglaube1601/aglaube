# Plataforma de Gestão Político-Territorial — Análise e Visão Geral

## 1. Visão geral do produto

Um CRM territorial que centraliza contato, engajamento e relacionamento político em uma base única, organizada por bairro/comunidade, substituindo WhatsApp, planilhas e memória pessoal.

O sistema tem três pilares que precisam ficar visualmente e estruturalmente separados, mesmo compartilhando a mesma base:

1. **Relacionamento e comunicação** — contatos, lideranças, demandas, eventos, mensagens (parabéns, notícias, lembretes).
2. **Leitura de engajamento político** — percepção de apoio por território, tratada como avaliação interna sensível, não como fato.
3. **Inteligência eleitoral** — cruzamento de dados públicos (IBGE/TSE) com a leitura de engajamento para gerar metas estatísticas por território.

O ponto central da arquitetura é que o pilar 2 nunca deve "vazar" para os pilares 1 e 3 de forma que exponha indivíduo — só entra nos dashboards de forma agregada.

---

## 2. Módulos do sistema

| Módulo | Função central |
|---|---|
| Contatos | Cadastro base + campo de engajamento político (entidade separada) |
| Lideranças & Influenciadores | Rede de relacionamento por bairro |
| Comunidades/Território | Hierarquia Município → Zona → Bairro → Comunidade → Microárea |
| Mapa | Visualização geográfica agregada de cobertura e engajamento |
| Demandas | Ticket de solicitação da comunidade |
| Interações | Timeline por contato |
| Eventos & Ações | Reuniões, visitas, ações de saúde (isoladas do engajamento político) |
| Comunicação | WhatsApp Business API — aniversário, notícia, lembrete |
| Automações | Motor trigger → condição → ação |
| Dashboard Executivo | Indicadores operacionais |
| Painel Eleitoral | População, eleitorado, votos, meta com margem de erro |
| Inteligência Territorial | IA sobre dados agregados |
| Qualidade de Dados | Deduplicação, completude, confiança |
| Segurança & LGPD | RBAC, auditoria, consentimento |

---

## 3. Modelo conceitual do banco de dados

### Entidades principais

```
MUNICIPIO (1) ──< ZONA_ELEITORAL (1) ──< BAIRRO (1) ──< COMUNIDADE (1) ──< MICROAREA

CONTATO
 ├── pertence a 1 COMUNIDADE
 ├── tem 1..N ENGAJAMENTO_POLITICO (histórico versionado)
 ├── tem 1..N INTERACAO
 ├── tem 0..N DEMANDA
 ├── pode ser LIDERANCA (subtipo)
 └── tem 0..N CONSENTIMENTO (por finalidade)

ENGAJAMENTO_POLITICO
 ├── contato_id (FK)
 ├── status (apoiador / simpatizante / neutro / percepção negativa / desconhecido)
 ├── origem (autodeclarado / avaliação liderança / avaliação equipe)
 ├── confianca (alta / média / baixa)
 ├── registrado_por (FK usuário)
 ├── data
 └── vigente (bool) — versão ativa; anteriores ficam como histórico, nunca sobrescritas

LIDERANCA
 ├── contato_id (FK, 1:1)
 ├── região/bairro de atuação
 ├── grupo (ex: "Força Jovem")
 └── contatos_vinculados (N:N com CONTATO)

DEMANDA
 ├── contato_id / comunidade_id
 ├── categoria, status, prioridade, prazo
 └── historico_status (versionado)

INTERACAO
 ├── contato_id (FK)
 ├── tipo (ligação, visita, mensagem, reunião...)
 ├── data, responsável
 └── atualizou_engajamento (bool, referência ao registro gerado)

EVENTO_ACAO
 ├── comunidade_id
 ├── tipo (reunião / campanha saúde / ação comunitária)
 ├── categoria_dado (política | assistencial) — flag de isolamento
 └── participantes (N:N com CONTATO, sem exposição de engajamento)

DADOS_ELEITORAIS_PUBLICOS (TSE/IBGE, agregado por território)
 ├── zona, seção, local_votação
 ├── comparecimento_historico
 └── resultado_historico_agregado

CONSENTIMENTO
 ├── contato_id
 ├── finalidade (comunicação institucional | pesquisa | outra)
 ├── origem, data, status (ativo/opt-out)

USUARIO
 ├── perfil (Admin / Coordenador / Operador / Visualização)
 └── permissao_engajamento_politico (bool — só Admin/Coordenador por padrão)

LOG_AUDITORIA
 ├── usuario_id, entidade, ação, timestamp
 └── obrigatório para toda leitura/escrita em ENGAJAMENTO_POLITICO
```

### Relacionamentos-chave

- `CONTATO 1:N ENGAJAMENTO_POLITICO` — histórico completo, nunca update destrutivo.
- `COMUNIDADE 1:N CONTATO` — base da territorialização.
- `EVENTO_ACAO` tem flag rígida separando dado de saúde de dado político — idealmente em schema/tabela fisicamente distinta, com permissão de acesso diferente.
- `DADOS_ELEITORAIS_PUBLICOS` nunca se liga a `CONTATO` individualmente — só a `COMUNIDADE`/`ZONA` (impede associar voto real a pessoa).

---

## 4. Perfis e permissões

| Perfil | Contatos | Demandas/Eventos | Engajamento político | Painel eleitoral | Configurações |
|---|---|---|---|---|---|
| Administrador | Total | Total | Total + auditoria | Total | Total |
| Coordenador | Total | Total | Leitura/escrita | Leitura | Não |
| Operador | Cadastro/edição | Cadastro/edição | Sem acesso | Não | Não |
| Visualização | Leitura | Leitura | Não | Agregado apenas | Não |

Regra dura: exportação de base completa com campo de engajamento político só por Administrador, com log obrigatório.

---

## 5. Fluxos principais do usuário

**Cadastro em campo (liderança/operador):**
Cadastra contato → sistema verifica duplicidade → vincula à comunidade → opcionalmente registra leitura de engajamento (se perfil permite) → gera timeline.

**Coordenador analisando território:**
Abre mapa → filtra por bairro com baixa cobertura → vê ranking de prioridade → aciona liderança local via automação → acompanha conversão ao longo do tempo no gráfico de engajamento por território.

**Envio de comunicação:**
Cria mensagem (aniversário/notícia) → sistema verifica consentimento por finalidade → sinaliza se o texto se aproxima de propaganda antecipada → fila de envio respeitando rate limit da API do WhatsApp → registra na timeline de cada contato.

---

## 6. Estrutura dos dashboards

**Dashboard executivo (operacional):**
Total de contatos, novos (30d), lideranças, comunidades mapeadas, regiões de baixa cobertura, interações (30d), demandas abertas/resolvidas, próximos eventos, aniversariantes.

**Painel eleitoral:**
- População total (IBGE) e eleitorado por zona (TSE)
- Votos obtidos na última eleição por território
- Meta de votos com intervalo de confiança (ex: 8.200–9.400), nunca número único
- Gap atual vs. meta, por bairro
- Ranking de territórios prioritários
- % de dados com confiança baixa (transparência sobre a qualidade da base usada no cálculo)

---

## 7. Arquitetura técnica recomendada

| Camada | Recomendação | Motivo |
|---|---|---|
| Frontend web | React + Tailwind | Ecossistema maduro, componentização, fácil evoluir para PWA |
| App | PWA (Progressive Web App) na v1 | Evita custo/tempo de app nativo + loja; funciona offline com service worker |
| Backend | Node.js (NestJS) ou Python (FastAPI) | APIs REST, fácil integrar automações e IA |
| Banco de dados | PostgreSQL + PostGIS | PostGIS é essencial para o módulo de mapa/territorialização |
| Fila/automação | Redis + worker (BullMQ ou Celery) | Rate limiting de WhatsApp, idempotência de envios |
| Autenticação | OAuth2/JWT + RBAC próprio | Controle granular de permissão por campo sensível |
| Mapas | Mapbox ou Leaflet + OpenStreetMap | Camadas customizadas de território |
| WhatsApp | API oficial WhatsApp Business (via BSP homologado, ex: Twilio, 360dialog) | Evita bloqueio, permite templates aprovados |
| IA | Chamadas a API de LLM (ex: Claude) sobre dados agregados via prompt controlado | Nunca IA com acesso direto a dado individual sensível sem camada de agregação antes |
| Hospedagem | Cloud (AWS/GCP) com ambiente separado staging/produção | Permite teste antes de deploy |
| Backup | Automático diário + teste de restauração mensal | Backup não testado não é backup |
| Logs/observabilidade | Stack tipo ELK ou serviço gerenciado (ex: Grafana Loki) | Detectar falha silenciosa de sincronização |

---

## 8. Integrações necessárias

- WhatsApp Business API (via BSP homologado)
- Dados públicos TSE (repositório de dados abertos)
- Dados públicos IBGE (população/censo)
- Mapas (Mapbox/OSM)
- E-mail transacional (opcional, para relatórios)

---

## 9. Segurança e compliance

- Criptografia em repouso e trânsito.
- RBAC com permissão adicional para campo de engajamento político.
- Log de auditoria obrigatório em toda leitura/escrita de dado sensível.
- Consentimento por finalidade, com opt-out.
- Sinalização automática de mensagens que se aproximem de propaganda antecipada (pré-período eleitoral).
- Recomendação formal: revisão jurídica especializada (eleitoral + LGPD) antes de operar em produção, principalmente sobre a base legal do campo de engajamento político sem consentimento do titular.

---

## 10. MVP (primeira versão)

- Cadastro de contatos + comunidades/território (sem hierarquia completa de microárea ainda).
- Campo de engajamento político básico (status + origem + confiança), sem IA ainda.
- Timeline de interações.
- Demandas (ticket simples).
- Mapa com filtro por bairro (marcadores, sem camadas avançadas).
- Dashboard executivo básico.
- WhatsApp para 2–3 automações essenciais (aniversário, lembrete de evento).
- RBAC com os 4 perfis.
- Backup diário.

## 11. Versões posteriores

- Painel eleitoral completo com metodologia estatística de meta de votos.
- Inteligência territorial (IA) com insights agregados.
- Grafo de rede de lideranças.
- Sincronização offline para app de campo.
- Deduplicação automática avançada.
- SaaS multi-município.

---

## 12. Roadmap sugerido

1. **Fase 0** — Validação jurídica (LGPD + eleitoral) do modelo de engajamento político.
2. **Fase 1 (MVP)** — Contatos, território, demandas, timeline, dashboard básico, WhatsApp essencial.
3. **Fase 2** — Mapa completo, lideranças/rede, automações avançadas.
4. **Fase 3** — Painel eleitoral com metodologia estatística e margem de erro.
5. **Fase 4** — IA territorial, qualidade de dados avançada, app offline.
6. **Fase 5** — Evolução para SaaS multi-município.

---

## 13. Estrutura de telas (menu lateral)

`Dashboard · Contatos · Lideranças · Comunidades · Mapa · Demandas · Interações · Eventos · Comunicação · Automações · Relatórios · Inteligência · Configurações`

Mobile-first: prioridade de acesso rápido a Contatos, Mapa e Demandas (uso predominante em campo).
