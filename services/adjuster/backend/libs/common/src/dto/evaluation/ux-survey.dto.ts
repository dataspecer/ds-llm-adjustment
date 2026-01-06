export type UxRole = 'Developer' | 'Maintainer' | 'Other';

export interface UxSurveyDto {
  runId?: string;
  dialogId?: string;
  role: UxRole;
  helpfulnessLikert: number; // 1-7
  susItems?: number[]; // 10 items, each 1-5
  susScore?: number; // 0-100 (computed)
  comments?: string;
  timestamp?: string;
}



