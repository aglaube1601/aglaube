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
      consentimento: { findMany: jest.fn().mockResolvedValue([]) },
      campanhaComunicacao: { create: jest.fn() },
      envioMensagem: { create: jest.fn(), delete: jest.fn() },
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

    it('exclui contato sem nenhum registro de consentimento', async () => {
      prisma.contato.findMany.mockResolvedValue([{ id: 'c1' }]);
      prisma.consentimento.findMany.mockResolvedValue([]);

      const elegiveis = await service.buscarDestinatariosElegiveis(
        'municipio-1',
        CriterioPublico.TODOS_COM_CONSENTIMENTO,
        FinalidadeComunicacao.COMUNICACAO_INSTITUCIONAL,
      );

      expect(elegiveis).toEqual([]);
    });

    it('inclui contato cujo consentimento MAIS RECENTE está ativo', async () => {
      prisma.contato.findMany.mockResolvedValue([{ id: 'c1' }]);
      prisma.consentimento.findMany.mockResolvedValue([{ contatoId: 'c1', status: 'ativo' }]);

      const elegiveis = await service.buscarDestinatariosElegiveis(
        'municipio-1',
        CriterioPublico.TODOS_COM_CONSENTIMENTO,
        FinalidadeComunicacao.COMUNICACAO_INSTITUCIONAL,
      );

      expect(elegiveis).toEqual(['c1']);
    });

    it('EXCLUI contato que já foi "ativo" mas revogou depois — nunca soma "algum dia foi ativo"', async () => {
      prisma.contato.findMany.mockResolvedValue([{ id: 'c1' }]);
      // orderBy: data desc — o mock já entrega na ordem que o service espera
      // receber do banco: o registro mais recente (opt_out) primeiro.
      prisma.consentimento.findMany.mockResolvedValue([
        { contatoId: 'c1', status: 'opt_out' },
        { contatoId: 'c1', status: 'ativo' },
      ]);

      const elegiveis = await service.buscarDestinatariosElegiveis(
        'municipio-1',
        CriterioPublico.TODOS_COM_CONSENTIMENTO,
        FinalidadeComunicacao.COMUNICACAO_INSTITUCIONAL,
      );

      expect(elegiveis).toEqual([]);
    });

    it('não consulta consentimento quando não há candidatos por território/critério', async () => {
      prisma.contato.findMany.mockResolvedValue([]);

      await service.buscarDestinatariosElegiveis(
        'municipio-1',
        CriterioPublico.TODOS_COM_CONSENTIMENTO,
        FinalidadeComunicacao.COMUNICACAO_INSTITUCIONAL,
      );

      expect(prisma.consentimento.findMany).not.toHaveBeenCalled();
    });
  });

  describe('critério aniversariantes da semana — compara só mês/dia, com virada de ano', () => {
    // Acessa o método privado direto: é a unidade de regra de negócio
    // relevante aqui, testar só via buscarDestinatariosElegiveis exigiria
    // reconstruir a data "hoje" real a cada corrida de teste.
    function aniversario(dataNascimento: Date, hoje: Date, dias = 7): boolean {
      return (service as any).aniversarioNosProximosDias(dataNascimento, hoje, dias);
    }

    it('inclui aniversário HOJE', () => {
      const hoje = new Date(2026, 8, 20); // 20/set/2026
      expect(aniversario(new Date(1990, 8, 20), hoje)).toBe(true);
    });

    it('inclui aniversário exatamente no limite (+7 dias)', () => {
      const hoje = new Date(2026, 8, 20);
      expect(aniversario(new Date(1985, 8, 27), hoje)).toBe(true);
    });

    it('EXCLUI aniversário fora da janela (+8 dias)', () => {
      const hoje = new Date(2026, 8, 20);
      expect(aniversario(new Date(1985, 8, 28), hoje)).toBe(false);
    });

    it('EXCLUI aniversário que já passou (ontem)', () => {
      const hoje = new Date(2026, 8, 20);
      expect(aniversario(new Date(1985, 8, 19), hoje)).toBe(false);
    });

    it('atravessa a virada do ano corretamente (29/dez -> 5/jan)', () => {
      const hoje = new Date(2026, 11, 29); // 29/dez/2026
      // 3/jan cai dentro da janela mesmo sendo "ano anterior" no calendário
      expect(aniversario(new Date(1992, 0, 3), hoje)).toBe(true);
      // 6/jan já é o 8º dia — fora da janela
      expect(aniversario(new Date(1992, 0, 6), hoje)).toBe(false);
    });

    it('buscarDestinatariosElegiveis filtra por mês/dia e aplica consentimento ativo', async () => {
      const hoje = new Date();
      const aniversarianteHoje = new Date(1990, hoje.getMonth(), hoje.getDate());
      const foraDaJanela = new Date(1990, (hoje.getMonth() + 6) % 12, 15);

      prisma.contato.findMany.mockResolvedValue([
        { id: 'c1', dataNascimento: aniversarianteHoje },
        { id: 'c2', dataNascimento: foraDaJanela },
      ]);
      prisma.consentimento.findMany.mockResolvedValue([{ contatoId: 'c1', status: 'ativo' }]);

      const elegiveis = await service.buscarDestinatariosElegiveis(
        'municipio-1',
        CriterioPublico.ANIVERSARIANTES_SEMANA,
        FinalidadeComunicacao.COMUNICACAO_INSTITUCIONAL,
      );

      expect(elegiveis).toEqual(['c1']);
      // dataNascimento: not null precisa estar no where — nunca a base inteira
      expect(prisma.contato.findMany.mock.calls[0][0].where.dataNascimento).toEqual({ not: null });
    });
  });

  describe('idempotência de envio', () => {
    it('enfileira um envio por destinatário elegível', async () => {
      prisma.contato.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
      prisma.consentimento.findMany.mockResolvedValue([
        { contatoId: 'c1', status: 'ativo' },
        { contatoId: 'c2', status: 'ativo' },
      ]);
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
      prisma.consentimento.findMany.mockResolvedValue([{ contatoId: 'c1', status: 'ativo' }]);
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
      prisma.consentimento.findMany.mockResolvedValue([{ contatoId: 'c1', status: 'ativo' }]);
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

    it('desfaz o EnvioMensagem já criado se enfileirar falhar (nunca deixa "pendente" órfão)', async () => {
      prisma.contato.findMany.mockResolvedValue([{ id: 'c1' }]);
      prisma.consentimento.findMany.mockResolvedValue([{ contatoId: 'c1', status: 'ativo' }]);
      prisma.campanhaComunicacao.create.mockResolvedValue({ id: 'camp-1' });
      prisma.envioMensagem.create.mockResolvedValue({ id: 'envio-1' });
      filaEnvio.enfileirar.mockRejectedValueOnce(new Error('Redis indisponível'));

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
      ).rejects.toThrow('Redis indisponível');

      expect(prisma.envioMensagem.delete).toHaveBeenCalledWith({ where: { id: 'envio-1' } });
    });
  });
});
