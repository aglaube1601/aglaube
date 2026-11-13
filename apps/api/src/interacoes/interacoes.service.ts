/**
 * interacoes.service.ts
 *
 * Regra de design importante: Interação NUNCA cria ou altera
 * EngajamentoPolitico diretamente. Se o usuário quer registrar que uma
 * visita mudou a leitura de engajamento, o fluxo correto é:
 *   1. Chamar ContatosService.atualizarEngajamento() (já valida permissão
 *      e gera auditoria).
 *   2. Opcionalmente, linkar o ID do registro resultante nesta interação,
 *      só para navegação na timeline ("essa visita gerou essa mudança").
 *
 * Isso evita duplicar a lógica de permissão/auditoria de engajamento em
 * dois lugares diferentes do código.
 */

import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInteracaoDto } from './dto/create-interacao.dto';
import { UsuarioAutenticado } from '../contatos/contatos.service';

@Injectable()
export class InteracoesService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dto: CreateInteracaoDto, usuario: UsuarioAutenticado) {
    const contato = await this.prisma.contato.findUnique({ where: { id: dto.contatoId } });
    if (!contato) {
      throw new BadRequestException('Contato informado não existe.');
    }

    if (dto.engajamentoPoliticoId) {
      // Não basta o registro existir — precisa pertencer a ESTE contato e
      // o usuário precisa ter permissão de engajamento para sequer
      // referenciá-lo (senão vazaria, por linkagem, a existência de um
      // dado sensível para quem não deveria acessá-lo).
      if (!usuario.permissaoEngajamentoPolitico) {
        throw new ForbiddenException(
          'Usuário sem permissão para vincular registro de engajamento político.',
        );
      }
      const registro = await this.prisma.engajamentoPolitico.findUnique({
        where: { id: dto.engajamentoPoliticoId },
      });
      if (!registro || registro.contatoId !== dto.contatoId) {
        throw new BadRequestException(
          'Registro de engajamento informado não pertence a este contato.',
        );
      }
    }

    return this.prisma.interacao.create({
      data: {
        contatoId: dto.contatoId,
        tipo: dto.tipo,
        descricao: dto.descricao,
        responsavelId: usuario.id,
        data: dto.data ? new Date(dto.data) : new Date(),
        atualizouEngajamentoId: dto.engajamentoPoliticoId,
      },
    });
  }

  /**
   * Timeline do contato, mais recente primeiro. Nunca inclui o CONTEÚDO
   * de EngajamentoPolitico aqui — só a referência (atualizouEngajamentoId),
   * se existir. Quem quiser o conteúdo do engajamento consulta o endpoint
   * próprio, que já tem o RBAC e a auditoria de leitura aplicados.
   */
  async listarPorContato(contatoId: string, limite = 50) {
    return this.prisma.interacao.findMany({
      where: { contatoId },
      orderBy: { data: 'desc' },
      take: limite,
      select: {
        id: true,
        tipo: true,
        descricao: true,
        data: true,
        responsavelId: true,
        atualizouEngajamentoId: true,
      },
    });
  }

  /** Usado pelo Dashboard: contagem simples de interações num período. */
  async contarNoPeriodo(municipioId: string, desde: Date) {
    return this.prisma.interacao.count({
      where: {
        data: { gte: desde },
        contato: {
          comunidade: { bairro: { zonaEleitoral: { municipioId } } },
        },
      },
    });
  }
}
