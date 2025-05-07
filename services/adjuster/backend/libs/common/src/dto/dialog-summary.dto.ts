import { IsString, IsArray, ValidateNested, IsOptional } from "class-validator";
import { DetectedChange } from "./detected-changes.dto";
import { Suggestion } from "./suggestions.dto";

export class DialogSummaryDto {
    @IsString()
    dialogId: string;
  
    @IsArray()
    @ValidateNested({ each: true })
    changes: DetectedChange[];
  
    @IsArray()
    @ValidateNested({ each: true })
    suggestions: Suggestion[];
  
    @IsOptional()
    @IsString()
    status?: string;
  }