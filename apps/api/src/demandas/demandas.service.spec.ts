/**
 * demandas.service.spec.ts
 */

import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DemandasService } from './demandas.service';
import { PrismaService } from '../prisma/prisma.service';
import { StatusDemanda } from './dto/create-demanda.dto';
import { UsuarioAutenticado } from '../contatos/contatos.service';

describe('DemandasService — máquina de estado', () => {
  let service: DemandasService;
  let prisma: any;

  const operador: UsuarioAutenticado = {
    id: 'user-operador',
    perfil: 'operador',
    permissaoEngajamentoPolitico: false,
  };
  const coordenador: UsuarioAutenticado = {
    id: 'user-coordenador',
    perfil: 'coordenador',
    permissaoEngajamentoPolitico: true,
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((cb) => cb(prisma)),
      comunidade: { findUnique: jest.fn().mockResolvedValue({ id: 'com-1' }) },
      contato: { findUnique: jest.fn() },
      demanda: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      demandaHistorico: { create: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [DemandasService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(DemandasService);
  });

  it('cria demanda com status NOVA e gera primeira entrada no histórico', async () => {
    prisma.demanda.create.mockResolvedValue({ id: 'demanda-1', status: StatusDemanda.NOVA });

    const resultado = await service.criar(
      { categoria: 'iluminação', descricao: 'poste apagado', comunidadeId: 'com-1' } as any,
      operador,
    );

    expect(resultado.status).toBe(StatusDemanda.NOVA);
    expect(prisma.demandaHistorico.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statusAnterior: null, statusNovo: StatusDemanda.NOVA }),
      }),
    );
  });

  it('permite transição sequencial (NOVA -> EM_ANALISE) para Operador', async () => {
    prisma.demanda.findUnique.mockResolvedValue({ id: 'd-1', status: StatusDemanda.NOVA });
    prisma.demanda.update.mockResolvedValue({ id: 'd-1', status: StatusDemanda.EM_ANALISE });

    const resultado = await service.atualizarStatus('d-1', StatusDemanda.EM_ANALISE, operador);

    expect(resultado.status).toBe(StatusDemanda.EM_ANALISE);
  });

  it('BLOQUEIA pulo de etapa (NOVA -> EM_ANDAMENTO) para Operador', async () => {
    prisma.demanda.findUnique.mockResolvedValue({ id: 'd-1', status: StatusDemanda.NOVA });

    await expect(
      service.atualizarStatus('d-1', StatusDemanda.EM_ANDAMENTO, operador),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.demanda.update).not.toHaveBeenCalled();
  });

  it('PERMITE pulo de etapa para Coordenador, mas exige justificativa', async () => {
    prisma.demanda.findUnique.mockResolvedValue({ id: 'd-1', status: StatusDemanda.NOVA });

    await expect(
      service.atualizarStatus('d-1', StatusDemanda.EM_ANDAMENTO, coordenador),
    ).rejects.toThrow(BadRequestException); // sem justificativa ainda

    prisma.demanda.update.mockResolvedValue({ id: 'd-1', status: StatusDemanda.EM_ANDAMENTO });
    const resultado = await service.atualizarStatus(
      'd-1',
      StatusDemanda.EM_ANDAMENTO,
      coordenador,
      'Demanda urgente confirmada por telefone, pulando análise formal.',
    );

    expect(resultado.status).toBe(StatusDemanda.EM_ANDAMENTO);
    expect(prisma.demandaHistorico.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          justificativa: expect.stringContaining('urgente'),
        }),
      }),
    );
  });

  it('BLOQUEIA retrocesso de status para qualquer perfil, mesmo Coordenador', async () => {
    prisma.demanda.findUnique.mockResolvedValue({ id: 'd-1', status: StatusDemanda.EM_ANDAMENTO });

    await expect(
      service.atualizarStatus('d-1', StatusDemanda.NOVA, coordenador),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.atualizarStatus('d-1', StatusDemanda.EM_ANALISE, coordenador),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.demanda.update).not.toHaveBeenCalled();
  });

  it('rejeita criação com comunidade inexistente', async () => {
    prisma.comunidade.findUnique.mockResolvedValue(null);

    await expect(
      service.criar(
        { categoria: 'x', descricao: 'y', comunidadeId: 'não-existe' } as any,
        operador,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('demanda inexistente ao atualizar status gera erro claro, não exceção genérica', async () => {
    prisma.demanda.findUnique.mockResolvedValue(null);

    await expect(
      service.atualizarStatus('não-existe', StatusDemanda.EM_ANALISE, operador),
    ).rejects.toThrow(BadRequestException);
  });
});
