import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { DialogAmqpController } from './controllers/amqp/dialog/dialog.amqp.controller';
import { IDialogService } from './services/interfaces/dialog/dialog-service.interface';
import { DialogService } from './services/dialog/dialog.service';
import { ChatMessageEntity } from './entities/chat-message.entity';
import { SpecificationDialogController } from './controllers/http/specification-dialog/specification-dialog.controller';
import { SpecificationProcessorService } from './services/specification-processor/specification-processor.service';
import { SpecificationMaintainerController } from './controllers/http/specification-maintainer/specification-maintainer.controller';
import { SpecificationMaintainerService } from './services/specification-maintainer/specification-maintainer.service';
import { LlmChatService } from './services/specification-maintainer/llm-chat.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get('DATABASE_URL') || 'postgresql://adjuster:adjuster123@postgres:5432/adjuster';
        return {
          type: 'postgres',
          url: databaseUrl,
          entities: [ChatMessageEntity],
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
    TypeOrmModule.forFeature([ChatMessageEntity])
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
