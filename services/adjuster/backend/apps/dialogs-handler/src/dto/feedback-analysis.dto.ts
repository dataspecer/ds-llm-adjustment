export interface FeedbackNoteDto {
  changeId: string;
  feedback: string;
}

export interface AnalyzeFeedbackDto {
  specificationId: string;
  changes: Array<{
    id: string;
    type: 'addition' | 'removal' | 'rename' | 'type-change' | string;
    path: string;
    description: string;
    isAcceptable: boolean;
    isProblematic: boolean;
    groupId?: string;
    suggestion?: string;
    rationale?: string;
  }>;
  notes: FeedbackNoteDto[];
}

export interface FeedbackAnalysisItemDto {
  changeId: string;
  risk: 'low' | 'medium' | 'high';
  alignment: 'aligned' | 'partially-aligned' | 'misaligned';
  recommendation: string;
  updatedDescription?: string;
}

export interface FeedbackAnalysisReportDto {
  summary: {
    aligned: number;
    partiallyAligned: number;
    misaligned: number;
  };
  items: FeedbackAnalysisItemDto[];
}


