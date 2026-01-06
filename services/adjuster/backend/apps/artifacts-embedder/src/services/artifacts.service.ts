import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { EmbeddingsService } from './embeddings.service';
import { QdrantService } from './qdrant.service';
import { DataspecerClientService } from './dataspecer-client.service';

@Injectable()
export class ArtifactsService implements OnModuleInit {
  // Private properties
  private readonly _defaultChunkSize: number = 2000;
  private readonly _logger: Logger = new Logger(ArtifactsService.name);

  public constructor(
    private readonly _embeddings: EmbeddingsService,
    private readonly _qdrant: QdrantService,
    private readonly _dataspecer: DataspecerClientService,
  ) {}

  public onModuleInit(): void {
    const hours: number = Number(process.env.EMBEDDER_REFRESH_HOURS || 6);
    const intervalMs: number = Math.max(1, hours) * 60 * 60 * 1000;
    setTimeout(() => {
      void this._scheduledRefresh();
    }, 10_000);
    setInterval(() => {
      void this._scheduledRefresh();
    }, intervalMs);
  }
  // Public methods
  public async embedFromDataspecer(dto: { dataSpecificationIri: string; psmIri?: string }): Promise<number> {
    const dataspecerBaseUrl: string = process.env.DATASPECER_BACKEND_URL || process.env.DATASPECER_API_URL || 'http://dataspecer:80';
    const results: Array<{ id: string; type: string; content: string; metadata?: Record<string, any> }> = [];
    this._logger.log(`Embedding from Dataspecer: dataSpecificationIri=${dto.dataSpecificationIri}${dto.psmIri ? `, psmIri=${dto.psmIri}` : ''}`);
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
      this._logger.log(`Fetched JSON Schema for dataSpecificationIri=${dto.dataSpecificationIri}${dto.psmIri ? ` (psmIri=${dto.psmIri})` : ''}`);
      results.push({
        id: `json-schema:${dto.dataSpecificationIri}`,
        type: 'json-schema',
        content: schema,
        metadata: { psmIri: dto.psmIri, dataSpecificationIri: dto.dataSpecificationIri, source: 'dataspecer' },
      });
    } catch {}
    return this.embedDocuments(results);
  }

  public async manualRefresh(): Promise<void> {
    await this.refreshAll();
  }

  public async embedDocuments(documents: Array<{ id: string; type: string; content: string; metadata?: Record<string, any> }>): Promise<number> {
    const points: Array<{ id: string; vector: number[]; payload: Record<string, any> }> = [];
    for (const doc of documents) {
      const chunks: string[] = this._chunkText(doc.content, this._defaultChunkSize);
      for (let i = 0; i < chunks.length; i += 1) {
        const text: string = chunks[i];
        const vector: number[] = await this._embeddings.embedText(text);
        // Qdrant accepts numeric IDs or UUIDs; use UUID to avoid 400 Bad Request
        const id: string = uuidv4();
        const payload: Record<string, any> = {
          type: doc.type,
          ...doc.metadata,
          sourceId: doc.id,
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

  public async refreshAll(): Promise<{ embedded: number; specs: number; psm: number }> {
    const dataspecerBaseUrl: string = process.env.DATASPECER_BACKEND_URL || process.env.DATASPECER_API_URL || 'http://dataspecer:80';
    const specsPayload: any = await this._dataspecer.listSpecs();
    const roots: any[] = Array.isArray(specsPayload) ? specsPayload : (specsPayload ? [specsPayload] : []);
    this._logger.log(`Starting full refresh. Root count=${roots.length}`);
    let embeddedCount: number = 0;
    let specCount: number = 0;
    let psmCount: number = 0;
    const seenSchemas = new Set<string>();
    const seenPsm = new Set<string>();
    for (const root of roots) {
      const rootIri: string | undefined = root?.iri || root?.id || root?.iriId;
      if (!rootIri) continue;
      this._logger.log(`Traversing root package iri=${rootIri} (children preload=${Array.isArray(root?.subResources) ? root.subResources.length : 0})`);
      const queue: Array<{ iri: string; preloadChildren?: any[] }> = [
        { iri: rootIri, preloadChildren: Array.isArray(root?.subResources) ? root.subResources : undefined }
      ];
      const visited = new Set<string>();
      while (queue.length) {
        const { iri: parent, preloadChildren } = queue.shift()!;
        if (visited.has(parent)) continue;
        visited.add(parent);
        let resources: any[] = [];
        if (Array.isArray(preloadChildren)) {
          resources = preloadChildren;
        } else {
          try {
            resources = await this._dataspecer.listResources(parent);
            this._logger.log(`Listed resources for package iri=${parent}, count=${Array.isArray(resources) ? resources.length : 0}`);
          } catch { resources = []; }
        }
        for (const res of resources) {
          const iri: string | undefined = res?.iri || res?.id;
          if (!iri) continue;
          const types: string[] = Array.isArray(res?.types) ? res.types : (res?.type ? (Array.isArray(res.type) ? res.type : [res.type]) : []);
          const isPackage: boolean = types.some((t: string) => t.toLowerCase().includes('package'));
          if (isPackage) {
            // Try to embed JSON schema for this package (only succeeds for proper data specifications)
            try {
              if (!seenSchemas.has(iri)) {
                const schema: string = await this._dataspecer.getJsonSchema(dataspecerBaseUrl, iri);
                this._logger.log(`Embedded JSON Schema for package iri=${iri}`);
                embeddedCount += await this.embedDocuments([
                  {
                    id: `json-schema:${iri}`,
                    type: 'json-schema',
                    content: schema,
                    metadata: { dataSpecificationIri: iri, source: 'dataspecer' },
                  },
                ]);
                specCount += 1;
                seenSchemas.add(iri);
              }
            } catch (e) {
              this._logger.warn(`Schema fetch failed for package iri=${iri}; continuing. ${e instanceof Error ? e.message : ''}`);
            }
            const children = Array.isArray(res?.subResources) ? res.subResources : undefined;
            queue.push({ iri, preloadChildren: children });
            continue;
          }
          const looksLikeModel: boolean =
            types.some((t: string) => {
              const lower = t.toLowerCase();
              return (
                lower.endsWith('/v1/psm') ||
                lower.includes('/local/semantic-model') ||
                lower.includes('/pim-store-wrapper') ||
                lower.includes('/sgov') ||
                lower.includes('/rdfs') ||
                lower.includes('/visual-model') ||
                lower.includes('/in-memory-semantic-model')
              );
            });
          if (looksLikeModel) {
            try {
              if (!seenPsm.has(iri)) {
                const psm: string = await this._dataspecer.getPsm(dataspecerBaseUrl, iri);
                this._logger.log(`Embedded PSM for resource iri=${iri}`);
                embeddedCount += await this.embedDocuments([
                  {
                    id: `psm:${iri}`,
                    type: 'psm',
                    content: psm,
                    metadata: { psmIri: iri, source: 'dataspecer' },
                  },
                ]);
                psmCount += 1;
                seenPsm.add(iri);
              }
            } catch (e) {
              this._logger.warn(`PSM fetch failed for resource iri=${iri}; continuing. ${e instanceof Error ? e.message : ''}`);
            }
          }
        }
      }
    }
    return { embedded: embeddedCount, specs: specCount, psm: psmCount };
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
  private async _scheduledRefresh(): Promise<void> {
    const autoRefresh: string | undefined = process.env.EMBEDDER_REFRESH_DSV_IRI;
    const psmIri: string | undefined = process.env.EMBEDDER_REFRESH_PSM_IRI;
    try {
      if (autoRefresh) {
        await this.embedFromDataspecer({ dataSpecificationIri: autoRefresh, psmIri });
      } else {
        await this.refreshAll();
      }
    } catch {}
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


