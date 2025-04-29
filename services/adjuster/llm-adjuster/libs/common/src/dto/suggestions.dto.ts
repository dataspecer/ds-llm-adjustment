import { Type } from "ajv/dist/compile/util";
import { IsString, IsOptional, IsNumber, IsArray, ValidateNested } from "class-validator";

export class Suggestion {
    @IsString()
    public changeId: string;
  
    @IsString()
    public suggestion: string;
  
    @IsOptional()
    @IsString()
    public rationale?: string;
  
    @IsOptional()
    @IsNumber()
    public confidence?: number;
  }
  
  export class SuggestionsDto {
    @IsString()
    public dialogId: string;
  
    @IsArray()
    @ValidateNested({ each: true })
    public suggestions: Suggestion[];
  }