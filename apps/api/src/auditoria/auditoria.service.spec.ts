/**
 * auditoria.service.spec.ts
 */

import { Test } from '@nestjs/testing';
import { AuditoriaService } from './auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard, PerfilUsuario } from '../auth/roles.guard';

describe('AuditoriaService', () => {
  let service: AuditoriaService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      logAuditoria: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [AuditoriaService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AuditoriaService);
  });

  it('aplica filtros de entidade e ação corretamente', async () => {
    prisma.logAuditoria.findMany.mockResolvedValue([]);
    prisma.logAuditoria.count.mockResolvedValue(0);

    await service.listar(
      { entidade: 'EngajamentoPolitico', acao: 'edicao' },
      { pagina: 1, tamanhoPagina: 25 },
    );

    expect(prisma.logAuditoria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entidade: 'EngajamentoPolitico', acao: 'edicao' },
      }),
    );
  });

  it('IMPÕE teto de 100 registros por página mesmo se pedirem mais', async () => {
    prisma.logAuditoria.findMany.mockResolvedValue([]);
    prisma.logAuditoria.count.mockResolvedValue(0);

    const resultado = await service.listar({}, { pagina: 1, tamanhoPagina: 5000 });

    expect(resultado.tamanhoPagina).toBe(100);
    expect(prisma.logAuditoria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it('calcula paginação (skip) corretamente para páginas além da primeira', async () => {
    prisma.logAuditoria.findMany.mockResolvedValue([]);
    prisma.logAuditoria.count.mockResolvedValue(0);

    await service.listar({}, { pagina: 3, tamanhoPagina: 25 });

    expect(prisma.logAuditoria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50 }), // (3-1) * 25
    );
  });

  it('registrarLeitura cria entrada com ação "leitura" e entidade fixa', async () => {
    prisma.logAuditoria.create.mockResolvedValue({ id: 'log-1' });

    await service.registrarLeitura('user-1', 'contato-1');

    expect(prisma.logAuditoria.create).toHaveBeenCalledWith({
      data: {
        usuarioId: 'user-1',
        entidade: 'EngajamentoPolitico',
        entidadeId: 'contato-1',
        acao: 'leitura',
      },
    });
  });

  it('filtro de período (dataInicio/dataFim) monta cláusula timestamp corretamente', async () => {
    prisma.logAuditoria.findMany.mockResolvedValue([]);
    prisma.logAuditoria.count.mockResolvedValue(0);

    const dataInicio = new Date('2027-01-01');
    const dataFim = new Date('2027-01-31');

    await service.listar({ dataInicio, dataFim }, { pagina: 1, tamanhoPagina: 25 });

    expect(prisma.logAuditoria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { timestamp: { gte: dataInicio, lte: dataFim } },
      }),
    );
  });
});

describe('RolesGuard aplicado à Auditoria — só Administrador', () => {
  function mockContext(perfil: PerfilUsuario | undefined) {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([PerfilUsuario.ADMINISTRADOR]);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user: perfil ? { perfil } : undefined }) }),
    } as unknown as ExecutionContext;
    return { reflector, context };
  }

  it('permite Administrador', () => {
    const { reflector, context } = mockContext(PerfilUsuario.ADMINISTRADOR);
    expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
  });

  it('BLOQUEIA Coordenador — mesmo podendo escrever engajamento, não vê a trilha de auditoria', () => {
    const { reflector, context } = mockContext(PerfilUsuario.COORDENADOR);
    expect(new RolesGuard(reflector).canActivate(context)).toBe(false);
  });

  it('bloqueia Operador e Visualização', () => {
    for (const perfil of [PerfilUsuario.OPERADOR, PerfilUsuario.VISUALIZACAO]) {
      const { reflector, context } = mockContext(perfil);
      expect(new RolesGuard(reflector).canActivate(context)).toBe(false);
    }
  });
});
