/**
 * contatos.controller.ts
 *
 * RBAC (ver tabela de permissões do MVP):
 *   Administrador, Coordenador, Operador — podem cadastrar/editar contato
 *   Visualização — apenas leitura (não exposta aqui; ver contatos.controller
 *   completo do projeto para GET /contatos)
 *
 *   PUT .../engajamento — só Administrador e Coordenador (Operador nunca
 *   vê nem edita este campo, reforçado também dentro do service).
 */

import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard, PerfilUsuario } from '../auth/roles.guard';
import { ContatosService, UsuarioAutenticado } from './contatos.service';
import { CreateContatoDto, EngajamentoPoliticoInputDto } from './dto/create-contato.dto';
import { CurrentUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contatos')
export class ContatosController {
  constructor(private readonly contatosService: ContatosService) {}

  // Listagem territorializada — precisa de municipioId porque não existe
  // rota "listar tudo" sem escopo de município (mesmo filtro usado pelo
  // Mapa/Dashboard). Visualização entra aqui (é leitura pura, nunca expõe
  // engajamento) mesmo não podendo cadastrar/editar.
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
    @Query('q') q?: string,
    @Query('pagina', new DefaultValuePipe(1), ParseIntPipe) pagina = 1,
    @Query('tamanhoPagina', new DefaultValuePipe(25), ParseIntPipe) tamanhoPagina = 25,
  ) {
    return this.contatosService.listar(municipioId, { comunidadeId, q, pagina, tamanhoPagina });
  }

  @Get('buscar-duplicatas')
  @Roles(
    PerfilUsuario.ADMINISTRADOR,
    PerfilUsuario.COORDENADOR,
    PerfilUsuario.OPERADOR,
  )
  async buscarDuplicatas(
    @Query('nome') nome: string,
    @Query('telefone') telefone?: string,
  ) {
    return this.contatosService.buscarPossiveisDuplicatas(nome, telefone);
  }

  // Todos os perfis autenticados podem chamar esta rota — o filtro do
  // campo sensível (engajamentoPolitico) acontece DENTRO do
  // ContatosService.buscarPorId(), não aqui. Isso é proposital: a decisão
  // de "quem vê o quê" fica em um único lugar (o service), nunca duplicada
  // entre guard de rota e lógica interna — evita os dois ficarem
  // dessincronizados depois de um PR futuro.
  @Get(':id')
  @Roles(
    PerfilUsuario.ADMINISTRADOR,
    PerfilUsuario.COORDENADOR,
    PerfilUsuario.OPERADOR,
    PerfilUsuario.VISUALIZACAO,
  )
  async buscarPorId(
    @Param('id') id: string,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.contatosService.buscarPorId(id, usuario);
  }

  @Post()
  @Roles(
    PerfilUsuario.ADMINISTRADOR,
    PerfilUsuario.COORDENADOR,
    PerfilUsuario.OPERADOR,
  )
  async criar(
    @Body() dto: CreateContatoDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.contatosService.criar(dto, usuario);
  }

  // Engajamento político tem rota PRÓPRIA, separada do CRUD comum de
  // contato — isso torna o RBAC mais restrito trivial de aplicar (guard
  // no nível da rota, não dentro do handler) e deixa a trilha de
  // auditoria mais clara nos logs de acesso HTTP.
  @Put(':contatoId/engajamento')
  @Roles(PerfilUsuario.ADMINISTRADOR, PerfilUsuario.COORDENADOR)
  async atualizarEngajamento(
    @Param('contatoId') contatoId: string,
    @Body() dto: EngajamentoPoliticoInputDto,
    @CurrentUser() usuario: UsuarioAutenticado,
  ) {
    return this.contatosService.atualizarEngajamento(contatoId, dto, usuario);
  }
}
