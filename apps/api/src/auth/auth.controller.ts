/**
 * auth.controller.ts
 */

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Roles, RolesGuard, PerfilUsuario } from './roles.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUsuarioDto } from './dto/create-usuario.dto';

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
}
