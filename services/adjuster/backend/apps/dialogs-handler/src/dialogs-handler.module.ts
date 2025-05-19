import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { DialogAmqpController } from './controllers/amqp/dialog/dialog.amqp.controller';
import { IDialogService } from './services/interfaces/dialog/dialog-service.interface';
import { DialogService } from './services/dialog/dialog.service';
import { ChatMessageEntity } from './entities/chat-message.entity';
import { SpecificationDialogController } from './controllers/http/specification-dialog/specification-dialog.controller';
import { SpecificationProcessorService } from './services/specification-processor/specification-processor.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'database.sqlite',
      entities: [ChatMessageEntity],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([ChatMessageEntity])
  ],
  controllers: [DialogAmqpController, SpecificationDialogController],
  providers: [
    {
      provide: IDialogService,
      useClass: DialogService,
    },
    SpecificationProcessorService
  ],
})
export class DialogsHandlerModule {}
