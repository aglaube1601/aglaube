/**
 * mapa.service.ts
 *
 * Este é o endpoint mais sensível construído até agora — é o único que
 * precisa AGREGAR EngajamentoPolitico para gerar a distribuição percentual
 * usada no mapa (ver wireframe "Tela do mapa" já aprovado). A regra que
 * protege isso:
 *
 *   NUNCA retornar a contagem de EngajamentoPolitico por comunidade se
 *   essa comunidade tiver poucos contatos. Uma comunidade com 2 contatos
 *   e "100% apoiador" na prática identifica indivíduos por eliminação.
 *   Aplicamos um piso mínimo de contatos (K-ANONIMATO SIMPLES) abaixo do
 *   qual a distribuição de engajamento não é exposta, mesmo agregada.
 *
 * RBAC: mesmo critério do Painel Eleitoral — Administrador, Coordenador,
 * Visualização. Operador NÃO acessa este endpoint, mesmo que o dado seja
 * agregado, porque a fonte (EngajamentoPolitico) é a mesma que ele já não
 * pode ver em nenhuma forma no restante do sistema. Consistência de RBAC
 * entre módulos importa mais aqui do que a agregação em si.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusDemanda } from '../demandas/dto/create-demanda.dto';

// Abaixo deste número de contatos, a comunidade aparece no mapa com
// cobertura/demandas normalmente, mas SEM distribuição de engajamento —
// evita reidentificação por eliminação em territórios pequenos.
const PISO_K_ANONIMATO = 5;

export interface DadosEleitoraisComunidade {
  candidatoNumero: number;
  candidatoNome: string;
  votosObtidos: number;
}

export interface EngajamentoAgregado {
  apoiador: number;
  simpatizante: number;
  neutro: number;
  percepcaoNegativa: number;
  desconhecido: number;
}

export interface TerritorioMapa {
  comunidadeId: string;
  nome: string;
  bairroNome: string;
  totalContatos: number;
  liderancasAtivas: number;
  demandasAbertas: number;
  engajamentoAgregado: EngajamentoAgregado | null; // null = abaixo do piso de k-anonimato
  dadosEleitorais: DadosEleitoraisComunidade[];
}

@Injectable()
export class MapaService {
  constructor(private readonly prisma: PrismaService) {}

  async obterTerritorios(municipioId: string): Promise<TerritorioMapa[]> {
    const comunidades = await this.prisma.comunidade.findMany({
      where: { bairro: { zonaEleitoral: { municipioId } } },
      select: {
        id: true,
        nome: true,
        bairro: { select: { nome: true } },
        _count: { select: { contatos: true } },
      },
    });

    const resultado = await Promise.all(
      comunidades.map(async (com) => {
        const [liderancasAtivas, demandasAbertas, engajamento, dadosEleitorais] =
          await Promise.all([
            this.prisma.lideranca.count({
              where: { contato: { comunidadeId: com.id } },
            }),
            this.prisma.demanda.count({
              where: {
                comunidadeId: com.id,
                status: { notIn: [StatusDemanda.RESOLVIDA, StatusDemanda.ENCERRADA] },
              },
            }),
            this.obterEngajamentoAgregado(com.id, com._count.contatos),
            this.obterDadosEleitorais(com.id),
          ]);

        return {
          comunidadeId: com.id,
          nome: com.nome,
          bairroNome: com.bairro.nome,
          totalContatos: com._count.contatos,
          liderancasAtivas,
          demandasAbertas,
          engajamentoAgregado: engajamento,
          dadosEleitorais,
        };
      }),
    );

    return resultado;
  }

  private async obterEngajamentoAgregado(
    comunidadeId: string,
    totalContatos: number,
  ): Promise<EngajamentoAgregado | null> {
    // K-anonimato simples: comunidade pequena demais não expõe distribuição
    if (totalContatos < PISO_K_ANONIMATO) {
      return null;
    }

    const grupos = await this.prisma.engajamentoPolitico.groupBy({
      by: ['status'],
      where: { vigente: true, contato: { comunidadeId } },
      _count: { _all: true },
    });

    const base: EngajamentoAgregado = {
      apoiador: 0,
      simpatizante: 0,
      neutro: 0,
      percepcaoNegativa: 0,
      desconhecido: 0,
    };

    for (const g of grupos) {
      const chave = this.mapStatusParaChave(g.status);
      if (chave) base[chave] = g._count._all;
    }

    return base;
  }

  private mapStatusParaChave(status: string): keyof EngajamentoAgregado | null {
    const mapa: Record<string, keyof EngajamentoAgregado> = {
      apoiador: 'apoiador',
      simpatizante: 'simpatizante',
      neutro: 'neutro',
      percepcao_negativa: 'percepcaoNegativa',
      desconhecido: 'desconhecido',
    };
    return mapa[status] ?? null;
  }

  private async obterDadosEleitorais(comunidadeId: string): Promise<DadosEleitoraisComunidade[]> {
    const registros = await this.prisma.dadosEleitoraisPublicos.groupBy({
      by: ['candidatoNumero', 'candidatoNome'],
      where: { comunidadeId },
      _sum: { votosObtidos: true },
    });

    return registros.map((r) => ({
      candidatoNumero: r.candidatoNumero,
      candidatoNome: r.candidatoNome,
      votosObtidos: r._sum.votosObtidos ?? 0,
    }));
  }
}
