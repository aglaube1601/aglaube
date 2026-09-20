/**
 * comunicacao.service.spec.ts
 */

import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ComunicacaoService } from './comunicacao.service';
import { PrismaService } from '../prisma/prisma.service';
import { FilaEnvioService } from './fila-envio.service';
import { CriterioPublico, FinalidadeComunicacao, TipoTemplate } from './dto/create-campanha.dto';
import { UsuarioAutenticado } from '../contatos/contatos.service';

describe('ComunicacaoService', () => {
  let service: ComunicacaoService;
  let prisma: any;
  let filaEnvio: { enfileirar: jest.Mock };

  const usuario: UsuarioAutenticado = {
    id: 'user-1',
    perfil: 'coordenador',
    permissaoEngajamentoPolitico: true,
  };

  beforeEach(async () => {
    prisma = {
      contato: { findMany: jest.fn() },
      campanhaComunicacao: { create: jest.fn() },
      envioMensagem: { create: jest.fn() },
    };
    filaEnvio = { enfileirar: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ComunicacaoService,
        { provide: PrismaService, useValue: prisma },
        { provide: FilaEnvioService, useValue: filaEnvio },
      ],
    }).compile();

    service = moduleRef.get(ComunicacaoService);
  });

  describe('detectarRiscoPropaganda', () => {
    it('sinaliza mensagem com termo de risco', () => {
      expect(service.detectarRiscoPropaganda('Vote 12, apoie minha candidatura!')).toBe(true);
      expect(service.detectarRiscoPropaganda('Feliz aniversário! Um abraço da equipe.')).toBe(false);
    });

    it('é case-insensitive', () => {
      expect(service.detectarRiscoPropaganda('VOTE já!')).toBe(true);
    });
  });

  describe('bloqueio de envio sem revisão', () => {
    it('BLOQUEIA criação de campanha com template sinalizado e sem revisadoPelaCoordenacao', async () => {
      await expect(
        service.criarCampanha(
          {
            tipoTemplate: TipoTemplate.NOTICIA,
            corpoMensagem: 'Vote em nosso candidato!',
            criterioPublico: CriterioPublico.TODOS_COM_CONSENTIMENTO,
          } as any,
          'municipio-1',
          usuario,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.campanhaComunicacao.create).not.toHaveBeenCalled();
    });

    it('PERMITE envio de template sinalizado se revisadoPelaCoordenacao=true', async () => {
      prisma.contato.findMany.mockResolvedValue([]);
      prisma.campanhaComunicacao.create.mockResolvedValue({ id: 'camp-1' });

      const resultado = await service.criarCampanha(
        {
          tipoTemplate: TipoTemplate.NOTICIA,
          corpoMensagem: 'Vote em nosso candidato!',
          criterioPublico: CriterioPublico.TODOS_COM_CONSENTIMENTO,
          revisadoPelaCoordenacao: true,
        } as any,
        'municipio-1',
        usuario,
      );

      expect(resultado.sinalizadoParaRevisao).toBe(true);
      expect(prisma.campanhaComunicacao.create).toHaveBeenCalled();
    });
  });

  describe('filtro de público por consentimento', () => {
    it('exige comunidadeId quando critério é POR_COMUNIDADE', async () => {
      await expect(
        service.buscarDestinatariosElegiveis(
          'municipio-1',
          CriterioPublico.POR_COMUNIDADE,
          FinalidadeComunicacao.COMUNICACAO_INSTITUCIONAL,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('inclui filtro de consentimento ativo em toda consulta, independente do critério', async () => {
      prisma.contato.findMany.mockResolvedValue([]);

      await service.buscarDestinatariosElegiveis(
        'municipio-1',
        CriterioPublico.TODOS_COM_CONSENTIMENTO,
        FinalidadeComunicacao.COMUNICACAO_INSTITUCIONAL,
      );

      const args = prisma.contato.findMany.mock.calls[0][0];
      expect(args.where.consentimentos).toEqual({
        some: { finalidade: FinalidadeComunicacao.COMUNICACAO_INSTITUCIONAL, status: 'ativo' },
      });
    });
  });

  describe('idempotência de envio', () => {
    it('enfileira um envio por destinatário elegível', async () => {
      prisma.contato.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
      prisma.campanhaComunicacao.create.mockResolvedValue({ id: 'camp-1' });
      prisma.envioMensagem.create.mockResolvedValue({});

      const resultado = await service.criarCampanha(
        {
          tipoTemplate: TipoTemplate.ANIVERSARIO,
          corpoMensagem: 'Feliz aniversário!',
          criterioPublico: CriterioPublico.TODOS_COM_CONSENTIMENTO,
        } as any,
        'municipio-1',
        usuario,
      );

      expect(resultado.enviosEnfileirados).toBe(2);
      expect(filaEnvio.enfileirar).toHaveBeenCalledTimes(2);
    });

    it('trata violação de unique constraint (P2002) como duplicidade esperada, não erro', async () => {
      prisma.contato.findMany.mockResolvedValue([{ id: 'c1' }]);
      prisma.campanhaComunicacao.create.mockResolvedValue({ id: 'camp-1' });
      prisma.envioMensagem.create.mockRejectedValue({ code: 'P2002' });

      const resultado = await service.criarCampanha(
        {
          tipoTemplate: TipoTemplate.ANIVERSARIO,
          corpoMensagem: 'Feliz aniversário!',
          criterioPublico: CriterioPublico.TODOS_COM_CONSENTIMENTO,
        } as any,
        'municipio-1',
        usuario,
      );

      expect(resultado.enviosIgnoradosPorDuplicidade).toBe(1);
      expect(resultado.enviosEnfileirados).toBe(0);
      // Não deveria ter enfileirado na fila um envio que o banco rejeitou
      expect(filaEnvio.enfileirar).not.toHaveBeenCalled();
    });

    it('propaga erro que NÃO é de duplicidade (não mascara bug real)', async () => {
      prisma.contato.findMany.mockResolvedValue([{ id: 'c1' }]);
      prisma.campanhaComunicacao.create.mockResolvedValue({ id: 'camp-1' });
      prisma.envioMensagem.create.mockRejectedValue(new Error('conexão com banco perdida'));

      await expect(
        service.criarCampanha(
          {
            tipoTemplate: TipoTemplate.ANIVERSARIO,
            corpoMensagem: 'Feliz aniversário!',
            criterioPublico: CriterioPublico.TODOS_COM_CONSENTIMENTO,
          } as any,
          'municipio-1',
          usuario,
        ),
      ).rejects.toThrow('conexão com banco perdida');
    });
  });
});
