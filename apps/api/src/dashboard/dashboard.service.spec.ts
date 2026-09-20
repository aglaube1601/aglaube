/**
 * dashboard.service.spec.ts
 */

import { Test } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      contato: { count: jest.fn() },
      lideranca: { count: jest.fn() },
      comunidade: { findMany: jest.fn() },
      interacao: { count: jest.fn() },
      demanda: { count: jest.fn() },
      eventoAcao: { findMany: jest.fn() },
      $queryRaw: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  function mockPadrao() {
    prisma.contato.count.mockResolvedValueOnce(120).mockResolvedValueOnce(8); // total, novos30d
    prisma.lideranca.count.mockResolvedValue(6);
    prisma.comunidade.findMany.mockResolvedValue([
      { id: 'com-1', nome: 'Av. Central', _count: { contatos: 45 } },
      { id: 'com-2', nome: 'Povoado São João Batista', _count: { contatos: 4 } }, // baixa cobertura
      { id: 'com-3', nome: 'Rua Projetada', _count: { contatos: 9 } }, // baixa cobertura (< 10)
    ]);
    prisma.interacao.count.mockResolvedValue(37);
    prisma.demanda.count.mockResolvedValueOnce(12).mockResolvedValueOnce(5); // abertas, resolvidas30d
    prisma.eventoAcao.findMany.mockResolvedValue([
      { id: 'ev-1', tipo: 'reuniao', data: new Date('2027-01-10'), comunidade: { nome: 'Av. Central' } },
    ]);
    prisma.$queryRaw.mockResolvedValue([{ count: BigInt(3) }]);
  }

  it('agrega todos os KPIs corretamente a partir dos módulos existentes', async () => {
    mockPadrao();

    const resumo = await service.obterResumoExecutivo('municipio-1');

    expect(resumo.totalContatos).toBe(120);
    expect(resumo.novosContatos30Dias).toBe(8);
    expect(resumo.liderancasCadastradas).toBe(6);
    expect(resumo.comunidadesMapeadas).toBe(3);
    expect(resumo.interacoes30Dias).toBe(37);
    expect(resumo.demandasAbertas).toBe(12);
    expect(resumo.demandasResolvidas30Dias).toBe(5);
    expect(resumo.aniversariantesDoMes).toBe(3);
    expect(resumo.proximosEventos).toHaveLength(1);
  });

  it('identifica corretamente comunidades com baixa cobertura (< 10 contatos)', async () => {
    mockPadrao();

    const resumo = await service.obterResumoExecutivo('municipio-1');

    expect(resumo.regioesComBaixaCobertura).toHaveLength(2);
    expect(resumo.regioesComBaixaCobertura.map((r) => r.nome)).toEqual(
      expect.arrayContaining(['Povoado São João Batista', 'Rua Projetada']),
    );
    // Av. Central tem 45 contatos — não deve aparecer no alerta
    expect(resumo.regioesComBaixaCobertura.map((r) => r.nome)).not.toContain('Av. Central');
  });

  it('nunca retorna lista de contatos individuais — só contagens e nomes de comunidade', async () => {
    mockPadrao();

    const resumo = await service.obterResumoExecutivo('municipio-1');
    const chaves = Object.keys(resumo);

    // Nenhuma chave do objeto de resposta deve sugerir lista de pessoas
    expect(chaves).not.toContain('contatos');
    expect(chaves).not.toContain('aniversariantes'); // só "aniversariantesDoMes" (número)
    expect(typeof resumo.aniversariantesDoMes).toBe('number');
  });

  it('funciona com município totalmente vazio (zero em tudo) sem quebrar', async () => {
    prisma.contato.count.mockResolvedValue(0);
    prisma.lideranca.count.mockResolvedValue(0);
    prisma.comunidade.findMany.mockResolvedValue([]);
    prisma.interacao.count.mockResolvedValue(0);
    prisma.demanda.count.mockResolvedValue(0);
    prisma.eventoAcao.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([{ count: BigInt(0) }]);

    const resumo = await service.obterResumoExecutivo('municipio-vazio');

    expect(resumo.totalContatos).toBe(0);
    expect(resumo.comunidadesMapeadas).toBe(0);
    expect(resumo.regioesComBaixaCobertura).toEqual([]);
    expect(resumo.aniversariantesDoMes).toBe(0);
  });
});
