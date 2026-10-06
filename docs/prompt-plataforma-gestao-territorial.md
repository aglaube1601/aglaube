# Prompt — Planejamento de Plataforma de Gestão Político-Territorial

Quero que você atue como Product Manager, arquiteto de software, especialista em CRM, UX/UI, banco de dados, automação e análise de dados para planejar uma plataforma web responsiva (também preparada como app) de gestão de relacionamento político-territorial.

---

## 0. Compliance — tratar antes do modelo de dados

O sistema deve tratar "posicionamento político" como uma **avaliação interna da equipe, não uma declaração verificada**. Na maioria dos casos é uma leitura de relacionamento (percepção de liderança/equipe de campo), não resposta a pergunta direta. Isso implica:

- Modelar o campo como *"leitura de propensão"* com metadado de origem: (a) autodeclarado espontaneamente pelo eleitor, (b) percepção da liderança/equipe de campo, (c) indicação de terceiro. A interface deve deixar essa distinção visível para quem consulta, para não tratar percepção como certeza.
- Como não há consentimento explícito na maioria dos casos (origens "b" e "c"), a base legal do LGPD (art. 5º II e art. 11 — dado sensível de opinião política) é frágil. Tratar como ponto de atenção jurídica prioritária, com avaliação de advogado especializado em eleitoral/LGPD antes de operar em produção — especialmente quanto a retenção, direito de acesso do titular aos próprios dados, e uso em período eleitoral.
- Nunca expor esse campo de forma que vaze individualmente (relatório impresso, mapa, export). Usar apenas em agregações territoriais para métricas de cobertura e meta de votos.
- Avaliar limites da Lei 9.504/97 e resoluções do TSE sobre uso de dados de eleitores e comunicação dentro/fora de período eleitoral. O sistema deve sinalizar automaticamente ações que se aproximem de propaganda antecipada irregular.
- Avaliar separação física (não só lógica/RBAC) entre dados de posicionamento político e dados de ações de saúde/assistenciais.

---

## 1. Visão do produto

Plataforma de gestão de relacionamento político, territorial e comunitário — tipo CRM — centralizando contatos, posicionamento político, lideranças, comunidades, regiões, demandas, interações, comunicação e indicadores eleitorais/territoriais, substituindo WhatsApp/planilhas/memória por base organizada, pesquisável e segura.

Perguntas que a plataforma deve responder:

- Quantos eleitores/simpatizantes/apoiadores há em cada bairro/região, e com que grau de confiança essa classificação foi feita?
- Quais bairros têm maior concentração de indecisos ou percepção negativa (prioridade de conversão)?
- Qual a cobertura de relacionamento por território (bairros "frios")?
- Quantos votos obtive na última eleição por zona/seção, e quantos preciso na próxima, com margem de erro?
- Quais lideranças e grupos (ex.: "Força Jovem") atuam em cada bairro, e como está a rede?
- Quando foi o último contato com cada liderança/apoiador?
- Quais demandas estão pendentes por comunidade?

---

## 2. Módulo de contatos e classificação de engajamento

Cadastro estruturado com: nome, telefone/WhatsApp, nascimento, endereço, comunidade/bairro, zona/seção eleitoral (quando informado voluntariamente), profissão, tags, origem do contato, responsável pelo cadastro, observações, histórico de interações.

**Campo de posicionamento político** como entidade separada (não coluna simples):

| Atributo | Descrição |
|---|---|
| status | apoiador declarado / simpatizante / neutro / percepção negativa / desconhecido |
| origem | autodeclarado / avaliação de liderança / avaliação de equipe interna |
| confiança | alta / média / baixa |
| data | última atualização |
| responsável | quem registrou |
| histórico | versionado — nunca sobrescreve, sempre cria novo registro |

Acesso restrito a esse campo: apenas coordenação, não todo operador. Trilha de auditoria completa de quem consultou.

Categorias organizacionais: contato, liderança, apoiador, influenciador, colaborador, voluntário, representante de associação, relacionamento institucional.

---

## 3. Lideranças, apoiadores e influenciadores

Módulo para lideranças formais e informais (ex.: grupos como "Força Jovem"): região de atuação, comunidades relacionadas, contatos vinculados, histórico de reuniões, demandas apresentadas, atividades, tarefas pendentes, responsável interno.

Sub-registro para influenciadores digitais/locais: alcance estimado, canais (Instagram, WhatsApp, rádio comunitária), histórico de colaboração.

Visualização gráfica da rede territorial (grafo de relacionamento).

---

## 4. Comunidades e território

Hierarquia: Município → Zona eleitoral → Bairro/Região → Comunidade/Localidade → Setor/microárea.

