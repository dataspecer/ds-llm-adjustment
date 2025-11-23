import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { DialogAmqpController } from './controllers/amqp/dialog/dialog.amqp.controller';
import { IDialogService } from './services/interfaces/dialog/dialog-service.interface';
import { DialogService } from './services/dialog/dialog.service';
import { ChatMessageEntity } from './entities/chat-message.entity';
import { SpecificationDialogController } from './controllers/http/specification-dialog/specification-dialog.controller';
import { SpecificationProcessorService } from './services/specification-processor/specification-processor.service';
import { SpecificationMaintainerController } from './controllers/http/specification-maintainer/specification-maintainer.controller';
import { SpecificationMaintainerService } from './services/specification-maintainer/specification-maintainer.service';
import { LlmChatService } from './services/specification-maintainer/llm-chat.service';
import { EvaluationDiffEntity } from './entities/evaluation-diff.entity';
import { EvaluationValidatorEntity } from './entities/evaluation-validator.entity';
import { EvaluationApplyEntity } from './entities/evaluation-apply.entity';
import { EvaluationUxEntity } from './entities/evaluation-ux.entity';
import { EvaluationMcpEntity } from './entities/evaluation-mcp.entity';
import { EvaluationService } from './services/evaluation/evaluation.service';
import { EvaluationController } from './controllers/http/evaluation/evaluation.controller';
import { EvaluationAmqpController } from './controllers/amqp/evaluation/evaluation.amqp.controller';

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
          entities: [ChatMessageEntity, EvaluationDiffEntity, EvaluationValidatorEntity, EvaluationApplyEntity, EvaluationUxEntity, EvaluationMcpEntity],
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
    TypeOrmModule.forFeature([ChatMessageEntity, EvaluationDiffEntity, EvaluationValidatorEntity, EvaluationApplyEntity, EvaluationUxEntity, EvaluationMcpEntity])
  ],
  controllers: [DialogAmqpController, SpecificationDialogController, SpecificationMaintainerController, EvaluationController, EvaluationAmqpController],
  providers: [
    {
      provide: IDialogService,
      useClass: DialogService,
    },
    SpecificationProcessorService,
    SpecificationMaintainerService,
    LlmChatService,
    EvaluationService
  ],
})
export class DialogsHandlerModule {}
