/**
 * auditoria.service.ts
 *
 * LogAuditoria já está sendo alimentado desde o módulo Contatos (toda
 * escrita em EngajamentoPolitico gera entrada). Este service é o lado
 * de LEITURA disso — sem ele, o log existe mas ninguém consegue consultar.
 *
 * RBAC: só Administrador. A tabela de permissões original já dizia
 * "Engajamento político: Administrador = Total + auditoria" — o "+auditoria"
 * significa que só o Administrador enxerga QUEM acessou o dado sensível,
 * nem o Coordenador (que pode ESCREVER engajamento) vê essa trilha.
 *
 * PENDÊNCIA CONHECIDA (não esconder isso): a regra original de compliance
 * pede auditoria em toda LEITURA OU ESCRITA de EngajamentoPolitico. Hoje
 * só a escrita está coberta (ver ContatosService). Ainda não existe um
 * endpoint de leitura individual de engajamento (ex: GET /contatos/:id
 * expandindo o campo) — quando ele for construído, PRECISA chamar
 * registrarLeitura() abaixo antes de retornar o dado. Registrando aqui
 * para não perder isso de vista.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface FiltrosAuditoria {
  entidade?: string;
  entidadeId?: string;
  usuarioId?: string;
  acao?: 'leitura' | 'criacao' | 'edicao' | 'exclusao' | 'exportacao';
  dataInicio?: Date;
  dataFim?: Date;
}

export interface PaginacaoParams {
  pagina: number; // 1-indexed
  tamanhoPagina: number;
}

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtros: FiltrosAuditoria, paginacao: PaginacaoParams) {
    const where = {
      ...(filtros.entidade && { entidade: filtros.entidade }),
      ...(filtros.entidadeId && { entidadeId: filtros.entidadeId }),
      ...(filtros.usuarioId && { usuarioId: filtros.usuarioId }),
      ...(filtros.acao && { acao: filtros.acao }),
      ...((filtros.dataInicio || filtros.dataFim) && {
        timestamp: {
          ...(filtros.dataInicio && { gte: filtros.dataInicio }),
          ...(filtros.dataFim && { lte: filtros.dataFim }),
        },
      }),
    };

    const tamanhoPagina = Math.min(paginacao.tamanhoPagina, 100); // teto — nunca dump completo
    const skip = (paginacao.pagina - 1) * tamanhoPagina;

    const [registros, total] = await Promise.all([
      this.prisma.logAuditoria.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: tamanhoPagina,
        select: {
          id: true,
          entidade: true,
          entidadeId: true,
          acao: true,
          timestamp: true,
          detalhes: true,
          usuario: { select: { id: true, nome: true, perfil: true } },
        },
      }),
      this.prisma.logAuditoria.count({ where }),
    ]);

    return {
      registros,
      total,
      pagina: paginacao.pagina,
      tamanhoPagina,
      totalPaginas: Math.ceil(total / tamanhoPagina),
    };
  }

  /**
   * Chamar SEMPRE que um endpoint retornar o CONTEÚDO de EngajamentoPolitico
   * para leitura (não confundir com listagem deste próprio log de auditoria,
   * que não expõe conteúdo de engajamento, só metadados de acesso).
   */
  async registrarLeitura(usuarioId: string, entidadeId: string) {
    return this.prisma.logAuditoria.create({
      data: {
        usuarioId,
        entidade: 'EngajamentoPolitico',
        entidadeId,
        acao: 'leitura',
      },
    });
  }
}
