import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { ArtifactsEmbedderModule } from './artifacts-embedder.module';

async function bootstrap() {
  const app = await NestFactory.create(ArtifactsEmbedderModule);
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ extended: true, limit: '20mb' }));
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672'],
      queue: 'artifacts_embedder_queue',
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
    .setTitle('Artifacts Embedder API')
    .setDescription('HTTP API for embedding artifacts and semantic search')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.startAllMicroservices();
  const port = process.env.PORT || 3103;
  await app.listen(port as number);
}

bootstrap();


