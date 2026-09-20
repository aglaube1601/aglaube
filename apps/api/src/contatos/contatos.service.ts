/**
 * contatos.service.ts
 *
 * Regras de negócio não-negociáveis implementadas aqui (ver seção 3 do MVP):
 * 1. comunidadeId obrigatório — garantido pelo DTO + validação extra aqui.
 * 2. Deduplicação por fuzzy match (nome + telefone) via pg_trgm do Postgres,
 *    ANTES de criar — nunca cria silenciosamente um possível duplicado.
 * 3. EngajamentoPolitico só é persistido se o usuário autenticado tiver
 *    permissaoEngajamentoPolitico = true. Isso é decidido NO SERVICE,
 *    nunca confiando em validação de frontend.
 * 4. Toda leitura/escrita de EngajamentoPolitico gera LogAuditoria.
 * 5. EngajamentoPolitico nunca é UPDATE — sempre novo registro + marca o
 *    anterior como vigente=false.
 */

import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContatoDto } from './dto/create-contato.dto';
import { AuditoriaService } from '../auditoria/auditoria.service';

export interface UsuarioAutenticado {
  id: string;
  perfil: 'administrador' | 'coordenador' | 'operador' | 'visualizacao';
  permissaoEngajamentoPolitico: boolean;
}

export interface EngajamentoPoliticoInput {
  status: string;
  origem: string;
  confianca: string;
}

export interface ContatoDetalhado {
  id: string;
  nome: string;
  telefone: string | null;
  whatsapp: string | null;
  dataNascimento: Date | null;
  endereco: string | null;
  profissao: string | null;
  comunidadeId: string;
  comunidade: { id: string; nome: string };
  criadoEm: Date;
  // Presente apenas quando o usuário tem permissaoEngajamentoPolitico —
  // ver docstring de buscarPorId. Ausente, não null, quando sem permissão.
  engajamentoPolitico?: {
    status: string;
    origem: string;
    confianca: string;
    criadoEm: Date;
    registradoPorId: string;
  } | null;
}

export interface CandidatoDuplicata {
  id: string;
  nome: string;
  telefone: string | null;
  comunidadeNome: string;
  criadoEm: Date;
  similaridade: number; // 0 a 1 — score do pg_trgm
}

export interface ContatoResumo {
  id: string;
  nome: string;
  telefone: string | null;
  comunidade: { id: string; nome: string };
  criadoEm: Date;
}

export interface ListagemContatos {
  itens: ContatoResumo[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
}

const LIMIAR_SIMILARIDADE_NOME = 0.4; // ajustável — ver nota de calibração abaixo

@Injectable()
export class ContatosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  /**
   * Listagem territorializada de contatos — nunca inclui EngajamentoPolitico
   * (mesma regra do Dashboard: este é um endpoint de navegação/CRUD, não o
   * lugar onde dado sensível é exposto). `q` é um filtro simples (contains,
   * case-insensitive), diferente do fuzzy match de buscarPossiveisDuplicatas
   * — aqui o objetivo é navegar a base já cadastrada, não checar duplicidade
   * antes de criar.
   */
  async listar(
    municipioId: string,
    opts: { comunidadeId?: string; q?: string; pagina?: number; tamanhoPagina?: number },
  ): Promise<ListagemContatos> {
    // Sem isso, um municipioId ausente vira "sem filtro" no Prisma (campo
    // undefined é ignorado no where) — vazaria contatos de outros
    // municípios assim que o sistema deixar de ser de município único.
    if (!municipioId) {
      throw new BadRequestException('municipioId é obrigatório.');
    }

    const pagina = opts.pagina && opts.pagina > 0 ? opts.pagina : 1;
    const tamanhoPagina = Math.min(opts.tamanhoPagina && opts.tamanhoPagina > 0 ? opts.tamanhoPagina : 25, 100);

    const where = {
      comunidade: {
        ...(opts.comunidadeId ? { id: opts.comunidadeId } : {}),
        bairro: { zonaEleitoral: { municipioId } },
      },
      ...(opts.q ? { nome: { contains: opts.q, mode: 'insensitive' as const } } : {}),
    };

    const [itens, total] = await Promise.all([
      this.prisma.contato.findMany({
        where,
        select: {
          id: true,
          nome: true,
          telefone: true,
          comunidade: { select: { id: true, nome: true } },
          criadoEm: true,
        },
        orderBy: { nome: 'asc' },
        skip: (pagina - 1) * tamanhoPagina,
        take: tamanhoPagina,
      }),
      this.prisma.contato.count({ where }),
    ]);

    return { itens, total, pagina, tamanhoPagina };
  }

