/**
 * contatos.service.spec.ts
 *
 * Cada teste aqui corresponde a uma regra de negócio EXPLÍCITA do MVP —
 * não são testes genéricos de CRUD. Se um teste destes for removido ou
 * enfraquecido, a regra de compliance correspondente provavelmente foi
 * quebrada em algum PR.
 */

import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ContatosService, UsuarioAutenticado } from './contatos.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

describe('ContatosService', () => {
  let service: ContatosService;
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
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn((cb) => cb(prisma)),
      comunidade: { findUnique: jest.fn() },
      contato: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      engajamentoPolitico: { create: jest.fn(), updateMany: jest.fn() },
      logAuditoria: { create: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ContatosService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: { registrarLeitura: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(ContatosService);
  });

  describe('regra: comunidade obrigatória', () => {
    it('rejeita criação se a comunidade informada não existe', async () => {
      prisma.comunidade.findUnique.mockResolvedValue(null);

      await expect(
        service.criar(
          { nome: 'Maria da Silva', comunidadeId: 'inexistente' } as any,
          operadorSemPermissao,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.contato.create).not.toHaveBeenCalled();
    });
  });

  describe('regra: deduplicação bloqueia candidato forte não revisado', () => {
    it('bloqueia criação quando há duplicata com similaridade > 0.6', async () => {
      prisma.comunidade.findUnique.mockResolvedValue({ id: 'com-1' });
      prisma.$queryRaw.mockResolvedValue([
        { id: 'contato-existente', nome: 'Maria S. Silva', similaridade: 0.75 },
      ]);

      await expect(
        service.criar(
          { nome: 'Maria da Silva', comunidadeId: 'com-1' } as any,
          operadorSemPermissao,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.contato.create).not.toHaveBeenCalled();
    });

    it('permite criação se o usuário já revisou e confirmou pessoa diferente', async () => {
      prisma.comunidade.findUnique.mockResolvedValue({ id: 'com-1' });
      prisma.$queryRaw.mockResolvedValue([
        { id: 'contato-existente', nome: 'Maria S. Silva', similaridade: 0.75 },
      ]);
      prisma.contato.create.mockResolvedValue({ id: 'novo-contato' });

      const resultado = await service.criar(
        {
          nome: 'Maria da Silva',
          comunidadeId: 'com-1',
          ignorarDuplicatasIds: ['contato-existente'],
        } as any,
        operadorSemPermissao,
      );

      expect(resultado).toEqual({ id: 'novo-contato' });
      expect(prisma.contato.create).toHaveBeenCalled();
    });

    it('não bloqueia por similaridade fraca (abaixo do limiar de bloqueio)', async () => {
      prisma.comunidade.findUnique.mockResolvedValue({ id: 'com-1' });
      prisma.$queryRaw.mockResolvedValue([
        { id: 'contato-parecido', nome: 'Maria Souza', similaridade: 0.45 },
      ]);
      prisma.contato.create.mockResolvedValue({ id: 'novo-contato' });

      const resultado = await service.criar(
        { nome: 'Maria da Silva', comunidadeId: 'com-1' } as any,
        operadorSemPermissao,
      );

      expect(resultado).toEqual({ id: 'novo-contato' });
    });
  });

  describe('regra: engajamento político condicional por permissão', () => {
    it('IGNORA silenciosamente o campo de engajamento se o usuário não tem permissão', async () => {
      prisma.comunidade.findUnique.mockResolvedValue({ id: 'com-1' });
      prisma.contato.create.mockResolvedValue({ id: 'novo-contato' });

      await service.criar(
        {
          nome: 'João Souza',
          comunidadeId: 'com-1',
          engajamentoPolitico: {
            status: 'apoiador',
            origem: 'percepcao_equipe',
            confianca: 'media',
          },
        } as any,
        operadorSemPermissao, // sem permissão
      );

      // Não deve ter tentado criar EngajamentoPolitico nem log de auditoria
      expect(prisma.engajamentoPolitico.create).not.toHaveBeenCalled();
      expect(prisma.logAuditoria.create).not.toHaveBeenCalled();
    });

    it('PERSISTE engajamento e gera auditoria quando o usuário tem permissão', async () => {
      prisma.comunidade.findUnique.mockResolvedValue({ id: 'com-1' });
      prisma.contato.create.mockResolvedValue({ id: 'novo-contato' });

      await service.criar(
        {
          nome: 'João Souza',
          comunidadeId: 'com-1',
          engajamentoPolitico: {
            status: 'apoiador',
            origem: 'percepcao_equipe',
            confianca: 'media',
          },
        } as any,
        coordenadorComPermissao,
      );

      expect(prisma.engajamentoPolitico.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contatoId: 'novo-contato', vigente: true }),
        }),
      );
      expect(prisma.logAuditoria.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ entidade: 'EngajamentoPolitico', acao: 'criacao' }),
        }),
      );
    });
  });

  describe('regra: engajamento nunca sofre UPDATE destrutivo', () => {
    it('marca o registro anterior como vigente=false e cria um novo', async () => {
      await service.atualizarEngajamento(
        'contato-1',
        { status: 'simpatizante', origem: 'autodeclarado', confianca: 'alta' },
        coordenadorComPermissao,
      );

      expect(prisma.engajamentoPolitico.updateMany).toHaveBeenCalledWith({
        where: { contatoId: 'contato-1', vigente: true },
        data: { vigente: false },
      });
      expect(prisma.engajamentoPolitico.create).toHaveBeenCalled();
    });

    it('bloqueia atualização de engajamento por usuário sem permissão, mesmo passando pelo guard', async () => {
      await expect(
        service.atualizarEngajamento(
          'contato-1',
          { status: 'simpatizante', origem: 'autodeclarado', confianca: 'alta' },
          operadorSemPermissao,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.engajamentoPolitico.create).not.toHaveBeenCalled();
    });
  });

  describe('regra: nome curto não gera ruído de dedup', () => {
    it('retorna lista vazia para nomes com menos de 3 caracteres', async () => {
      const resultado = await service.buscarPossiveisDuplicatas('Jo');
      expect(resultado).toEqual([]);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('regra: listagem nunca vaza contato de outro município e nunca inclui engajamento', () => {
    it('rejeita listagem sem municipioId — undefined viraria "sem filtro" no Prisma', async () => {
      await expect(service.listar('', {})).rejects.toThrow(BadRequestException);
      expect(prisma.contato.findMany).not.toHaveBeenCalled();
    });

    it('filtra por território (município), aplica q e nunca seleciona engajamentoPolitico', async () => {
      prisma.contato.findMany.mockResolvedValue([]);
      prisma.contato.count.mockResolvedValue(0);

      await service.listar('municipio-1', { q: 'Maria', pagina: 2, tamanhoPagina: 10 });

      const args = prisma.contato.findMany.mock.calls[0][0];
      expect(args.where.comunidade.bairro.zonaEleitoral.municipioId).toBe('municipio-1');
      expect(args.where.nome).toEqual({ contains: 'Maria', mode: 'insensitive' });
      expect(args.skip).toBe(10); // (pagina 2 - 1) * tamanhoPagina 10
      expect(args.take).toBe(10);
      expect(args.select).not.toHaveProperty('engajamentoPolitico');
    });

    it('limita tamanhoPagina a 100 mesmo se pedido maior', async () => {
      prisma.contato.findMany.mockResolvedValue([]);
      prisma.contato.count.mockResolvedValue(0);

      const resultado = await service.listar('municipio-1', { tamanhoPagina: 500 });

      expect(resultado.tamanhoPagina).toBe(100);
      expect(prisma.contato.findMany.mock.calls[0][0].take).toBe(100);
    });
  });
});

describe('ContatosService — fechamento da lacuna de auditoria de leitura', () => {
  let service: ContatosService;
  let prisma: any;
  let auditoriaService: { registrarLeitura: jest.Mock };

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
      engajamentoPolitico: { findFirst: jest.fn() },
    };
    auditoriaService = { registrarLeitura: jest.fn().mockResolvedValue({ id: 'log-1' }) };

    const { Test } = require('@nestjs/testing');
    const { PrismaService } = require('../prisma/prisma.service');
    const { AuditoriaService } = require('../auditoria/auditoria.service');

    const moduleRef = await Test.createTestingModule({
      providers: [
        ContatosService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoriaService },
      ],
    }).compile();

    service = moduleRef.get(ContatosService);
  });

  it('usuário SEM permissão: não recebe o campo engajamentoPolitico e NENHUM log é gerado', async () => {
    prisma.contato.findUnique.mockResolvedValue({ id: 'contato-1', nome: 'Maria' });

    const resultado = await service.buscarPorId('contato-1', operadorSemPermissao);

    expect(resultado).not.toHaveProperty('engajamentoPolitico');
    expect(prisma.engajamentoPolitico.findFirst).not.toHaveBeenCalled();
    expect(auditoriaService.registrarLeitura).not.toHaveBeenCalled();
  });

  it('usuário COM permissão: recebe o campo E gera log de leitura', async () => {
    prisma.contato.findUnique.mockResolvedValue({ id: 'contato-1', nome: 'Maria' });
    prisma.engajamentoPolitico.findFirst.mockResolvedValue({
      status: 'apoiador',
      origem: 'percepcao_lideranca',
      confianca: 'media',
    });

    const resultado = await service.buscarPorId('contato-1', coordenadorComPermissao);

    expect(resultado.engajamentoPolitico).toEqual(
      expect.objectContaining({ status: 'apoiador' }),
    );
    expect(auditoriaService.registrarLeitura).toHaveBeenCalledWith('user-coordenador', 'contato-1');
  });

  it('se o log de auditoria falhar, a leitura inteira falha (não expõe dado sem registrar)', async () => {
    prisma.contato.findUnique.mockResolvedValue({ id: 'contato-1', nome: 'Maria' });
    prisma.engajamentoPolitico.findFirst.mockResolvedValue({ status: 'apoiador' });
    auditoriaService.registrarLeitura.mockRejectedValue(new Error('log indisponível'));

    await expect(
      service.buscarPorId('contato-1', coordenadorComPermissao),
    ).rejects.toThrow('log indisponível');
  });
});
