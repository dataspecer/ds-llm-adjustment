import { Controller, Inject } from '@nestjs/common';
import { ClientProxy, MessagePattern, Payload } from '@nestjs/microservices';
import { DataspecerAdapterService } from '../services/dataspecer.adapter.service';

@Controller()
export class DataspecerAdapterAmqpController {
  constructor(
    private readonly dataspecerAdapterService: DataspecerAdapterService,
    @Inject('DIALOG_SERVICE')
    private readonly client: ClientProxy
  ) {}

  @MessagePattern('get.dataspecer.zip')
  async getZipExport(@Payload() payload: { dataspecerBaseUrl: string, iri: string }): Promise<Buffer> {
    const zipExport: Buffer = await this.dataspecerAdapterService.getZipExport(payload.dataspecerBaseUrl, payload.iri);
    this.client.emit('dataspecer.zip.exported', zipExport);
    return zipExport;
  }

  @MessagePattern('get.psm')
  async getPsm(@Payload() payload: { dataspecerBaseUrl: string, iri: string }): Promise<string> {
    return this.dataspecerAdapterService.getPsm(payload.dataspecerBaseUrl, payload.iri);
  }

  @MessagePattern('get.json.schema')
  async getJsonSchema(@Payload() payload: { dataspecerBaseUrl: string, dataSpecificationIri: string, psmIri?: string }): Promise<string> {
    return this.dataspecerAdapterService.getJsonSchemaViaDsv(
      payload.dataspecerBaseUrl,
      payload.dataSpecificationIri,
      payload.psmIri,
    );
  }

  @MessagePattern('dataspecer.get.owl')
  async getLightweightOwl(@Payload() payload: { iri: string }): Promise<string> {
    return this.dataspecerAdapterService.getLightweightOwlTtl(payload.iri);
  }

  @MessagePattern('dataspecer.preview.apply')
  async previewApply(@Payload() payload: { operations: Array<{ op: string; args: any }>, token?: string }): Promise<{ planId: string; report: { ok: boolean; issues: Array<{ level: string; message: string }> } }> {
    return this.dataspecerAdapterService.previewApply(payload.operations, payload.token);
  }

  @MessagePattern('dataspecer.apply.changes')
  async applyChanges(@Payload() payload: { planId: string, token?: string }): Promise<{ applied: boolean; changedIris: string[] }> {
    return this.dataspecerAdapterService.applyChanges(payload.planId, payload.token);
  }
} 