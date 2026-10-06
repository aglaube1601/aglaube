-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateTable
CREATE TABLE "Municipio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "populacaoEstimada" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Municipio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZonaEleitoral" (
    "id" TEXT NOT NULL,
    "municipioId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "comparecimentoHistorico" INTEGER,

    CONSTRAINT "ZonaEleitoral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bairro" (
    "id" TEXT NOT NULL,
    "zonaEleitoralId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "Bairro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comunidade" (
    "id" TEXT NOT NULL,
    "bairroId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "populacaoEstimada" INTEGER,

    CONSTRAINT "Comunidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contato" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "dataNascimento" TIMESTAMP(3),
    "endereco" TEXT,
    "comunidadeId" TEXT NOT NULL,
    "profissao" TEXT,
    "origemCadastro" TEXT,
    "responsavelCadastroId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngajamentoPolitico" (
    "id" TEXT NOT NULL,
    "contatoId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "confianca" TEXT NOT NULL,
    "registradoPorId" TEXT NOT NULL,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngajamentoPolitico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lideranca" (
    "id" TEXT NOT NULL,
    "contatoId" TEXT NOT NULL,
    "grupo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lideranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Demanda" (
    "id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "comunidadeId" TEXT NOT NULL,
    "contatoId" TEXT,
    "prioridade" TEXT NOT NULL DEFAULT 'media',
    "status" TEXT NOT NULL DEFAULT 'nova',
    "responsavelId" TEXT,
    "prazo" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Demanda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandaHistorico" (
    "id" TEXT NOT NULL,
    "demandaId" TEXT NOT NULL,
    "statusAnterior" TEXT,
    "statusNovo" TEXT NOT NULL,
    "alteradoPorId" TEXT NOT NULL,
    "justificativa" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandaHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interacao" (
    "id" TEXT NOT NULL,
    "contatoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "responsavelId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizouEngajamentoId" TEXT,

    CONSTRAINT "Interacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoAcao" (
    "id" TEXT NOT NULL,
    "comunidadeId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoriaDado" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "local" TEXT,
    "publicoEstimado" INTEGER,
    "observacoes" TEXT,

    CONSTRAINT "EventoAcao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoParticipante" (
    "eventoId" TEXT NOT NULL,
    "contatoId" TEXT NOT NULL,

    CONSTRAINT "EventoParticipante_pkey" PRIMARY KEY ("eventoId","contatoId")
);

-- CreateTable
CREATE TABLE "Consentimento" (
    "id" TEXT NOT NULL,
    "contatoId" TEXT NOT NULL,
    "finalidade" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "origem" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consentimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DadosEleitoraisPublicos" (
    "id" TEXT NOT NULL,
    "comunidadeId" TEXT,
    "eleicaoAno" INTEGER NOT NULL,
    "cargo" TEXT NOT NULL,
    "candidatoNumero" INTEGER NOT NULL,
    "candidatoNome" TEXT NOT NULL,
    "votosObtidos" INTEGER NOT NULL,

    CONSTRAINT "DadosEleitoraisPublicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampanhaComunicacao" (
    "id" TEXT NOT NULL,
    "tipoTemplate" TEXT NOT NULL,
    "corpoMensagem" TEXT NOT NULL,
    "finalidade" TEXT NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "sinalizadoParaRevisao" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampanhaComunicacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvioMensagem" (
    "id" TEXT NOT NULL,
    "campanhaId" TEXT NOT NULL,
    "contatoId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvioMensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" TEXT NOT NULL,
    "permissaoEngajamentoPolitico" BOOLEAN NOT NULL DEFAULT false,
    "municipioId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "detalhes" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZonaEleitoral_municipioId_numero_key" ON "ZonaEleitoral"("municipioId", "numero");

-- CreateIndex
CREATE INDEX "Contato_nome_idx" ON "Contato"("nome");

-- CreateIndex
CREATE INDEX "EngajamentoPolitico_contatoId_vigente_idx" ON "EngajamentoPolitico"("contatoId", "vigente");

-- CreateIndex
CREATE UNIQUE INDEX "Lideranca_contatoId_key" ON "Lideranca"("contatoId");

-- CreateIndex
CREATE INDEX "Consentimento_contatoId_finalidade_status_idx" ON "Consentimento"("contatoId", "finalidade", "status");

-- CreateIndex
CREATE INDEX "DadosEleitoraisPublicos_comunidadeId_eleicaoAno_idx" ON "DadosEleitoraisPublicos"("comunidadeId", "eleicaoAno");

-- CreateIndex
CREATE UNIQUE INDEX "EnvioMensagem_idempotencyKey_key" ON "EnvioMensagem"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidade_entidadeId_idx" ON "LogAuditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "LogAuditoria_usuarioId_idx" ON "LogAuditoria"("usuarioId");

-- AddForeignKey
ALTER TABLE "ZonaEleitoral" ADD CONSTRAINT "ZonaEleitoral_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bairro" ADD CONSTRAINT "Bairro_zonaEleitoralId_fkey" FOREIGN KEY ("zonaEleitoralId") REFERENCES "ZonaEleitoral"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comunidade" ADD CONSTRAINT "Comunidade_bairroId_fkey" FOREIGN KEY ("bairroId") REFERENCES "Bairro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contato" ADD CONSTRAINT "Contato_comunidadeId_fkey" FOREIGN KEY ("comunidadeId") REFERENCES "Comunidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contato" ADD CONSTRAINT "Contato_responsavelCadastroId_fkey" FOREIGN KEY ("responsavelCadastroId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngajamentoPolitico" ADD CONSTRAINT "EngajamentoPolitico_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "Contato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngajamentoPolitico" ADD CONSTRAINT "EngajamentoPolitico_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lideranca" ADD CONSTRAINT "Lideranca_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "Contato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demanda" ADD CONSTRAINT "Demanda_comunidadeId_fkey" FOREIGN KEY ("comunidadeId") REFERENCES "Comunidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demanda" ADD CONSTRAINT "Demanda_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "Contato"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demanda" ADD CONSTRAINT "Demanda_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandaHistorico" ADD CONSTRAINT "DemandaHistorico_demandaId_fkey" FOREIGN KEY ("demandaId") REFERENCES "Demanda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandaHistorico" ADD CONSTRAINT "DemandaHistorico_alteradoPorId_fkey" FOREIGN KEY ("alteradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interacao" ADD CONSTRAINT "Interacao_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "Contato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interacao" ADD CONSTRAINT "Interacao_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interacao" ADD CONSTRAINT "Interacao_atualizouEngajamentoId_fkey" FOREIGN KEY ("atualizouEngajamentoId") REFERENCES "EngajamentoPolitico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoAcao" ADD CONSTRAINT "EventoAcao_comunidadeId_fkey" FOREIGN KEY ("comunidadeId") REFERENCES "Comunidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoParticipante" ADD CONSTRAINT "EventoParticipante_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EventoAcao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoParticipante" ADD CONSTRAINT "EventoParticipante_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "Contato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consentimento" ADD CONSTRAINT "Consentimento_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "Contato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DadosEleitoraisPublicos" ADD CONSTRAINT "DadosEleitoraisPublicos_comunidadeId_fkey" FOREIGN KEY ("comunidadeId") REFERENCES "Comunidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampanhaComunicacao" ADD CONSTRAINT "CampanhaComunicacao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvioMensagem" ADD CONSTRAINT "EnvioMensagem_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "CampanhaComunicacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvioMensagem" ADD CONSTRAINT "EnvioMensagem_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "Contato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogAuditoria" ADD CONSTRAINT "LogAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

