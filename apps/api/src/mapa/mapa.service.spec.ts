/**
 * mapa.service.spec.ts
 */

import { Test } from '@nestjs/testing';
import { MapaService } from './mapa.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MapaService', () => {
  let service: MapaService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      comunidade: { findMany: jest.fn() },
      lideranca: { count: jest.fn() },
      demanda: { count: jest.fn() },
      engajamentoPolitico: { groupBy: jest.fn() },
      dadosEleitoraisPublicos: { groupBy: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [MapaService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(MapaService);
  });

  function mockComunidade(totalContatos: number) {
    prisma.comunidade.findMany.mockResolvedValue([
      {
        id: 'com-1',
        nome: 'Povoado São João Batista',
        bairro: { nome: 'Zona Rural' },
        _count: { contatos: totalContatos },
      },
    ]);
    prisma.lideranca.count.mockResolvedValue(2);
    prisma.demanda.count.mockResolvedValue(3);
    prisma.dadosEleitoraisPublicos.groupBy.mockResolvedValue([
      { candidatoNumero: 12, candidatoNome: 'MANOEL BERNARDO LEAL', _sum: { votosObtidos: 523 } },
      { candidatoNumero: 15, candidatoNome: 'GERONIMO MANOEL DA SILVA', _sum: { votosObtidos: 343 } },
    ]);
  }

  describe('regra de k-anonimato', () => {
    it('OCULTA distribuição de engajamento se a comunidade tem menos de 5 contatos', async () => {
      mockComunidade(3); // abaixo do piso

      const resultado = await service.obterTerritorios('municipio-1');

      expect(resultado[0].engajamentoAgregado).toBeNull();
      // Nem deveria ter consultado o groupBy — economiza query também
      expect(prisma.engajamentoPolitico.groupBy).not.toHaveBeenCalled();
    });

    it('EXPÕE distribuição de engajamento se a comunidade tem 5 ou mais contatos', async () => {
      mockComunidade(5); // exatamente no piso
      prisma.engajamentoPolitico.groupBy.mockResolvedValue([
        { status: 'apoiador', _count: { _all: 3 } },
        { status: 'simpatizante', _count: { _all: 2 } },
      ]);

      const resultado = await service.obterTerritorios('municipio-1');

      expect(resultado[0].engajamentoAgregado).not.toBeNull();
      expect(resultado[0].engajamentoAgregado!.apoiador).toBe(3);
      expect(resultado[0].engajamentoAgregado!.simpatizante).toBe(2);
    });

    it('comunidade com 4 contatos (1 abaixo do piso) ainda oculta', async () => {
      mockComunidade(4);
      const resultado = await service.obterTerritorios('municipio-1');
      expect(resultado[0].engajamentoAgregado).toBeNull();
    });
  });

  it('agrega dados eleitorais reais por comunidade corretamente', async () => {
    mockComunidade(10);
    prisma.engajamentoPolitico.groupBy.mockResolvedValue([]);

    const resultado = await service.obterTerritorios('municipio-1');

    expect(resultado[0].dadosEleitorais).toEqual([
      { candidatoNumero: 12, candidatoNome: 'MANOEL BERNARDO LEAL', votosObtidos: 523 },
      { candidatoNumero: 15, candidatoNome: 'GERONIMO MANOEL DA SILVA', votosObtidos: 343 },
    ]);
  });

  it('território sem nenhum dado eleitoral carregado retorna array vazio, não erro', async () => {
    mockComunidade(10);
    prisma.dadosEleitoraisPublicos.groupBy.mockResolvedValue([]);
    prisma.engajamentoPolitico.groupBy.mockResolvedValue([]);

    const resultado = await service.obterTerritorios('municipio-1');
    expect(resultado[0].dadosEleitorais).toEqual([]);
  });

  it('resposta nunca inclui uma lista de contatos, só contagens e agregados', async () => {
    mockComunidade(10);
    prisma.engajamentoPolitico.groupBy.mockResolvedValue([]);

    const resultado = await service.obterTerritorios('municipio-1');
    const chaves = Object.keys(resultado[0]);

    expect(chaves).not.toContain('contatos');
    expect(chaves).toContain('totalContatos'); // número, não lista
    expect(typeof resultado[0].totalContatos).toBe('number');
  });
});
