import { Controller, Get } from '@nestjs/common';
import { DataspecerAdapterService } from './dataspecer-adapter.service';

@Controller()
export class DataspecerAdapterController {
  constructor(private readonly dataspecerAdapterService: DataspecerAdapterService) {}

  @Get()
  getHello(): string {
    return this.dataspecerAdapterService.getHello();
  }
}
