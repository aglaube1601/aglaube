/**
 * auth.controller.ts
 */

import { Body, Controller, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles, RolesGuard, PerfilUsuario } from './roles.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateFotoPerfilDto } from './dto/update-foto-perfil.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Única rota pública de todo o sistema — todas as outras exigem
  // JwtAuthGuard. Não colocar @UseGuards aqui.
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  @Roles(PerfilUsuario.ADMINISTRADOR)
  async criar(@Body() dto: CreateUsuarioDto) {
    return this.authService.criarUsuario(dto);
  }

  // Sem @Roles() de propósito: qualquer perfil autenticado atualiza a
  // PRÓPRIA foto (id vem de @CurrentUser(), nunca do corpo da requisição —
  // não existe como um usuário alterar a foto de outro por aqui).
  //
  // O tipo aqui é só { id } de propósito: é tudo que JwtStrategy.validate()
  // garante estar presente em request.user (ver jwt-auth.guard.ts) — tipar
  // como UsuarioSemSenha completo mentiria sobre campos que não vêm
  // selecionados ali (ex: email).
  @Patch('me/foto-perfil')
  async atualizarMinhaFotoPerfil(
    @CurrentUser() usuario: { id: string },
    @Body() dto: UpdateFotoPerfilDto,
  ) {
    return this.authService.atualizarFotoPerfil(usuario.id, dto.fotoPerfilUrl);
  }
}
