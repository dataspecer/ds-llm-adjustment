export interface ChangeDecisionDto {
  changeId: string;
  decision: 'accept' | 'reject' | 'developer';
  comment?: string;
}


