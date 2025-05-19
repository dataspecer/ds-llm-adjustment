import axios from 'axios';
import * as AdmZip from 'adm-zip';

export class DataspecerAdapterService {
  async getPsm(dataspecerBaseUrl: string, iri: string): Promise<string> {
    try {
      const zipBuffer = await this.getZipExport(dataspecerBaseUrl, iri);
      
      const zip = new AdmZip(zipBuffer);
      const psmEntry = zip.getEntries().find(entry => entry.entryName.endsWith('.json'));
      
      if (!psmEntry) {
        throw new Error('No PSM file found in the zip export');
      }

      return psmEntry.getData().toString('utf8');
    } catch (error) {
      throw new Error(`Failed to get PSM from Dataspecer: ${error.message}`);
    }
  }

  async getZipExport(dataspecerBaseUrl: string, iri: string): Promise<Buffer> {
    try {
      const url = `${dataspecerBaseUrl}/resources/export.zip?iri=${encodeURIComponent(iri)}`;
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to get zip export from Dataspecer: ${error.message}`);
    }
  }
}