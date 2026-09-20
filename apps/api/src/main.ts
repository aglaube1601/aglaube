import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET não definido no ambiente — obrigatório para subir a API.');
  }

  const app = await NestFactory.create(AppModule);

  // whitelist: true descarta silenciosamente campos não esperados no DTO —
  // importante especialmente em CreateUsuarioDto, onde um campo extra não
  // deve nem chegar perto do service.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
