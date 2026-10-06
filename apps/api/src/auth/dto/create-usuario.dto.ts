/**
 * login.dto.ts + create-usuario.dto.ts
 */

import { IsString, MinLength, IsEnum, IsOptional, IsBoolean, IsUUID, IsEmail } from 'class-validator';

export enum PerfilUsuarioEnum {
  ADMINISTRADOR = 'administrador',
  COORDENADOR = 'coordenador',
  OPERADOR = 'operador',
  VISUALIZACAO = 'visualizacao',
}

export class CreateUsuarioDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Senha deve ter no mínimo 8 caracteres.' })
  senha: string;

  @IsEnum(PerfilUsuarioEnum)
  perfil: PerfilUsuarioEnum;

  // Só faz sentido para perfil coordenador (ver ContatosService) — mas
  // quem decide isso é o Administrador criando o usuário, não o próprio
  // usuário. Default false por segurança.
  @IsOptional()
  @IsBoolean()
  permissaoEngajamentoPolitico?: boolean = false;

  @IsOptional()
  @IsUUID()
  municipioId?: string;
}
