/**
 * electoral-projection.service.ts
 *
 * Módulo de Painel Eleitoral — cálculo de meta de votos com margem de erro.
 *
 * PRINCÍPIOS DE COMPLIANCE (não alterar sem revisão):
 * - Toda leitura de dado aqui é AGREGADA POR COMUNIDADE. Esta service nunca
 *   consulta Contato ou EngajamentoPolitico individualmente — apenas as
 *   contagens já agregadas expostas por ContatosService.contarPorPropensao().
 * - O resultado NUNCA é um número único. Sempre um intervalo + premissas.
 * - Todo parâmetro de retenção/conversão é explícito e ajustável pelo
 *   coordenador — nunca hardcoded como "verdade".
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PremissasProjecao {
  /** Taxa de crescimento anual do eleitorado (proxy: crescimento populacional IBGE) */
  taxaCrescimentoAnual: number;
  /** Anos de projeção a partir da última eleição */
  anosProjecao: number;
  /** Faixa de retenção da base atual pelo sucessor/chapa (0 a 1) */
  retencaoMin: number;
  retencaoMax: number;
}

export interface ResultadoCenario {
  cenario: 'sucessao_unificada' | 'fragmentacao_50_50';
  votosMin: number;
  votosMax: number;
  pisoVitoria: number;
  retencaoMinimaParaVencer: number;
  vitoriaGarantidaNoIntervalo: boolean;
  observacao: string;
}

export interface ResultadoProjecaoEleitoral {
  municipioId: string;
  eleicaoAnoBase: number;
  comparecimentoBase: number;
  validosBase: number;
  votosBaseSituacionista: number;
  votosBaseOposicao: number;
  fatorCrescimentoAplicado: number;
  premissas: PremissasProjecao;
  cenarios: ResultadoCenario[];
  avisoMetodologico: string;
}

const DEFAULT_PREMISSAS: PremissasProjecao = {
  taxaCrescimentoAnual: 0.0042, // proxy populacional — ajustável
  anosProjecao: 4,
  retencaoMin: 0.7,
  retencaoMax: 0.95,
};

const AVISO_METODOLOGICO =
  'Meta estatística baseada em dados públicos agregados (TSE/IBGE) e em premissas ' +
  'de retenção definidas pela coordenação. Não representa contagem individual de ' +
  'intenção de voto nem garante resultado eleitoral. Taxa de crescimento do ' +
  'eleitorado é um proxy de crescimento populacional, não um dado eleitoral direto.';

