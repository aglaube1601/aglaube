/**
 * health.controller.ts
 *
 * Único endpoint público além de /auth/login — sem guard de propósito.
 * Existe só pra plataforma de hospedagem saber que o processo subiu e a
 * API está respondendo; nenhum dado do sistema. Sem isso, um health check
 * de deploy (Render, etc.) não tem nenhuma rota 200 sem autenticação pra
 * verificar.
 */

import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  status() {
    return { status: 'ok' };
  }
}
