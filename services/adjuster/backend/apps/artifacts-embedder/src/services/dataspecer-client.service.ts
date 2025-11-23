import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class DataspecerClientService {
  // Public methods
  public constructor(@Inject('DATASPECER_ADAPTER') private readonly _client: ClientProxy) {}

  public async getPsm(dataspecerBaseUrl: string, iri: string): Promise<string> {
    return firstValueFrom(this._client.send('get.psm', { dataspecerBaseUrl, iri })) as Promise<string>;
  }

  public async getJsonSchema(dataspecerBaseUrl: string, dataSpecificationIri: string, psmIri?: string): Promise<string> {
    return firstValueFrom(
      this._client.send('get.json.schema', { dataspecerBaseUrl, dataSpecificationIri, psmIri })
    ) as Promise<string>;
  }
}


