export interface ValidatorIssueDto {
  level: 'info' | 'warning' | 'error';
  message: string;
}

export interface ValidatorCheckEventDto {
  runId?: string;
  dialogId?: string;
  planId?: string;
  stage: 'before' | 'after' | 'preview';
  syntacticValid?: boolean;
  roundTripOk?: boolean;
  reportOk?: boolean;
  issues?: ValidatorIssueDto[];
  timestamp?: string;
}



