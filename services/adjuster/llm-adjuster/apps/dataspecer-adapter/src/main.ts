import { NestFactory } from '@nestjs/core';
import { DataspecerAdapterModule } from './dataspecer-adapter.module';

async function bootstrap() {
  const app = await NestFactory.create(DataspecerAdapterModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
