import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EmbeddingsService } from './services/embeddings.service';
import { ArtifactsHttpController } from './controllers/http/artifacts.http.controller';
import { ArtifactsAmqpController } from './controllers/amqp/artifacts.amqp.controller';
import { ArtifactsService } from './services/artifacts.service';
import { DataspecerClientService } from './services/dataspecer-client.service';
import { QdrantService } from './services/qdrant.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ClientsModule.register([
      {
        name: 'DATASPECER_ADAPTER',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL as string],
          queue: 'dataspecer_adapter_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [ArtifactsHttpController, ArtifactsAmqpController],
  providers: [ArtifactsService, EmbeddingsService, QdrantService, DataspecerClientService],
})
export class ArtifactsEmbedderModule {}


