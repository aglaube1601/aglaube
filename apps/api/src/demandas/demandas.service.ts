/**
 * demandas.service.ts
 *
 * Regras de negócio:
 * 1. Transição de status segue a ordem definida (NOVA → EM_ANALISE →
 *    EM_ANDAMENTO → RESOLVIDA → ENCERRADA). Pular etapa é bloqueado para
 *    a maioria dos perfis — só Administrador/Coordenador podem forçar,
 *    e só com justificativa registrada (ex: fechar demanda duplicada).
 * 2. Toda mudança de status gera um registro em DemandaHistorico — nunca
 *    sobrescreve, é histórico permanente (mesmo princípio de versionamento
 *    usado em EngajamentoPolitico).
 * 3. comunidadeId obrigatório — mesma regra de territorialização do
 *    módulo Contatos.
 */

import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDemandaDto, StatusDemanda } from './dto/create-demanda.dto';
import { UsuarioAutenticado } from '../contatos/contatos.service';

// Ordem oficial do fluxo — única fonte de verdade para validação de transição
const ORDEM_STATUS: StatusDemanda[] = [
  StatusDemanda.NOVA,
  StatusDemanda.EM_ANALISE,
  StatusDemanda.EM_ANDAMENTO,
  StatusDemanda.RESOLVIDA,
  StatusDemanda.ENCERRADA,
];

function indiceStatus(status: StatusDemanda): number {
  return ORDEM_STATUS.indexOf(status);
}

@Injectable()
export class DemandasService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dto: CreateDemandaDto, usuario: UsuarioAutenticado) {
    const comunidade = await this.prisma.comunidade.findUnique({
      where: { id: dto.comunidadeId },
    });
    if (!comunidade) {
      throw new BadRequestException('Comunidade informada não existe.');
    }

    if (dto.contatoId) {
      const contato = await this.prisma.contato.findUnique({ where: { id: dto.contatoId } });
      if (!contato) {
        throw new BadRequestException('Contato informado não existe.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const demanda = await tx.demanda.create({
        data: {
          categoria: dto.categoria,
          descricao: dto.descricao,
          comunidadeId: dto.comunidadeId,
          contatoId: dto.contatoId,
          prioridade: dto.prioridade ?? 'media',
          status: StatusDemanda.NOVA,
          responsavelId: dto.responsavelId ?? usuario.id,
          prazo: dto.prazo ? new Date(dto.prazo) : undefined,
        },
      });

      // Primeira entrada no histórico — nasce como NOVA
      await tx.demandaHistorico.create({
        data: {
          demandaId: demanda.id,
          statusAnterior: null,
          statusNovo: StatusDemanda.NOVA,
          alteradoPorId: usuario.id,
        },
      });

      return demanda;
    });
  }

  /**
   * Valida se a transição é permitida. Retorna true/false — não lança
   * exceção aqui para permitir que o caller decida a mensagem de erro
   * mais específica (ex: "pulo de etapa" vs "retrocesso").
   */
  private transicaoValida(atual: StatusDemanda, novo: StatusDemanda): boolean {
    const idxAtual = indiceStatus(atual);
    const idxNovo = indiceStatus(novo);
    // Só permite avançar exatamente uma etapa por vez no fluxo padrão
    return idxNovo === idxAtual + 1;
  }

  async atualizarStatus(
    demandaId: string,
    novoStatus: StatusDemanda,
    usuario: UsuarioAutenticado,
    justificativaForcarTransicao?: string,
  ) {
    const demanda = await this.prisma.demanda.findUnique({ where: { id: demandaId } });
    if (!demanda) {
      throw new BadRequestException('Demanda não encontrada.');
    }

    const statusAtual = demanda.status as StatusDemanda;

    // Retrocesso nunca é permitido, para ninguém — o histórico é a forma
    // correta de "corrigir" um status, não voltar o estado atual.
    if (indiceStatus(novoStatus) < indiceStatus(statusAtual)) {
      throw new BadRequestException(
        'Retrocesso de status não é permitido. Registre uma observação no histórico se necessário.',
      );
    }

    const ehTransicaoSequencial = this.transicaoValida(statusAtual, novoStatus);
    const ehPuloDeEtapa = !ehTransicaoSequencial && indiceStatus(novoStatus) > indiceStatus(statusAtual);

    if (ehPuloDeEtapa) {
      const podeForcar = usuario.perfil === 'administrador' || usuario.perfil === 'coordenador';
      if (!podeForcar) {
        throw new ForbiddenException(
          'Pular etapa do fluxo requer perfil Coordenador ou Administrador.',
        );
      }
      if (!justificativaForcarTransicao) {
        throw new BadRequestException(
          'Pular etapa do fluxo exige justificativa registrada.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const atualizada = await tx.demanda.update({
        where: { id: demandaId },
        data: { status: novoStatus },
      });

      await tx.demandaHistorico.create({
        data: {
          demandaId,
          statusAnterior: statusAtual,
          statusNovo: novoStatus,
          alteradoPorId: usuario.id,
          // justificativa só é preenchida quando é pulo de etapa forçado
          ...(ehPuloDeEtapa && { justificativa: justificativaForcarTransicao }),
        },
      });

      return atualizada;
    });
  }

  /**
   * FECHA A LACUNA: existia criação e mudança de status de demanda desde o
   * início, mas nenhum jeito de LISTAR ou ABRIR uma demanda depois de
   * criada — a única visão era a contagem agregada do Mapa/Painel. Listagem
   * territorializada, mesmo critério de escopo de ContatosService.listar.
   */
  async listar(
    municipioId: string,
    opts: { comunidadeId?: string; status?: string },
  ) {
    if (!municipioId) {
      throw new BadRequestException('municipioId é obrigatório.');
    }

    return this.prisma.demanda.findMany({
      where: {
        comunidade: {
          ...(opts.comunidadeId ? { id: opts.comunidadeId } : {}),
          bairro: { zonaEleitoral: { municipioId } },
        },
        ...(opts.status ? { status: opts.status } : {}),
      },
      select: {
        id: true,
        categoria: true,
        descricao: true,
        status: true,
        prioridade: true,
        prazo: true,
        criadoEm: true,
        comunidade: { select: { id: true, nome: true } },
        contato: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async buscarPorId(id: string) {
    const demanda = await this.prisma.demanda.findUnique({
      where: { id },
      select: {
        id: true,
        categoria: true,
        descricao: true,
        status: true,
        prioridade: true,
        prazo: true,
        criadoEm: true,
        comunidade: { select: { id: true, nome: true } },
        contato: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
        historico: {
          orderBy: { data: 'desc' },
          select: {
            id: true,
            statusAnterior: true,
            statusNovo: true,
            justificativa: true,
            data: true,
            alteradoPor: { select: { id: true, nome: true } },
          },
        },
      },
    });

    if (!demanda) {
      throw new NotFoundException('Demanda não encontrada.');
    }

    return demanda;
  }

  /**
   * Agregação para o dashboard: demandas mais frequentes por território.
   * Retorna contagem por comunidade + categoria — nunca lista contato
   * individual nesta consulta (isso é responsabilidade de outro endpoint
   * com RBAC específico de leitura de Contato).
   */
  async contarPorTerritorioECategoria(municipioId: string) {
    return this.prisma.demanda.groupBy({
      by: ['comunidadeId', 'categoria', 'status'],
      where: {
        comunidade: { bairro: { zonaEleitoral: { municipioId } } },
      },
      _count: { _all: true },
    });
  }
}
