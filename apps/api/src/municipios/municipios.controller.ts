/**
 * municipios.controller.ts + municipios.service.ts
 *
 * Propositalmente mínimo, mesmo espírito de comunidades.controller.ts:
 * só leitura, para o frontend descobrir qual município carregar (MVP é
 * de município único — Vila Nova do Piauí — mas o dado não pode ficar
 * hardcoded no cliente, porque o id é gerado pelo seed). Um CRUD de
 * município fica para a fase SaaS multi-município.
 */

import { Controller, Get, Injectable, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MunicipiosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar() {
    return this.prisma.municipio.findMany({
      select: { id: true, nome: true, uf: true },
      orderBy: { nome: 'asc' },
    });
  }
}

@UseGuards(JwtAuthGuard)
@Controller('municipios')
export class MunicipiosController {
  constructor(private readonly municipiosService: MunicipiosService) {}

  // Sem @Roles() — qualquer perfil autenticado pode ler a lista de
  // municípios; é pré-requisito de navegação, não dado sensível.
  @Get()
  async listar() {
    return this.municipiosService.listar();
  }
}
