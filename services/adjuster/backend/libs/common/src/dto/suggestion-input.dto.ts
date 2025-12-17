import { IsString, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { DetectedChange } from './detected-changes.dto';

export class SuggestionInputDto {
  @IsString()
  public dialogId: string;

  @IsOptional()
  @IsString()
  public runId?: string;

  @IsOptional()
  public useRag?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  public changes: DetectedChange[];

  @IsString()
  public psm: string;

  @IsOptional()
  @IsString()
  public ontology?: string;
} 