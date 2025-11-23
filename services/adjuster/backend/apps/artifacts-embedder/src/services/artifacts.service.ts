import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import { EmbeddingsService } from './embeddings.service';
import { QdrantService } from './qdrant.service';
import { DataspecerClientService } from './dataspecer-client.service';

@Injectable()
export class ArtifactsService {
  // Private properties
  private readonly _defaultChunkSize: number = 2000;

  public constructor(
    private readonly _embeddings: EmbeddingsService,
    private readonly _qdrant: QdrantService,
    private readonly _dataspecer: DataspecerClientService,
  ) {}

  // Public methods
  public async embedFromDataspecer(dto: { dataSpecificationIri: string; psmIri?: string }): Promise<number> {
    const dataspecerBaseUrl: string = process.env.DATASPECER_BACKEND_URL || process.env.DATASPECER_API_URL || 'http://dataspecer:80';
    const results: Array<{ id: string; type: string; content: string; metadata?: Record<string, any> }> = [];
    try {
      if (dto.psmIri) {
        const psm: string = await this._dataspecer.getPsm(dataspecerBaseUrl, dto.psmIri);
        results.push({
          id: `psm:${dto.psmIri}`,
          type: 'psm',
          content: psm,
          metadata: { psmIri: dto.psmIri, dataSpecificationIri: dto.dataSpecificationIri, source: 'dataspecer' },
        });
      }
    } catch {}
    try {
      const schema: string = await this._dataspecer.getJsonSchema(dataspecerBaseUrl, dto.dataSpecificationIri, dto.psmIri);
      results.push({
        id: `json-schema:${dto.dataSpecificationIri}`,
        type: 'json-schema',
        content: schema,
        metadata: { psmIri: dto.psmIri, dataSpecificationIri: dto.dataSpecificationIri, source: 'dataspecer' },
      });
    } catch {}
    return this.embedDocuments(results);
  }

  public async embedDocuments(documents: Array<{ id: string; type: string; content: string; metadata?: Record<string, any> }>): Promise<number> {
    const points: Array<{ id: string; vector: number[]; payload: Record<string, any> }> = [];
    for (const doc of documents) {
      const chunks: string[] = this._chunkText(doc.content, this._defaultChunkSize);
      for (let i = 0; i < chunks.length; i += 1) {
        const text: string = chunks[i];
        const vector: number[] = await this._embeddings.embedText(text);
        const id: string = `${doc.id}#${i}:${uuidv4()}`;
        const payload: Record<string, any> = {
          type: doc.type,
          ...doc.metadata,
          chunkIndex: i,
          chunkCount: chunks.length,
          text,
        };
        points.push({ id, vector, payload });
      }
    }
    if (points.length > 0) {
      await this._qdrant.upsertPoints(points);
    }
    return points.length;
  }

  public async search(query: string, k: number, filter?: { psmIri?: string; dataSpecificationIri?: string }): Promise<any> {
    const vector: number[] = await this._embeddings.embedText(query);
    const results = await this._qdrant.search(vector, k, filter);
    return results.map((r: any) => ({
      id: r.id,
      score: r.score,
      payload: r.payload,
    }));
  }

  // Private methods
  @Cron(CronExpression.EVERY_6_HOURS)
  private async _scheduledRefresh(): Promise<void> {
    // KISS: Only run if configured
    const autoRefresh: string | undefined = process.env.EMBEDDER_REFRESH_DSV_IRI;
    const psmIri: string | undefined = process.env.EMBEDDER_REFRESH_PSM_IRI;
    if (!autoRefresh) {
      return;
    }
    try {
      await this.embedFromDataspecer({ dataSpecificationIri: autoRefresh, psmIri });
    } catch {
      // swallow errors in cron
    }
  }

  private _chunkText(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    let start: number = 0;
    while (start < text.length) {
      const end: number = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start = end;
    }
    return chunks;
  }
}