@Injectable()
export class ElectoralProjectionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Soma os votos de um candidato/situação em todas as comunidades de um
   * município, para uma eleição específica. Consulta apenas
   * DadosEleitoraisPublicos (dado público agregado por comunidade,
   * nunca ligado a Contato).
   */
  private async somarVotosPorCandidato(
    municipioId: string,
    eleicaoAno: number,
    candidatoNumero: number,
  ): Promise<number> {
    const registros = await this.prisma.dadosEleitoraisPublicos.findMany({
      where: {
        eleicaoAno,
        candidatoNumero,
        comunidade: { bairro: { zonaEleitoral: { municipioId } } },
      },
      select: { votosObtidos: true },
    });
    return registros.reduce((acc, r) => acc + r.votosObtidos, 0);
  }

  private calcularFatorCrescimento(premissas: PremissasProjecao): number {
    return Math.pow(1 + premissas.taxaCrescimentoAnual, premissas.anosProjecao);
  }

  /**
   * Cenário A: corrida a 2 (sucessão unificada, sem candidatura dissidente).
   * Piso de vitória = maioria simples dos votos válidos projetados.
   */
  private calcularCenarioSucessaoUnificada(
    votosBaseSituacionista: number,
    validosProjetados: number,
    premissas: PremissasProjecao,
  ): ResultadoCenario {
    const pisoVitoria = Math.floor(validosProjetados / 2) + 1;

    const votosMin = votosBaseSituacionista * premissas.retencaoMin;
    const votosMax = votosBaseSituacionista * premissas.retencaoMax;

    // Evita divisão por zero quando não há base situacionista (ex: município
    // sem histórico eleitoral carregado ainda)
    const retencaoMinimaParaVencer =
      votosBaseSituacionista > 0 ? pisoVitoria / votosBaseSituacionista : Infinity;

    return {
      cenario: 'sucessao_unificada',
      votosMin: Math.round(votosMin),
      votosMax: Math.round(votosMax),
      pisoVitoria,
      retencaoMinimaParaVencer: Math.min(retencaoMinimaParaVencer, 1),
      vitoriaGarantidaNoIntervalo: votosMin > pisoVitoria,
      observacao:
        retencaoMinimaParaVencer > 1
          ? 'Piso de vitória acima da base histórica mesmo sem erosão — cenário requer crescimento real de base, não apenas retenção.'
          : `Retenção mínima necessária: ${(retencaoMinimaParaVencer * 100).toFixed(1)}%.`,
    };
  }

  /**
   * Cenário B: fragmentação — pior caso de divisão 50/50 do campo
   * situacionista entre dois candidatos, com oposição mantendo sua base.
   * Este é o cenário de risco existencial (não de erosão gradual).
   */
  private calcularCenarioFragmentacao(
    votosBaseSituacionista: number,
    votosBaseOposicao: number,
    premissas: PremissasProjecao,
  ): ResultadoCenario {
    const fragmentoMin = (votosBaseSituacionista * premissas.retencaoMin) / 2;
    const fragmentoMax = (votosBaseSituacionista * premissas.retencaoMax) / 2;

    // retenção mínima do campo INTEIRO para que a metade ainda supere a oposição
    const retencaoMinimaParaVencer =
      votosBaseSituacionista > 0
        ? (2 * votosBaseOposicao) / votosBaseSituacionista
        : Infinity;

    return {
      cenario: 'fragmentacao_50_50',
      votosMin: Math.round(fragmentoMin),
      votosMax: Math.round(fragmentoMax),
      pisoVitoria: Math.round(votosBaseOposicao) + 1,
      retencaoMinimaParaVencer: Math.min(retencaoMinimaParaVencer, 1),
      vitoriaGarantidaNoIntervalo: fragmentoMin > votosBaseOposicao,
      observacao:
        retencaoMinimaParaVencer > 1
          ? 'Mesmo com retenção total (100%) da base, um split 50/50 favoreceria a oposição — coesão da chapa é crítica.'
          : `Sem margem de erro relevante: retenção mínima de ${(retencaoMinimaParaVencer * 100).toFixed(1)}% necessária para o campo inteiro, mesmo dividido ao meio.`,
    };
  }

  async calcularMetaVotos(
    municipioId: string,
    eleicaoAnoBase: number,
    candidatoSituacionistaNumero: number,
    candidatoOposicaoNumero: number,
    premissasCustom?: Partial<PremissasProjecao>,
  ): Promise<ResultadoProjecaoEleitoral> {
    const premissas: PremissasProjecao = { ...DEFAULT_PREMISSAS, ...premissasCustom };

    const [votosBaseSituacionista, votosBaseOposicao] = await Promise.all([
      this.somarVotosPorCandidato(municipioId, eleicaoAnoBase, candidatoSituacionistaNumero),
      this.somarVotosPorCandidato(municipioId, eleicaoAnoBase, candidatoOposicaoNumero),
    ]);

    const fator = this.calcularFatorCrescimento(premissas);
    const votosBaseSituacionistaProj = votosBaseSituacionista * fator;
    const votosBaseOposicaoProj = votosBaseOposicao * fator;
    const validosBase = votosBaseSituacionista + votosBaseOposicao; // aproximação: só os 2 candidatos
    const validosProjetados = validosBase * fator;

    const cenarioA = this.calcularCenarioSucessaoUnificada(
      votosBaseSituacionistaProj,
      validosProjetados,
      premissas,
    );
    const cenarioB = this.calcularCenarioFragmentacao(
      votosBaseSituacionistaProj,
      votosBaseOposicaoProj,
      premissas,
    );

    return {
      municipioId,
      eleicaoAnoBase,
      comparecimentoBase: validosBase, // aproximação — ver nota no README
      validosBase,
      votosBaseSituacionista,
      votosBaseOposicao,
      fatorCrescimentoAplicado: fator,
      premissas,
      cenarios: [cenarioA, cenarioB],
      avisoMetodologico: AVISO_METODOLOGICO,
    };
  }
}
