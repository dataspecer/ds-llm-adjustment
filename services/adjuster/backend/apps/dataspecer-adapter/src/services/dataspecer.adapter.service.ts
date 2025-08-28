import axios, { AxiosResponse } from 'axios';
import * as AdmZip from 'adm-zip';
import { DataspecerAdapterServiceInterface } from '@interfaces/dataspecer.adapter.service.interface';

export class DataspecerAdapterService implements DataspecerAdapterServiceInterface {
  public getHello(): string {
    return 'Hello World!';
  }

  public async getPsm(dataspecerBaseUrl: string, iri: string): Promise<string> {
    try {
      const url: string = `${dataspecerBaseUrl}/api/resources/blob?iri=${encodeURIComponent(iri)}`;
      console.log('url', url);
      const response: AxiosResponse = await axios.get(url, { responseType: 'text', validateStatus: () => true });

      if (response.status < 200 || response.status >= 300) {
        const errorText: string = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        throw new Error(`Failed to fetch PSM schema: ${response.status} ${response.statusText}. Response: ${errorText}`);
      }

      const responseText: string = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      try {
        const psmData: any = JSON.parse(responseText);
        return JSON.stringify(psmData, null, 2);
      } catch (parseError) {
        // If it is already JSON text, return as-is; otherwise, bubble up
        try {
          JSON.parse(responseText);
          return responseText;
        } catch {
          throw new Error(`PSM API returned invalid JSON: ${(parseError as Error).message}`);
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to get PSM from Dataspecer: ${error.message}`);
    }
  }

  public async getZipExport(dataspecerBaseUrl: string, iri: string): Promise<Buffer> {
    try {
      const url: string = `${dataspecerBaseUrl}/resources/export.zip?iri=${encodeURIComponent(iri)}`;
      const response: AxiosResponse = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to get zip export from Dataspecer: ${error.message}`);
    }
  }

  public async getJsonSchemaViaDsv(dataspecerBaseUrl: string, dataSpecificationIri: string, psmIri?: string): Promise<string> {
    try {
      const htmlDocUrl: string = `${dataspecerBaseUrl}/api/preview/index.html?iri=${encodeURIComponent(dataSpecificationIri)}`;
      const response: AxiosResponse = await axios.get(htmlDocUrl, { responseType: 'text', validateStatus: () => true });

      if (response.status < 200 || response.status >= 300) {
        const errorText: string = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        throw new Error(`Failed to fetch HTML documentation: ${response.status} ${response.statusText}. Response: ${errorText}`);
      }

      const htmlContent: string = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const metadata: any = this.extractMetadataFromHtml(htmlContent);
      if (!metadata) {
        throw new Error('No embedded metadata found in HTML documentation');
      }

      const jsonSchemaUrl: string | null = this.findJsonSchemaUrl(metadata);
      if (!jsonSchemaUrl) {
        throw new Error('No JSON schema found in DSV metadata');
      }

      const schemaResponse: AxiosResponse = await axios.get(jsonSchemaUrl, { responseType: 'text', validateStatus: () => true });
      if (schemaResponse.status < 200 || schemaResponse.status >= 300) {
        const errorText: string = typeof schemaResponse.data === 'string' ? schemaResponse.data : JSON.stringify(schemaResponse.data);
        throw new Error(`Failed to fetch JSON schema from URL: ${schemaResponse.status} ${schemaResponse.statusText}. Response: ${errorText}`);
      }

      const jsonSchema: string = typeof schemaResponse.data === 'string' ? schemaResponse.data : JSON.stringify(schemaResponse.data);
      return jsonSchema;
    } catch (error: any) {
      return this.getJsonSchemaOld(dataspecerBaseUrl, dataSpecificationIri, psmIri);
    }
  }

  private async getJsonSchemaOld(dataspecerBaseUrl: string, dataSpecificationIri: string, psmIri?: string): Promise<string> {
    const baseUrl: string = `${dataspecerBaseUrl}/api/preview/schema.json?iri=${encodeURIComponent(dataSpecificationIri)}`;
    const url: string = psmIri ? `${baseUrl}&psm=${encodeURIComponent(psmIri)}` : baseUrl;
    const response: AxiosResponse = await axios.get(url, { responseType: 'text', validateStatus: () => true });
    if (response.status < 200 || response.status >= 300) {
      const errorText: string = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      throw new Error(`Failed to generate JSON schema: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }
    return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  }

  private extractMetadataFromHtml(html: string): any | null {
    const startToken: string = `<script type="application/ld+json">`;
    const endToken: string = `</script>`;
    const start: number = html.indexOf(startToken);
    if (start === -1) {
      return null;
    }
    const metadataStart: number = start + startToken.length;
    const end: number = html.indexOf(endToken, metadataStart);
    if (end === -1) {
      return null;
    }
    const metadataJson: string = html.substring(metadataStart, end).trim();
    try {
      return JSON.parse(metadataJson);
    } catch {
      return null;
    }
  }

  private findJsonSchemaUrl(metadata: any): string | null {
    try {
      const inSpecificationOf: any = metadata.inSpecificationOf;
      if (!inSpecificationOf || !Array.isArray(inSpecificationOf)) {
        return null;
      }
      const applicationProfile: any = inSpecificationOf.find((spec: any) => {
        const types: string[] = Array.isArray(spec['@type']) ? spec['@type'] : [spec['@type']];
        return types.includes('dsv:ApplicationProfile') || types.includes('https://w3id.org/dsv#ApplicationProfile');
      });
      if (!applicationProfile) {
        return null;
      }
      const hasResource: any = applicationProfile.hasResource;
      if (!hasResource || !Array.isArray(hasResource)) {
        return null;
      }
      const jsonSchemaResource = hasResource.find((resource: any) => {
        const conformsTo = resource.conformsTo;
        if (Array.isArray(conformsTo)) {
          return conformsTo.includes('https://json-schema.org/draft/2020-12/schema');
        } else {
          return conformsTo === 'https://json-schema.org/draft/2020-12/schema';
        }
      });
      if (!jsonSchemaResource) {
        return null;
      }
      const artifactUrl = jsonSchemaResource.hasArtifact;
      if (!artifactUrl) {
        return null;
      }
      return artifactUrl;
    } catch {
      return null;
    }
  }
}