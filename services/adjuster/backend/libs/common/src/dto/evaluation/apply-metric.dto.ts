export interface ApplyMetricEventDto {
  runId?: string;
  dialogId?: string;
  planId?: string;
  acceptedActions?: number;
  appliedOk?: boolean;
  validatorFailed?: boolean;
  changedIrisCount?: number;
  timestamp?: string;
}



