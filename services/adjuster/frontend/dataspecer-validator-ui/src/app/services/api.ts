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

// ===== Evaluation DTOs =====
export type EvalChangeKind = 'addition' | 'removal' | 'modify' | 'rename' | 'type-change';

export interface EvalTypedChangeRef {
  id: string;
  type: EvalChangeKind;
  path: string;
}

export interface EvalPerTypeScores {
  type: EvalChangeKind;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface DiffQualityInputDto {
  runId: string;
  gold: EvalTypedChangeRef[];
  predicted: EvalTypedChangeRef[];
}

export interface DiffQualityResultDto {
  runId: string;
  perType: EvalPerTypeScores[];
  microAveraged: {
    precision: number;
    recall: number;
    f1: number;
  };
}

export type UxRole = 'Developer' | 'Maintainer' | 'Other';
export interface UxSurveyDto {
  runId?: string;
  dialogId?: string;
  role: UxRole;
  helpfulnessLikert: number; // 1-7
  susScore?: number; // 0-100
  comments?: string;
}

// New interfaces for Specification Maintainer workflow
export interface SpecificationDto {
  id: string;
  name: string;
  psm: {
    id: string;
    name: string;
    iri: string;
  };
}

export interface SchemaChangeDto {
  id: string;
  type: 'addition' | 'removal' | 'rename' | 'type-change';
  path: string;
  description: string;
  oldValue?: unknown;
  newValue?: unknown;
  lineNumber?: number;
  groupId?: string;
  isAcceptable: boolean;
  isProblematic: boolean;
  suggestion?: string;
  rationale?: string;
}

export interface ChangeDecisionDto {
  changeId: string;
  decision: 'accept' | 'reject' | 'developer';
  comment?: string;
}

export interface SharedAnalysisDto {
  analysisId: string;
  oldSchemaName: string;
  newSchemaName: string;
  psmFileName: string;
  changes: SchemaChangeDto[];
  decisions?: ChangeDecisionDto[];
  schema: string;
  timestamp: string;
  sharedBy?: string;
}

export interface StoreAnalysisDto {
  analysisId: string;
  oldSchemaName: string;
  newSchemaName: string;
  psmFileName: string;
  changes: SchemaChangeDto[];
  schema: string;
  decisions?: ChangeDecisionDto[];
}

export interface AcceptedChangeDto {
  changeId: string;
  analysisId: string;
  type: 'addition' | 'removal' | 'rename' | 'type-change';
  path: string;
  description: string;
  comment?: string;
  timestamp: string;
  oldSchemaName: string;
  newSchemaName: string;
  psmFileName: string;
  suggestion?: string;
  rationale?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Chat interfaces
export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
  changeIds?: string[];
}

export interface ChatConversation {
  id: string;
  changeIds: string[];
  changes: SchemaChangeDto[];
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface StartChatDto {
  changeIds: string[];
  changes: SchemaChangeDto[];
  initialPrompt?: string;
}

export interface SendMessageDto {
  conversationId: string;
  message: string;
}

class Api {
  private changesDetectorUrl = process.env.NEXT_PUBLIC_CHANGES_DETECTOR_URL || 'http://localhost:3000/detector';
  private changesSuggesterUrl = process.env.NEXT_PUBLIC_CHANGES_SUGGESTER_URL || 'http://localhost:3000/suggester';
  private dialogHandlerUrl = process.env.NEXT_PUBLIC_DIALOG_HANDLER_URL || 'http://localhost:3000/dialogs-handler';
  private dataspecerBackendUrl = process.env.NEXT_PUBLIC_DATASPECER_BACKEND || 'http://localhost:3000/dataspecer';

