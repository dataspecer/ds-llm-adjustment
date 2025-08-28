export interface DataspecerAdapterServiceInterface {
  getHello(): string;
  getPsm(dataspecerBaseUrl: string, iri: string): Promise<string>;
  getZipExport(dataspecerBaseUrl: string, iri: string): Promise<Buffer>;
  getJsonSchemaViaDsv(dataspecerBaseUrl: string, dataSpecificationIri: string, psmIri?: string): Promise<string>;
}






