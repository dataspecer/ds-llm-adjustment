export type McpEventType = 'preview_apply' | 'apply_changes';

export interface McpSafetyEventDto {
  runId?: string;
  dialogId?: string;
  planId?: string;
  eventType: McpEventType;
  hadPriorPreview?: boolean;
  blockedByGuardrails?: boolean;
  auditId?: string;
  issuesCount?: number;
  ok?: boolean;
  timestamp?: string;
}



