/**
 * dashboard.controller.ts
 *
 * RBAC: todos os perfis autenticados podem ver o resumo executivo — é
 * agregado por natureza (contagens, nunca lista individual), então não
 * há razão de negócio para restringir. Diferente do Painel Eleitoral
 * (que tem a leitura estratégica de meta de votos) e do Engajamento
 * Político (dado sensível individual), este endpoint é operacional puro.
 */

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard, PerfilUsuario } from '../auth/roles.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('municipios/:municipioId/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('resumo-executivo')
  @Roles(
    PerfilUsuario.ADMINISTRADOR,
    PerfilUsuario.COORDENADOR,
    PerfilUsuario.OPERADOR,
    PerfilUsuario.VISUALIZACAO,
  )
  async resumoExecutivo(@Param('municipioId') municipioId: string) {
    return this.dashboardService.obterResumoExecutivo(municipioId);
  }

  // RBAC igual ao Mapa/Painel Eleitoral: Administrador, Coordenador,
  // Visualização. Operador fica de fora — mesma fonte de dado sensível
  // (EngajamentoPolitico), mesmo agregada e com k-anonimato aplicado.
  @Get('engajamento-agregado')
  @Roles(PerfilUsuario.ADMINISTRADOR, PerfilUsuario.COORDENADOR, PerfilUsuario.VISUALIZACAO)
  async engajamentoAgregado(@Param('municipioId') municipioId: string) {
    return this.dashboardService.obterEngajamentoAgregado(municipioId);
  }
}
