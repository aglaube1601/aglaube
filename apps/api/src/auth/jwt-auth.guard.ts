/**
 * jwt-auth.guard.ts + jwt.strategy.ts
 *
 * Guard e estratégia JWT. O decorator @CurrentUser() vive em
 * current-user.decorator.ts (arquivo próprio). Login e criação de usuário
 * (o gap sinalizado no handoff) ficam em auth.service.ts / auth.controller.ts —
 * este arquivo só valida o token e popula request.user.
 */

import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

// ---------- Estratégia JWT ----------

export interface JwtPayload {
  sub: string; // usuarioId
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        nome: true,
        perfil: true,
        permissaoEngajamentoPolitico: true,
        municipioId: true,
      },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuário do token não existe mais.');
    }

    // Isto é o que popula request.user — usado por RolesGuard e @CurrentUser()
    return usuario;
  }
}

// ---------- Guard ----------

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
