export interface SchemaChangeDto {
  id: string;
  type: 'addition' | 'removal' | 'rename' | 'type-change';
  path: string;
  description: string;
  oldValue?: any;
  newValue?: any;
  lineNumber?: number;
  groupId?: string;
  isAcceptable: boolean;
  isProblematic: boolean;
  suggestion?: string;
  rationale?: string;
  satisfaction?: number; // 1-10
}


