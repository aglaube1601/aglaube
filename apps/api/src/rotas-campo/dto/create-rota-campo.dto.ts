/**
 * create-rota-campo.dto.ts + atualizar-parada.dto.ts
 */

import { ArrayMinSize, IsArray, IsEnum, IsUUID } from 'class-validator';

export enum StatusParada {
  PENDENTE = 'pendente',
  VISITADO = 'visitado',
  AUSENTE = 'ausente',
  RECUSOU = 'recusou',
}

export class CreateRotaCampoDto {
  @IsUUID()
  comunidadeId: string;

  // Quem vai executar a rota em campo — qualquer Usuario (tipicamente
  // Operador), nunca uma Lideranca: Lideranca é só um rótulo em cima de
  // um Contato, sem login no sistema (ver schema.prisma).
  @IsUUID()
  responsavelId: string;

  // Ordem da rota = ordem deste array (índice vira ParadaRota.ordem).
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  contatoIds: string[];
}

export class AtualizarParadaDto {
  @IsEnum(StatusParada)
  status: StatusParada;
}
