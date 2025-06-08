import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DataspecerFetcherService {
  private readonly dataspecerBackendUrl: string;

  constructor(private configService: ConfigService) {
    this.dataspecerBackendUrl = this.configService.get<string>('DATASPECER_BACKEND_URL') || 'http://localhost:3002';
  }

  async fetchPsmSchema(psmIri: string): Promise<string> {
    try {
      const url = `${this.dataspecerBackendUrl}/api/resources/blob?iri=${encodeURIComponent(psmIri)}`;
      console.log('Fetching PSM schema from URL:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Failed to fetch PSM schema. Status:', response.status, 'Response:', errorText);
        throw new HttpException(
          `Failed to fetch PSM schema: ${response.status} ${response.statusText}`,
          HttpStatus.BAD_REQUEST
        );
      }

      const responseText = await response.text();
      console.log('PSM schema response (first 200 chars):', responseText.substring(0, 200));
      
      try {
        const psmData = JSON.parse(responseText);
        return JSON.stringify(psmData, null, 2);
      } catch (parseError) {
        console.log('Failed to parse PSM response as JSON:', parseError.message);
        console.log('Full response:', responseText);
        throw new HttpException(
          `PSM API returned invalid JSON: ${parseError.message}`,
          HttpStatus.BAD_REQUEST
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.log('Error fetching PSM schema:', error.message);
      throw new HttpException(
        `Error fetching PSM schema: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async generateJsonSchema(dataSpecificationIri: string, psmIri?: string): Promise<string> {
    try {
      // Generate JSON schema using the Dataspecer backend with the package IRI directly
      let url = `${this.dataspecerBackendUrl}/api/preview/schema.json?iri=${encodeURIComponent(dataSpecificationIri)}`;
      
      // If PSM IRI is provided, add it as a parameter to generate schema for specific PSM
      if (psmIri) {
        url += `&psm=${encodeURIComponent(psmIri)}`;
      }
      
      console.log('Generating JSON schema from URL:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Failed to generate JSON schema. Status:', response.status, 'Response:', errorText);
        throw new HttpException(
          `Failed to generate JSON schema: ${response.status} ${response.statusText}`,
          HttpStatus.BAD_REQUEST
        );
      }

      const jsonSchema = await response.text();
      console.log('JSON schema generated successfully, length:', jsonSchema.length);
      return jsonSchema;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.log('Error generating JSON schema:', error.message);
      throw new HttpException(
        `Error generating JSON schema: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async getPackageIriForPsm(psmIri: string): Promise<string> {
    try {
      // This is a simplified approach - in practice, you might need to 
      // traverse the resource hierarchy to find the parent package
      // For now, we'll try to extract it from the PSM IRI or use a default approach
      
      // Try to get resource info to find the parent
      const url = `${this.dataspecerBackendUrl}/api/resources?iri=${encodeURIComponent(psmIri)}`;
      console.log('Getting package IRI from URL:', url);
      
      const response = await fetch(url);
      
      if (response.ok) {
        const responseText = await response.text();
        try {
          const resourceData = JSON.parse(responseText);
          // Look for parent package in the resource metadata
          // This is a simplified implementation - you might need to adjust based on the actual API structure
          if (resourceData && resourceData.parentIri) {
            console.log('Found parent IRI:', resourceData.parentIri);
            return resourceData.parentIri;
          }
        } catch (parseError) {
          console.log('Failed to parse resource response:', parseError.message);
        }
      } else {
        const errorText = await response.text();
        console.log('Failed to get resource info. Status:', response.status, 'Response:', errorText);
      }

      // Fallback: try to use the PSM IRI directly for generation
      console.log('Using PSM IRI directly as fallback:', psmIri);
      return psmIri;
    } catch (error) {
      // Fallback: use the PSM IRI directly
      console.log('Error getting package IRI, using PSM IRI as fallback:', error.message);
      return psmIri;
    }
  }
} 