import { NestFactory } from '@nestjs/core';
import { ChangesSuggesterModule } from './changes-suggester.module';

async function bootstrap() {
  const app = await NestFactory.create(ChangesSuggesterModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
  });
  await app.listen(3102);
}
bootstrap();
