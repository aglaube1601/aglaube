/**
 * rotas-campo.controller.ts
 *
 * RBAC: Administrador/Coordenador montam e atribuem rotas (criar).
 * Operador participa só como executor — lista/abre/atualiza as rotas
 * atribuídas a ele (RotasCampoService.verificarAcesso cobre o "só a
 * própria rota"). Visualizacao fica de fora: isto é ação operacional de
 * campo, não leitura estratégica.
 */

import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard, PerfilUsuario } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsuarioAutenticado } from '../contatos/contatos.service';
import { RotasCampoService } from './rotas-campo.service';
import { CreateRotaCampoDto, AtualizarParadaDto } from './dto/create-rota-campo.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rotas-campo')
export class RotasCampoController {
  constructor(private readonly rotasCampoService: RotasCampoService) {}

  @Post()
  @Roles(PerfilUsuario.ADMINISTRADOR, PerfilUsuario.COORDENADOR)
  async criar(@Body() dto: CreateRotaCampoDto, @CurrentUser() usuario: UsuarioAutenticado) {
    return this.rotasCampoService.criar(dto, usuario);
  }

  @Get()
  @Roles(PerfilUsuario.ADMINISTRADOR, PerfilUsuario.COORDENADOR, PerfilUsuario.OPERADOR)
  async listar(
    @Query('municipioId') municipioId: string,
    @CurrentUser() usuario: UsuarioAutenticado,
    @Query('status') status?: string,
  ) {
    return this.rotasCampoService.listar(municipioId, usuario, { status });
  }

  @Get(':id')
  @Roles(PerfilUsuario.ADMINISTRADOR, PerfilUsuario.COORDENADOR, PerfilUsuario.OPERADOR)
  async buscarPorId(@Param('id') id: string, @CurrentUser() usuario: UsuarioAutenticado) {
    return this.rotasCampoService.buscarPorId(id, usuario);
  }

  @Patch(':id/paradas/:paradaId')
  @Roles(PerfilUsuario.ADMINISTRADOR, PerfilUsuario.COORDENADOR, PerfilUsuario.OPERADOR)
  async atualizarParada(
    @Param('id') id: string,
    @Param('paradaId') paradaId: string,
    @Body() dto: AtualizarParadaDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.rotasCampoService.atualizarParada(id, paradaId, dto.status, usuario);
  }
}
