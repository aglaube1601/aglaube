-- 0005_rotas_campo.sql
--
-- Rota de campo (Fase 1, sem offline): uma lista ordenada de contatos de
-- UMA comunidade, atribuída a um Usuario pra visitar porta a porta.
-- RotaCampo.status é derivado do status das paradas pelo
-- RotasCampoService, nunca setado direto por quem chama a API.

-- CreateTable
CREATE TABLE "RotaCampo" (
    "id" TEXT NOT NULL,
    "comunidadeId" TEXT NOT NULL,
    "responsavelId" TEXT NOT NULL,
    "criadaPorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planejada',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RotaCampo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParadaRota" (
    "id" TEXT NOT NULL,
    "rotaId" TEXT NOT NULL,
    "contatoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "concluidaEm" TIMESTAMP(3),

    CONSTRAINT "ParadaRota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParadaRota_rotaId_contatoId_key" ON "ParadaRota"("rotaId", "contatoId");

-- CreateIndex
CREATE INDEX "ParadaRota_rotaId_ordem_idx" ON "ParadaRota"("rotaId", "ordem");

-- AddForeignKey
ALTER TABLE "RotaCampo" ADD CONSTRAINT "RotaCampo_comunidadeId_fkey" FOREIGN KEY ("comunidadeId") REFERENCES "Comunidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaCampo" ADD CONSTRAINT "RotaCampo_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaCampo" ADD CONSTRAINT "RotaCampo_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParadaRota" ADD CONSTRAINT "ParadaRota_rotaId_fkey" FOREIGN KEY ("rotaId") REFERENCES "RotaCampo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParadaRota" ADD CONSTRAINT "ParadaRota_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "Contato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
