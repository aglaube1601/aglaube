-- 0002_envio_mensagem_idempotencia.sql
--
-- A garantia de "nunca enviar duas vezes" não pode depender só do código
-- da aplicação (retry de infra, deploy duplo, corrida entre workers).
-- Precisa ser uma constraint do banco.

CREATE UNIQUE INDEX IF NOT EXISTS idx_envio_mensagem_idempotency_key
  ON "EnvioMensagem" (idempotency_key);
