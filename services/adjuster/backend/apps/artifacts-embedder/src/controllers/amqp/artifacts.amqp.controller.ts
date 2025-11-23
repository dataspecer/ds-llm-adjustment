import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ArtifactsService } from '../../services/artifacts.service';

@Controller()
export class ArtifactsAmqpController {
  constructor(private readonly _artifactsService: ArtifactsService) {}

  @MessagePattern('artifacts.embed.dataspecer')
  public async embedFromDataspecer(@Payload() payload: { dataSpecificationIri: string; psmIri?: string }) {
    return this._artifactsService.embedFromDataspecer(payload);
  }

  @MessagePattern('artifacts.embed.documents')
  public async embedDocuments(@Payload() payload: { documents: Array<{ id: string; type: string; content: string; metadata?: Record<string, any> }> }) {
    return this._artifactsService.embedDocuments(payload.documents);
  }

  @MessagePattern('artifacts.search')
  public async search(@Payload() payload: { query: string; k?: number; filter?: { psmIri?: string; dataSpecificationIri?: string } }) {
    return this._artifactsService.search(payload.query, payload.k || 5, payload.filter || {});
  }
}


