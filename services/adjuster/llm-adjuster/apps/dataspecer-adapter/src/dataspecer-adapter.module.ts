import { Module } from '@nestjs/common';
import { DataspecerAdapterController } from './dataspecer-adapter.controller';
import { DataspecerAdapterService } from './dataspecer-adapter.service';

@Module({
  imports: [],
  controllers: [DataspecerAdapterController],
  providers: [DataspecerAdapterService],
})
export class DataspecerAdapterModule {}
