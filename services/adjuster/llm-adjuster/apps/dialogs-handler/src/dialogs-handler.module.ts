import { Module } from '@nestjs/common';

import { DialogHttpController } from './controllers/http/dialog/dialog.http.controller';
import { DialogAmqpController } from './controllers/amqp/dialog/dialog.amqp.controller';
import { IDialogService } from './services/interfaces/dialog/dialog-service.interface';
import { DialogService } from './services/dialog/dialog.service';

@Module({
  imports: [],
  controllers: [DialogHttpController, DialogAmqpController],
  providers: [
    {
      provide: IDialogService,
      useClass: DialogService,
    }
  ],
})
export class DialogsHandlerModule {}
