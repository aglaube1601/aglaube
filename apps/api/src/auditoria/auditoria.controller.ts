/**
 * auditoria.controller.ts
 *
 * RBAC: só Administrador — ver comentário em auditoria.service.ts.
 */

import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard, PerfilUsuario } from '../auth/roles.guard';
import { AuditoriaService } from './auditoria.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @Roles(PerfilUsuario.ADMINISTRADOR)
  async listar(
    @Query('entidade') entidade?: string,
    @Query('entidadeId') entidadeId?: string,
    @Query('usuarioId') usuarioId?: string,
    @Query('acao') acao?: 'leitura' | 'criacao' | 'edicao' | 'exclusao' | 'exportacao',
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('pagina', new DefaultValuePipe(1), ParseIntPipe) pagina = 1,
    @Query('tamanhoPagina', new DefaultValuePipe(25), ParseIntPipe) tamanhoPagina = 25,
  ) {
    return this.auditoriaService.listar(
      {
        entidade,
        entidadeId,
        usuarioId,
        acao,
        dataInicio: dataInicio ? new Date(dataInicio) : undefined,
        dataFim: dataFim ? new Date(dataFim) : undefined,
      },
      { pagina, tamanhoPagina },
    );
  }
}
