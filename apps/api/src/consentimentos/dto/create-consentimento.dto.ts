/**
 * create-consentimento.dto.ts
 */

import { IsEnum, IsOptional, IsString } from 'class-validator';
import { FinalidadeComunicacao } from '../../comunicacao/dto/create-campanha.dto';

export enum StatusConsentimento {
  ATIVO = 'ativo',
  OPT_OUT = 'opt_out',
  NAO_PERGUNTADO = 'nao_perguntado',
}

export class CreateConsentimentoDto {
  @IsEnum(FinalidadeComunicacao)
  finalidade: FinalidadeComunicacao;

  @IsEnum(StatusConsentimento)
  status: StatusConsentimento;

  @IsOptional()
  @IsString()
  origem?: string;
}
