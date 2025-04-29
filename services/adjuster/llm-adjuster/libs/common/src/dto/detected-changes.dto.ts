import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from "class-validator";

export class DetectedChange {
  @IsString()
  changeId: string;

  @IsEnum(['addition', 'removal', 'rename', 'type-change'])
  type: string;

  @IsString()
  path: string;

  @IsString()
  description: string;

  @IsBoolean()
  isAcceptable: boolean;

  @IsOptional()
  @IsString()
  groupId?: string;
}

export class DetectedChangesDto {
  @IsString()
  dialogId: string;

  @IsArray()
  @ValidateNested({ each: true })
  changes: DetectedChange[];
}