import { NestFactory } from '@nestjs/core';
import { DataspecerAdapterModule } from './dataspecer-adapter.module';

async function bootstrap() {
  const app = await NestFactory.create(DataspecerAdapterModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
  });
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
