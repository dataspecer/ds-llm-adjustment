import * as AdmZip from 'adm-zip';
import { DataspecerAdapterServiceInterface } from '@interfaces/dataspecer.adapter.service.interface';
import { McpHttpClient } from '@app/common/mcp/client';

export class DataspecerAdapterService implements DataspecerAdapterServiceInterface {
  public getHello(): string {
    return 'Hello World!';
  }

  public async getPsm(dataspecerBaseUrl: string, iri: string): Promise<string> {
    const client = this.createClient();
    const result = await client.callTool<any>('dataspecer.get_resource_blob', { iri });
    const text: string = result?.content?.[0]?.text ?? '';
    if (!text) throw new Error('Empty PSM content');
    // normalize JSON formatting if possible
    try {
      const obj = JSON.parse(text);
      return JSON.stringify(obj, null, 2);
    } catch {
      return text;
    }
  }

  public async getZipExport(dataspecerBaseUrl: string, iri: string): Promise<Buffer> {
    const client = this.createClient();
    const result = await client.callTool<any>('dataspecer.get_zip_export', { iri });
    const b64: string | undefined = result?.content?.[0]?.data;
    if (!b64) throw new Error('Empty zip content');
    return Buffer.from(b64, 'base64');
  }

  public async getJsonSchemaViaDsv(dataspecerBaseUrl: string, dataSpecificationIri: string, psmIri?: string): Promise<string> {
    const client = this.createClient();
    const result = await client.callTool<any>('dataspecer.get_json_schema', { dataSpecificationIri, psmIri });
    const text: string = result?.content?.[0]?.text ?? '';
    if (!text) throw new Error('Empty schema content');
    return text;
  }

  private async getJsonSchemaOld(dataspecerBaseUrl: string, dataSpecificationIri: string, psmIri?: string): Promise<string> {
    // Fallback to REST (legacy) if MCP not available
    throw new Error('Legacy REST fallback disabled: MCP required');
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

  private createClient(): McpHttpClient {
    const baseUrl = process.env.DATASPECER_MCP_BASE_URL || 'http://dataspecer/api/mcp';
    const authToken = process.env.DATASPECER_MCP_TOKEN || process.env.MCP_AUTH_SECRET;
    return new McpHttpClient({ baseUrl, authToken });
  }
}