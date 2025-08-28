import { Controller, Get } from '@nestjs/common';
import { DataspecerAdapterService } from '../services/dataspecer.adapter.service';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('root')
@Controller()
export class DataspecerAdapterController {
  constructor(private readonly dataspecerAdapterService: DataspecerAdapterService) {}

  @Get()
  @ApiOperation({ summary: 'Health/hello of Dataspecer adapter' })
  @ApiOkResponse({ schema: { type: 'string' } })
  getHello(): string {
    return this.dataspecerAdapterService.getHello();
  }
}
