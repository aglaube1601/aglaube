/**
 * interacoes.controller.ts
 *
 * RBAC: Administrador, Coordenador, Operador registram interação
 * (cadastro/edição, igual Contatos e Demandas). Visualização só lê.
 */

import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard, PerfilUsuario } from '../auth/roles.guard';
import { InteracoesService } from './interacoes.service';
import { CreateInteracaoDto } from './dto/create-interacao.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsuarioAutenticado } from '../contatos/contatos.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class InteracoesController {
  constructor(private readonly interacoesService: InteracoesService) {}

  @Post('interacoes')
  @Roles(PerfilUsuario.ADMINISTRADOR, PerfilUsuario.COORDENADOR, PerfilUsuario.OPERADOR)
  async criar(@Body() dto: CreateInteracaoDto, @CurrentUser() usuario: UsuarioAutenticado) {
    return this.interacoesService.criar(dto, usuario);
  }

  @Get('contatos/:contatoId/interacoes')
  @Roles(
    PerfilUsuario.ADMINISTRADOR,
    PerfilUsuario.COORDENADOR,
    PerfilUsuario.OPERADOR,
    PerfilUsuario.VISUALIZACAO,
  )
  async listarPorContato(
    @Param('contatoId') contatoId: string,
    @Query('limite') limite?: string,
  ) {
    return this.interacoesService.listarPorContato(
      contatoId,
      limite ? parseInt(limite, 10) : undefined,
    );
  }
}
