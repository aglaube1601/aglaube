/**
 * Seed de dados REAIS (fonte pública: TSE + IBGE) para Vila Nova do Piauí - PI.
 * Município piloto do MVP.
 *
 * IMPORTANTE — mudança de schema em relação à primeira versão:
 * DadosEleitoraisPublicos originalmente só linkava a Bairro OU ZonaEleitoral.
 * O nível real de granularidade que conseguimos confirmar oficialmente é o de
 * COMUNIDADE (cada local de votação = 1 comunidade). Adicionamos comunidade_id
 * como FK opcional em DadosEleitoraisPublicos (nunca contato_id, nunca voto
 * individual). Ver nota de compliance no schema.prisma.
 *
 * Fontes:
 * - resultados.tse.jus.br (totalização oficial, 1º turno 2024)
 * - dadosabertos.tse.jus.br — votacao_secao_2024_PI.csv (votação por seção)
 * - IBGE Cidades@ (população estimada 2025, área territorial)
 * - Endereço de cada local de votação vem do próprio arquivo do TSE
 *   (coluna DS_LOCAL_VOTACAO_ENDERECO) — é a fonte da distinção sede/povoado.
 *
 * O que NÃO está confirmado oficialmente (verificado e descartado nesta etapa):
 * - Limite geográfico exato do povoado "São João Batista" — não está mapeado
 *   como localidade individual na base de Localidades do Brasil (Censo 2022)
 *   do IBGE. Usamos o nome como veio no endereço oficial do TSE, sem polígono.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Município
  const municipio = await prisma.municipio.create({
    data: {
      nome: 'Vila Nova do Piauí',
      uf: 'PI',
      populacaoEstimada: 2972, // IBGE, estimativa 2025
      // área territorial: 221,627 km² — guardar se o schema tiver esse campo
    },
  });

  // 2. Zona eleitoral — município tem só a zona 68
  const zona = await prisma.zonaEleitoral.create({
    data: {
      municipioId: municipio.id,
      numero: 68,
      comparecimentoHistorico: 2811, // 2024, 1º turno, eleição majoritária
      // eleitoradoApto: 2998 — se o schema guardar isso separadamente
    },
  });

  // 3. Bairros (nível intermediário — Vila Nova do Piauí não tem bairros
  //    oficialmente demarcados pelo IBGE; usamos Sede vs Zona Rural como
  //    a única distinção real disponível)
  const bairroSede = await prisma.bairro.create({
    data: { zonaEleitoralId: zona.id, nome: 'Sede - Vila Nova do Piauí' },
  });

  const bairroRural = await prisma.bairro.create({
    data: { zonaEleitoralId: zona.id, nome: 'Zona Rural' },
  });

  // 4. Comunidades — 1 por local de votação, granularidade real confirmada
  const comunidades = await Promise.all([
    prisma.comunidade.create({
      data: {
        bairroId: bairroSede.id,
        nome: 'Avenida Central (Luiz Ubiraci de Carvalho)',
        // endereço oficial: "AVENIDA CENTRAL" — via TSE
      },
    }),
    prisma.comunidade.create({
      data: {
        bairroId: bairroSede.id,
        nome: 'Rua Anísia Laura de Sousa (Osvaldo José de Araújo)',
      },
    }),
    prisma.comunidade.create({
      data: {
        bairroId: bairroSede.id,
        nome: 'Rua Projetada (Sabino Gomes de Lima)',
        // endereço genérico "RUA PROJETADA" — provável loteamento/extensão
        // recente da sede; sem confirmação adicional
      },
    }),
    prisma.comunidade.create({
      data: {
        bairroId: bairroRural.id,
        nome: 'Povoado São João Batista (Zacarias Manoel da Silva)',
        // rural confirmado pelo endereço oficial do TSE;
        // sem polígono/coordenada oficial do IBGE até o momento
      },
    }),
  ]);

  const [avCentral, osvaldo, sabino, saoJoaoBatista] = comunidades;

  // 5. Seções eleitorais — de-para oficial seção -> comunidade. Fonte: TSE,
  //    coluna NM_LOCAL_VOTACAO/DS_LOCAL_VOTACAO_ENDERECO do arquivo bruto de
  //    votação por seção (ver docs/dados-eleitorais-vila-nova-do-piaui/).
  //    O formato oficial do TSE SEMPRE vem por seção, nunca por comunidade —
  //    sem essa tabela, todo import novo teria que ser agregado à mão fora
  //    do sistema antes de entrar, como foi feito manualmente da primeira vez.
  const secoesPorLocal: Array<{
    comunidade: (typeof comunidades)[number];
    nrLocalVotacao: number;
    nomeLocalVotacao: string;
    endereco: string;
    numeros: number[];
  }> = [
    {
      comunidade: saoJoaoBatista,
      nrLocalVotacao: 1015,
      nomeLocalVotacao: 'GRUPO ESCOLAR ZACARIAS MANOEL DA SILVA',
      endereco: 'POVOADO SAO JOAO BATISTA S/N',
      numeros: [27, 28, 29, 87],
    },
    {
      comunidade: avCentral,
      nrLocalVotacao: 1040,
      nomeLocalVotacao: 'UNIDADE ESCOLAR LUIZ UBIRACI DE CARVALHO',
      endereco: 'AVENIDA CENTRAL',
      numeros: [45, 54, 68],
    },
    {
      comunidade: sabino,
      nrLocalVotacao: 1031,
      nomeLocalVotacao: 'GRUPO ESCOLAR SABINO GOMES DE LIMA',
      endereco: 'RUA PROJETADA',
      numeros: [30, 31, 96],
    },
    {
      comunidade: osvaldo,
      nrLocalVotacao: 1058,
      nomeLocalVotacao: 'UNIDADE ESCOLAR OSVALDO JOSÉ DE ARAÚJO',
      endereco: 'RUA ANISIA LAURA DE SOUSA, SN',
      numeros: [80, 89],
    },
  ];

  const secaoPorNumero = new Map<number, { id: string; comunidadeId: string }>();
  for (const local of secoesPorLocal) {
    for (const numero of local.numeros) {
      const secao = await prisma.secaoEleitoral.create({
        data: {
          zona: zona.numero,
          numero,
          nrLocalVotacao: local.nrLocalVotacao,
          nomeLocalVotacao: local.nomeLocalVotacao,
          endereco: local.endereco,
          comunidadeId: local.comunidade.id,
        },
      });
      secaoPorNumero.set(numero, { id: secao.id, comunidadeId: local.comunidade.id });
    }
  }

  // 6. Dados eleitorais públicos — Prefeito 2024, 1º turno, POR SEÇÃO (nunca
  //    por contato individual). Fonte: votacao_secao_2024_PI.csv. Granularidade
  //    real confirmada — soma bate exatamente com o resultado oficial agregado
  //    (1.821 Leal / 903 Geronimo / 12 brancos / 75 nulos = 2.811).
  const prefeito2024PorSecao: Array<{ numero: number; leal: number; geronimo: number }> = [
    { numero: 27, leal: 135, geronimo: 91 },
    { numero: 28, leal: 136, geronimo: 79 },
    { numero: 29, leal: 122, geronimo: 91 },
    { numero: 87, leal: 130, geronimo: 82 },
    { numero: 30, leal: 172, geronimo: 87 },
    { numero: 31, leal: 187, geronimo: 82 },
    { numero: 96, leal: 119, geronimo: 57 },
    { numero: 45, leal: 171, geronimo: 69 },
    { numero: 54, leal: 178, geronimo: 61 },
    { numero: 68, leal: 162, geronimo: 57 },
    { numero: 80, leal: 165, geronimo: 85 },
    { numero: 89, leal: 144, geronimo: 62 },
  ];

  for (const r of prefeito2024PorSecao) {
    const secao = secaoPorNumero.get(r.numero)!;
    await prisma.dadosEleitoraisPublicos.create({
      data: {
        comunidadeId: secao.comunidadeId,
        secaoEleitoralId: secao.id,
        eleicaoAno: 2024,
        cargo: 'PREFEITO',
        candidatoNumero: 12,
        candidatoNome: 'MANOEL BERNARDO LEAL',
        votosObtidos: r.leal,
      },
    });
    await prisma.dadosEleitoraisPublicos.create({
      data: {
        comunidadeId: secao.comunidadeId,
        secaoEleitoralId: secao.id,
        eleicaoAno: 2024,
        cargo: 'PREFEITO',
        candidatoNumero: 15,
        candidatoNome: 'GERONIMO MANOEL DA SILVA',
        votosObtidos: r.geronimo,
      },
    });
  }

  // 7. Presidente 2026, 1º turno, POR SEÇÃO — decodificado diretamente dos
  //    Boletins de Urna oficiais (.dat, formato ASN.1 do TSE) fornecidos pelo
  //    usuário, cruzado e validado contra o total de comparecimento de cada
  //    seção (bate exato nas 12 seções). O BU só carrega NÚMERO do candidato,
  //    nunca o nome — "Candidato nº X" é um placeholder até confirmação do
  //    nome oficial contra a lista de candidatos do TSE.
  //    Brancos/nulos NÃO entram aqui — mesmo critério do Prefeito 2024 acima
  //    (DadosEleitoraisPublicos guarda só candidato real, nunca pseudo-linha).
  const presidente2026PorSecao: Array<{ numero: number; votos: Record<number, number> }> = [
    { numero: 27, votos: { 13: 165, 22: 38, 55: 3, 70: 6 } },
    { numero: 28, votos: { 13: 159, 14: 4, 22: 29, 55: 3, 70: 7 } },
    { numero: 29, votos: { 13: 153, 14: 2, 22: 37, 55: 2, 70: 7 } },
    { numero: 30, votos: { 13: 181, 22: 35, 55: 3, 70: 1 } },
    { numero: 31, votos: { 13: 191, 22: 33, 55: 1, 70: 3 } },
    { numero: 45, votos: { 13: 156, 14: 3, 22: 65, 55: 6, 70: 9 } },
    { numero: 54, votos: { 13: 170, 14: 7, 22: 57, 30: 1, 55: 1, 70: 8 } },
    { numero: 68, votos: { 13: 161, 14: 4, 22: 53, 55: 5, 70: 8 } },
    { numero: 80, votos: { 13: 139, 14: 2, 22: 54, 55: 1, 70: 6 } },
    { numero: 87, votos: { 13: 139, 14: 7, 22: 33, 27: 1, 55: 2, 70: 18 } },
    { numero: 89, votos: { 13: 147, 14: 3, 22: 47, 55: 6, 70: 13 } },
    { numero: 96, votos: { 13: 125, 14: 8, 22: 45, 70: 7 } },
  ];

  for (const r of presidente2026PorSecao) {
    const secao = secaoPorNumero.get(r.numero)!;
    for (const [candidatoNumero, votos] of Object.entries(r.votos)) {
      await prisma.dadosEleitoraisPublicos.create({
        data: {
          comunidadeId: secao.comunidadeId,
          secaoEleitoralId: secao.id,
          eleicaoAno: 2026,
          cargo: 'PRESIDENTE',
          candidatoNumero: Number(candidatoNumero),
          candidatoNome: `Candidato nº ${candidatoNumero}`,
          votosObtidos: votos,
        },
      });
    }
  }

  console.log('Seed de Vila Nova do Piauí concluído:');
  console.log(`  1 município, 1 zona eleitoral, 2 bairros, 4 comunidades, 12 seções eleitorais`);
  console.log(`  24 registros de DadosEleitoraisPublicos — Prefeito 2024 (2 candidatos x 12 seções)`);
  console.log(`  ~84 registros de DadosEleitoraisPublicos — Presidente 2026 (por seção, decodificado do BU oficial)`);
  console.log('');
  console.log('Resumo por comunidade, Prefeito 2024 (% Geronimo = indicador de prioridade):');
  console.log('  Av. Central             | Leal 511 | Geronimo 187 | 26,8% Geronimo');
  console.log('  Osvaldo José de Araújo  | Leal 309 | Geronimo 147 | 32,2% Geronimo');
  console.log('  Sabino Gomes de Lima    | Leal 478 | Geronimo 226 | 32,1% Geronimo');
  console.log('  Povoado São João Batista| Leal 523 | Geronimo 343 | 39,6% Geronimo ← prioridade');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
