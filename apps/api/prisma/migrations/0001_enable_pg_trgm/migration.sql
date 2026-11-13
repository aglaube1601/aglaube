-- 0001_enable_pg_trgm.sql
--
-- Necessário para ContatosService.buscarPossiveisDuplicatas(). Sem isso,
-- a função similarity() não existe e o dedup falha silenciosamente em
-- produção mesmo passando nos testes locais (se o dev tiver a extensão
-- habilitada manualmente na própria máquina). Rodar como migration do
-- Prisma (prisma/migrations/) e não só localmente.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice GIN para não degradar a busca de duplicatas conforme a base cresce.
-- Sem isso, buscarPossiveisDuplicatas() faz sequential scan em todo
-- Contato a cada cadastro em campo — aceitável com 100 contatos,
-- inaceitável com 50.000.
CREATE INDEX IF NOT EXISTS idx_contato_nome_trgm
  ON "Contato" USING GIN (nome gin_trgm_ops);
