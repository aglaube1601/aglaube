/**
 * create-contato.dto.ts
 *
 * comunidadeId é obrigatório por regra de negócio (seção 3 do MVP):
 * sem território, a territorialização do sistema inteiro quebra.
 * engajamentoPolitico é aceito aqui, mas o SERVICE decide se ele é
 * persistido — depende da permissão do usuário autenticado, nunca
 * de o campo estar ou não presente no payload.
 */

import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  ValidateNested,
  IsDateString,
} from 'class-validator';

export enum StatusEngajamento {
  APOIADOR = 'apoiador',
  SIMPATIZANTE = 'simpatizante',
  NEUTRO = 'neutro',
  PERCEPCAO_NEGATIVA = 'percepcao_negativa',
  DESCONHECIDO = 'desconhecido',
}

export enum OrigemEngajamento {
  AUTODECLARADO = 'autodeclarado',
  PERCEPCAO_LIDERANCA = 'percepcao_lideranca',
  PERCEPCAO_EQUIPE = 'percepcao_equipe',
}

export enum ConfiancaEngajamento {
  ALTA = 'alta',
  MEDIA = 'media',
  BAIXA = 'baixa',
}

export class EngajamentoPoliticoInputDto {
  @IsEnum(StatusEngajamento)
  status: StatusEngajamento;

  @IsEnum(OrigemEngajamento)
  origem: OrigemEngajamento;

  @IsEnum(ConfiancaEngajamento)
  confianca: ConfiancaEngajamento;
}

export class CreateContatoDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsDateString()
  dataNascimento?: string;

  @IsOptional()
  @IsString()
  endereco?: string;

  // Obrigatório — ver nota acima
  @IsUUID()
  comunidadeId: string;

  @IsOptional()
  @IsString()
  profissao?: string;

  @IsOptional()
  @IsString()
  origemCadastro?: string;

  // Presente no payload não significa que será salvo — ver ContatosService
  @IsOptional()
  @ValidateNested()
  @Type(() => EngajamentoPoliticoInputDto)
  engajamentoPolitico?: EngajamentoPoliticoInputDto;

  // Ignora possíveis duplicatas já revisadas pelo usuário e confirma
  // que é pessoa diferente (ver ContatosService.buscarPossiveisDuplicatas)
  @IsOptional()
  ignorarDuplicatasIds?: string[];
}

/**
 * UpdateContatoDto — edição dos campos básicos de um contato já cadastrado.
 *
 * Propositalmente NÃO inclui comunidadeId nem engajamentoPolitico:
 * - comunidadeId: trocar o território de um contato via edição genérica
 *   contorna a territorialização do sistema sem passar pelas mesmas
 *   checagens de criação; se isso virar necessário, deve ser uma rota
 *   própria e auditada, igual ao engajamento.
 * - engajamentoPolitico: já tem rota própria (PUT /:id/engajamento) com
 *   RBAC mais restrito e histórico versionado — não pode ser editado por
 *   aqui.
 * Todos os campos são opcionais porque uma edição pode tocar só um deles
 * (ex.: só telefone).
 */
export class UpdateContatoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nome?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsDateString()
  dataNascimento?: string;

  @IsOptional()
  @IsString()
  endereco?: string;

  @IsOptional()
  @IsString()
  profissao?: string;

  // Mesmo uso do campo de mesmo nome em CreateContatoDto — confirma que o
  // candidato apontado pela checagem de dedup é pessoa diferente.
  @IsOptional()
  ignorarDuplicatasIds?: string[];
}
