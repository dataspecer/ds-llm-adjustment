import { IsString, IsOptional } from 'class-validator';

export class DetectChangesDto {
  @IsString()
  dialogId: string;

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
  dialogId: string;

  @IsString()
  psmIri: string;

  @IsString()
  oldJsonSchema: string;

  @IsString()
  newJsonSchema: string;

  @IsOptional()
  @IsString()
  artifactFormat?: string;
} 