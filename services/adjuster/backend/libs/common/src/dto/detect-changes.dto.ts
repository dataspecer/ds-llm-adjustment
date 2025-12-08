import { IsString, IsOptional } from 'class-validator';

export class DetectChangesDto {
  @IsString()
  dialogId: string;

  @IsOptional()
  @IsString()
  runId?: string;

  @IsString()
  oldApi: string;

  @IsString()
  newApi: string;

  @IsString()
  @IsOptional()
  psm?: string;

  @IsString()
  @IsOptional()
  psmIri?: string;

  @IsOptional()
  @IsString()
  artifactFormat?: string;
}

export class DetectChangesFromIriDto {
  @IsString()
  dialogId: string;

  @IsOptional()
  @IsString()
  runId?: string;

  @IsString()
  psmIri: string;

  @IsString()
  dataSpecificationIri: string;

  @IsString()
  newJsonSchema: string;

  @IsOptional()
  @IsString()
  artifactFormat?: string;
}

export class DetectChangesHybridDto {
  @IsString()
  public dialogId: string;

  @IsOptional()
  @IsString()
  public runId?: string;

  @IsString()
  public psmIri: string;

  @IsString()
  public oldJsonSchema: string;

  @IsString()
  public newJsonSchema: string;

  @IsOptional()
  @IsString()
  public artifactFormat?: string;
}

export class DetectChangesAutomaticDto {
  @IsString()
  public dialogId: string;

  @IsOptional()
  @IsString()
  public runId?: string;

  @IsString()
  public dataSpecificationIri: string;

  @IsString()
  public psmIri: string;

  @IsString()
  public newJsonSchema: string;

  @IsOptional()
  @IsString()
  public artifactFormat?: string;
} 