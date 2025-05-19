import axios from 'axios';

export async function getDataspecerZipExport(baseUrl: string): Promise<Buffer> {
  try {
    const response = await axios.get(`${baseUrl}/export`, {
      responseType: 'arraybuffer'
    });
    return Buffer.from(response.data);
  } catch (error) {
    throw new Error(`Failed to get zip export from Dataspecer: ${error.message}`);
  }
} 