/**
 * rotas-campo.service.spec.ts
 */

import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RotasCampoService } from './rotas-campo.service';
import { PrismaService } from '../prisma/prisma.service';
import { StatusParada } from './dto/create-rota-campo.dto';
import { UsuarioAutenticado } from '../contatos/contatos.service';

describe('RotasCampoService', () => {
  let service: RotasCampoService;
  let prisma: any;

  const coordenador: UsuarioAutenticado = {
    id: 'coord-1',
    perfil: 'coordenador',
    permissaoEngajamentoPolitico: false,
  };
  const operador: UsuarioAutenticado = {
    id: 'op-1',
    perfil: 'operador',
    permissaoEngajamentoPolitico: false,
  };
  const outroOperador: UsuarioAutenticado = {
    id: 'op-2',
    perfil: 'operador',
    permissaoEngajamentoPolitico: false,
  };

  beforeEach(async () => {
    prisma = {
      comunidade: { findUnique: jest.fn() },
      usuario: { findUnique: jest.fn() },
      contato: { count: jest.fn() },
      rotaCampo: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      paradaRota: { createMany: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [RotasCampoService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(RotasCampoService);
  });

  describe('criar', () => {
    const dto = { comunidadeId: 'com-1', responsavelId: 'op-1', contatoIds: ['c-1', 'c-2'] };

    it('cria a rota e as paradas na ordem do array recebido', async () => {
      prisma.comunidade.findUnique.mockResolvedValue({ id: 'com-1' });
      prisma.usuario.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.contato.count.mockResolvedValue(2); // os 2 ids batem com a comunidade
      prisma.rotaCampo.create.mockResolvedValue({ id: 'rota-1' });

      await service.criar(dto as any, coordenador);

      expect(prisma.rotaCampo.create).toHaveBeenCalledWith({
        data: { comunidadeId: 'com-1', responsavelId: 'op-1', criadaPorId: 'coord-1' },
      });
      expect(prisma.paradaRota.createMany).toHaveBeenCalledWith({
        data: [
          { rotaId: 'rota-1', contatoId: 'c-1', ordem: 0 },
          { rotaId: 'rota-1', contatoId: 'c-2', ordem: 1 },
        ],
      });
    });

    it('rejeita se a comunidade não existe', async () => {
      prisma.comunidade.findUnique.mockResolvedValue(null);
      await expect(service.criar(dto as any, coordenador)).rejects.toThrow(BadRequestException);
    });

    it('rejeita se o responsável não existe', async () => {
      prisma.comunidade.findUnique.mockResolvedValue({ id: 'com-1' });
      prisma.usuario.findUnique.mockResolvedValue(null);
      await expect(service.criar(dto as any, coordenador)).rejects.toThrow(BadRequestException);
    });

    it('rejeita se algum contato não pertence à comunidade da rota', async () => {
      prisma.comunidade.findUnique.mockResolvedValue({ id: 'com-1' });
      prisma.usuario.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.contato.count.mockResolvedValue(1); // só 1 dos 2 bate — territorialização furada

      await expect(service.criar(dto as any, coordenador)).rejects.toThrow(BadRequestException);
      expect(prisma.rotaCampo.create).not.toHaveBeenCalled();
    });

    it('deduplica contatoIds repetidos antes de criar as paradas', async () => {
      prisma.comunidade.findUnique.mockResolvedValue({ id: 'com-1' });
      prisma.usuario.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.contato.count.mockResolvedValue(2);
      prisma.rotaCampo.create.mockResolvedValue({ id: 'rota-1' });

      await service.criar({ ...dto, contatoIds: ['c-1', 'c-2', 'c-1'] } as any, coordenador);

      expect(prisma.paradaRota.createMany).toHaveBeenCalledWith({
        data: [
          { rotaId: 'rota-1', contatoId: 'c-1', ordem: 0 },
          { rotaId: 'rota-1', contatoId: 'c-2', ordem: 1 },
        ],
      });
    });
  });

  describe('listar', () => {
    it('exige municipioId', async () => {
      await expect(service.listar('', coordenador)).rejects.toThrow(BadRequestException);
    });

    it('filtra por responsavelId quando o perfil é operador', async () => {
      prisma.rotaCampo.findMany.mockResolvedValue([]);
      await service.listar('mun-1', operador);

      expect(prisma.rotaCampo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ responsavelId: 'op-1' }),
        }),
      );
    });

    it('não filtra por responsavelId para coordenador (vê todas do município)', async () => {
      prisma.rotaCampo.findMany.mockResolvedValue([]);
      await service.listar('mun-1', coordenador);

      const where = prisma.rotaCampo.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('responsavelId');
    });

    it('calcula totalParadas e paradasConcluidas a partir do status de cada parada', async () => {
      prisma.rotaCampo.findMany.mockResolvedValue([
        {
          id: 'rota-1',
          status: 'em_andamento',
          criadaEm: new Date(),
          comunidade: { id: 'com-1', nome: 'Av. Central' },
          responsavel: { id: 'op-1', nome: 'Op' },
          paradas: [{ status: 'visitado' }, { status: 'pendente' }, { status: 'ausente' }],
        },
      ]);

      const resultado = await service.listar('mun-1', coordenador);

      expect(resultado[0].totalParadas).toBe(3);
      expect(resultado[0].paradasConcluidas).toBe(2);
    });
  });

  describe('buscarPorId / controle de acesso', () => {
    function mockRota(responsavelId: string) {
      prisma.rotaCampo.findUnique.mockResolvedValue({
        id: 'rota-1',
        status: 'planejada',
        criadaEm: new Date(),
        responsavelId,
        comunidade: { id: 'com-1', nome: 'Av. Central' },
        responsavel: { id: responsavelId, nome: 'Op' },
        criadaPor: { id: 'coord-1', nome: 'Coord' },
        paradas: [],
      });
    }

    it('lança NotFound se a rota não existe', async () => {
      prisma.rotaCampo.findUnique.mockResolvedValue(null);
      await expect(service.buscarPorId('rota-x', coordenador)).rejects.toThrow(NotFoundException);
    });

    it('permite acesso ao próprio responsável', async () => {
      mockRota('op-1');
      await expect(service.buscarPorId('rota-1', operador)).resolves.toBeDefined();
    });

    it('permite acesso a Administrador/Coordenador mesmo não sendo o responsável', async () => {
      mockRota('op-1');
      await expect(service.buscarPorId('rota-1', coordenador)).resolves.toBeDefined();
    });

    it('bloqueia outro Operador que não é o responsável da rota', async () => {
      mockRota('op-1');
      await expect(service.buscarPorId('rota-1', outroOperador)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('atualizarParada', () => {
    function mockRotaComParadas() {
      prisma.rotaCampo.findUnique.mockResolvedValue({
        id: 'rota-1',
        responsavelId: 'op-1',
        paradas: [
          { id: 'parada-1', status: 'pendente' },
          { id: 'parada-2', status: 'pendente' },
        ],
      });
    }

    it('atualiza o status da parada e marca concluidaEm', async () => {
      mockRotaComParadas();
      prisma.paradaRota.update.mockResolvedValue({ id: 'parada-1', status: StatusParada.VISITADO });

      await service.atualizarParada('rota-1', 'parada-1', StatusParada.VISITADO, operador);

      expect(prisma.paradaRota.update).toHaveBeenCalledWith({
        where: { id: 'parada-1' },
        data: { status: StatusParada.VISITADO, concluidaEm: expect.any(Date) },
      });
    });

    it('recalcula a rota para "em_andamento" quando só parte das paradas está concluída', async () => {
      mockRotaComParadas();
      prisma.paradaRota.update.mockResolvedValue({});

      await service.atualizarParada('rota-1', 'parada-1', StatusParada.VISITADO, operador);

      expect(prisma.rotaCampo.update).toHaveBeenCalledWith({
        where: { id: 'rota-1' },
        data: { status: 'em_andamento' },
      });
    });

    it('recalcula a rota para "concluida" quando todas as paradas saem de pendente', async () => {
      prisma.rotaCampo.findUnique.mockResolvedValue({
        id: 'rota-1',
        responsavelId: 'op-1',
        paradas: [
          { id: 'parada-1', status: 'visitado' },
          { id: 'parada-2', status: 'pendente' },
        ],
      });
      prisma.paradaRota.update.mockResolvedValue({});

      await service.atualizarParada('rota-1', 'parada-2', StatusParada.AUSENTE, operador);

      expect(prisma.rotaCampo.update).toHaveBeenCalledWith({
        where: { id: 'rota-1' },
        data: { status: 'concluida' },
      });
    });

    it('zera concluidaEm ao voltar uma parada pra pendente', async () => {
      mockRotaComParadas();
      prisma.paradaRota.update.mockResolvedValue({});

      await service.atualizarParada('rota-1', 'parada-1', StatusParada.PENDENTE, operador);

      expect(prisma.paradaRota.update).toHaveBeenCalledWith({
        where: { id: 'parada-1' },
        data: { status: StatusParada.PENDENTE, concluidaEm: null },
      });
    });

    it('lança NotFound se a parada não pertence à rota', async () => {
      mockRotaComParadas();
      await expect(
        service.atualizarParada('rota-1', 'parada-inexistente', StatusParada.VISITADO, operador),
      ).rejects.toThrow(NotFoundException);
    });

    it('bloqueia operador que não é o responsável da rota', async () => {
      mockRotaComParadas();
      await expect(
        service.atualizarParada('rota-1', 'parada-1', StatusParada.VISITADO, outroOperador),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
