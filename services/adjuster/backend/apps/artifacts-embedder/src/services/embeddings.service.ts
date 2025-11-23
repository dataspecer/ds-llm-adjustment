import { Injectable } from '@nestjs/common';
import { OpenAIEmbeddings } from '@langchain/openai';

@Injectable()
export class EmbeddingsService {
  // Public properties
  public readonly dimension: number = 1536; // text-embedding-3-small

  // Private properties
  private _embeddings: OpenAIEmbeddings;

  constructor() {
    this._embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'text-embedding-3-small',
    });
  }

  // Public methods
  public async embedText(text: string): Promise<number[]> {
    const vector: number[] = await this._embeddings.embedQuery(text);
    return vector;
  }
}


