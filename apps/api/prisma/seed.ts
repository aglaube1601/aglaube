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

  // 5. Dados eleitorais públicos — resultado agregado por comunidade
  //    (nunca por contato individual). Fonte: votacao_secao_2024_PI.csv,
  //    agregado por local de votação. Conferido contra o resultado oficial
  //    do TSE (1.821 / 903 / 12 brancos / 75 nulos = 2.811) — bate exato.
  const dadosEleitorais = [
    {
      comunidadeId: avCentral.id,
      votosLeal: 511,
      votosGeronimo: 187,
      totalSecao: 721,
      nSecoes: 3,
    },
    {
      comunidadeId: osvaldo.id,
      votosLeal: 309,
      votosGeronimo: 147,
      totalSecao: 473,
      nSecoes: 2,
    },
    {
      comunidadeId: sabino.id,
      votosLeal: 478,
      votosGeronimo: 226,
      totalSecao: 724,
      nSecoes: 3,
    },
    {
      comunidadeId: saoJoaoBatista.id,
      votosLeal: 523,
      votosGeronimo: 343,
      totalSecao: 893,
      nSecoes: 4,
    },
  ];

  for (const d of dadosEleitorais) {
    await prisma.dadosEleitoraisPublicos.create({
      data: {
        comunidadeId: d.comunidadeId, // FK nova — nunca contatoId
        eleicaoAno: 2024,
        cargo: 'PREFEITO',
        candidatoNumero: 12,
        candidatoNome: 'MANOEL BERNARDO LEAL',
        votosObtidos: d.votosLeal,
      },
    });
    await prisma.dadosEleitoraisPublicos.create({
      data: {
        comunidadeId: d.comunidadeId,
        eleicaoAno: 2024,
        cargo: 'PREFEITO',
        candidatoNumero: 15,
        candidatoNome: 'GERONIMO MANOEL DA SILVA',
        votosObtidos: d.votosGeronimo,
      },
    });
  }

  console.log('Seed de Vila Nova do Piauí concluído:');
  console.log(`  1 município, 1 zona eleitoral, 2 bairros, 4 comunidades`);
  console.log(`  8 registros de DadosEleitoraisPublicos (2 candidatos x 4 comunidades)`);
  console.log('');
  console.log('Resumo por comunidade (% Geronimo = indicador de prioridade):');
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
