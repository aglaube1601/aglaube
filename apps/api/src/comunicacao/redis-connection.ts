/**
 * redis-connection.ts
 *
 * BullMQ exige `maxRetriesPerRequest: null` na conexão usada por Queue e
 * Worker (comandos de bloqueio internos falham sem isso). Conexão
 * compartilhada entre os dois em vez de uma nova por instância — BullMQ
 * já duplica internamente quando precisa de uma conexão dedicada de
 * bloqueio, então isso é só pooling, não risco de comportamento cruzado.
 */

import IORedis from 'ioredis';

let conexaoCompartilhada: IORedis | undefined;

export function conexaoRedis(): IORedis {
  if (!conexaoCompartilhada) {
    conexaoCompartilhada = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
  }
  return conexaoCompartilhada;
}
