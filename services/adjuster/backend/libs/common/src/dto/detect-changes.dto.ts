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