/**
 * fila-envio.service.ts
 *
 * MOCKADO propositalmente — sem integração real de WhatsApp ainda.
 * Quando a integração real entrar (BSP homologado: Twilio ou 360dialog,
 * ver arquitetura técnica), esta classe é o ÚNICO lugar que muda: troca
 * o log por um `queue.add()` do BullMQ de verdade, com rate limiting
 * configurado para o limite da API do WhatsApp Business.
 *
 * ComunicacaoService não deve saber ou se importar com essa troca —
 * é exatamente por isso que essa responsabilidade está isolada aqui
 * atrás de uma interface simples.
 */

import { Injectable, Logger } from '@nestjs/common';

export interface JobEnvio {
  envioId: string; // = idempotencyKey
  contatoId: string;
  campanhaId: string;
}

@Injectable()
export class FilaEnvioService {
  private readonly logger = new Logger(FilaEnvioService.name);

  async enfileirar(job: JobEnvio): Promise<void> {
    // TODO(integração real): substituir por
    //   await this.bullQueue.add('envio-whatsapp', job, {
    //     jobId: job.envioId, // BullMQ também dedupe por jobId — dupla camada
    //     attempts: 3,
    //     backoff: { type: 'exponential', delay: 5000 },
    //   });
    // e configurar limiter da queue para respeitar o rate limit da Meta.
    this.logger.log(`[MOCK] Envio enfileirado: ${JSON.stringify(job)}`);
  }
}
