import { Injectable, OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';

@Injectable()
export class QdrantService implements OnModuleInit {
  // Public properties
  public readonly collectionName: string = process.env.QDRANT_COLLECTION || 'artifacts';

  // Private properties
  private _client!: QdrantClient;

  // Public methods
  public async onModuleInit(): Promise<void> {
    const url: string = process.env.QDRANT_URL || 'http://qdrant:6333';
    this._client = new QdrantClient({ url });
    await this.ensureCollection();
  }

  public async upsertPoints(points: Array<{ id: string; vector: number[]; payload: Record<string, any> }>): Promise<void> {
    await this._client.upsert(this.collectionName, {
      wait: true,
      points: points.map(p => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    });
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
      const exists: boolean = await this._client.collectionExists(this.collectionName);
      if (!exists) {
        await this._client.createCollection(this.collectionName, {
          vectors: { size: Number(process.env.QDRANT_VECTOR_SIZE || 1536), distance: 'Cosine' },
        } as any);
      }
    } catch {
      // Fallback: try creating without exists check
      await this._client.createCollection(this.collectionName, {
        vectors: { size: Number(process.env.QDRANT_VECTOR_SIZE || 1536), distance: 'Cosine' },
      } as any);
    }
  }
}


