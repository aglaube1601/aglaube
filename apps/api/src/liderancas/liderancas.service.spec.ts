/**
 * liderancas.service.spec.ts
 */

import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LiderancasService } from './liderancas.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('LiderancasService', () => {
  let service: LiderancasService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      contato: { findUnique: jest.fn() },
      lideranca: { upsert: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), findMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [LiderancasService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(LiderancasService);
  });

  describe('marcar', () => {
    it('rejeita marcar um contato inexistente', async () => {
      prisma.contato.findUnique.mockResolvedValue(null);

      await expect(service.marcar('contato-inexistente', {})).rejects.toThrow(NotFoundException);
      expect(prisma.lideranca.upsert).not.toHaveBeenCalled();
    });

    it('é idempotente — marcar de novo atualiza o grupo em vez de duplicar', async () => {
      prisma.contato.findUnique.mockResolvedValue({ id: 'contato-1' });
      prisma.lideranca.upsert.mockResolvedValue({ grupo: 'Força Jovem', criadoEm: new Date('2026-01-01') });

      await service.marcar('contato-1', { grupo: 'Força Jovem' });

      expect(prisma.lideranca.upsert).toHaveBeenCalledWith({
        where: { contatoId: 'contato-1' },
        update: { grupo: 'Força Jovem' },
        create: { contatoId: 'contato-1', grupo: 'Força Jovem' },
      });
    });
  });

  describe('desmarcar', () => {
    it('rejeita desmarcar um contato que não está marcado como liderança', async () => {
      prisma.lideranca.findUnique.mockResolvedValue(null);

      await expect(service.desmarcar('contato-1')).rejects.toThrow(NotFoundException);
      expect(prisma.lideranca.delete).not.toHaveBeenCalled();
    });

    it('remove o registro quando ele existe', async () => {
      prisma.lideranca.findUnique.mockResolvedValue({ id: 'lid-1' });

      await service.desmarcar('contato-1');

      expect(prisma.lideranca.delete).toHaveBeenCalledWith({ where: { contatoId: 'contato-1' } });
    });
  });

  describe('listar', () => {
    it('rejeita listagem sem municipioId', async () => {
      await expect(service.listar('')).rejects.toThrow(BadRequestException);
      expect(prisma.lideranca.findMany).not.toHaveBeenCalled();
    });

    it('filtra por território (município) e mapeia os campos de exibição', async () => {
      prisma.lideranca.findMany.mockResolvedValue([
        {
          id: 'lid-1',
          contatoId: 'contato-1',
          grupo: 'Força Jovem',
          criadoEm: new Date('2026-01-01'),
          contato: { nome: 'Maria da Silva', telefone: '3333-0000', comunidade: { nome: 'Av. Central' } },
        },
      ]);

      const resultado = await service.listar('municipio-1', 'com-1');

      const args = prisma.lideranca.findMany.mock.calls[0][0];
      expect(args.where.contato.comunidade.id).toBe('com-1');
      expect(args.where.contato.comunidade.bairro.zonaEleitoral.municipioId).toBe('municipio-1');
      expect(resultado).toEqual([
        {
          id: 'lid-1',
          contatoId: 'contato-1',
          nome: 'Maria da Silva',
          telefone: '3333-0000',
          comunidadeNome: 'Av. Central',
          grupo: 'Força Jovem',
          criadoEm: new Date('2026-01-01'),
        },
      ]);
    });
  });
});
