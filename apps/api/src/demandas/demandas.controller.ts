/**
 * demandas.controller.ts
 *
 * RBAC: Administrador, Coordenador, Operador podem criar/atualizar
 * (cadastro/edição, igual Contatos). Visualização só teria acesso a um
 * GET de leitura (não incluído aqui — ver controller completo do projeto).
 */

import {
  Body,
  Controller,
  DefaultValuePipe,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard, PerfilUsuario } from '../auth/roles.guard';
import { DemandasService } from './demandas.service';
import { CreateDemandaDto, UpdateDemandaStatusDto } from './dto/create-demanda.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsuarioAutenticado } from '../contatos/contatos.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('demandas')
export class DemandasController {
  constructor(private readonly demandasService: DemandasService) {}

  @Post()
  @Roles(PerfilUsuario.ADMINISTRADOR, PerfilUsuario.COORDENADOR, PerfilUsuario.OPERADOR)
  async criar(@Body() dto: CreateDemandaDto, @CurrentUser() usuario: UsuarioAutenticado) {
    return this.demandasService.criar(dto, usuario);
  }

  @Patch(':id/status')
  @Roles(PerfilUsuario.ADMINISTRADOR, PerfilUsuario.COORDENADOR, PerfilUsuario.OPERADOR)
  async atualizarStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDemandaStatusDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.demandasService.atualizarStatus(
      id,
      dto.novoStatus,
      usuario,
      dto.justificativaForcarTransicao,
    );
  }

  @Get('municipios/:municipioId/resumo-territorial')
  @Roles(PerfilUsuario.ADMINISTRADOR, PerfilUsuario.COORDENADOR, PerfilUsuario.VISUALIZACAO)
  async resumoTerritorial(@Param('municipioId') municipioId: string) {
    return this.demandasService.contarPorTerritorioECategoria(municipioId);
  }

  // Listagem territorializada — mesmos perfis de leitura de Contatos.listar.
  @Get()
  @Roles(
    PerfilUsuario.ADMINISTRADOR,
    PerfilUsuario.COORDENADOR,
    PerfilUsuario.OPERADOR,
    PerfilUsuario.VISUALIZACAO,
  )
  async listar(
    @Query('municipioId') municipioId: string,
    @Query('comunidadeId') comunidadeId?: string,
    @Query('status') status?: string,
    @Query('pagina', new DefaultValuePipe(1), ParseIntPipe) pagina = 1,
    @Query('tamanhoPagina', new DefaultValuePipe(25), ParseIntPipe) tamanhoPagina = 25,
  ) {
    return this.demandasService.listar(municipioId, { comunidadeId, status, pagina, tamanhoPagina });
  }

  @Get(':id')
  @Roles(
    PerfilUsuario.ADMINISTRADOR,
    PerfilUsuario.COORDENADOR,
    PerfilUsuario.OPERADOR,
    PerfilUsuario.VISUALIZACAO,
  )
  async buscarPorId(@Param('id') id: string) {
    return this.demandasService.buscarPorId(id);
  }
}
