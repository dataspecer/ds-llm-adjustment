import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ChangesSuggesterService } from './services/changes-suggester.service';
import { ChangesSuggesterController } from './controllers/changes-suggester.controller';
import { ChangesSuggesterAmqpController } from './controllers/changes-suggester.amqp.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
      {
        name: 'DIALOG_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL as string],
          queue: 'dialogs_handler_queue',
          queueOptions: { durable: true },
        },
      },
      {
        name: 'EVALUATION',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL as string],
          queue: 'dialogs_handler_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [ChangesSuggesterController, ChangesSuggesterAmqpController],
  providers: [ChangesSuggesterService],
})
export class ChangesSuggesterModule {}
