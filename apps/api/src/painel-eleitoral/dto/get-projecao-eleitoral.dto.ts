/**
 * get-projecao-eleitoral.dto.ts
 *
 * Query params do endpoint de projeção eleitoral. As premissas (retenção,
 * crescimento) são OPCIONAIS e sempre ajustáveis pelo coordenador — nunca
 * fixas — conforme decidido no design do módulo.
 */

import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, Max, IsNumber } from 'class-validator';

export class GetProjecaoEleitoralDto {
  @Type(() => Number)
  @IsInt()
  eleicaoAnoBase: number;

  @Type(() => Number)
  @IsInt()
  candidatoSituacionistaNumero: number;

  @Type(() => Number)
  @IsInt()
  candidatoOposicaoNumero: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  retencaoMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  retencaoMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-0.5)
  @Max(0.5)
  taxaCrescimentoAnual?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  anosProjecao?: number;
}
