import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { DialogAmqpController } from './controllers/amqp/dialog/dialog.amqp.controller';
import { IDialogService } from './services/interfaces/dialog/dialog-service.interface';
import { DialogService } from './services/dialog/dialog.service';
import { ChatMessageEntity } from './entities/chat-message.entity';
import { SharedAnalysisEntity } from './entities/shared-analysis.entity';
import { SpecificationDialogController } from './controllers/http/specification-dialog/specification-dialog.controller';
import { SpecificationProcessorService } from './services/specification-processor/specification-processor.service';
import { SpecificationMaintainerController } from './controllers/http/specification-maintainer/specification-maintainer.controller';
import { SpecificationMaintainerService } from './services/specification-maintainer/specification-maintainer.service';
import { LlmChatService } from './services/specification-maintainer/llm-chat.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ClientsModule.register([
      {
        name: 'CHANGES_DETECTOR',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672'],
          queue: 'changes_detector_queue',
          queueOptions: { durable: true },
        },
      },
      {
        name: 'CHANGES_SUGGESTER',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672'],
          queue: 'changes_suggester_queue',
          queueOptions: { durable: true },
        },
      },
      {
        name: 'DATASPECER_ADAPTER',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672'],
          queue: 'dataspecer_adapter_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get('DATABASE_URL') || 'postgresql://adjuster:adjuster123@postgres:5432/adjuster';
        return {
          type: 'postgres',
          url: databaseUrl,
          entities: [ChatMessageEntity, SharedAnalysisEntity],
          synchronize: true,
          logging: configService.get('NODE_ENV') === 'development',
          ssl: false,
          extra: {
            max: 10,
            connectionTimeoutMillis: 30000,
          },
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([ChatMessageEntity, SharedAnalysisEntity])
  ],
  controllers: [DialogAmqpController, SpecificationDialogController, SpecificationMaintainerController],
  providers: [
    {
      provide: IDialogService,
      useClass: DialogService,
    },
    SpecificationProcessorService,
    SpecificationMaintainerService,
    LlmChatService
  ],
})
export class DialogsHandlerModule {}
