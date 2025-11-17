import { NestFactory } from '@nestjs/core';
import { DialogsHandlerModule } from './dialogs-handler.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { registerMcpHandlers } from '@app/common/mcp/server';

async function bootstrap() {
  const app = await NestFactory.create(DialogsHandlerModule);
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ extended: true, limit: '20mb' }));
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL as string],
      queue: 'dialogs_handler_queue',
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
    .setTitle('Dialogs Handler API')
    .setDescription('HTTP API for dialogs handling')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = process.env.PORT || 3100;

  // MCP integration (official SDK when available, with fallback)
  if (String(process.env.MCP_ENABLED || '').toLowerCase() === '1' || String(process.env.MCP_ENABLED || '').toLowerCase() === 'true') {
    const basePath = process.env.MCP_BASE_PATH || '/api/mcp';
    const authSecret = process.env.MCP_AUTH_SECRET;
    const httpAdapter = app.getHttpAdapter();
    const expressApp = httpAdapter.getInstance?.() || (httpAdapter as any);
    registerMcpHandlers(expressApp, { basePath, authSecret });
  }

  await app.startAllMicroservices();
  await app.listen(port);
  console.log(`Dialogs Handler is running on port ${port}`);
}
bootstrap();
