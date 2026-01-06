import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class DataspecerClientService {
  private readonly _logger: Logger = new Logger(DataspecerClientService.name);
  // Public methods
  public constructor(@Inject('DATASPECER_ADAPTER') private readonly _client: ClientProxy) {}

  public async getPsm(dataspecerBaseUrl: string, iri: string): Promise<string> {
    this._logger.log(`AMQP -> get.psm iri=${iri}`);
    return firstValueFrom(this._client.send('get.psm', { dataspecerBaseUrl, iri })) as Promise<string>;
  }

  public async getJsonSchema(dataspecerBaseUrl: string, dataSpecificationIri: string, psmIri?: string): Promise<string> {
    this._logger.log(`AMQP -> get.json.schema dataSpecificationIri=${dataSpecificationIri}${psmIri ? `, psmIri=${psmIri}` : ''}`);
    return firstValueFrom(
      this._client.send('get.json.schema', { dataspecerBaseUrl, dataSpecificationIri, psmIri })
    ) as Promise<string>;
  }

  public async listSpecs(): Promise<any> {
    this._logger.log(`AMQP -> list.dataspecer.specs`);
    const text: string = await firstValueFrom(this._client.send('list.dataspecer.specs', {})) as string;
    try {
      return JSON.parse(text);
    } catch {
      return [];
    }
  }

  public async listResources(parentIri: string): Promise<any[]> {
    this._logger.log(`AMQP -> list.dataspecer.resources parentIri=${parentIri}`);
    const text: string = await firstValueFrom(this._client.send('list.dataspecer.resources', { parentIri })) as string;
    try {
      const parsed: any = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      // The endpoint returns a package object with subResources array
      if (parsed && Array.isArray(parsed.subResources)) {
        return parsed.subResources;
      }
      return [];
    } catch {
      return [];
    }
  }
}


