/**
 * roles.decorator.ts + roles.guard.ts
 *
 * Implementação mínima do RBAC granular definido no schema (Usuario.perfil).
 * Outros controllers do projeto (Contatos, Demandas, EngajamentoPolitico...)
 * devem reusar este mesmo par decorator/guard — não criar um RBAC paralelo
 * por módulo.
 */

import { SetMetadata, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export enum PerfilUsuario {
  ADMINISTRADOR = 'administrador',
  COORDENADOR = 'coordenador',
  OPERADOR = 'operador',
  VISUALIZACAO = 'visualizacao',
}

export const ROLES_KEY = 'roles';
export const Roles = (...perfis: PerfilUsuario[]) => SetMetadata(ROLES_KEY, perfis);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const perfisPermitidos = this.reflector.getAllAndOverride<PerfilUsuario[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sem @Roles() no handler => rota não é restrita por perfil (ainda assim
    // deve estar atrás de JwtAuthGuard para exigir login)
    if (!perfisPermitidos || perfisPermitidos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const usuario = request.user; // populado pelo JwtAuthGuard/JwtStrategy

    if (!usuario) {
      return false;
    }

    return perfisPermitidos.includes(usuario.perfil);
  }
}
