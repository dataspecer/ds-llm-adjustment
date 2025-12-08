import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from "class-validator";

export enum ChangeType {
  ADDITION = 'addition',
  REMOVAL = 'removal',
  RENAME = 'rename',
  TYPE_CHANGE = 'type-change'
}

export class DetectedChange {
  @IsString()
  public changeId: string;

  @IsArray()
  @IsEnum(ChangeType, { each: true })
  public type: ChangeType[];

  @IsString()
  public path: string;

  @IsString()
  public description: string;

  @IsBoolean()
  public isAcceptable: boolean;

  @IsOptional()
  @IsString()
  public groupId?: string;
}

export class DetectedChangesDto {
  @IsString()
  public dialogId: string;

  @IsOptional()
  @IsString()
  public runId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  public changes: DetectedChange[];

  @IsOptional()
  @IsString()
  public psm?: string;

  @IsOptional()
  @IsString()
  public psmIri?: string;
}