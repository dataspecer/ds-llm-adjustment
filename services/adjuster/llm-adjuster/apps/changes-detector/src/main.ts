import { NestFactory } from '@nestjs/core';
import { ChangesDetectorModule } from './changes-detector.module';

async function bootstrap() {
  const app = await NestFactory.create(ChangesDetectorModule);
  await app.listen(3101);
}
bootstrap();
