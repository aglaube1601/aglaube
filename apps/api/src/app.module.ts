/**
 * app.module.ts + main.ts
 *
 * Últimas duas peças que faltavam no mapa de pastas. Sem o JwtModule
 * configurado aqui com o secret/expiração, o JwtStrategy e o
 * AuthService.login() (que assina o token) não têm como funcionar juntos
 * — é o fio que faltava conectar entre auth.service.ts e jwt-auth.guard.ts.
 */

import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

import { PrismaService } from './prisma/prisma.service';
import { JwtStrategy } from './auth/jwt-auth.guard';
import { AuthService } from './auth/auth.service';
import { AuthController, UsuariosController } from './auth/auth.controller';
import { HealthController } from './health.controller';

import { ContatosService } from './contatos/contatos.service';
import { ContatosController } from './contatos/contatos.controller';
import { ComunidadesService, ComunidadesController } from './comunidades/comunidades.controller';
import { MunicipiosService, MunicipiosController } from './municipios/municipios.controller';
import {
  ConsentimentosService,
  ConsentimentosController,
} from './consentimentos/consentimentos.controller';
import { DemandasService } from './demandas/demandas.service';
import { DemandasController } from './demandas/demandas.controller';
import { InteracoesService } from './interacoes/interacoes.service';
import { InteracoesController } from './interacoes/interacoes.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { MapaService } from './mapa/mapa.service';
import { MapaController } from './mapa/mapa.controller';
import { ElectoralProjectionService } from './painel-eleitoral/electoral-projection.service';
import { ElectoralProjectionController } from './painel-eleitoral/electoral-projection.controller';
import { AuditoriaService } from './auditoria/auditoria.service';
import { AuditoriaController } from './auditoria/auditoria.controller';
import { ComunicacaoService } from './comunicacao/comunicacao.service';
import { ComunicacaoController } from './comunicacao/comunicacao.controller';
import { FilaEnvioService } from './comunicacao/fila-envio.service';
import { EnvioWorker } from './comunicacao/envio.worker';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' },
    }),
  ],
  controllers: [
    HealthController,
    AuthController,
    UsuariosController,
    ContatosController,
    ComunidadesController,
    MunicipiosController,
    ConsentimentosController,
    DemandasController,
    InteracoesController,
    DashboardController,
    MapaController,
    ElectoralProjectionController,
    AuditoriaController,
    ComunicacaoController,
  ],
  providers: [
    PrismaService,
    JwtStrategy,
    AuthService,
    ContatosService,
    ComunidadesService,
    MunicipiosService,
    ConsentimentosService,
    DemandasService,
    InteracoesService,
    DashboardService,
    MapaService,
    ElectoralProjectionService,
    AuditoriaService,
    ComunicacaoService,
    FilaEnvioService,
    EnvioWorker,
  ],
})
export class AppModule {}