  /**
   * Busca candidatos a duplicata por similaridade de nome (pg_trgm) OU
   * telefone idêntico. Requer a extensão pg_trgm habilitada no Postgres
   * (ver migration 0001_enable_pg_trgm.sql) e um índice GIN em Contato.nome
   * para não degradar em produção com a base crescendo.
   *
   * NÃO decide sozinho o que é duplicata — sempre retorna candidatos para
   * o usuário confirmar. Falso positivo aqui vira um clique extra; falso
   * negativo vira um contato duplicado silencioso — por isso o limiar é
   * propositalmente permissivo (mais candidatos, não menos).
   */
  async buscarPossiveisDuplicatas(
    nome: string,
    telefone?: string,
  ): Promise<CandidatoDuplicata[]> {
    if (!nome || nome.trim().length < 3) {
      return []; // nome curto demais gera ruído de falso positivo
    }

    const resultados = await this.prisma.$queryRaw<
      Array<{
        id: string;
        nome: string;
        telefone: string | null;
        comunidadeNome: string;
        criadoEm: Date;
        similaridade: number;
      }>
    >`
      SELECT
        c.id,
        c.nome,
        c.telefone,
        com.nome as "comunidadeNome",
        c."criadoEm" as "criadoEm",
        GREATEST(
          similarity(c.nome, ${nome}),
          CASE WHEN ${telefone ?? null}::text IS NOT NULL
               AND c.telefone = ${telefone ?? null}
               THEN 1.0 ELSE 0.0 END
        ) as similaridade
      FROM "Contato" c
      JOIN "Comunidade" com ON com.id = c."comunidadeId"
      WHERE similarity(c.nome, ${nome}) > ${LIMIAR_SIMILARIDADE_NOME}
         OR (${telefone ?? null}::text IS NOT NULL AND c.telefone = ${telefone ?? null})
      ORDER BY similaridade DESC
      LIMIT 5
    `;

    return resultados;
  }

  async criar(dto: CreateContatoDto, usuario: UsuarioAutenticado) {
    // Regra 1: comunidade obrigatória (defesa em profundidade — já validado
    // no DTO, mas um service nunca deve confiar só na camada de entrada)
    if (!dto.comunidadeId) {
      throw new BadRequestException('comunidadeId é obrigatório.');
    }

    const comunidade = await this.prisma.comunidade.findUnique({
      where: { id: dto.comunidadeId },
    });
    if (!comunidade) {
      throw new BadRequestException('Comunidade informada não existe.');
    }

    // Regra 2: dedup — se houver candidatos fortes não revisados, bloqueia
    const duplicatas = await this.buscarPossiveisDuplicatas(dto.nome, dto.telefone);
    const naoRevisadas = duplicatas.filter(
      (d) => !dto.ignorarDuplicatasIds?.includes(d.id),
    );
    const duplicataForte = naoRevisadas.find((d) => d.similaridade > 0.6);
    if (duplicataForte) {
      throw new BadRequestException({
        message: 'Possível contato duplicado encontrado. Revise antes de criar.',
        candidatos: naoRevisadas,
      });
    }

    // Regra 3: engajamento político só é persistido com permissão explícita
    const podeRegistrarEngajamento = usuario.permissaoEngajamentoPolitico;
    if (dto.engajamentoPolitico && !podeRegistrarEngajamento) {
      // Não falha a criação do contato por isso — só ignora o campo
      // silenciosamente do payload, já que o frontend nem deveria ter
      // mostrado essa opção para este perfil.
      dto.engajamentoPolitico = undefined;
    }

    const contato = await this.prisma.$transaction(async (tx) => {
      const novoContato = await tx.contato.create({
        data: {
          nome: dto.nome,
          telefone: dto.telefone,
          whatsapp: dto.whatsapp,
          dataNascimento: dto.dataNascimento ? new Date(dto.dataNascimento) : undefined,
          endereco: dto.endereco,
          comunidadeId: dto.comunidadeId,
          profissao: dto.profissao,
          origemCadastro: dto.origemCadastro,
          responsavelCadastroId: usuario.id,
        },
      });

      if (dto.engajamentoPolitico && podeRegistrarEngajamento) {
        await tx.engajamentoPolitico.create({
          data: {
            contatoId: novoContato.id,
            status: dto.engajamentoPolitico.status,
            origem: dto.engajamentoPolitico.origem,
            confianca: dto.engajamentoPolitico.confianca,
            registradoPorId: usuario.id,
            vigente: true,
          },
        });

        // Regra 4: auditoria obrigatória em toda escrita de EngajamentoPolitico
        await tx.logAuditoria.create({
          data: {
            usuarioId: usuario.id,
            entidade: 'EngajamentoPolitico',
            entidadeId: novoContato.id,
            acao: 'criacao',
            detalhes: { status: dto.engajamentoPolitico.status },
          },
        });
      }

      return novoContato;
    });

    return contato;
  }