Cada território com: população estimada (IBGE), eleitorado (dados públicos TSE quando disponíveis), contatos cadastrados por status de engajamento, lideranças, demandas, ações realizadas, histórico de visitas, indicador de cobertura e de "temperatura" política agregada (nunca por indivíduo isolado exposto), localização geográfica.

---

## 5. Mapa territorial com camada eleitoral

Mapa interativo exibindo, por bairro/zona: densidade de contatos por status de engajamento (agregado, sem expor indivíduo no mapa), lideranças, ações realizadas, votos obtidos na última eleição, cobertura de relacionamento.

Filtros: região, período, tipo de ação, presença de liderança, nível de cobertura, faixa de engajamento.

Clique no território abre o painel da comunidade.

---

## 6. Histórico de interações

Timeline por contato: ligação, mensagem, reunião, visita, evento, demanda, encaminhamento, tarefa, retorno agendado. Cada interação pode, opcionalmente, atualizar o status de engajamento — com log de quem alterou e por quê.

---

## 7. Gestão de demandas

Sistema de tickets: categoria, descrição, comunidade, contato, data, prioridade, responsável, status, prazo, histórico.

Fluxo de status: `NOVA → EM ANÁLISE → EM ANDAMENTO → RESOLVIDA → ENCERRADA`

Dashboard de demandas mais frequentes por território.

---

## 8. Comunicação — canal de relacionamento, não propaganda

Integração via API oficial do WhatsApp Business para: mensagens de aniversário, notícias de interesse público, lembretes, confirmação de presença em eventos, acompanhamento de demanda — segmentadas por consentimento e, quando aplicável, por status de engajamento.

Obrigatório:
- Consentimento e opt-out por finalidade (comunicação institucional é finalidade distinta de eventual comunicação de campanha).
- Registro da origem do consentimento.
- Controle de frequência.
- Trilha de auditoria.
- Sinalização automática se um template de mensagem se aproximar de pedido de voto/propaganda antecipada, para revisão humana antes do envio em período pré-eleitoral.

---

## 9. Automações

Motor `TRIGGER → CONDIÇÃO → AÇÃO`.

Exemplos:
- Aniversário do contato → mensagem personalizada para envio.
- Demanda sem atualização por X dias → notifica responsável.
- Evento comunitário programado → lembrete para quem consentiu naquela categoria.
- Bairro com queda de engajamento → alerta para liderança local intensificar contato.

---

## 10. Eventos e ações comunitárias

Reuniões, visitas, eventos, campanhas educativas, ações de saúde.

**Separação lógica e de permissão obrigatória** entre dados de ações assistenciais/saúde e o módulo de engajamento político. Dado clínico nunca alimenta classificação de posicionamento político.

---

## 11. Qualidade e confiabilidade de dados

- **Deduplicação obrigatória**: contato cadastrado por operadores diferentes deve ser identificado e mesclado, não duplicado — duplicação corrompe silenciosamente todos os dashboards e metas.
- **Versionamento de status de engajamento**: cada mudança gera novo registro histórico, nunca sobrescreve.
- **Indicador de completude/qualidade por território**: % de dados desatualizados (sem contato há X meses) e % de registros com confiança "baixa" no campo de posicionamento, visível no dashboard.
- **Validação de entrada**: telefone, WhatsApp e endereço com validação de formato; bloqueio de cadastro incompleto em campos críticos (comunidade/bairro obrigatório).

---

## 12. Metodologia estatística da meta de votos

O cálculo de "votos necessários com margem de erro" precisa de metodologia explícita e auditável, não caixa-preta:

- Documentar a fórmula: base (votos última eleição por território) × fator de correção (crescimento populacional/eleitoral IBGE/TSE) × taxa de conversão estimada simpatizante→voto (com intervalo de confiança, não número único).
- Exibir intervalo de confiança na interface (ex.: "meta: 8.200–9.400 votos"), nunca número único que passe falsa precisão.
- Permitir que o coordenador ajuste manualmente premissas (comparecimento esperado, taxa de conversão) e veja o impacto — a fórmula não deve ser fixa/opaca.
- Na etapa de arquitetura, explicitar qual método estatístico simples (ex.: intervalo baseado em desvio padrão histórico de comparecimento) será usado, evitando modelo mais sofisticado que o volume de dados disponível justifique.

---

## 13. Robustez técnica e operacional

