import { NestFactory } from '@nestjs/core';
import { ChangesDetectorModule } from './changes-detector.module';

async function bootstrap() {
  const app = await NestFactory.create(ChangesDetectorModule);
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
  });
  await app.listen(3101);
}
bootstrap();
