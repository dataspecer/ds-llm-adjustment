import { NestFactory } from '@nestjs/core';
import { ChangesSuggesterModule } from './changes-suggester.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(ChangesSuggesterModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672'],
      queue: 'changes_suggester_queue',
      queueOptions: { durable: true },
    },
  });
  app.setGlobalPrefix('api');

  const corsOriginEnv = process.env.CORS_ORIGIN || 'http://localhost:3001';
  const corsOrigins = corsOriginEnv.split(',').map((s) => s.trim());
  app.enableCors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With'],
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Changes Suggester API')
    .setDescription('HTTP API for generating change suggestions')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);
  await app.startAllMicroservices();
  await app.listen(3102);
}
bootstrap();
