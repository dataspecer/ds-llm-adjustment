import { Module } from '@nestjs/common';
import { ChangesSuggesterService } from './changes-suggester.service';
import { ChangesSuggesterController } from './controllers/changes-suggester.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [ClientsModule.register([
    {
      name: 'DIALOG_SERVICE',
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL],
        queue: 'dialog_queue',
        queueOptions: { durable: true },
      },
    },
  ]),],
  controllers: [ChangesSuggesterController],
  providers: [ChangesSuggesterService],
})
export class ChangesSuggesterModule {}
