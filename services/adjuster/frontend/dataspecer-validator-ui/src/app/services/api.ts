export interface DetectedChange {
  changeId: string;
  type: 'addition' | 'removal' | 'rename' | 'type-change';
  path: string;
  description: string;
  isAcceptable: boolean;
  groupId?: string;
}

export interface DetectedChangesDto {
  dialogId: string;
  changes: DetectedChange[];
}

export interface Suggestion {
  changeId: string;
  suggestion: string;
  rationale: string;
}

export interface SuggestionsDto {
  suggestions: Suggestion[];
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class Api {
  private changesDetectorUrl = process.env.NEXT_PUBLIC_CHANGES_DETECTOR_URL || 'http://localhost:3101';
  private changesSuggesterUrl = process.env.NEXT_PUBLIC_CHANGES_SUGGESTER_URL || 'http://localhost:3102';

  async detectChanges(
    oldApi: string,
    newApi: string,
    psm: string,
    dialogId: string
  ): Promise<ApiResponse<DetectedChangesDto>> {
    try {
      const response = await fetch(`${this.changesDetectorUrl}/api/detect-changes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oldApi,
          newApi,
          psm,
          dialogId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to detect changes');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  async getSuggestions(
    changes: DetectedChangesDto,
    psm: string
  ): Promise<ApiResponse<SuggestionsDto>> {
    try {
      const response = await fetch(`${this.changesSuggesterUrl}/api/suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          changes,
          psm,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get suggestions');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }
}

export const api = new Api(); 