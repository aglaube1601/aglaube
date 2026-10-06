/**
 * consentimentos.controller.ts + consentimentos.service.ts
 *
 * Fecha a lacuna do módulo Comunicação: ComunicacaoService já FILTRA por
 * Consentimento.status desde o início, mas não existia nenhum jeito de
 * criar ou consultar esse registro — o filtro sempre batia vazio.
 *
 * Design: igual EngajamentoPolitico, Consentimento é APPEND-ONLY. Nunca
 * fazemos UPDATE num registro existente — cada mudança de decisão (aceitou
 * / não aceitou / mudou de ideia depois) vira um novo registro, e o status
 * "atual" é sempre o mais recente por (contato, finalidade). Isso mantém
 * histórico auditável e evita a classe de bug onde um "ativo" antigo,
 * seguido de opt-out, continuaria contando como consentimento válido só
 * porque a query original perguntava "algum registro ativo já existiu"
 * em vez de "qual é o status MAIS RECENTE".
 */

import {
  Body,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard, PerfilUsuario } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConsentimentoDto } from './dto/create-consentimento.dto';

export interface ConsentimentoAtual {
  finalidade: string;
  status: string;
  origem: string | null;
  data: Date;
}

@Injectable()
export class ConsentimentosService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(contatoId: string, dto: CreateConsentimentoDto) {
    const contato = await this.prisma.contato.findUnique({ where: { id: contatoId } });
    if (!contato) {
      throw new NotFoundException('Contato não encontrado.');
    }

    return this.prisma.consentimento.create({
      data: {
        contatoId,
        finalidade: dto.finalidade,
        status: dto.status,
        origem: dto.origem,
      },
    });
  }

  /** Status mais recente por finalidade — nunca "algum registro já foi X". */
  async statusAtual(contatoId: string): Promise<ConsentimentoAtual[]> {
    const historico = await this.prisma.consentimento.findMany({
      where: { contatoId },
      orderBy: { data: 'desc' },
      select: { finalidade: true, status: true, origem: true, data: true },
    });

    const maisRecentePorFinalidade = new Map<string, ConsentimentoAtual>();
    for (const registro of historico) {
      if (!maisRecentePorFinalidade.has(registro.finalidade)) {
        maisRecentePorFinalidade.set(registro.finalidade, registro);
      }
    }
    return Array.from(maisRecentePorFinalidade.values());
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contatos/:contatoId/consentimento')
export class ConsentimentosController {
  constructor(private readonly consentimentosService: ConsentimentosService) {}

  // Mesmo RBAC de cadastro/edição de Contato — captar consentimento é ação
  // operacional de campo, não dado sensível como EngajamentoPolitico.
  @Post()
  @Roles(PerfilUsuario.ADMINISTRADOR, PerfilUsuario.COORDENADOR, PerfilUsuario.OPERADOR)
  async registrar(@Param('contatoId') contatoId: string, @Body() dto: CreateConsentimentoDto) {
    return this.consentimentosService.registrar(contatoId, dto);
  }

  @Get()
  @Roles(
    PerfilUsuario.ADMINISTRADOR,
    PerfilUsuario.COORDENADOR,
    PerfilUsuario.OPERADOR,
    PerfilUsuario.VISUALIZACAO,
  )
  async statusAtual(@Param('contatoId') contatoId: string) {
    return this.consentimentosService.statusAtual(contatoId);
  }
}
