import { NestFactory } from '@nestjs/core';
import { DialogsHandlerModule } from './dialogs-handler.module';

async function bootstrap() {
  const app = await NestFactory.create(DialogsHandlerModule);
  
  // Set global prefix for all routes
  app.setGlobalPrefix('api');
  
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept'],
  });
  
  const port = process.env.PORT || 3100;
  await app.listen(port);
  console.log(`Dialogs Handler is running on port ${port}`);
}
bootstrap();
