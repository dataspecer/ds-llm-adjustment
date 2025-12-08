import { Controller, Inject, Logger } from '@nestjs/common';
import { ClientProxy, MessagePattern, Payload } from '@nestjs/microservices';
import { DataspecerAdapterService } from '../services/dataspecer.adapter.service';

@Controller()
export class DataspecerAdapterAmqpController {
  private readonly logger: Logger = new Logger(DataspecerAdapterAmqpController.name);
  constructor(
    private readonly dataspecerAdapterService: DataspecerAdapterService,
    @Inject('DIALOG_SERVICE')
    private readonly client: ClientProxy
  ) {}

  @MessagePattern('get.dataspecer.zip')
  async getZipExport(@Payload() payload: { dataspecerBaseUrl: string, iri: string }): Promise<Buffer> {
    this.logger.log(`get.dataspecer.zip iri=${payload?.iri}`);
    const zipExport: Buffer = await this.dataspecerAdapterService.getZipExport(payload.dataspecerBaseUrl, payload.iri);
    this.client.emit('dataspecer.zip.exported', zipExport);
    return zipExport;
  }

  @MessagePattern('get.psm')
  async getPsm(@Payload() payload: { dataspecerBaseUrl: string, iri: string }): Promise<string> {
    this.logger.log(`get.psm iri=${payload?.iri}`);
    return this.dataspecerAdapterService.getPsm(payload.dataspecerBaseUrl, payload.iri);
  }

  @MessagePattern('get.json.schema')
  async getJsonSchema(@Payload() payload: { dataspecerBaseUrl: string, dataSpecificationIri: string, psmIri?: string }): Promise<string> {
    this.logger.log(`get.json.schema dataSpecificationIri=${payload?.dataSpecificationIri}${payload?.psmIri ? `, psmIri=${payload.psmIri}` : ''}`);
    return this.dataspecerAdapterService.getJsonSchemaViaDsv(
      payload.dataspecerBaseUrl,
      payload.dataSpecificationIri,
      payload.psmIri,
    );
  }

  @MessagePattern('list.dataspecer.specs')
  async listSpecs(): Promise<string> {
    this.logger.log(`list.dataspecer.specs`);
    return this.dataspecerAdapterService.listSpecs();
  }

  @MessagePattern('list.dataspecer.resources')
  async listResources(@Payload() payload: { parentIri: string }): Promise<string> {
    this.logger.log(`list.dataspecer.resources parentIri=${payload?.parentIri}`);
    return this.dataspecerAdapterService.listResources(payload.parentIri);
  }

  @MessagePattern('dataspecer.get.owl')
  async getLightweightOwl(@Payload() payload: { iri: string }): Promise<string> {
    this.logger.log(`dataspecer.get.owl iri=${payload?.iri}`);
    return this.dataspecerAdapterService.getLightweightOwlTtl(payload.iri);
  }

  @MessagePattern('dataspecer.preview.apply')
  async previewApply(@Payload() payload: { operations: Array<{ op: string; args: any }>, token?: string }): Promise<{ planId: string; report: { ok: boolean; issues: Array<{ level: string; message: string }> } }> {
    this.logger.log(`dataspecer.preview.apply ops=${Array.isArray(payload?.operations) ? payload.operations.length : 0}`);
    return this.dataspecerAdapterService.previewApply(payload.operations, payload.token);
  }

  @MessagePattern('dataspecer.apply.changes')
  async applyChanges(@Payload() payload: { planId: string, token?: string }): Promise<{ applied: boolean; changedIris: string[] }> {
    this.logger.log(`dataspecer.apply.changes planId=${payload?.planId}`);
    return this.dataspecerAdapterService.applyChanges(payload.planId, payload.token);
  }
} 