import { ApiProperty } from '@nestjs/swagger';

export class EmbeddableDocument {
  @ApiProperty({ description: 'Document identifier', required: true })
  public id!: string;

  @ApiProperty({ description: 'Type of document (json-schema|psm|doc|other)', required: true })
  public type!: string;

  @ApiProperty({ description: 'Plain text content to embed', required: true })
  public content!: string;

  @ApiProperty({ description: 'Optional metadata payload to store with vector', required: false })
  public metadata?: Record<string, any>;
}

export class EmbedDocumentsDto {
  @ApiProperty({ type: [EmbeddableDocument] })
  public documents!: EmbeddableDocument[];
}