  /**
   * Atualiza o engajamento político de um contato — NUNCA faz UPDATE no
   * registro existente. Marca o vigente como vigente=false e cria um novo.
   * Bloqueado no nível de service para qualquer perfil sem a permissão,
   * mesmo que a rota tenha passado por um guard (defesa em profundidade).
   */
  async atualizarEngajamento(
    contatoId: string,
    novoEngajamento: EngajamentoPoliticoInput | undefined,
    usuario: UsuarioAutenticado,
  ) {
    if (!usuario.permissaoEngajamentoPolitico) {
      throw new ForbiddenException(
        'Usuário sem permissão para registrar engajamento político.',
      );
    }
    if (!novoEngajamento) {
      throw new BadRequestException('Dados de engajamento não informados.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.engajamentoPolitico.updateMany({
        where: { contatoId, vigente: true },
        data: { vigente: false },
      });

      const registro = await tx.engajamentoPolitico.create({
        data: {
          contatoId,
          status: novoEngajamento.status,
          origem: novoEngajamento.origem,
          confianca: novoEngajamento.confianca,
          registradoPorId: usuario.id,
          vigente: true,
        },
      });

      await tx.logAuditoria.create({
        data: {
          usuarioId: usuario.id,
          entidade: 'EngajamentoPolitico',
          entidadeId: contatoId,
          acao: 'edicao',
          detalhes: { novoStatus: novoEngajamento.status },
        },
      });

      return registro;
    });
  }

  /**
   * FECHA A LACUNA documentada em auditoria.service.ts: este é o primeiro
   * (e único, por enquanto) lugar do sistema que expõe o CONTEÚDO de
   * EngajamentoPolitico para leitura. Por isso:
   *
   *   1. O campo só é incluído na resposta se usuario.permissaoEngajamentoPolitico
   *      for true — igual à regra de escrita.
   *   2. Toda vez que o conteúdo É retornado, chama auditoriaService.registrarLeitura()
   *      ANTES de devolver a resposta. Se a chamada de auditoria falhar, a leitura
   *      inteira falha — não existe "mostrar o dado sensível e tentar logar depois".
   *   3. Se o usuário não tem permissão, o campo simplesmente não aparece
   *      (nem null explícito) — e, corretamente, NENHUM log de leitura é
   *      gerado, porque nenhuma leitura de dado sensível aconteceu.
   */
  async buscarPorId(
    contatoId: string,
    usuario: UsuarioAutenticado,
  ): Promise<ContatoDetalhado> {
    const contato = await this.prisma.contato.findUnique({
      where: { id: contatoId },
      select: {
        id: true,
        nome: true,
        telefone: true,
        whatsapp: true,
        dataNascimento: true,
        endereco: true,
        profissao: true,
        comunidadeId: true,
        comunidade: { select: { id: true, nome: true } },
        criadoEm: true,
      },
    });

    if (!contato) {
      throw new NotFoundException('Contato não encontrado.');
    }

    if (!usuario.permissaoEngajamentoPolitico) {
      return contato; // sem o campo — não é null, é ausente
    }

    const engajamentoVigente = await this.prisma.engajamentoPolitico.findFirst({
      where: { contatoId, vigente: true },
      select: { status: true, origem: true, confianca: true, criadoEm: true, registradoPorId: true },
    });

    // Auditoria ANTES de retornar — se isso falhar, a request falha também,
    // por design (ver docstring acima).
    await this.auditoriaService.registrarLeitura(usuario.id, contatoId);

    return { ...contato, engajamentoPolitico: engajamentoVigente };
  }
}
