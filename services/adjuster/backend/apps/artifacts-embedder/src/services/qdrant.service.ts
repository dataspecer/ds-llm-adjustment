import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';

@Injectable()
export class QdrantService implements OnModuleInit {
  // Public properties
  public readonly collectionName: string = process.env.QDRANT_COLLECTION || 'artifacts';

  // Private properties
  private _client!: QdrantClient;
  private readonly _logger: Logger = new Logger(QdrantService.name);
  private readonly _expectedSize: number = Number(process.env.QDRANT_VECTOR_SIZE || 1536);

  // Public methods
  public async onModuleInit(): Promise<void> {
    const url: string = process.env.QDRANT_URL || 'http://qdrant:6333';
    this._client = new QdrantClient({ url });
    await this.ensureCollection();
  }

  public async upsertPoints(points: Array<{ id: string; vector: number[]; payload: Record<string, any> }>): Promise<void> {
    const validPoints = points.filter(p =>
      Array.isArray(p.vector) &&
      p.vector.length === this._expectedSize &&
      p.vector.every((x) => Number.isFinite(x))
    );
    const rejected = points.length - validPoints.length;
    if (rejected > 0) {
      this._logger.warn(`Filtered out ${rejected} invalid vectors (expected size=${this._expectedSize}). Upserting ${validPoints.length}.`);
    }
    if (validPoints.length === 0) {
      return;
    }
    const batchSize = Number(process.env.QDRANT_BATCH_SIZE || 64);
    const batches: Array<typeof validPoints> = [];
    for (let i = 0; i < validPoints.length; i += batchSize) {
      batches.push(validPoints.slice(i, i + batchSize));
    }
    for (const batch of batches) {
      try {
        await this._client.upsert(this.collectionName, {
          wait: true,
          points: batch.map(p => ({
            id: p.id,
            vector: p.vector,
            payload: p.payload,
          })),
        });
      } catch (e: any) {
        const errText = e?.response?.data || e?.data || e?.message || e;
        this._logger.error(`Qdrant upsert batch failed: ${typeof errText === 'string' ? errText : JSON.stringify(errText)}`);
        // Diagnose failing points one-by-one to continue with the rest
        for (const point of batch) {
          try {
            await this._client.upsert(this.collectionName, {
              wait: true,
              points: [point],
            });
          } catch (ee: any) {
            const eeText = ee?.response?.data || ee?.data || ee?.message || ee;
            this._logger.error(`Qdrant upsert failed for point id=${point.id}, vecLen=${point.vector?.length}, payloadKeys=${Object.keys(point.payload || {}).join(',')} -> ${typeof eeText === 'string' ? eeText : JSON.stringify(eeText)}`);
          }
        }
      }
    }
  }

  public async search(vector: number[], topK: number, filter?: Record<string, any>): Promise<Array<{ id: string; score: number; payload: any }>> {
    const res: any = await this._client.search(this.collectionName, {
      vector,
      limit: topK,
      ...(filter ? { filter: { must: Object.entries(filter).filter(([_, v]) => !!v).map(([key, value]) => ({ key, match: { value } })) } } : {}),
      with_payload: true,
    });
    return res as Array<{ id: string; score: number; payload: any }>;
  }

  // Private methods
  private async ensureCollection(): Promise<void> {
    try {
      const { exists } = await this._client.collectionExists(this.collectionName);
      if (!exists) {
        await this._client.createCollection(this.collectionName, {
          vectors: { size: this._expectedSize, distance: 'Cosine' },
        } as any);
        this._logger.log(`Created Qdrant collection "${this.collectionName}" with size=${this._expectedSize}, distance=Cosine`);
      } else {
        try {
          const info: any = await this._client.getCollection(this.collectionName);
          const actual = info?.result?.config?.params?.vectors?.size ?? info?.result?.vectors?.size;
          if (typeof actual === 'number' && actual !== this._expectedSize) {
            this._logger.warn(`Qdrant collection "${this.collectionName}" vector size mismatch: actual=${actual}, expected=${this._expectedSize}. Upserts may fail with 400.`);
          }
        } catch {}
      }
    } catch {
      // Fallback: try creating without exists check
      await this._client.createCollection(this.collectionName, {
        vectors: { size: this._expectedSize, distance: 'Cosine' },
      } as any);
      this._logger.log(`Created Qdrant collection (fallback) "${this.collectionName}" with size=${this._expectedSize}, distance=Cosine`);
    }
  }
}


