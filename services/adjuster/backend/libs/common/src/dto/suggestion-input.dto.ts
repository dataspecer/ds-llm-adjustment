import { IsString, IsArray, ValidateNested } from 'class-validator';
import { DetectedChange } from './detected-changes.dto';

export class SuggestionInputDto {
  @IsString()
  dialogId: string;

  @IsArray()
  @ValidateNested({ each: true })
  changes: DetectedChange[];

  @IsString()
  psm: string;
} 