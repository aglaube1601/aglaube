/**
 * auth.service.ts
 *
 * Fecha a lacuna sinalizada no handoff: até aqui, JwtStrategy assumia que
 * usuários já existiam no banco, mas não havia como criá-los nem fazer
 * login. Duas coisas importantes de design aqui:
 *
 * 1. Senha nunca é logada, nunca retorna em nenhuma resposta — nem hash.
 *    O DTO de retorno de criarUsuario() é explicitamente montado campo a
 *    campo, nunca um spread do registro do Prisma (que incluiria senhaHash).
 * 2. Criação de usuário é SEMPRE por um Administrador já autenticado — não
 *    existe endpoint público de "criar minha conta". O primeiro admin do
 *    sistema nasce via seed (ver seed-admin-usuario.ts), não pela API.
 */

import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { LoginDto } from './dto/login.dto';

const SALT_ROUNDS = 12;

export interface UsuarioSemSenha {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  permissaoEngajamentoPolitico: boolean;
  municipioId: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string; usuario: UsuarioSemSenha }> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email: dto.email } });

    // Mensagem genérica de propósito — não revela se foi o e-mail ou a
    // senha que estavam errados (evita enumeração de e-mails cadastrados).
    const credenciaisInvalidas = () =>
      new UnauthorizedException('E-mail ou senha inválidos.');

    if (!usuario) {
      throw credenciaisInvalidas();
    }

    const senhaConfere = await bcrypt.compare(dto.senha, usuario.senhaHash);
    if (!senhaConfere) {
      throw credenciaisInvalidas();
    }

    const accessToken = await this.jwtService.signAsync({ sub: usuario.id });

    return { accessToken, usuario: this.paraRespostaSemSenha(usuario) };
  }

  /**
   * Só chamado a partir de um endpoint protegido por
   * @Roles(PerfilUsuario.ADMINISTRADOR) — a checagem de "quem pode criar
   * usuário" é RBAC de rota, não repetida aqui, mas o service não confia
   * cegamente nisso: mesmo assim nunca aceita perfil inválido (o enum do
   * DTO já impede) e nunca deixa permissaoEngajamentoPolitico=true vazar
   * sem ter sido setado explicitamente por quem está criando.
   */
  async criarUsuario(dto: CreateUsuarioDto): Promise<UsuarioSemSenha> {
    const existente = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (existente) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }

    const senhaHash = await bcrypt.hash(dto.senha, SALT_ROUNDS);

    const usuario = await this.prisma.usuario.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        senhaHash,
        perfil: dto.perfil,
        permissaoEngajamentoPolitico: dto.permissaoEngajamentoPolitico ?? false,
        municipioId: dto.municipioId,
      },
    });

    return this.paraRespostaSemSenha(usuario);
  }

  private paraRespostaSemSenha(usuario: {
    id: string;
    nome: string;
    email: string;
    perfil: string;
    permissaoEngajamentoPolitico: boolean;
    municipioId: string | null;
  }): UsuarioSemSenha {
    // Montagem campo a campo — nunca um spread do objeto do Prisma.
    // Um spread ali dentro é exatamente o tipo de mudança "inofensiva"
    // que um PR futuro poderia introduzir e vazar senhaHash sem ninguém notar.
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      permissaoEngajamentoPolitico: usuario.permissaoEngajamentoPolitico,
      municipioId: usuario.municipioId,
    };
  }
}
