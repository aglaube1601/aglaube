/**
 * fila-envio.service.ts
 *
 * Fila REAL via BullMQ/Redis — só o ENVIO em si ainda é simulado (ver
 * envio.worker.ts). ComunicacaoService não sabe nem se importa com
 * BullMQ — só chama enfileirar(), exatamente como quando isso era mock.
 * Isso valida que o isolamento desenhado desde o início funcionou: trocar
 * a implementação não tocou em nenhuma linha de comunicacao.service.ts.
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { conexaoRedis } from './redis-connection';

export interface JobEnvio {
  envioId: string; // = idempotencyKey
  contatoId: string;
  campanhaId: string;
}

export const NOME_FILA_ENVIO = 'envio-whatsapp';

@Injectable()
export class FilaEnvioService implements OnModuleDestroy {
  private readonly logger = new Logger(FilaEnvioService.name);
  private readonly fila = new Queue<JobEnvio>(NOME_FILA_ENVIO, { connection: conexaoRedis() });

  async enfileirar(job: JobEnvio): Promise<void> {
    // jobId = idempotencyKey: BullMQ também dedupe por jobId — camada
    // extra além da unique constraint no banco (ver ComunicacaoService),
    // que já é a garantia de verdade contra reprocessamento duplicado.
    await this.fila.add(NOME_FILA_ENVIO, job, {
      jobId: job.envioId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1000 },
    });
    this.logger.debug(`Job enfileirado: ${job.envioId}`);
  }

  async onModuleDestroy() {
    await this.fila.close();
  }
}
