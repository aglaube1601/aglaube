-- 0003_secao_eleitoral.sql
--
-- Guarda o de-para oficial "seção eleitoral -> comunidade" (local de
-- votação + endereço, do arquivo de local de votação do TSE), pra todo
-- import de resultado eleitoral por seção reaproveitar essa relação em vez
-- de cada import ter que agregar manualmente fora do sistema.

-- CreateTable
CREATE TABLE "SecaoEleitoral" (
    "id" TEXT NOT NULL,
    "zona" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "nrLocalVotacao" INTEGER,
    "nomeLocalVotacao" TEXT,
    "endereco" TEXT,
    "comunidadeId" TEXT NOT NULL,

    CONSTRAINT "SecaoEleitoral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SecaoEleitoral_zona_numero_key" ON "SecaoEleitoral"("zona", "numero");

-- AddForeignKey
ALTER TABLE "SecaoEleitoral" ADD CONSTRAINT "SecaoEleitoral_comunidadeId_fkey" FOREIGN KEY ("comunidadeId") REFERENCES "Comunidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: DadosEleitoraisPublicos ganha referência opcional à seção
ALTER TABLE "DadosEleitoraisPublicos" ADD COLUMN "secaoEleitoralId" TEXT;

-- CreateIndex
CREATE INDEX "DadosEleitoraisPublicos_secaoEleitoralId_idx" ON "DadosEleitoraisPublicos"("secaoEleitoralId");

-- AddForeignKey
ALTER TABLE "DadosEleitoraisPublicos" ADD CONSTRAINT "DadosEleitoraisPublicos_secaoEleitoralId_fkey" FOREIGN KEY ("secaoEleitoralId") REFERENCES "SecaoEleitoral"("id") ON DELETE SET NULL ON UPDATE CASCADE;
