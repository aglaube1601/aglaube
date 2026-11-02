/**
 * Seed de CONTATOS DE TESTE — nomes fictícios, todos com o mesmo telefone
 * (o do dono do projeto), usado só para validar o fluxo ponta a ponta
 * (cadastro, dashboard, comunicação) antes de o time de campo começar a
 * cadastrar contatos reais.
 *
 * SUBSTITUIR por cadastro real assim que o sistema estiver pronto — este
 * script é seguro de rodar de novo (não duplica: usa upsert por nome).
 * Não roda em produção — não há guarda automática, remova/edite antes.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TELEFONE_TESTE = '(89) 98116-7308';

async function main() {
  const comunidades = await prisma.comunidade.findMany({
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  });

  if (comunidades.length === 0) {
    throw new Error(
      'Nenhuma comunidade encontrada — rode "pnpm seed" primeiro (dado real de Vila Nova do Piauí).',
    );
  }

  const criados: string[] = [];

  for (let i = 0; i < comunidades.length; i++) {
    const comunidade = comunidades[i];
    // Nome derivado da própria comunidade — nunca fica desalinhado,
    // independente da ordem em que elas vierem do banco.
    const nome = `Contato Teste ${i + 1} - ${comunidade.nome}`;

    const existente = await prisma.contato.findFirst({
      where: { nome, comunidadeId: comunidade.id },
    });
    if (existente) {
      criados.push(`${nome} (já existia)`);
      continue;
    }

    await prisma.contato.create({
      data: {
        nome,
        telefone: TELEFONE_TESTE,
        whatsapp: TELEFONE_TESTE,
        comunidadeId: comunidade.id,
        origemCadastro: 'seed_teste',
      },
    });
    criados.push(`${nome} → ${comunidade.nome}`);
  }

  console.log('Contatos de teste:');
  criados.forEach((c) => console.log(`  ${c}`));
  console.log('');
  console.log(
    `Todos com telefone/whatsapp de teste: ${TELEFONE_TESTE} — troque por dado real depois.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
