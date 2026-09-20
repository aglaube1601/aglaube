import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET não definido no ambiente — obrigatório para subir a API.');
  }

  const app = await NestFactory.create(AppModule);

  // CORS: necessário pro frontend (apps/web, outra origem/porta) chamar a
  // API do navegador. CORS_ORIGIN restringe em produção; sem ela, aceita
  // qualquer origem — aceitável no estágio atual (MVP, sem deploy público).
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? true });

  // whitelist: true descarta silenciosamente campos não esperados no DTO —
  // importante especialmente em CreateUsuarioDto, onde um campo extra não
  // deve nem chegar perto do service.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
