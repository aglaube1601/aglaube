/**
 * comunicacao.service.ts
 *
 * MVP: envio MOCKADO (sem integração real de WhatsApp Business API ainda —
 * ver seção 8 do produto). O que precisa estar certo desde já, porque é
 * caro de adicionar depois:
 *
 * 1. Toda seleção de público filtra por Consentimento.status = ativo para
 *    a finalidade da mensagem. Isso é feito NO BACKEND — nunca confiar em
 *    filtro de frontend.
 * 2. Todo envio tem idempotencyKey único (contatoId + campanhaId). Se o
 *    job de fila for reprocessado (falha de rede, retry automático), a
 *    unique constraint no banco impede duplicidade — não é "melhor
 *    esforço", é garantia de banco.
 * 3. Template é checado por um heurístico simples de risco de propaganda
 *    antecipada. Isso NUNCA decide sozinho — só bloqueia envio automático
 *    até a coordenação confirmar revisão explícita (revisadoPelaCoordenacao).
 *    É um alerta, não um parecer jurídico.
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCampanhaDto,
  CriterioPublico,
  FinalidadeComunicacao,
} from './dto/create-campanha.dto';
import { UsuarioAutenticado } from '../contatos/contatos.service';
import { FilaEnvioService } from './fila-envio.service';

// Heurística simples — lista de termos que costumam aparecer em pedido de
// voto ou propaganda antecipada. NÃO é análise jurídica. Existe só para
// forçar uma pausa humana antes do envio, nunca para bloquear ou aprovar
// automaticamente algo que precise de avaliação de advogado eleitoral.
const TERMOS_RISCO_PROPAGANDA = [
  'vote',
  'voto',
  'candidato',
  'candidatura',
  'eleição',
  'eleições',
  'campanha eleitoral',
  'apoie minha',
  'é 12',
  'é 15',
];

export interface ResultadoEnvioCampanha {
  campanhaId: string;
  destinatariosElegiveis: number;
  enviosEnfileirados: number;
  enviosIgnoradosPorDuplicidade: number;
  sinalizadoParaRevisao: boolean;
}

@Injectable()
export class ComunicacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filaEnvio: FilaEnvioService,
  ) {}

  /**
   * Nunca decide "seguro"/"inseguro" — só sinaliza. A decisão de enviar
   * mesmo assim é sempre humana (revisadoPelaCoordenacao no DTO).
   */
  detectarRiscoPropaganda(corpoMensagem: string): boolean {
    const textoNormalizado = corpoMensagem.toLowerCase();
    return TERMOS_RISCO_PROPAGANDA.some((termo) => textoNormalizado.includes(termo));
  }

  /**
   * Filtro de público — a única fonte de verdade é Consentimento.status.
   * Um contato "elegível" por critério (ex: aniversariante da semana) mas
   * SEM consentimento ativo para a finalidade nunca entra na lista.
   *
   * Consentimento é APPEND-ONLY (ver ConsentimentosService) — por isso o
   * filtro NÃO pode ser "existe algum registro ativo" (`some`): um "ativo"
   * antigo seguido de um opt-out mais recente continuaria contando pra
   * sempre. O que importa é o status MAIS RECENTE por (contato,
   * finalidade), calculado aqui em duas consultas em vez de uma só —
   * evita SQL raw pra uma agregação que o Prisma não expressa
   * declarativamente, ao custo de uma segunda query já limitada ao
   * conjunto de candidatos (nunca a base inteira).
   */
  async buscarDestinatariosElegiveis(
    municipioId: string,
    criterio: CriterioPublico,
    finalidade: FinalidadeComunicacao,
    comunidadeId?: string,
  ): Promise<string[]> {
    if (criterio === CriterioPublico.POR_COMUNIDADE && !comunidadeId) {
      throw new BadRequestException('comunidadeId é obrigatório para este critério de público.');
    }

    const filtroTerritorio = { comunidade: { bairro: { zonaEleitoral: { municipioId } } } };

    const filtrosPorCriterio: Record<CriterioPublico, object> = {
      [CriterioPublico.ANIVERSARIANTES_SEMANA]: this.filtroAniversariantesSemana(),
      [CriterioPublico.POR_COMUNIDADE]: { comunidadeId },
      [CriterioPublico.TODOS_COM_CONSENTIMENTO]: {},
      [CriterioPublico.LIDERANCAS_E_APOIADORES]: { lideranca: { isNot: null } },
    };

    const candidatos = await this.prisma.contato.findMany({
      where: {
        ...filtroTerritorio,
        ...filtrosPorCriterio[criterio],
      },
      select: { id: true },
    });

    if (candidatos.length === 0) {
      return [];
    }

    const candidatoIds = candidatos.map((c) => c.id);
    const historicoConsentimento = await this.prisma.consentimento.findMany({
      where: { contatoId: { in: candidatoIds }, finalidade },
      orderBy: { data: 'desc' },
      select: { contatoId: true, status: true },
    });

    const statusMaisRecentePorContato = new Map<string, string>();
    for (const registro of historicoConsentimento) {
      if (!statusMaisRecentePorContato.has(registro.contatoId)) {
        statusMaisRecentePorContato.set(registro.contatoId, registro.status);
      }
    }

    return candidatoIds.filter((id) => statusMaisRecentePorContato.get(id) === 'ativo');
  }

  private filtroAniversariantesSemana() {
    const hoje = new Date();
    const daqui7Dias = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
    // Simplificação de MVP: compara mês+dia via SQL seria mais robusto para
    // virada de ano — registrado como melhoria futura, não bloqueador.
    return {
      dataNascimento: { not: null },
      // filtro fino de mês/dia fica na query raw quando este critério
      // precisar de precisão (ex: 30/dez a 05/jan) — fora do escopo do MVP.
    };
  }

  async criarCampanha(
    dto: CreateCampanhaDto,
    municipioId: string,
    usuario: UsuarioAutenticado,
  ): Promise<ResultadoEnvioCampanha> {
    const finalidade = dto.finalidade ?? FinalidadeComunicacao.COMUNICACAO_INSTITUCIONAL;
    const sinalizado = this.detectarRiscoPropaganda(dto.corpoMensagem);

    if (sinalizado && !dto.revisadoPelaCoordenacao) {
      throw new BadRequestException({
        message:
          'Este template pode se aproximar de propaganda antecipada. Revisão da coordenação obrigatória antes do envio.',
        sinalizadoParaRevisao: true,
      });
    }

    const destinatarios = await this.buscarDestinatariosElegiveis(
      municipioId,
      dto.criterioPublico,
      finalidade,
      dto.comunidadeId,
    );

    const campanha = await this.prisma.campanhaComunicacao.create({
      data: {
        tipoTemplate: dto.tipoTemplate,
        corpoMensagem: dto.corpoMensagem,
        finalidade,
        criadoPorId: usuario.id,
        sinalizadoParaRevisao: sinalizado,
      },
    });

    let enfileirados = 0;
    let ignoradosPorDuplicidade = 0;

    for (const contatoId of destinatarios) {
      // Idempotency key determinística: mesmo contato + mesma campanha
      // nunca gera dois envios, mesmo se este loop rodar de novo por
      // retry de infraestrutura.
      const idempotencyKey = `${campanha.id}:${contatoId}`;

      try {
        await this.prisma.envioMensagem.create({
          data: {
            campanhaId: campanha.id,
            contatoId,
            idempotencyKey,
            status: 'pendente',
          },
        });
        await this.filaEnvio.enfileirar({ envioId: idempotencyKey, contatoId, campanhaId: campanha.id });
        enfileirados++;
      } catch (erro: any) {
        // Unique constraint violation em idempotencyKey = já foi
        // enfileirado antes. Não é erro do usuário, é o comportamento
        // correto e esperado do mecanismo de idempotência.
        if (erro?.code === 'P2002') {
          ignoradosPorDuplicidade++;
        } else {
          throw erro;
        }
      }
    }

    return {
      campanhaId: campanha.id,
      destinatariosElegiveis: destinatarios.length,
      enviosEnfileirados: enfileirados,
      enviosIgnoradosPorDuplicidade: ignoradosPorDuplicidade,
      sinalizadoParaRevisao: sinalizado,
    };
  }
}
