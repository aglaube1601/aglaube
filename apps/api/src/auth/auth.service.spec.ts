/**
 * auth.service.spec.ts
 */

import { Test } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { PerfilUsuarioEnum } from './dto/create-usuario.dto';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    prisma = { usuario: { findUnique: jest.fn(), create: jest.fn() } };
    jwtService = { signAsync: jest.fn().mockResolvedValue('token-fake') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('login', () => {
    it('rejeita e-mail inexistente com mensagem GENÉRICA (não revela que o e-mail não existe)', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'naoexiste@x.com', senha: 'qualquer' }),
      ).rejects.toThrow(UnauthorizedException);

      try {
        await service.login({ email: 'naoexiste@x.com', senha: 'qualquer' });
      } catch (e: any) {
        expect(e.message).toBe('E-mail ou senha inválidos.');
      }
    });

    it('rejeita senha incorreta com a MESMA mensagem genérica do e-mail inexistente', async () => {
      const senhaHash = await bcrypt.hash('senha-correta-123', 12);
      prisma.usuario.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@x.com',
        senhaHash,
        nome: 'A',
        perfil: 'operador',
        permissaoEngajamentoPolitico: false,
        municipioId: null,
      });

      try {
        await service.login({ email: 'a@x.com', senha: 'senha-errada' });
        fail('deveria ter lançado');
      } catch (e: any) {
        expect(e.message).toBe('E-mail ou senha inválidos.'); // idêntica à do e-mail inexistente
      }
    });

    it('login funciona com e-mail em caixa/espaçamento diferente do cadastrado (ex: autocapitalização do teclado do celular)', async () => {
      const senhaHash = await bcrypt.hash('senha-correta-123', 12);
      prisma.usuario.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@x.com',
        senhaHash,
        nome: 'A',
        perfil: 'operador',
        permissaoEngajamentoPolitico: false,
        municipioId: null,
      });

      const resultado = await service.login({ email: ' A@X.com ', senha: 'senha-correta-123' });

      expect(prisma.usuario.findUnique).toHaveBeenCalledWith({ where: { email: 'a@x.com' } });
      expect(resultado.accessToken).toBe('token-fake');
    });

    it('login correto retorna token e usuário SEM senhaHash', async () => {
      const senhaHash = await bcrypt.hash('senha-correta-123', 12);
      prisma.usuario.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@x.com',
        senhaHash,
        nome: 'A',
        perfil: 'coordenador',
        permissaoEngajamentoPolitico: true,
        municipioId: 'mun-1',
      });

      const resultado = await service.login({ email: 'a@x.com', senha: 'senha-correta-123' });

      expect(resultado.accessToken).toBe('token-fake');
      expect(resultado.usuario).not.toHaveProperty('senhaHash');
      expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'u1' });
    });
  });

  describe('criarUsuario', () => {
    it('rejeita e-mail já cadastrado', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ id: 'existente' });

      await expect(
        service.criarUsuario({
          nome: 'Novo',
          email: 'ja@existe.com',
          senha: 'senha-1234',
          perfil: PerfilUsuarioEnum.OPERADOR,
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.usuario.create).not.toHaveBeenCalled();
    });

    it('normaliza e-mail (trim + lowercase) antes de checar duplicidade e de salvar', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'x', ...data }));

      await service.criarUsuario({
        nome: 'Novo',
        email: ' Novo@X.com ',
        senha: 'senha-1234',
        perfil: PerfilUsuarioEnum.OPERADOR,
      });

      expect(prisma.usuario.findUnique).toHaveBeenCalledWith({ where: { email: 'novo@x.com' } });
      expect(prisma.usuario.create.mock.calls[0][0].data.email).toBe('novo@x.com');
    });

    it('NUNCA retorna senhaHash na resposta, mesmo que o Prisma retorne o campo', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.create.mockResolvedValue({
        id: 'novo-user',
        nome: 'Novo',
        email: 'novo@x.com',
        senhaHash: 'hash-super-secreto-que-nunca-deve-vazar',
        perfil: 'operador',
        permissaoEngajamentoPolitico: false,
        municipioId: null,
      });

      const resultado = await service.criarUsuario({
        nome: 'Novo',
        email: 'novo@x.com',
        senha: 'senha-1234',
        perfil: PerfilUsuarioEnum.OPERADOR,
      });

      expect(resultado).not.toHaveProperty('senhaHash');
      expect(JSON.stringify(resultado)).not.toContain('hash-super-secreto');
    });

    it('nunca armazena a senha em texto puro — sempre um hash bcrypt', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'x', ...data }));

      await service.criarUsuario({
        nome: 'Novo',
        email: 'novo@x.com',
        senha: 'senha-em-texto-puro',
        perfil: PerfilUsuarioEnum.OPERADOR,
      });

      const dadosCriados = prisma.usuario.create.mock.calls[0][0].data;
      expect(dadosCriados.senhaHash).not.toBe('senha-em-texto-puro');
      expect(dadosCriados).not.toHaveProperty('senha'); // nunca passa o campo cru adiante
      expect(await bcrypt.compare('senha-em-texto-puro', dadosCriados.senhaHash)).toBe(true);
    });

    it('default de permissaoEngajamentoPolitico é false quando não informado', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'x', ...data }));

      const resultado = await service.criarUsuario({
        nome: 'Novo',
        email: 'novo@x.com',
        senha: 'senha-1234',
        perfil: PerfilUsuarioEnum.COORDENADOR,
      });

      expect(resultado.permissaoEngajamentoPolitico).toBe(false);
    });
  });
});
