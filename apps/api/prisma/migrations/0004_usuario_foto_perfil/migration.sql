-- 0004_usuario_foto_perfil.sql
--
-- Permite salvar a foto de perfil do usuário (usada no cabeçalho do
-- Jornal Médico) direto na conta, em vez de precisar reanexar a cada
-- edição. Guardada como data URL (base64) — sem storage de arquivo
-- externo neste MVP, mesma abordagem pragmática já usada pelas imagens
-- anexadas às notícias do Jornal (ver JornalComposer.tsx no frontend).
ALTER TABLE "Usuario" ADD COLUMN "fotoPerfilUrl" TEXT;
