/**
 * envio.worker.spec.ts
 *
 * Só testa processarJob() — a regra de negócio (idempotencyKey -> status)
 * — nunca sobe um Worker de verdade nem precisa de Redis. onModuleInit()
 * (que conecta em Redis) não é chamado aqui de propósito.
 */

import { Test } from '@nestjs/testing';
import { EnvioWorker } from './envio.worker';
import { PrismaService } from '../prisma/prisma.service';

describe('EnvioWorker', () => {
  let worker: EnvioWorker;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      envioMensagem: { updateMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [EnvioWorker, { provide: PrismaService, useValue: prisma }],
    }).compile();

    worker = moduleRef.get(EnvioWorker);
  });

  it('marca o envio como enviado usando idempotencyKey, só se ainda estava pendente', async () => {
    await worker.processarJob({ envioId: 'camp-1:contato-1', contatoId: 'contato-1', campanhaId: 'camp-1' });

    expect(prisma.envioMensagem.updateMany).toHaveBeenCalledWith({
      where: { idempotencyKey: 'camp-1:contato-1', status: 'pendente' },
      data: { status: 'enviado' },
    });
  });
});
