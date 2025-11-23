import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { DataspecerAdapterController } from './controllers/dataspecer-adapter.controller';
import { DataspecerAdapterAmqpController } from './controllers/dataspecer.adapter.amqp.controller';
import { DataspecerAdapterService } from './services/dataspecer.adapter.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClientsModule.register([
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
  controllers: [DataspecerAdapterController, DataspecerAdapterAmqpController],
  providers: [DataspecerAdapterService],
})
export class DataspecerAdapterModule {}
