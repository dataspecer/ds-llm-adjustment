import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChangesDetectorService } from './changes-detector.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ChangesDetectorController } from './controllers/changes-detector.controller';
import { DataspecerFetcherService } from './services/dataspecer-fetcher.service';

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
          urls: [process.env.RABBITMQ_URL],
          queue: 'dataspecer_adapter_queue',
          queueOptions: { durable: true },
        },
      },
    ])
  ],
  controllers: [ChangesDetectorController],
  providers: [ChangesDetectorService, DataspecerFetcherService],
})
export class ChangesDetectorModule {}
