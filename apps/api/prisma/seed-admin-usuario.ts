/**
 * seed-admin-usuario.ts
 *
 * Resolve o problema de partida: criar usuário exige um Administrador já
 * autenticado, mas o primeiro Administrador não existe ainda. Este script
 * roda FORA da API (linha de comando), não é um endpoint.
 *
 * IDEMPOTENTE: se já existir qualquer usuário com perfil administrador,
 * o script não faz nada — evita recriar/resetar credenciais sem querer
 * ao rodar de novo por engano.
 *
 * Senha e e-mail vêm de variável de ambiente, nunca hardcoded no código
 * (mesmo sendo um script de dev/bootstrap) — evita a senha padrão parar
 * num repositório git.
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

async function main() {
  const jaExisteAdmin = await prisma.usuario.findFirst({
    where: { perfil: 'administrador' },
  });

  if (jaExisteAdmin) {
    console.log('Já existe um Administrador cadastrado — nada a fazer.');
    return;
  }

  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const senha = process.env.ADMIN_BOOTSTRAP_SENHA;

  if (!email || !senha) {
    throw new Error(
      'Defina ADMIN_BOOTSTRAP_EMAIL e ADMIN_BOOTSTRAP_SENHA no ambiente antes de rodar este script.',
    );
  }
  if (senha.length < 8) {
    throw new Error('ADMIN_BOOTSTRAP_SENHA precisa ter no mínimo 8 caracteres.');
  }

  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

  const admin = await prisma.usuario.create({
    data: {
      nome: 'Administrador',
      email,
      senhaHash,
      perfil: 'administrador',
      permissaoEngajamentoPolitico: true,
    },
  });

  console.log(`Administrador criado: ${admin.email}`);
  console.log('IMPORTANTE: troque a senha no primeiro login e remova as');
  console.log('variáveis ADMIN_BOOTSTRAP_* do ambiente depois de usá-las.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
