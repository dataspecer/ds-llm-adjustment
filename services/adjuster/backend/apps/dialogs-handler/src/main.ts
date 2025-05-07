import { NestFactory } from '@nestjs/core';
import { DialogsHandlerModule } from './dialogs-handler.module';

async function bootstrap() {
  const app = await NestFactory.create(DialogsHandlerModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
  });
  await app.listen(3103);
}
bootstrap();
