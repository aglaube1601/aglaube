/**
 * seed-secoes-eleitorais.ts
 *
 * Script de ATUALIZAÇÃO — roda contra um banco que JÁ ESTÁ NO AR, com dado
 * real (contatos, demandas, etc). Diferente de seed.ts (que cria tudo do
 * zero): este NUNCA cria Município/ZonaEleitoral/Bairro/Comunidade — só
 * procura o que já existe pelo nome, e adiciona por cima:
 *   1. As 12 SecaoEleitoral (de-para seção -> comunidade, fonte TSE).
 *   2. Reimporta DadosEleitoraisPublicos do Prefeito 2024 com granularidade
 *      de seção (substitui os 8 registros antigos — só por comunidade — por
 *      24 novos — por seção — pra não ficar contando voto em dobro).
 *   3. Adiciona DadosEleitoraisPublicos do Presidente 2026 (cargo novo,
 *      nunca tocando o que já existe de Prefeito).
 *
 * IDEMPOTENTE: se já existir qualquer SecaoEleitoral pra zona 68, o script
 * não faz nada — evita duplicar ao rodar de novo por engano.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NOMES_COMUNIDADE = {
  saoJoaoBatista: 'Povoado São João Batista (Zacarias Manoel da Silva)',
  avCentral: 'Avenida Central (Luiz Ubiraci de Carvalho)',
  sabino: 'Rua Projetada (Sabino Gomes de Lima)',
  osvaldo: 'Rua Anísia Laura de Sousa (Osvaldo José de Araújo)',
} as const;

async function main() {
  const zonaExistente = await prisma.secaoEleitoral.findFirst({ where: { zona: 68 } });
  if (zonaExistente) {
    console.log('Já existem SecaoEleitoral para a zona 68 — nada a fazer (script é idempotente).');
    return;
  }

  const comunidadesEncontradas = await prisma.comunidade.findMany({
    where: { nome: { in: Object.values(NOMES_COMUNIDADE) } },
  });
  const porNome = new Map(comunidadesEncontradas.map((c) => [c.nome, c]));

  const faltando = Object.values(NOMES_COMUNIDADE).filter((n) => !porNome.has(n));
  if (faltando.length > 0) {
    throw new Error(
      `Comunidade(s) não encontrada(s) no banco (nome precisa bater exatamente com o seed original): ${faltando.join(', ')}`,
    );
  }

  const saoJoaoBatista = porNome.get(NOMES_COMUNIDADE.saoJoaoBatista)!;
  const avCentral = porNome.get(NOMES_COMUNIDADE.avCentral)!;
  const sabino = porNome.get(NOMES_COMUNIDADE.sabino)!;
  const osvaldo = porNome.get(NOMES_COMUNIDADE.osvaldo)!;

  // 1. Seções eleitorais — de-para oficial (fonte: TSE, ver seed.ts para a
  //    mesma tabela comentada com mais detalhe).
  const secoesPorLocal: Array<{
    comunidade: { id: string };
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
          zona: 68,
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
  console.log(`${secaoPorNumero.size} seções eleitorais criadas.`);

  // 2. Substitui o Prefeito 2024 agregado (8 registros, só por comunidade,
  //    sem secaoEleitoralId) pelos 24 registros por seção — apagar antes de
  //    inserir evita contar o mesmo voto duas vezes no groupBy do Mapa.
  const removidos = await prisma.dadosEleitoraisPublicos.deleteMany({
    where: { cargo: 'PREFEITO', eleicaoAno: 2024, secaoEleitoralId: null },
  });
  console.log(`${removidos.count} registros antigos de Prefeito 2024 (agregados por comunidade) removidos.`);

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
  console.log('24 registros de Prefeito 2024 (por seção) criados.');

  // 3. Presidente 2026, por seção — decodificado dos Boletins de Urna
  //    oficiais. Ver seed.ts para a mesma nota sobre candidatoNome placeholder.
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

  let criadosPresidente = 0;
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
      criadosPresidente += 1;
    }
  }
  console.log(`${criadosPresidente} registros de Presidente 2026 (por seção) criados.`);
  console.log('Atualização concluída.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
