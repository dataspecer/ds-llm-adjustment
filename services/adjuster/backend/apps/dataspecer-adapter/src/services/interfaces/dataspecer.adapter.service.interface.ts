export interface DataspecerAdapterServiceInterface {
  getHello(): string;
  getPsm(dataspecerBaseUrl: string, iri: string): Promise<string>;
  getZipExport(dataspecerBaseUrl: string, iri: string): Promise<Buffer>;
  getJsonSchemaViaDsv(dataspecerBaseUrl: string, dataSpecificationIri: string, psmIri?: string): Promise<string>;
  previewApply(operations: Array<{ op: string; args: any }>, token?: string): Promise<{ planId: string; report: { ok: boolean; issues: Array<{ level: string; message: string }> } }>;
  applyChanges(planId: string, token?: string): Promise<{ applied: boolean; changedIris: string[] }>;
  getLightweightOwlTtl(iri: string): Promise<string>;
}






