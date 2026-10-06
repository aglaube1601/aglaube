/**
 * interacoes.service.spec.ts
 */

import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { InteracoesService } from './interacoes.service';
import { PrismaService } from '../prisma/prisma.service';
import { TipoInteracao } from './dto/create-interacao.dto';
import { UsuarioAutenticado } from '../contatos/contatos.service';

describe('InteracoesService', () => {
  let service: InteracoesService;
  let prisma: any;

  const operadorSemPermissao: UsuarioAutenticado = {
    id: 'user-operador',
    perfil: 'operador',
    permissaoEngajamentoPolitico: false,
  };
  const coordenadorComPermissao: UsuarioAutenticado = {
    id: 'user-coordenador',
    perfil: 'coordenador',
    permissaoEngajamentoPolitico: true,
  };

  beforeEach(async () => {
    prisma = {
      contato: { findUnique: jest.fn() },
      engajamentoPolitico: { findUnique: jest.fn() },
      interacao: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [InteracoesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(InteracoesService);
  });

  it('rejeita criação se o contato não existe', async () => {
    prisma.contato.findUnique.mockResolvedValue(null);

    await expect(
      service.criar(
        { contatoId: 'x', tipo: TipoInteracao.VISITA, descricao: 'visita' } as any,
        operadorSemPermissao,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('cria interação simples sem link de engajamento', async () => {
    prisma.contato.findUnique.mockResolvedValue({ id: 'contato-1' });
    prisma.interacao.create.mockResolvedValue({ id: 'int-1' });

    const resultado = await service.criar(
      { contatoId: 'contato-1', tipo: TipoInteracao.LIGACAO, descricao: 'contato telefônico' } as any,
      operadorSemPermissao,
    );

    expect(resultado).toEqual({ id: 'int-1' });
    expect(prisma.engajamentoPolitico.findUnique).not.toHaveBeenCalled();
  });

  it('BLOQUEIA link de engajamento se o usuário não tem permissão (mesmo com ID válido)', async () => {
    prisma.contato.findUnique.mockResolvedValue({ id: 'contato-1' });

    await expect(
      service.criar(
        {
          contatoId: 'contato-1',
          tipo: TipoInteracao.VISITA,
          descricao: 'visita',
          engajamentoPoliticoId: 'eng-1',
        } as any,
        operadorSemPermissao,
      ),
    ).rejects.toThrow(ForbiddenException);

    // Nem chega a checar se o registro existe — falha antes, por permissão
    expect(prisma.engajamentoPolitico.findUnique).not.toHaveBeenCalled();
  });

  it('BLOQUEIA link se o registro de engajamento pertence a OUTRO contato', async () => {
    prisma.contato.findUnique.mockResolvedValue({ id: 'contato-1' });
    prisma.engajamentoPolitico.findUnique.mockResolvedValue({
      id: 'eng-1',
      contatoId: 'contato-DIFERENTE',
    });

    await expect(
      service.criar(
        {
          contatoId: 'contato-1',
          tipo: TipoInteracao.VISITA,
          descricao: 'visita',
          engajamentoPoliticoId: 'eng-1',
        } as any,
        coordenadorComPermissao,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('permite link válido quando usuário tem permissão e registro pertence ao contato certo', async () => {
    prisma.contato.findUnique.mockResolvedValue({ id: 'contato-1' });
    prisma.engajamentoPolitico.findUnique.mockResolvedValue({
      id: 'eng-1',
      contatoId: 'contato-1',
    });
    prisma.interacao.create.mockResolvedValue({ id: 'int-1', atualizouEngajamentoId: 'eng-1' });

    const resultado = await service.criar(
      {
        contatoId: 'contato-1',
        tipo: TipoInteracao.VISITA,
        descricao: 'visita',
        engajamentoPoliticoId: 'eng-1',
      } as any,
      coordenadorComPermissao,
    );

    expect(resultado.atualizouEngajamentoId).toBe('eng-1');
  });

  it('listarPorContato nunca seleciona conteúdo de EngajamentoPolitico, só a referência', async () => {
    prisma.interacao.findMany.mockResolvedValue([]);
    await service.listarPorContato('contato-1');

    const chamadaArgs = prisma.interacao.findMany.mock.calls[0][0];
    expect(chamadaArgs.select).not.toHaveProperty('atualizouEngajamento'); // relação expandida
    expect(chamadaArgs.select).toHaveProperty('atualizouEngajamentoId'); // só a referência (ID)
  });
});
