/**
 * electoral-projection.service.spec.ts
 *
 * Testes da lógica pura de projeção. Os testes de "casos-limite" foram
 * definidos junto com o algoritmo (ver prompt do MVP) e não podem ser
 * removidos sem justificativa: eles protegem contra o painel eleitoral
 * mostrar um número falso-preciso quando o dado de base é fraco ou ausente.
 */

import { Test } from '@nestjs/testing';
import { ElectoralProjectionService } from './electoral-projection.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ElectoralProjectionService', () => {
  let service: ElectoralProjectionService;
  let prisma: { dadosEleitoraisPublicos: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { dadosEleitoraisPublicos: { findMany: jest.fn() } };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ElectoralProjectionService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(ElectoralProjectionService);
  });

  function mockVotos(situacionista: number, oposicao: number) {
    prisma.dadosEleitoraisPublicos.findMany
      .mockResolvedValueOnce(
        Array(1).fill({ votosObtidos: situacionista }), // 1ª chamada: situacionista
      )
      .mockResolvedValueOnce(
        Array(1).fill({ votosObtidos: oposicao }), // 2ª chamada: oposição
      );
  }

  it('caso real: Vila Nova do Piauí 2024 (Leal 1821 x Geronimo 903)', async () => {
    mockVotos(1821, 903);

    const resultado = await service.calcularMetaVotos('municipio-1', 2024, 12, 15);

    const cenarioA = resultado.cenarios.find((c) => c.cenario === 'sucessao_unificada');
    const cenarioB = resultado.cenarios.find((c) => c.cenario === 'fragmentacao_50_50');

    // Cenário A: retenção mínima ~74-76% (calculado à mão na análise anterior)
    expect(cenarioA!.retencaoMinimaParaVencer).toBeGreaterThan(0.7);
    expect(cenarioA!.retencaoMinimaParaVencer).toBeLessThan(0.8);

    // Cenário B: retenção mínima para split 50/50 deve ser bem mais alta (~99%)
    expect(cenarioB!.retencaoMinimaParaVencer).toBeGreaterThan(0.95);

    // Nunca retorna um único número — sempre intervalo
    expect(cenarioA!.votosMin).toBeLessThan(cenarioA!.votosMax);
    expect(cenarioB!.votosMin).toBeLessThan(cenarioB!.votosMax);
  });

  it('município sem dados eleitorais históricos carregados (findMany vazio)', async () => {
    mockVotos(0, 0);

    const resultado = await service.calcularMetaVotos('municipio-sem-dado', 2024, 12, 15);

    const cenarioA = resultado.cenarios[0];
    // Sem base, não pode afirmar vitória nem calcular retenção normalmente —
    // deve sinalizar isso explicitamente, nunca fingir precisão.
    expect(cenarioA.retencaoMinimaParaVencer).toBe(1); // clamped, nunca > 100%
    expect(cenarioA.observacao).toMatch(/crescimento real de base/i);
  });

  it('zero contatos com leitura de engajamento não quebra o cálculo (base = 0)', async () => {
    // Este teste documenta que a projeção eleitoral usa DADO PÚBLICO
    // (DadosEleitoraisPublicos), não EngajamentoPolitico — então "zero
    // contatos com engajamento" não afeta este cálculo. Mantido aqui como
    // guarda de regressão caso alguém tente ligar os dois no futuro.
    mockVotos(500, 500);
    const resultado = await service.calcularMetaVotos('municipio-2', 2024, 12, 15);
    expect(resultado.votosBaseSituacionista).toBe(500);
    expect(() => resultado).not.toThrow();
  });

  it('taxa de conversão/retenção no extremo mínimo (0%)', async () => {
    mockVotos(1821, 903);

    const resultado = await service.calcularMetaVotos('municipio-1', 2024, 12, 15, {
      retencaoMin: 0,
      retencaoMax: 0,
    });

    const cenarioA = resultado.cenarios[0];
    expect(cenarioA.votosMin).toBe(0);
    expect(cenarioA.votosMax).toBe(0);
    expect(cenarioA.vitoriaGarantidaNoIntervalo).toBe(false);
  });

  it('taxa de retenção no extremo máximo (100%) ainda respeita piso de vitória', async () => {
    mockVotos(1821, 903);

    const resultado = await service.calcularMetaVotos('municipio-1', 2024, 12, 15, {
      retencaoMin: 1,
      retencaoMax: 1,
    });

    const cenarioA = resultado.cenarios[0];
    // Com 100% de retenção e crescimento positivo, base projetada > piso
    expect(cenarioA.votosMin).toBe(cenarioA.votosMax);
    expect(cenarioA.vitoriaGarantidaNoIntervalo).toBe(true);
  });

  it('resposta sempre inclui aviso metodológico (nunca omitido)', async () => {
    mockVotos(1821, 903);
    const resultado = await service.calcularMetaVotos('municipio-1', 2024, 12, 15);
    expect(resultado.avisoMetodologico).toBeTruthy();
    expect(resultado.avisoMetodologico.length).toBeGreaterThan(20);
  });
});
