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

    // ANIVERSARIANTES_SEMANA precisa comparar só mês/dia (ignorando o ano
    // de nascimento), inclusive virada de ano — o Prisma não expressa isso
    // declarativamente num `where`, então filtra em memória sobre o
    // conjunto já restrito por território (nunca a base inteira).
    if (criterio === CriterioPublico.ANIVERSARIANTES_SEMANA) {
      const comAniversario = await this.prisma.contato.findMany({
        where: { ...filtroTerritorio, dataNascimento: { not: null } },
        select: { id: true, dataNascimento: true },
      });
      const hoje = new Date();
      const candidatoIds = comAniversario
        .filter((c) => c.dataNascimento && this.aniversarioNosProximosDias(c.dataNascimento, hoje, 7))
        .map((c) => c.id);
      return this.filtrarPorConsentimentoAtivo(candidatoIds, finalidade);
    }

    const filtrosPorCriterio: Record<
      Exclude<CriterioPublico, CriterioPublico.ANIVERSARIANTES_SEMANA>,
      object
    > = {
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

    return this.filtrarPorConsentimentoAtivo(
      candidatos.map((c) => c.id),
      finalidade,
    );
  }

  /**
   * Resolve o status MAIS RECENTE de Consentimento por contato (nunca
   * "algum dia foi ativo" — ver docstring de buscarDestinatariosElegiveis)
   * e devolve só os ids com status='ativo' para a finalidade pedida.
   */
  private async filtrarPorConsentimentoAtivo(
    candidatoIds: string[],
    finalidade: FinalidadeComunicacao,
  ): Promise<string[]> {
    if (candidatoIds.length === 0) {
      return [];
    }

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

  /**
   * Compara só mês/dia de `dataNascimento` contra os próximos `dias` dias
   * corridos a partir de `hoje` (inclusive hoje) — nunca o ano. Construir
   * Date reais dia a dia (em vez de aritmética manual de dia-do-ano) é o
   * que faz a virada de ano funcionar de graça: somar dias a um Date do
   * JS já rola dezembro -> janeiro corretamente.
   */
  private aniversarioNosProximosDias(dataNascimento: Date, hoje: Date, dias: number): boolean {
    for (let i = 0; i <= dias; i++) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);
      if (data.getMonth() === dataNascimento.getMonth() && data.getDate() === dataNascimento.getDate()) {
        return true;
      }
    }
    return false;
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
      // retry de infraestrutura. Sem ":" de propósito — é usada também
      // como jobId do BullMQ (ver FilaEnvioService), que rejeita ":" em
      // ID customizado (usa como separador interno de chave no Redis).
      const idempotencyKey = `${campanha.id}_${contatoId}`;

      let envio: { id: string };
      try {
        envio = await this.prisma.envioMensagem.create({
          data: {
            campanhaId: campanha.id,
            contatoId,
            idempotencyKey,
            status: 'pendente',
          },
        });
      } catch (erro: any) {
        // Unique constraint violation em idempotencyKey = já foi
        // enfileirado antes. Não é erro do usuário, é o comportamento
        // correto e esperado do mecanismo de idempotência.
        if (erro?.code === 'P2002') {
          ignoradosPorDuplicidade++;
          continue;
        }
        throw erro;
      }

      try {
        await this.filaEnvio.enfileirar({ envioId: idempotencyKey, contatoId, campanhaId: campanha.id });
        enfileirados++;
      } catch (erroFila) {
        // O registro já foi criado no passo anterior — se o enfileiramento
        // falhar agora (Redis fora do ar, etc.), desfaz o registro em vez
        // de deixar um EnvioMensagem "pendente" órfão que nunca seria
        // processado (e que bloquearia pra sempre uma nova tentativa,
        // porque o idempotencyKey já existiria).
        await this.prisma.envioMensagem.delete({ where: { id: envio.id } });
        throw erroFila;
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
