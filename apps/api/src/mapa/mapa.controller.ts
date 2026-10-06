/**
 * mapa.controller.ts
 *
 * RBAC igual ao Painel Eleitoral: Administrador, Coordenador, Visualização.
 * Operador fora — mesma fonte de dado sensível (EngajamentoPolitico),
 * mesmo que agregada e com k-anonimato aplicado.
 */

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard, PerfilUsuario } from '../auth/roles.guard';
import { MapaService } from './mapa.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('municipios/:municipioId/mapa')
export class MapaController {
  constructor(private readonly mapaService: MapaService) {}

  @Get('territorios')
  @Roles(PerfilUsuario.ADMINISTRADOR, PerfilUsuario.COORDENADOR, PerfilUsuario.VISUALIZACAO)
  async obterTerritorios(@Param('municipioId') municipioId: string) {
    return this.mapaService.obterTerritorios(municipioId);
  }
}
