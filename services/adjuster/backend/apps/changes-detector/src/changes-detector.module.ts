import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChangesDetectorService } from './services/changes-detector.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ChangesDetectorController } from './controllers/changes-detector.controller';
import { ChangesDetectorAmqpController } from './controllers/changes-detector.amqp.controller';

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
      {
        name: 'DIALOG_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL as string],
          queue: 'dialogs_handler_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [ChangesDetectorController, ChangesDetectorAmqpController],
  providers: [ChangesDetectorService],
})
export class ChangesDetectorModule {}
