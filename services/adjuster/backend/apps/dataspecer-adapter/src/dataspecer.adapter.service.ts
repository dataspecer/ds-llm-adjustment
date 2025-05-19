import axios from 'axios';

export class DataspecerAdapterService {
  async getPsm(iri: string): Promise<string> {
    try {
      const response = await axios.get(`${process.env.DATASPECER_API_URL}/resources/${encodeURIComponent(iri)}`, {
        headers: {
          'Accept': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get PSM from Dataspecer: ${error.message}`);
    }
  }

  async getZipExport(baseUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(`${baseUrl}/export`, {
        responseType: 'arraybuffer'
      });
      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to get zip export from Dataspecer: ${error.message}`);
    }
  }
} 