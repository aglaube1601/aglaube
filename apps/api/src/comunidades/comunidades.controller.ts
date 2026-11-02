/**
 * comunidades.controller.ts + comunidades.service.ts
 *
 * Propositalmente mínimo: só leitura, para alimentar o dropdown de
 * cadastro de contato e o filtro de bairro do Mapa/Demandas. Um CRUD
 * completo de território (criar/editar município, zona, bairro) fica
 * para a fase SaaS multi-município — ver roadmap. Criar isso agora seria
 * trabalho adiantado sem uso no MVP de município único.
 */

import { Controller, Get, Param, Query, UseGuards, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ComunidadesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista comunidades para preencher dropdown/filtro. Não expõe nenhum
   * dado agregado de engajamento aqui — isso é responsabilidade do
   * endpoint de Mapa/Dashboard, que já trata a agregação com o cuidado
   * de nunca vazar dado individual.
   */
  async listar(bairroId?: string) {
    const comunidades = await this.prisma.comunidade.findMany({
      where: bairroId ? { bairroId } : undefined,
      select: {
        id: true,
        nome: true,
        bairro: {
          select: {
            id: true,
            nome: true,
            zonaEleitoral: { select: { id: true, numero: true } },
          },
        },
        // Uma comunidade pode ter várias SecaoEleitoral, mas na prática
        // (ver seed-secoes-eleitorais.ts) todas as seções de uma mesma
        // comunidade caem no MESMO local de votação — pegar só a primeira
        // já identifica a escola. Front usa isso como rótulo principal no
        // lugar do nome da comunidade: pra quem cadastra, "a pessoa vota
        // na escola tal" é mais concreto do que o nome da comunidade.
        secoesEleitorais: {
          select: { nomeLocalVotacao: true },
          take: 1,
        },
      },
      orderBy: { nome: 'asc' },
    });

    return comunidades.map(({ secoesEleitorais, ...comunidade }) => ({
      ...comunidade,
      escolaLocalVotacao: secoesEleitorais[0]?.nomeLocalVotacao ?? null,
    }));
  }

  async buscarPorId(id: string) {
    return this.prisma.comunidade.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        bairro: { select: { id: true, nome: true } },
      },
    });
  }
}

@UseGuards(JwtAuthGuard)
@Controller('comunidades')
export class ComunidadesController {
  constructor(private readonly comunidadesService: ComunidadesService) {}

  // Sem @Roles() — qualquer perfil autenticado pode ler a lista de
  // territórios; é pré-requisito de UI (dropdown), não dado sensível.
  @Get()
  async listar(@Query('bairroId') bairroId?: string) {
    return this.comunidadesService.listar(bairroId);
  }

  @Get(':id')
  async buscarPorId(@Param('id') id: string) {
    return this.comunidadesService.buscarPorId(id);
  }
}
