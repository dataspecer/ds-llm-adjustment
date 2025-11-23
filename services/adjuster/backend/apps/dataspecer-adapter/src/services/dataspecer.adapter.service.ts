import { DataspecerAdapterServiceInterface } from '@interfaces/dataspecer.adapter.service.interface';
import { McpHttpClient } from '@app/common/mcp/client';
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ValidatorCheckEventDto } from '@app/common/dto/evaluation/validator-check.dto';
import { ApplyMetricEventDto } from '@app/common/dto/evaluation/apply-metric.dto';
import { McpSafetyEventDto } from '@app/common/dto/evaluation/mcp-safety.dto';

@Injectable()
export class DataspecerAdapterService implements DataspecerAdapterServiceInterface {
  public constructor(
    @Inject('EVALUATION') private readonly evaluationClient: ClientProxy,
  ) {}

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

  public async previewApply(operations: Array<{ op: string; args: any }>, token?: string): Promise<{ planId: string; report: { ok: boolean; issues: Array<{ level: string; message: string }> } }> {
    const client = this.createClient();
    const result = await client.callTool<any>('dataspecer.preview_apply', { operations, token });
    const payload: { planId: string; report: { ok: boolean; issues: Array<{ level: string; message: string }> } } = {
      planId: result?.planId,
      report: result?.report ?? { ok: false, issues: [{ level: 'error', message: 'No report returned' }] },
    };
    // Emit validator and MCP safety events
    const validatorEvent: ValidatorCheckEventDto = {
      stage: 'preview',
      planId: payload.planId,
      reportOk: !!payload.report?.ok,
      issues: (payload.report?.issues || []).map(i => ({ level: (i.level as any) ?? 'error', message: i.message })),
      timestamp: new Date().toISOString(),
    };
    this.evaluationClient.emit('evaluation.validator', validatorEvent).subscribe({ error: () => {} });
    const mcpEvent: McpSafetyEventDto = {
      eventType: 'preview_apply',
      planId: payload.planId,
      ok: !!payload.report?.ok,
      issuesCount: Array.isArray(payload.report?.issues) ? payload.report.issues.length : 0,
      timestamp: new Date().toISOString(),
    };
    this.evaluationClient.emit('evaluation.mcp', mcpEvent).subscribe({ error: () => {} });
    return payload;
  }

  public async applyChanges(planId: string, token?: string): Promise<{ applied: boolean; changedIris: string[] }> {
    const client = this.createClient();
    const result = await client.callTool<any>('dataspecer.apply_changes', { planId, confirm: true, token });
    const payload = {
      applied: !!result?.applied,
      changedIris: Array.isArray(result?.changedIris) ? result.changedIris : [],
    };
    const mcpEvent: McpSafetyEventDto = {
      eventType: 'apply_changes',
      planId,
      ok: !!payload.applied,
      timestamp: new Date().toISOString(),
    };
    this.evaluationClient.emit('evaluation.mcp', mcpEvent).subscribe({ error: () => {} });
    const applyEvent: ApplyMetricEventDto = {
      planId,
      appliedOk: !!payload.applied,
      changedIrisCount: payload.changedIris.length,
      timestamp: new Date().toISOString(),
    };
    this.evaluationClient.emit('evaluation.apply', applyEvent).subscribe({ error: () => {} });
    return payload;
  }

  public async getLightweightOwlTtl(iri: string): Promise<string> {
    const client = this.createClient();
    const result = await client.callTool<any>('dataspecer.generate_lightweight_owl_from_iri', { iri });
    const ttl: string = result?.content?.[0]?.text ?? '';
    if (!ttl) throw new Error('Empty OWL/Turtle payload');
    return ttl;
  }
}