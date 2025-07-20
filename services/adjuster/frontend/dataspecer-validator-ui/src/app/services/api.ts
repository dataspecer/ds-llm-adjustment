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
  private changesDetectorUrl = process.env.NEXT_PUBLIC_CHANGES_DETECTOR_URL || 'http://localhost:3101';
  private changesSuggesterUrl = process.env.NEXT_PUBLIC_CHANGES_SUGGESTER_URL || 'http://localhost:3102';
  private dialogHandlerUrl = process.env.NEXT_PUBLIC_DIALOG_HANDLER_URL || 'http://localhost:3101';

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

  // New methods for Specification Maintainer workflow

  async getSpecifications(search?: string): Promise<ApiResponse<SpecificationDto[]>> {
    try {
      const url = new URL(`${this.dialogHandlerUrl}/api/specification-maintainer/specifications`);
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

  async getSpecification(id: string): Promise<ApiResponse<SpecificationDto>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specification-maintainer/specifications/${id}`, {
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
      const response = await fetch(`${this.dialogHandlerUrl}/api/specification-maintainer/analyze`, {
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
      const response = await fetch(`${this.dialogHandlerUrl}/api/specification-maintainer/apply-changes`, {
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
      const response = await fetch(`${this.dialogHandlerUrl}/api/specification-maintainer/export-report`, {
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
      const response = await fetch(`${this.dialogHandlerUrl}/api/specification-maintainer/validation-link`, {
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
      const response = await fetch(`${this.dialogHandlerUrl}/api/specification-maintainer/validate?token=${encodeURIComponent(token)}`, {
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
      const response = await fetch(`${this.dialogHandlerUrl}/api/specification-maintainer/store-analysis`, {
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
      const response = await fetch(`${this.dialogHandlerUrl}/api/specification-maintainer/shared-analysis/${encodeURIComponent(analysisId)}`, {
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
   * Fetch PSM content from IRI
   */
  async fetchPsmFromIri(psmIri: string): Promise<ApiResponse<{ content: string; name: string }>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specification-maintainer/fetch-psm?iri=${encodeURIComponent(psmIri)}`, {
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

  // ========== LLM Chat Methods ==========

  /**
   * Start a new chat conversation about specific changes
   */
  async startChat(startChatDto: StartChatDto): Promise<ApiResponse<ChatConversation>> {
    try {
      const response = await fetch(`${this.dialogHandlerUrl}/api/specification-maintainer/chat/start`, {
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
      const response = await fetch(`${this.dialogHandlerUrl}/api/specification-maintainer/chat/message`, {
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
      const response = await fetch(`${this.dialogHandlerUrl}/api/specification-maintainer/chat/${encodeURIComponent(conversationId)}`, {
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
      const response = await fetch(`${this.dialogHandlerUrl}/api/specification-maintainer/chat/by-changes`, {
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
      const response = await fetch(`${this.dialogHandlerUrl}/api/specification-maintainer/chat/${encodeURIComponent(conversationId)}/delete`, {
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
      const response = await fetch(`${this.dialogHandlerUrl}/api/specification-maintainer/regenerate-description`, {
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
}

export const api = new Api(); 