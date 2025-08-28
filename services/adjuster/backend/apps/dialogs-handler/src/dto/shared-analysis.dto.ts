import { ChangeDecisionDto } from './change-decision.dto';
import { SchemaChangeDto } from './schema-change.dto';

export interface SharedAnalysisDto {
  analysisId: string;
  oldSchemaName: string;
  newSchemaName: string;
  psmFileName: string;
  changes: SchemaChangeDto[];
  schema: string;
  timestamp: string;
  decisions?: ChangeDecisionDto[];
  sharedBy?: string;
}


