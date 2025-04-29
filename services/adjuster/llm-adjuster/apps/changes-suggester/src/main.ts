import { NestFactory } from '@nestjs/core';
import { ChangesSuggesterModule } from './changes-suggester.module';

async function bootstrap() {
  const app = await NestFactory.create(ChangesSuggesterModule);
  await app.listen(3102);
}
bootstrap();
