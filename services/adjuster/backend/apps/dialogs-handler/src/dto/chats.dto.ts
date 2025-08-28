import { SchemaChangeDto } from "./schema-change.dto";

export interface ChatMessage {
    id: string;
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp: Date;
    changeIds?: string[];
  }
  
  export interface ChatConversation {
    id: string;
    changeIds: string[];
    changes: SchemaChangeDto[];
    messages: ChatMessage[];
    createdAt: Date;
    updatedAt: Date;
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
  
  export interface GenerateDeveloperReuploadPromptDto {
    specificationId: string;
    changes: SchemaChangeDto[];
    decisions: { changeId: string; decision: 'accept' | 'reject' | 'developer'; comment?: string }[];
    maintainerNote?: string;
    uploadUrl: string;
  }