  // ===== Evaluation API =====
  async submitEvaluationDiff(payload: DiffQualityInputDto): Promise<ApiResponse<DiffQualityResultDto>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/evaluation/diff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error('Failed to submit diff evaluation');
      }
      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  async submitUxSurvey(payload: UxSurveyDto): Promise<ApiResponse<{ ok: true }>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/evaluation/ux`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error('Failed to submit UX survey');
      }
      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  async detectChangesFromIri(
    psmIri: string,
    dataSpecificationIri: string,
    newJsonSchema: string,
    dialogId: string
  ): Promise<ApiResponse<DetectedChangesDto>> {
    try {
      const response = await fetch(`${this.changesDetectorUrl}/api/changes/detections/from-iri`, {
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
      console.log('Making detectChangesHybrid request to:', `${this.changesDetectorUrl}/api/changes/detections/hybrid`);
      console.log('Request body:', { psmIri, oldJsonSchema: `${oldJsonSchema.length} chars`, newJsonSchema: `${newJsonSchema.length} chars`, dialogId });

      const response = await fetch(`${this.changesDetectorUrl}/api/changes/detections/hybrid`, {
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

  /**
   * Automatically detects changes by fetching both old JSON schema and PSM from Dataspecer using DSV approach.
   * This eliminates the need for manual JSON schema uploads.
   */
  async detectChangesAutomatic(
    dataSpecificationIri: string,
    psmIri: string,
    newJsonSchema: string,
    dialogId: string
  ): Promise<ApiResponse<DetectedChangesDto>> {
    try {
      console.log('Making detectChangesAutomatic request to:', `${this.changesDetectorUrl}/api/changes/detections/automatic`);
      console.log('Request body:', { dataSpecificationIri, psmIri, newJsonSchema: `${newJsonSchema.length} chars`, dialogId });

      const response = await fetch(`${this.changesDetectorUrl}/api/changes/detections/automatic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataSpecificationIri,
          psmIri,
          newJsonSchema,
          dialogId,
        }),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to automatically detect changes: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('detectChangesAutomatic response data:', data);
      return { data };
    } catch (error) {
      console.error('Error in detectChangesAutomatic:', error);
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
      const body: Record<string, unknown> = {
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

      console.log('Making detectChanges request to:', `${this.changesDetectorUrl}/api/changes/detections/raw`);
      console.log('Request body:', { ...body, oldApi: `${oldApi.length} chars`, newApi: `${newApi.length} chars`, psm: `${psm.length} chars` });

      const response = await fetch(`${this.changesDetectorUrl}/api/changes/detections/raw`, {
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

  // New methods for Specification Maintainer workflow

  async getSpecifications(search?: string): Promise<ApiResponse<SpecificationDto[]>> {
    try {
      const url = new URL(`${this.dialogHandlerUrl}/api/specifications`);
      if (search) {
        url.searchParams.append('search', search);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch specifications');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  async getSpecification(idOrIri: string): Promise<ApiResponse<SpecificationDto>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specifications/psm?iri=${encodeURIComponent(idOrIri)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch specification');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  async analyzeSchema(specificationId: string, schema: string, schemaFileName: string): Promise<ApiResponse<{ changes: SchemaChangeDto[] }>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specifications/analyses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          specificationId,
          schema,
          schemaFileName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze schema');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  async applyChanges(specificationId: string, decisions: ChangeDecisionDto[]): Promise<ApiResponse<{ success: boolean; message: string }>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specifications/changes/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          specificationId,
          decisions,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to apply changes');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  async exportReport(specificationId: string, decisions: ChangeDecisionDto[]): Promise<ApiResponse<{ report: unknown }>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specifications/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          specificationId,
          decisions,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to export report');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  async generateValidationLink(specificationId: string): Promise<ApiResponse<{ token: string; url: string }>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specifications/validation-links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          specificationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate validation link');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  async validateWithToken(token: string): Promise<ApiResponse<{ valid: boolean; specification: SpecificationDto }>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specifications/validation?token=${encodeURIComponent(token)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to validate token');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Store analysis results for sharing
   */
  async storeAnalysis(storeDto: StoreAnalysisDto): Promise<ApiResponse<{ success: boolean; shareUrl: string }>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specifications/analyses/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(storeDto),
      });

      if (!response.ok) {
        throw new Error('Failed to store analysis');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Retrieve shared analysis results
   */
  async getSharedAnalysis(analysisId: string): Promise<ApiResponse<SharedAnalysisDto>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specifications/analyses/${encodeURIComponent(analysisId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve shared analysis');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Validate developer re-upload against shared analysis
   */
  async validateReuploadAgainstAnalysis(
    analysisId: string,
    newSchema: string
  ): Promise<ApiResponse<{ analysisId: string; summary: { addressed: number; stillPresent: number; unclear: number }; items: Array<{ changeId: string; decision?: string; status: 'addressed' | 'still-present' | 'unclear'; notes?: string }> }>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specifications/analyses/${encodeURIComponent(analysisId)}/reupload-validations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newSchema }),
      });

      if (!response.ok) {
        throw new Error('Failed to validate re-upload');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Fetch PSM content from IRI
   */
  async fetchPsmFromIri(psmIri: string): Promise<ApiResponse<{ content: string; name: string }>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specifications/psm?iri=${encodeURIComponent(psmIri)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch PSM from IRI');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Fetch JSON Schema from Dataspecer using DSV approach
   */
  async fetchJsonSchemaFromDsv(dataSpecificationIri: string): Promise<ApiResponse<{ content: string; name: string }>> {
    try {
      const response = await fetch(`${this.changesDetectorUrl}/api/changes/schemas/dsv?dataSpecificationIri=${encodeURIComponent(dataSpecificationIri)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch JSON schema via DSV');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  // ========== LLM Chat Methods ==========

  /**
   * Start a new chat conversation about specific changes
   */
  async startChat(startChatDto: StartChatDto): Promise<ApiResponse<ChatConversation>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specifications/chats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(startChatDto),
      });

      if (!response.ok) {
        throw new Error('Failed to start chat conversation');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Send a message to an existing conversation
   */
  async sendMessage(sendMessageDto: SendMessageDto): Promise<ApiResponse<ChatConversation>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specifications/chats/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sendMessageDto),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get an existing conversation
   */
  async getConversation(conversationId: string): Promise<ApiResponse<ChatConversation>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specifications/chats/${encodeURIComponent(conversationId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get conversation');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get all conversations for specific changes
   */
  async getConversationsForChanges(changeIds: string[]): Promise<ApiResponse<ChatConversation[]>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specifications/chats/by-changes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ changeIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to get conversations for changes');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specifications/chats/${encodeURIComponent(conversationId)}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Regenerate change description based on maintainer feedback
   */
  async regenerateChangeDescription(changeId: string, feedback: string, currentChange: SchemaChangeDto): Promise<ApiResponse<{ updatedChange: SchemaChangeDto }>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specifications/changes/regenerate-description`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          changeId,
          feedback,
          currentChange,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate change description');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Get all accepted changes from stored analyses
   */
  async getAcceptedChanges(): Promise<ApiResponse<{ acceptedChanges: AcceptedChangeDto[] }>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specifications/changes/accepted`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch accepted changes');
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'An error occurred',
      };
    }
  }

  /**
   * Generate a developer-facing prompt and validation link for re-upload after maintainer review
   */
  async generateDeveloperReuploadPrompt(
    specificationId: string,
    changes: SchemaChangeDto[],
    decisions: ChangeDecisionDto[],
    maintainerNote?: string
  ): Promise<ApiResponse<{ prompt: string; token: string; url: string }>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specifications/${encodeURIComponent(specificationId)}/developer-reupload-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ specificationId, changes, decisions, maintainerNote }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate developer re-upload prompt');
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