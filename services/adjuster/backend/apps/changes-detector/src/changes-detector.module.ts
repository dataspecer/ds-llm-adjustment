import { Module } from '@nestjs/common';
import { ChangesDetectorService } from './changes-detector.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ChangesDetectorController } from './controllers/changes-detector.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'DIALOG_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL],
          queue: 'dialog_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [ChangesDetectorController],
  providers: [ChangesDetectorService],
})
export class ChangesDetectorModule {}
