export enum ChangeType {
  ADDITION = 'addition',
  REMOVAL = 'removal',
  RENAME = 'rename',
  TYPE_CHANGE = 'type-change'
}

export interface DetectedChange {
  changeId: string;
  type: (ChangeType | string)[];
  path: string;
  description: string;
  isAcceptable: boolean;
  groupId?: string;
}

export interface DetectedChangesDto {
  dialogId: string;
  changes: DetectedChange[];
  psm?: string;
  psmIri?: string;
}

export interface Suggestion {
  changeId: string;
  suggestion: string;
  rationale?: string;
}

export interface SuggestionsDto {
  dialogId: string;
  suggestions: Suggestion[];
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class Api {
  private changesDetectorUrl = process.env.NEXT_PUBLIC_CHANGES_DETECTOR_URL || 'http://localhost:3101';
  private changesSuggesterUrl = process.env.NEXT_PUBLIC_CHANGES_SUGGESTER_URL || 'http://localhost:3102';

  async detectChangesFromIri(
    psmIri: string,
    dataSpecificationIri: string,
    newJsonSchema: string,
    dialogId: string
  ): Promise<ApiResponse<DetectedChangesDto>> {
    try {
      const response = await fetch(`${this.changesDetectorUrl}/api/detect-changes-from-iri`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          psmIri,
          dataSpecificationIri,
          newJsonSchema,
          dialogId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to detect changes from IRI');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  async detectChangesHybrid(
    psmIri: string,
    oldJsonSchema: string,
    newJsonSchema: string,
    dialogId: string
  ): Promise<ApiResponse<DetectedChangesDto>> {
    try {
      console.log('Making detectChangesHybrid request to:', `${this.changesDetectorUrl}/api/detect-changes-hybrid`);
      console.log('Request body:', { psmIri, oldJsonSchema: `${oldJsonSchema.length} chars`, newJsonSchema: `${newJsonSchema.length} chars`, dialogId });

      const response = await fetch(`${this.changesDetectorUrl}/api/detect-changes-hybrid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          psmIri,
          oldJsonSchema,
          newJsonSchema,
          dialogId,
        }),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        throw new Error('Failed to detect changes in hybrid mode');
      }

      const data = await response.json();
      console.log('Response data:', data);
      return { data };
    } catch (error) {
      console.error('Error in detectChangesHybrid:', error);
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  async detectChanges(
    oldApi: string,
    newApi: string,
    psm: string,
    dialogId: string,
    psmIri?: string
  ): Promise<ApiResponse<DetectedChangesDto>> {
    try {
      const body: any = {
        oldApi,
        newApi,
        dialogId,
      };

      // Add PSM content or IRI depending on what's provided
      if (psmIri) {
        body.psmIri = psmIri;
      } else {
        body.psm = psm;
      }

      console.log('Making detectChanges request to:', `${this.changesDetectorUrl}/api/detect-changes`);
      console.log('Request body:', { ...body, oldApi: `${oldApi.length} chars`, newApi: `${newApi.length} chars`, psm: `${psm.length} chars` });

      const response = await fetch(`${this.changesDetectorUrl}/api/detect-changes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        throw new Error('Failed to detect changes');
      }

      const data = await response.json();
      console.log('Response data:', data);
      return { data };
    } catch (error) {
      console.error('Error in detectChanges:', error);
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
          changes: changes.changes,
          dialogId: changes.dialogId,
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