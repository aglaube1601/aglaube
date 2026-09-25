/**
 * create-campanha.dto.ts
 */

import { IsString, IsNotEmpty, IsOptional, IsUUID, IsEnum } from 'class-validator';

export enum TipoTemplate {
  ANIVERSARIO = 'aniversario',
  NOTICIA = 'noticia',
  LEMBRETE_EVENTO = 'lembrete_evento',
  CONVITE_EVENTO = 'convite_evento',
  RESPOSTA_DEMANDA = 'resposta_demanda',
}

export enum FinalidadeComunicacao {
  COMUNICACAO_INSTITUCIONAL = 'comunicacao_institucional',
  OUTRA = 'outra',
}

export enum CriterioPublico {
  ANIVERSARIANTES_SEMANA = 'aniversariantes_semana',
  POR_COMUNIDADE = 'por_comunidade',
  TODOS_COM_CONSENTIMENTO = 'todos_com_consentimento',
  LIDERANCAS_E_APOIADORES = 'liderancas_e_apoiadores',
}

export class CreateCampanhaDto {
  @IsEnum(TipoTemplate)
  tipoTemplate: TipoTemplate;

  @IsString()
  @IsNotEmpty()
  corpoMensagem: string; // pode conter {{primeiro_nome}}

  @IsEnum(CriterioPublico)
  criterioPublico: CriterioPublico;

  @IsOptional()
  @IsUUID()
  comunidadeId?: string; // obrigatório só quando criterioPublico = POR_COMUNIDADE

  @IsOptional()
  @IsEnum(FinalidadeComunicacao)
  finalidade?: FinalidadeComunicacao = FinalidadeComunicacao.COMUNICACAO_INSTITUCIONAL;

  // Confirmação explícita da coordenação de que revisou o alerta de
  // possível propaganda antecipada (ver ComunicacaoService.detectarRiscoPropaganda).
  // Sem isso, um template sinalizado nunca é enviado, mesmo por Admin.
  @IsOptional()
  revisadoPelaCoordenacao?: boolean;
}
