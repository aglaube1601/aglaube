/**
 * electoral-projection.controller.ts
 *
 * Expõe o cálculo de meta de votos (dois cenários + intervalo) via REST.
 *
 * RBAC (ver tabela de permissões do MVP):
 *   Administrador — total
 *   Coordenador   — leitura (pode ajustar premissas via query params)
 *   Operador      — SEM ACESSO (não é dado de cadastro/campo)
 *   Visualização  — acesso permitido: este endpoint só expõe dado já
 *                   agregado por comunidade, nunca individual, então não
 *                   viola a regra de "Visualização = agregado apenas".
 *
 * Este endpoint NUNCA consulta Contato ou EngajamentoPolitico — só
 * DadosEleitoraisPublicos (via ElectoralProjectionService). Se algum dia
 * precisar cruzar com engajamento, isso exige nova revisão de compliance,
 * não só uma mudança de código.
 */

import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard, PerfilUsuario } from '../auth/roles.guard';
import { ElectoralProjectionService, ResultadoProjecaoEleitoral } from './electoral-projection.service';
import { GetProjecaoEleitoralDto } from './dto/get-projecao-eleitoral.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('municipios/:municipioId/projecao-eleitoral')
export class ElectoralProjectionController {
  constructor(private readonly electoralProjectionService: ElectoralProjectionService) {}

  @Get()
  @Roles(PerfilUsuario.ADMINISTRADOR, PerfilUsuario.COORDENADOR, PerfilUsuario.VISUALIZACAO)
  async obterProjecao(
    @Param('municipioId') municipioId: string,
    @Query() query: GetProjecaoEleitoralDto,
  ): Promise<ResultadoProjecaoEleitoral> {
    const premissasCustom = {
      ...(query.retencaoMin !== undefined && { retencaoMin: query.retencaoMin }),
      ...(query.retencaoMax !== undefined && { retencaoMax: query.retencaoMax }),
      ...(query.taxaCrescimentoAnual !== undefined && {
        taxaCrescimentoAnual: query.taxaCrescimentoAnual,
      }),
      ...(query.anosProjecao !== undefined && { anosProjecao: query.anosProjecao }),
    };

    return this.electoralProjectionService.calcularMetaVotos(
      municipioId,
      query.eleicaoAnoBase,
      query.candidatoSituacionistaNumero,
      query.candidatoOposicaoNumero,
      Object.keys(premissasCustom).length > 0 ? premissasCustom : undefined,
    );
  }
}
