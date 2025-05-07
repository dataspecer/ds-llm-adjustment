import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SpecificationDialogController } from './controllers/specification-dialog/specification-dialog.controller';
import { SpecificationProcessorService } from './services/specification-processor/specification-processor.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMessageEntity } from './entities/chat-message.entity';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [    
    TypeOrmModule.forRoot({
    type: 'sqlite',
    database: 'database.sqlite',
    entities: [ChatMessageEntity],
    synchronize: true,
  }),
  ConfigModule.forRoot(),
  TypeOrmModule.forFeature([ChatMessageEntity])],
  controllers: [AppController, SpecificationDialogController],
  providers: [AppService, SpecificationProcessorService],
})
export class AppModule {}
