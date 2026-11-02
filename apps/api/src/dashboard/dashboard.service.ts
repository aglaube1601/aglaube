/**
 * dashboard.service.ts
 *
 * Junta números que os módulos já construídos (Contatos, Demandas,
 * Interações, Território) já produzem — este service NÃO introduz
 * nenhuma fonte de dado nova, só agrega o que já existe.
 *
 * Regra de compliance: todo número aqui é CONTAGEM ou AGREGAÇÃO. Nenhum
 * método deste service retorna uma lista de Contato ou o conteúdo de
 * EngajamentoPolitico — isso é obrigatório mesmo que pareça inofensivo
 * ("só uma lista de aniversariantes") porque uma lista de nomes por
 * comunidade já é dado individual, não agregado.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusDemanda } from '../demandas/dto/create-demanda.dto';

// Limiar de "baixa cobertura": comunidade com menos contatos cadastrados
// que este número entra no alerta do dashboard. Ajustável — não deve virar
// constante mágica espalhada pelo código; só existe aqui.
const LIMIAR_BAIXA_COBERTURA_CONTATOS = 10;

export interface ResumoExecutivo {
  totalContatos: number;
  novosContatos30Dias: number;
  liderancasCadastradas: number;
  comunidadesMapeadas: number;
  regioesComBaixaCobertura: Array<{ comunidadeId: string; nome: string; totalContatos: number }>;
  interacoes30Dias: number;
  demandasAbertas: number;
  demandasResolvidas30Dias: number;
  proximosEventos: Array<{ id: string; tipo: string; data: Date; comunidadeNome: string }>;
  aniversariantesDoMes: number; // contagem — nunca lista de nomes neste endpoint
  // Ranking agregado (contagem por comunidade) — usado no gráfico de barras
  // do painel. Continua sendo uma AGREGAÇÃO, não uma lista de Contato.
  contatosPorComunidade: Array<{ comunidadeId: string; nome: string; totalContatos: number }>;
  // Série temporal (contagem por dia) para o gráfico de tendência do
  // painel — 14 dias, dias sem interação entram com total 0.
  interacoesPorDia: Array<{ dia: string; total: number }>;
  geradoEm: Date;
}

const DIAS_SERIE_INTERACOES = 14;
const TOP_COMUNIDADES_GRAFICO = 8;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async obterResumoExecutivo(municipioId: string): Promise<ResumoExecutivo> {
    const agora = new Date();
    const ha30Dias = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59);

    const filtroTerritorioContato = {
      comunidade: { bairro: { zonaEleitoral: { municipioId } } },
    };
    const filtroTerritorioComunidade = {
      bairro: { zonaEleitoral: { municipioId } },
    };

    const [
      totalContatos,
      novosContatos30Dias,
      liderancasCadastradas,
      comunidades,
      interacoes30Dias,
      demandasAbertas,
      demandasResolvidas30Dias,
      proximosEventosRaw,
      aniversariantesDoMes,
      interacoesPorDiaRaw,
    ] = await Promise.all([
      this.prisma.contato.count({ where: filtroTerritorioContato }),

      this.prisma.contato.count({
        where: { ...filtroTerritorioContato, criadoEm: { gte: ha30Dias } },
      }),

      this.prisma.lideranca.count({
        where: { contato: filtroTerritorioContato },
      }),

      // Traz contagem de contatos por comunidade em uma única query
      // (evita N+1: uma query por comunidade para achar baixa cobertura)
      this.prisma.comunidade.findMany({
        where: filtroTerritorioComunidade,
        select: {
          id: true,
          nome: true,
          _count: { select: { contatos: true } },
        },
      }),

      this.contarInteracoes30Dias(municipioId, ha30Dias),

      this.prisma.demanda.count({
        where: {
          comunidade: filtroTerritorioComunidade,
          status: { notIn: [StatusDemanda.RESOLVIDA, StatusDemanda.ENCERRADA] },
        },
      }),

      this.prisma.demanda.count({
        where: {
          comunidade: filtroTerritorioComunidade,
          status: StatusDemanda.RESOLVIDA,
          atualizadoEm: { gte: ha30Dias },
        },
      }),

      this.prisma.eventoAcao.findMany({
        where: { comunidade: filtroTerritorioComunidade, data: { gte: agora } },
        orderBy: { data: 'asc' },
        take: 5,
        select: { id: true, tipo: true, data: true, comunidade: { select: { nome: true } } },
      }),

      // Aniversariantes do mês corrente — CONTAGEM apenas. A lista com
      // nomes fica num endpoint separado (com RBAC de leitura de Contato),
      // nunca aqui no resumo agregado.
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint as count
        FROM "Contato" c
        JOIN "Comunidade" com ON com.id = c."comunidadeId"
        JOIN "Bairro" b ON b.id = com."bairroId"
        JOIN "ZonaEleitoral" z ON z.id = b."zonaEleitoralId"
        WHERE z."municipioId" = ${municipioId}
          AND c."dataNascimento" IS NOT NULL
          AND EXTRACT(MONTH FROM c."dataNascimento") = ${agora.getMonth() + 1}
      `.then((r) => Number(r[0]?.count ?? 0)),

      // Interações agrupadas por dia — base do gráfico de tendência do
      // painel. Traz só os dias com pelo menos uma interação; os dias sem
      // nenhuma são preenchidos com total=0 depois (ver preencherDiasVazios),
      // porque um LEFT JOIN com generate_series complicaria a query sem
      // necessidade.
      this.prisma.$queryRaw<Array<{ dia: string; total: bigint }>>`
        SELECT
          to_char(date_trunc('day', i."data"), 'YYYY-MM-DD') as dia,
          COUNT(*)::bigint as total
        FROM "Interacao" i
        JOIN "Contato" c ON c.id = i."contatoId"
        JOIN "Comunidade" com ON com.id = c."comunidadeId"
        JOIN "Bairro" b ON b.id = com."bairroId"
        JOIN "ZonaEleitoral" z ON z.id = b."zonaEleitoralId"
        WHERE z."municipioId" = ${municipioId}
          AND i."data" >= ${new Date(agora.getTime() - (DIAS_SERIE_INTERACOES - 1) * 24 * 60 * 60 * 1000)}
        GROUP BY dia
        ORDER BY dia ASC
      `,
    ]);

    const regioesComBaixaCobertura = comunidades
      .filter((c) => c._count.contatos < LIMIAR_BAIXA_COBERTURA_CONTATOS)
      .map((c) => ({ comunidadeId: c.id, nome: c.nome, totalContatos: c._count.contatos }));

    const proximosEventos = proximosEventosRaw.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      data: e.data,
      comunidadeNome: e.comunidade.nome,
    }));

    const contatosPorComunidade = [...comunidades]
      .sort((a, b) => b._count.contatos - a._count.contatos)
      .slice(0, TOP_COMUNIDADES_GRAFICO)
      .map((c) => ({ comunidadeId: c.id, nome: c.nome, totalContatos: c._count.contatos }));

    const interacoesPorDia = this.preencherDiasVazios(interacoesPorDiaRaw, agora);

    return {
      totalContatos,
      novosContatos30Dias,
      liderancasCadastradas,
      comunidadesMapeadas: comunidades.length,
      regioesComBaixaCobertura,
      interacoes30Dias,
      demandasAbertas,
      demandasResolvidas30Dias,
      proximosEventos,
      aniversariantesDoMes,
      contatosPorComunidade,
      interacoesPorDia,
      geradoEm: agora,
    };
  }

  /**
   * Completa a série de 14 dias com total=0 nos dias sem nenhuma
   * interação — sem isso o gráfico de tendência "pularia" dias, o que
   * é enganoso num gráfico de linha (parece que o dia não existiu, não
   * que teve zero interações).
   */
  private preencherDiasVazios(
    linhas: Array<{ dia: string; total: bigint }>,
    agora: Date,
  ): Array<{ dia: string; total: number }> {
    const porDia = new Map(linhas.map((l) => [l.dia, Number(l.total)]));
    const dias: Array<{ dia: string; total: number }> = [];
    for (let i = DIAS_SERIE_INTERACOES - 1; i >= 0; i--) {
      const data = new Date(agora.getTime() - i * 24 * 60 * 60 * 1000);
      const chave = data.toISOString().slice(0, 10);
      dias.push({ dia: chave, total: porDia.get(chave) ?? 0 });
    }
    return dias;
  }

  private async contarInteracoes30Dias(municipioId: string, desde: Date): Promise<number> {
    return this.prisma.interacao.count({
      where: {
        data: { gte: desde },
        contato: { comunidade: { bairro: { zonaEleitoral: { municipioId } } } },
      },
    });
  }
}
