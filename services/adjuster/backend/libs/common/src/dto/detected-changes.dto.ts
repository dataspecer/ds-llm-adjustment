import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from "class-validator";

export enum ChangeType {
  ADDITION = 'addition',
  REMOVAL = 'removal',
  RENAME = 'rename',
  TYPE_CHANGE = 'type-change'
}

export class DetectedChange {
  @IsString()
  changeId: string;

  @IsArray()
  @IsEnum(ChangeType, { each: true })
  type: ChangeType[];

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

  @IsOptional()
  @IsString()
  psm?: string;

  @IsOptional()
  @IsString()
  psmIri?: string;
}