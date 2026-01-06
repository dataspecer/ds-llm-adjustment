import { ApiProperty } from '@nestjs/swagger';

export class SearchQueryDto {
  @ApiProperty({ description: 'Free-text query to search', required: true })
  public query!: string;

  @ApiProperty({ description: 'Top K results', required: false, default: 5 })
  public k?: number;

  @ApiProperty({ description: 'Optional PSM IRI filter', required: false })
  public psmIri?: string;

  @ApiProperty({ description: 'Optional Data Specification IRI filter', required: false })
  public dataSpecificationIri?: string;
}


