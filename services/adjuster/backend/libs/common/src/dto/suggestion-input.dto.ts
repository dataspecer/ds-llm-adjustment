import { IsString, IsArray, ValidateNested } from 'class-validator';
import { DetectedChange } from './detected-changes.dto';

export class SuggestionInputDto {
  @IsString()
  public dialogId: string;

  @IsArray()
  @ValidateNested({ each: true })
  public changes: DetectedChange[];

  @IsString()
  public psm: string;
} 