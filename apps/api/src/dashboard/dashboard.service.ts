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
  geradoEm: Date;
}

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
        JOIN "Comunidade" com ON com.id = c.comunidade_id
        JOIN "Bairro" b ON b.id = com.bairro_id
        JOIN "ZonaEleitoral" z ON z.id = b.zona_eleitoral_id
        WHERE z.municipio_id = ${municipioId}
          AND c.data_nascimento IS NOT NULL
          AND EXTRACT(MONTH FROM c.data_nascimento) = ${agora.getMonth() + 1}
      `.then((r) => Number(r[0]?.count ?? 0)),
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
      geradoEm: agora,
    };
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
