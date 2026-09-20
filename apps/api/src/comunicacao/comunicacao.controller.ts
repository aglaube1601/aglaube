/**
 * comunicacao.controller.ts
 *
 * RBAC: Administrador, Coordenador, Operador podem criar campanha —
 * mesma lógica de Contatos/Demandas (é ação operacional, não dado
 * sensível em si). O que protege contra abuso não é o RBAC da rota,
 * é a checagem de consentimento + sinalização de propaganda DENTRO
 * do service, que nenhum perfil consegue contornar por aqui.
 */

import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard, PerfilUsuario } from '../auth/roles.guard';
import { ComunicacaoService } from './comunicacao.service';
import { CreateCampanhaDto } from './dto/create-campanha.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsuarioAutenticado } from '../contatos/contatos.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('municipios/:municipioId/campanhas')
export class ComunicacaoController {
  constructor(private readonly comunicacaoService: ComunicacaoService) {}

  @Post()
  @Roles(PerfilUsuario.ADMINISTRADOR, PerfilUsuario.COORDENADOR, PerfilUsuario.OPERADOR)
  async criarCampanha(
    @Param('municipioId') municipioId: string,
    @Body() dto: CreateCampanhaDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.comunicacaoService.criarCampanha(dto, municipioId, usuario);
  }
}
