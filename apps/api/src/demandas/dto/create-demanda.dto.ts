/**
 * create-demanda.dto.ts + update-demanda-status.dto.ts
 */

import { IsString, IsNotEmpty, IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';

export enum PrioridadeDemanda {
  BAIXA = 'baixa',
  MEDIA = 'media',
  ALTA = 'alta',
}

export enum StatusDemanda {
  NOVA = 'nova',
  EM_ANALISE = 'em_analise',
  EM_ANDAMENTO = 'em_andamento',
  RESOLVIDA = 'resolvida',
  ENCERRADA = 'encerrada',
}

export class CreateDemandaDto {
  @IsString()
  @IsNotEmpty()
  categoria: string;

  @IsString()
  @IsNotEmpty()
  descricao: string;

  @IsUUID()
  comunidadeId: string;

  @IsOptional()
  @IsUUID()
  contatoId?: string;

  @IsOptional()
  @IsEnum(PrioridadeDemanda)
  prioridade?: PrioridadeDemanda;

  @IsOptional()
  @IsUUID()
  responsavelId?: string;

  @IsOptional()
  @IsDateString()
  prazo?: string;
}

export class UpdateDemandaStatusDto {
  @IsEnum(StatusDemanda)
  novoStatus: StatusDemanda;

  // Só relevante para Admin/Coordenador forçando um pulo de etapa
  // (ex: encerrar demanda duplicada sem passar por todo o fluxo)
  @IsOptional()
  @IsString()
  justificativaForcarTransicao?: string;
}
