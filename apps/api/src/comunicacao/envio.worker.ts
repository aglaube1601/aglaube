/**
 * envio.worker.ts
 *
 * Consome a fila real (BullMQ) e fecha o ciclo de vida de EnvioMensagem:
 * pendente -> enviado. O que continua PENDENTE de verdade (ver HANDOFF.md
 * §7) é a chamada real a um BSP homologado (Twilio ou 360dialog) dentro
 * de `processarJob` — hoje ela é um STUB que sempre "funciona". Quando a
 * integração real entrar, é SÓ este método que muda: chama a API do BSP
 * em vez de simular sucesso, e mapeia falha de entrega pra status='falha'
 * em vez de sempre 'enviado'.
 *
 * `processarJob` é público e não depende de nada de Redis — dá pra testar
 * a regra de negócio (idempotencyKey -> status) sem subir um Worker de
 * verdade nem precisar de Redis no ambiente de teste.
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { conexaoRedis } from './redis-connection';
import { JobEnvio, NOME_FILA_ENVIO } from './fila-envio.service';

@Injectable()
export class EnvioWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EnvioWorker.name);
  private worker?: Worker<JobEnvio>;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.worker = new Worker<JobEnvio>(
      NOME_FILA_ENVIO,
      (job: Job<JobEnvio>) => this.processarJob(job.data),
      { connection: conexaoRedis(), concurrency: 5 },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`Falha ao processar envio ${job?.id}: ${err.message}`);
    });
  }

  async processarJob(job: JobEnvio): Promise<void> {
    // STUB — nenhuma mensagem real sai do WhatsApp aqui ainda.
    this.logger.log(`[STUB] "Enviando" via WhatsApp — envioId=${job.envioId} contatoId=${job.contatoId}`);

    // updateMany (não update) porque o filtro por status='pendente' evita
    // reabrir um envio que outro worker/retry já marcou como enviado —
    // idempotente mesmo sob reprocessamento concorrente do mesmo job.
    await this.prisma.envioMensagem.updateMany({
      where: { idempotencyKey: job.envioId, status: 'pendente' },
      data: { status: 'enviado' },
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
