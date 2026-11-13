/**
 * rotas-campo.service.ts
 *
 * Regras de negócio:
 * 1. Toda ParadaRota pertence a um Contato da MESMA comunidade da rota —
 *    nunca mistura território dentro de uma rota (mesma régua de
 *    territorialização do resto do sistema).
 * 2. RotaCampo.status NUNCA é setado direto — é sempre recalculado a
 *    partir do status das paradas (ver recalcularStatusRota), pra nunca
 *    ficar dessincronizado do progresso real registrado em campo.
 * 3. Quem executa a rota (perfil Operador) só enxerga/atualiza as
 *    PRÓPRIAS rotas (responsavelId = usuario.id). Administrador e
 *    Coordenador enxergam todas as rotas do município, pra acompanhar o
 *    progresso de quem está em campo.
 */

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRotaCampoDto, StatusParada } from './dto/create-rota-campo.dto';
import { UsuarioAutenticado } from '../contatos/contatos.service';

export interface RotaCampoResumo {
  id: string;
  status: string;
  criadaEm: Date;
  comunidade: { id: string; nome: string };
  responsavel: { id: string; nome: string };
  totalParadas: number;
  paradasConcluidas: number; // visitado + ausente + recusou — qualquer coisa != pendente
}

@Injectable()
export class RotasCampoService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dto: CreateRotaCampoDto, usuario: UsuarioAutenticado) {
    const comunidade = await this.prisma.comunidade.findUnique({ where: { id: dto.comunidadeId } });
    if (!comunidade) {
      throw new BadRequestException('Comunidade informada não existe.');
    }

    const responsavel = await this.prisma.usuario.findUnique({ where: { id: dto.responsavelId } });
    if (!responsavel) {
      throw new BadRequestException('Usuário responsável informado não existe.');
    }

    // Territorialização: todo contatoId precisa pertencer à MESMA
    // comunidade da rota — count divergente = algum id não existe, ou
    // existe mas é de outra comunidade.
    const idsUnicos = Array.from(new Set(dto.contatoIds));
    const contatosValidos = await this.prisma.contato.count({
      where: { id: { in: idsUnicos }, comunidadeId: dto.comunidadeId },
    });
    if (contatosValidos !== idsUnicos.length) {
      throw new BadRequestException(
        'Um ou mais contatos informados não existem ou não pertencem à comunidade da rota.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const rota = await tx.rotaCampo.create({
        data: {
          comunidadeId: dto.comunidadeId,
          responsavelId: dto.responsavelId,
          criadaPorId: usuario.id,
        },
      });

      await tx.paradaRota.createMany({
        data: idsUnicos.map((contatoId, i) => ({
          rotaId: rota.id,
          contatoId,
          ordem: i,
        })),
      });

      return rota;
    });
  }

  /**
   * Listagem territorializada (mesmo critério de Contatos/Demandas).
   * Operador só vê as próprias rotas — Administrador/Coordenador veem
   * todas as do município.
   */
  async listar(
    municipioId: string,
    usuario: UsuarioAutenticado,
    opts: { status?: string } = {},
  ): Promise<RotaCampoResumo[]> {
    if (!municipioId) {
      throw new BadRequestException('municipioId é obrigatório.');
    }

    const somenteProprias = usuario.perfil === 'operador';

    const rotas = await this.prisma.rotaCampo.findMany({
      where: {
        comunidade: { bairro: { zonaEleitoral: { municipioId } } },
        ...(somenteProprias ? { responsavelId: usuario.id } : {}),
        ...(opts.status ? { status: opts.status } : {}),
      },
      orderBy: { criadaEm: 'desc' },
      select: {
        id: true,
        status: true,
        criadaEm: true,
        comunidade: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
        paradas: { select: { status: true } },
      },
    });

    return rotas.map((r) => ({
      id: r.id,
      status: r.status,
      criadaEm: r.criadaEm,
      comunidade: r.comunidade,
      responsavel: r.responsavel,
      totalParadas: r.paradas.length,
      paradasConcluidas: r.paradas.filter((p) => p.status !== StatusParada.PENDENTE).length,
    }));
  }

  async buscarPorId(id: string, usuario: UsuarioAutenticado) {
    const rota = await this.prisma.rotaCampo.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        criadaEm: true,
        responsavelId: true,
        comunidade: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
        criadaPor: { select: { id: true, nome: true } },
        paradas: {
          orderBy: { ordem: 'asc' },
          select: {
            id: true,
            ordem: true,
            status: true,
            concluidaEm: true,
            contato: { select: { id: true, nome: true, telefone: true, endereco: true } },
          },
        },
      },
    });

    if (!rota) {
      throw new NotFoundException('Rota de campo não encontrada.');
    }

    this.verificarAcesso(rota.responsavelId, usuario);

    return rota;
  }

  async atualizarParada(
    rotaId: string,
    paradaId: string,
    novoStatus: StatusParada,
    usuario: UsuarioAutenticado,
  ) {
    const rota = await this.prisma.rotaCampo.findUnique({
      where: { id: rotaId },
      select: { id: true, responsavelId: true, paradas: { select: { id: true, status: true } } },
    });

    if (!rota) {
      throw new NotFoundException('Rota de campo não encontrada.');
    }

    this.verificarAcesso(rota.responsavelId, usuario);

    const parada = rota.paradas.find((p) => p.id === paradaId);
    if (!parada) {
      throw new NotFoundException('Parada não encontrada nesta rota.');
    }

    return this.prisma.$transaction(async (tx) => {
      const paradaAtualizada = await tx.paradaRota.update({
        where: { id: paradaId },
        data: {
          status: novoStatus,
          concluidaEm: novoStatus === StatusParada.PENDENTE ? null : new Date(),
        },
      });

      const statusDasParadas = rota.paradas.map((p) => (p.id === paradaId ? novoStatus : p.status));
      await tx.rotaCampo.update({
        where: { id: rotaId },
        data: { status: this.recalcularStatusRota(statusDasParadas) },
      });

      return paradaAtualizada;
    });
  }

  private verificarAcesso(responsavelId: string, usuario: UsuarioAutenticado) {
    const ehDona = responsavelId === usuario.id;
    const podeVerTudo = usuario.perfil === 'administrador' || usuario.perfil === 'coordenador';
    if (!ehDona && !podeVerTudo) {
      throw new ForbiddenException('Você só pode acessar as próprias rotas de campo.');
    }
  }

  private recalcularStatusRota(statusDasParadas: string[]): string {
    const todasConcluidas = statusDasParadas.every((s) => s !== StatusParada.PENDENTE);
    if (todasConcluidas) return 'concluida';
    const algumaConcluida = statusDasParadas.some((s) => s !== StatusParada.PENDENTE);
    return algumaConcluida ? 'em_andamento' : 'planejada';
  }
}
