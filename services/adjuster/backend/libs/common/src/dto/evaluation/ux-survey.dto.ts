export type UxRole = 'Developer' | 'Maintainer' | 'Other';

export interface UxSurveyDto {
  runId?: string;
  dialogId?: string;
  role: UxRole;
  helpfulnessLikert: number; // 1-7
  susScore?: number; // 0-100
  comments?: string;
  timestamp?: string;
}



