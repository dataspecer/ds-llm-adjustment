export interface AcceptedChangeDto {
  changeId: string;
  analysisId: string;
  type: 'addition' | 'removal' | 'rename' | 'type-change';
  path: string;
  description: string;
  comment?: string;
  timestamp: string;
  oldSchemaName: string;
  newSchemaName: string;
  psmFileName: string;
  suggestion?: string;
  rationale?: string;
}


