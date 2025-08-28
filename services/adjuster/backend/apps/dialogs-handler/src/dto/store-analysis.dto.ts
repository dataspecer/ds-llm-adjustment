import { ChangeDecisionDto } from './change-decision.dto';
import { SchemaChangeDto } from './schema-change.dto';

export interface StoreAnalysisDto {
  analysisId: string;
  oldSchemaName: string;
  newSchemaName: string;
  psmFileName: string;
  changes: SchemaChangeDto[];
  schema: string;
  decisions?: ChangeDecisionDto[];
}


