/**
 * liderancas.controller.ts + liderancas.service.ts
 *
 * Fecha uma lacuna real: o modelo Lideranca (schema.prisma) e sua
 * contagem já eram usados no Painel, no Mapa e na segmentação de
 * Comunicação desde o início, mas nunca existiu um jeito de CRIAR um
 * registro — ninguém conseguia marcar um contato como liderança pela
 * aplicação. Toda contagem de "lideranças" no sistema sempre bateu zero
 * na prática.
 *
 * Design: Lideranca é 1:1 com Contato (contatoId @unique no schema) — não
 * é organizacional/político como EngajamentoPolitico, é só um marcador
 * "este contato é uma liderança territorial", com um campo livre opcional
 * de grupo (ex: "Força Jovem"). Por isso o RBAC aqui é o mesmo de
 * cadastro/edição de Contato (operacional de campo), não o RBAC mais
 * restrito de EngajamentoPolitico.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard, PerfilUsuario } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { MarcarLiderancaDto } from './dto/marcar-lideranca.dto';

export interface LiderancaAtual {
  grupo: string | null;
  criadoEm: Date;
}

export interface LiderancaResumo {
  id: string;
  contatoId: string;
  nome: string;
  telefone: string | null;
  comunidadeNome: string;
  grupo: string | null;
  criadoEm: Date;
}

@Injectable()
export class LiderancasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotente: marcar de novo um contato que já é liderança só atualiza
   * o grupo, em vez de estourar a constraint @unique de contatoId — evita
   * um erro 500 chato se o usuário clicar duas vezes.
   */
  async marcar(contatoId: string, dto: MarcarLiderancaDto): Promise<LiderancaAtual> {
    const contato = await this.prisma.contato.findUnique({ where: { id: contatoId } });
    if (!contato) {
      throw new NotFoundException('Contato não encontrado.');
    }

    const registro = await this.prisma.lideranca.upsert({
      where: { contatoId },
      update: { grupo: dto.grupo },
      create: { contatoId, grupo: dto.grupo },
    });

    return { grupo: registro.grupo, criadoEm: registro.criadoEm };
  }

  async desmarcar(contatoId: string): Promise<void> {
    const existente = await this.prisma.lideranca.findUnique({ where: { contatoId } });
    if (!existente) {
      throw new NotFoundException('Este contato não está marcado como liderança.');
    }
    await this.prisma.lideranca.delete({ where: { contatoId } });
  }

  async statusAtual(contatoId: string): Promise<LiderancaAtual | null> {
    const registro = await this.prisma.lideranca.findUnique({ where: { contatoId } });
    return registro ? { grupo: registro.grupo, criadoEm: registro.criadoEm } : null;
  }

  /** Listagem territorializada — mesmo critério de escopo de ContatosService.listar. */
  async listar(municipioId: string, comunidadeId?: string): Promise<LiderancaResumo[]> {
    if (!municipioId) {
      throw new BadRequestException('municipioId é obrigatório.');
    }

    const registros = await this.prisma.lideranca.findMany({
      where: {
        contato: {
          comunidade: {
            ...(comunidadeId ? { id: comunidadeId } : {}),
            bairro: { zonaEleitoral: { municipioId } },
          },
        },
      },
      select: {
        id: true,
        contatoId: true,
        grupo: true,
        criadoEm: true,
        contato: { select: { nome: true, telefone: true, comunidade: { select: { nome: true } } } },
      },
      orderBy: { contato: { nome: 'asc' } },
    });

    return registros.map((r) => ({
      id: r.id,
      contatoId: r.contatoId,
      nome: r.contato.nome,
      telefone: r.contato.telefone,
      comunidadeNome: r.contato.comunidade.nome,
      grupo: r.grupo,
      criadoEm: r.criadoEm,
    }));
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contatos/:contatoId/lideranca')
export class LiderancaController {
  constructor(private readonly liderancasService: LiderancasService) {}

  @Post()
  @Roles(PerfilUsuario.ADMINISTRADOR, PerfilUsuario.COORDENADOR, PerfilUsuario.OPERADOR)
  async marcar(@Param('contatoId') contatoId: string, @Body() dto: MarcarLiderancaDto) {
    return this.liderancasService.marcar(contatoId, dto);
  }

  @Delete()
  @Roles(PerfilUsuario.ADMINISTRADOR, PerfilUsuario.COORDENADOR, PerfilUsuario.OPERADOR)
  async desmarcar(@Param('contatoId') contatoId: string) {
    await this.liderancasService.desmarcar(contatoId);
    return { ok: true };
  }

  @Get()
  @Roles(
    PerfilUsuario.ADMINISTRADOR,
    PerfilUsuario.COORDENADOR,
    PerfilUsuario.OPERADOR,
    PerfilUsuario.VISUALIZACAO,
  )
  async statusAtual(@Param('contatoId') contatoId: string) {
    return this.liderancasService.statusAtual(contatoId);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('liderancas')
export class LiderancasController {
  constructor(private readonly liderancasService: LiderancasService) {}

  @Get()
  @Roles(
    PerfilUsuario.ADMINISTRADOR,
    PerfilUsuario.COORDENADOR,
    PerfilUsuario.OPERADOR,
    PerfilUsuario.VISUALIZACAO,
  )
  async listar(@Query('municipioId') municipioId: string, @Query('comunidadeId') comunidadeId?: string) {
    return this.liderancasService.listar(municipioId, comunidadeId);
  }
}
