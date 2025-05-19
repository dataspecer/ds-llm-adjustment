import { Controller, Inject } from '@nestjs/common';
import { ClientProxy, MessagePattern, Payload } from '@nestjs/microservices';
import { DataspecerAdapterService } from './services/dataspecer.adapter.service';

@Controller()
export class DataspecerAdapterAmqpController {
  constructor(
    private readonly dataspecerAdapterService: DataspecerAdapterService,
    @Inject('DIALOG_SERVICE')
    private readonly client: ClientProxy
  ) {}

  @MessagePattern('get.dataspecer.zip')
  async getZipExport(@Payload() payload: { dataspecerBaseUrl: string, iri: string }): Promise<Buffer> {
    const zipExport = await this.dataspecerAdapterService.getZipExport(payload.dataspecerBaseUrl, payload.iri);
    this.client.emit('dataspecer.zip.exported', zipExport);
    return zipExport;
  }

  @MessagePattern('get.psm')
  async getPsm(@Payload() payload: { dataspecerBaseUrl: string, iri: string }): Promise<string> {
    return this.dataspecerAdapterService.getPsm(payload.dataspecerBaseUrl, payload.iri);
  }
} 