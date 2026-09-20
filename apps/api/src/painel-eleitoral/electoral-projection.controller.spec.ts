/**
 * electoral-projection.controller.spec.ts
 *
 * Foco: garantir que o RBAC bloqueia Operador e permite os demais perfis
 * para este endpoint específico (a mesma matriz de permissões de
 * Configurações/Painel eleitoral definida no MVP). Testes de cálculo
 * já ficam em electoral-projection.service.spec.ts — aqui é só controle
 * de acesso.
 */

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard, PerfilUsuario, ROLES_KEY } from '../auth/roles.guard';

function mockContext(perfil: PerfilUsuario | undefined, perfisExigidos: PerfilUsuario[]) {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(perfisExigidos);

  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: perfil ? { perfil } : undefined }),
    }),
  } as unknown as ExecutionContext;

  return { reflector, context };
}

describe('RolesGuard aplicado ao endpoint de projeção eleitoral', () => {
  const perfisExigidos = [
    PerfilUsuario.ADMINISTRADOR,
    PerfilUsuario.COORDENADOR,
    PerfilUsuario.VISUALIZACAO,
  ];

  it('permite Administrador', () => {
    const { reflector, context } = mockContext(PerfilUsuario.ADMINISTRADOR, perfisExigidos);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite Coordenador', () => {
    const { reflector, context } = mockContext(PerfilUsuario.COORDENADOR, perfisExigidos);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite Visualização (dado já é agregado)', () => {
    const { reflector, context } = mockContext(PerfilUsuario.VISUALIZACAO, perfisExigidos);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('BLOQUEIA Operador — não tem acesso ao painel eleitoral', () => {
    const { reflector, context } = mockContext(PerfilUsuario.OPERADOR, perfisExigidos);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('bloqueia requisição sem usuário autenticado', () => {
    const { reflector, context } = mockContext(undefined, perfisExigidos);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(false);
  });
});
