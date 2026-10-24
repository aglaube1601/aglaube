/**
 * create-interacao.dto.ts
 */

import { IsString, IsNotEmpty, IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';

export enum TipoInteracao {
  LIGACAO = 'ligacao',
  MENSAGEM = 'mensagem',
  REUNIAO = 'reuniao',
  VISITA = 'visita',
  EVENTO = 'evento',
  DEMANDA = 'demanda',
  OBSERVACAO = 'observacao',
  TAREFA = 'tarefa',
  RETORNO_AGENDADO = 'retorno_agendado',
}

export class CreateInteracaoDto {
  @IsUUID()
  contatoId: string;

  @IsEnum(TipoInteracao)
  tipo: TipoInteracao;

  @IsString()
  @IsNotEmpty()
  descricao: string;

  @IsOptional()
  @IsDateString()
  data?: string; // default: agora — só usado para registro retroativo

  // Referência opcional a um registro de EngajamentoPolitico já criado
  // via ContatosService.atualizarEngajamento(). A interação NÃO cria nem
  // altera engajamento diretamente — apenas linka o registro se o usuário
  // tinha permissão para tê-lo criado antes. Ver InteracoesService.
  @IsOptional()
  @IsUUID()
  engajamentoPoliticoId?: string;
}