- **Backup e recuperação**: backup automático diário, com teste periódico de restauração.
- **Ambiente de staging** separado de produção antes de qualquer atualização.
- **Idempotência nas automações**: disparo de mensagem não pode duplicar em caso de reprocessamento/falha — cada envio com identificador único.
- **Rate limiting e fila** para envios via WhatsApp Business API, respeitando limites da Meta.
- **Observabilidade**: log de erros de sincronização (especialmente com app offline em campo); alerta automático se um módulo parar de registrar dados (zero cadastros novos por X dias pode indicar falha silenciosa).
- **Sincronização offline confiável**: estratégia de resolução de conflito quando dois dispositivos editam o mesmo contato offline — sinalizar conflito para revisão humana em vez de last-write-wins automático, especialmente em dado sensível.
- **Controle de acesso granular testado**: plano de teste de permissão (ex.: operador não deve conseguir exportar base completa de posicionamento político).

---

## 14. Dashboard executivo e eleitoral

**Indicadores gerais**: total de contatos, novos contatos (30 dias), lideranças cadastradas, comunidades mapeadas, regiões de baixa cobertura, interações (30 dias), demandas abertas/resolvidas, próximos eventos, aniversariantes.

**Painel eleitoral**: população total do município (IBGE), eleitorado total e por zona (TSE), votos obtidos na última eleição por território, meta de votos para a próxima eleição com margem de erro configurável, gap por bairro entre votos atuais e meta, ranking de territórios prioritários para investimento de relacionamento.

Deixar explícito na interface que a "meta de votos" é estimativa estatística baseada em dados públicos agregados, não contagem individual de intenção de voto.

---

## 15. Dados eleitorais públicos

Módulo separado, importando apenas dados públicos agregados do TSE: zona, seção, local de votação, comparecimento histórico, resultados históricos agregados por território.

**Nunca associar voto individual a pessoa cadastrada** — a meta de votos é sempre estatística/territorial; o registro de "apoiador" é percepção/declaração da equipe, não inferência do voto real (que é secreto).

---

## 16. Inteligência territorial (IA)

Análises sobre dados agregados: bairros com baixa cobertura, comunidades sem liderança, demandas mais frequentes, crescimento da base, gap entre engajamento e meta eleitoral por território, comunidades sem visita recente, tarefas atrasadas, qualidade dos dados.

A IA deve explicar quais dados sustentam cada insight, e **não deve inferir posicionamento político individual** a partir de profissão, religião, saúde, localização ou outros dados pessoais — apenas exibir o que foi declarado/registrado explicitamente, com seu nível de confiança.

---

## 17. Relatório territorial, busca inteligente, segurança/LGPD e UX

- **Relatório automático** por comunidade/região: contatos, lideranças, demandas, interações, ações realizadas, pendências, indicadores agregados, evolução temporal.
- **Busca universal**: um termo (ex.: "Comunidade Lagoa Grande") retorna página da comunidade, lideranças, contatos, demandas, eventos, interações, tarefas relacionadas.
- **Segurança e LGPD**: autenticação segura, RBAC, criptografia, logs de auditoria, registro de alterações, política de retenção, exportação/exclusão de dados, registro de consentimentos.
- **Perfis de usuário**: Administrador, Coordenador, Operador, Visualização — com permissão adicional obrigatória para acesso ao campo de posicionamento político.
- **UX**: interface moderna, mobile-first. Menu lateral: Dashboard, Contatos, Lideranças, Comunidades, Mapa, Demandas, Interações, Eventos, Comunicação, Automações, Relatórios, Inteligência, Configurações.

---

## 18. Arquitetura técnica

Propor arquitetura moderna e escalável, avaliando tecnologias para: frontend, backend, banco de dados, autenticação, mapas, WhatsApp, automações, IA, hospedagem, backup, logs.

Considerar inicialmente uma aplicação para um município pequeno, com arquitetura que permita evoluir para produto SaaS multi-município/multi-equipe.

---

## 19. Primeira tarefa

**Não começar programando.** Entregar primeiro:

0. Análise de compliance LGPD/eleitoral (seção 0).
1. Visão geral do produto.
2. Módulos necessários.
3. Funcionalidades de cada módulo.
4. Arquitetura de informação.
5. Modelo conceitual do banco de dados (com notação ER, ex. Mermaid).
6. Principais entidades e relacionamentos.
7. Perfis e permissões.
8. Fluxos principais do usuário.
9. Estrutura dos dashboards.
10. Arquitetura técnica recomendada.
11. Integrações necessárias.
12. Requisitos de segurança, LGPD e compliance eleitoral.
13. Definição do MVP.
14. Funcionalidades para versões posteriores.
15. Roadmap de desenvolvimento.

Depois disso, apresentar a estrutura de telas e navegação.

**Implementação só começa após aprovação da arquitetura, módulo por módulo.**
