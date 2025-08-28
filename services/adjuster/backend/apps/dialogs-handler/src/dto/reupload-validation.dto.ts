export interface ReuploadValidationSummaryDto {
  addressed: number;
  stillPresent: number;
  unclear: number;
}

export type ReuploadValidationStatus = 'addressed' | 'still-present' | 'unclear';

export interface ReuploadValidationItemDto {
  changeId: string;
  decision?: string;
  status: ReuploadValidationStatus;
  notes?: string;
}

export interface ReuploadValidationDto {
  analysisId: string;
  summary: ReuploadValidationSummaryDto;
  items: ReuploadValidationItemDto[];
}



