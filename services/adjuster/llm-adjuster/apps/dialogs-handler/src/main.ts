import { NestFactory } from '@nestjs/core';
import { DialogsHandlerModule } from './dialogs-handler.module';

async function bootstrap() {
  const app = await NestFactory.create(DialogsHandlerModule);
  await app.listen(3103);
}
bootstrap();
