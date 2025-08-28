import { IsString, IsArray, ValidateNested, IsOptional } from "class-validator";
import { DetectedChange } from "./detected-changes.dto";
import { Suggestion } from "./suggestions.dto";

export class DialogSummaryDto {
    @IsString()
    public dialogId: string;
  
    @IsArray()
    @ValidateNested({ each: true })
    public changes: DetectedChange[];
  
    @IsArray()
    @ValidateNested({ each: true })
    public suggestions: Suggestion[];
  
    @IsOptional()
    @IsString()
    public status?: string;
  }