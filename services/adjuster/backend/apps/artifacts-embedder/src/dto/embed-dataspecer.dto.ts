import { ApiProperty } from '@nestjs/swagger';

export class EmbedDataspecerDto {
  @ApiProperty({ description: 'Data Specification IRI', required: true })
  public dataSpecificationIri!: string;

  @ApiProperty({ description: 'PSM IRI', required: false })
  public psmIri?: string;
}


