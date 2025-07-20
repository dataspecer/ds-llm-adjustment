import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { SpecificationMaintainerService } from '../../../services/specification-maintainer/specification-maintainer.service';
import { 
  LlmChatService, 
  ChatConversation, 
  StartChatDto, 
  SendMessageDto 
} from '../../../services/specification-maintainer/llm-chat.service';

export interface SpecificationDto {
  id: string;
  name: string;
  psm: {
    id: string;
    name: string;
    iri: string;
  };
}

export interface AnalyzeSchemaDto {
  specificationId: string;
  schema: string;
  schemaFileName: string;
}

export interface SchemaChangeDto {
  id: string;
  type: 'addition' | 'removal' | 'rename' | 'type-change';
  path: string;
  description: string;
  oldValue?: any;
  newValue?: any;
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

export interface ApplyChangesDto {
  specificationId: string;
  decisions: ChangeDecisionDto[];
}

export interface SharedAnalysisDto {
  analysisId: string;
  oldSchemaName: string;
  newSchemaName: string;
  psmFileName: string;
  changes: SchemaChangeDto[];
  schema: string;
  timestamp: string;
  decisions?: ChangeDecisionDto[];
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

@Controller('specification-maintainer')
export class SpecificationMaintainerController {
  constructor(
    private readonly specificationMaintainerService: SpecificationMaintainerService,
    private readonly llmChatService: LlmChatService
  ) {}

  /**
   * Mock endpoint to get list of specifications from Dataspecer
   */
  @Get('specifications')
  async getSpecifications(@Query('search') search?: string): Promise<SpecificationDto[]> {
    return this.specificationMaintainerService.getSpecifications(search);
  }

  /**
   * Mock endpoint to get a specific specification
   */
  @Get('specifications/:id')
  async getSpecification(@Param('id') id: string): Promise<SpecificationDto> {
    return this.specificationMaintainerService.getSpecification(id);
  }

  /**
   * Analyze a new JSON schema against a selected specification
   */
  @Post('analyze')
  async analyzeSchema(@Body() analyzeDto: AnalyzeSchemaDto): Promise<{ changes: SchemaChangeDto[] }> {
    return this.specificationMaintainerService.analyzeSchema(analyzeDto);
  }

  /**
   * Apply accepted changes to the specification
   */
  @Post('apply-changes')
  async applyChanges(@Body() applyDto: ApplyChangesDto): Promise<{ success: boolean; message: string }> {
    return this.specificationMaintainerService.applyChanges(applyDto);
  }

  /**
   * Generate developer feedback report
   */
  @Post('export-report')
  async exportReport(@Body() applyDto: ApplyChangesDto): Promise<{ report: any }> {
    return this.specificationMaintainerService.exportReport(applyDto);
  }

  /**
   * Generate validation link for developers
   */
  @Post('validation-link')
  async generateValidationLink(@Body() body: { specificationId: string }): Promise<{ token: string; url: string }> {
    return this.specificationMaintainerService.generateValidationLink(body.specificationId);
  }

  /**
   * Validate a schema using a validation token
   */
  @Get('validate')
  async validateWithToken(@Query('token') token: string): Promise<{ valid: boolean; specification: SpecificationDto }> {
    return this.specificationMaintainerService.validateWithToken(token);
  }

  /**
   * Store analysis results for sharing
   */
  @Post('store-analysis')
  async storeAnalysis(@Body() storeDto: StoreAnalysisDto): Promise<{ success: boolean; shareUrl: string }> {
    return this.specificationMaintainerService.storeAnalysis(storeDto);
  }

  /**
   * Retrieve shared analysis results
   */
  @Get('shared-analysis/:id')
  async getSharedAnalysis(@Param('id') analysisId: string): Promise<SharedAnalysisDto> {
    return this.specificationMaintainerService.getSharedAnalysis(analysisId);
  }

  /**
   * Fetch PSM content from IRI
   */
  @Get('fetch-psm')
  async fetchPsmFromIri(@Query('iri') psmIri: string): Promise<{ content: string; name: string }> {
    return this.specificationMaintainerService.fetchPsmFromIri(psmIri);
  }

  // ========== LLM Chat Endpoints ==========

  /**
   * Start a new chat conversation about specific changes
   */
  @Post('chat/start')
  async startChat(@Body() startChatDto: StartChatDto): Promise<ChatConversation> {
    return this.llmChatService.startChat(startChatDto);
  }

  /**
   * Send a message to an existing conversation
   */
  @Post('chat/message')
  async sendMessage(@Body() sendMessageDto: SendMessageDto): Promise<ChatConversation> {
    return this.llmChatService.sendMessage(sendMessageDto);
  }

  /**
   * Get an existing conversation
   */
  @Get('chat/:conversationId')
  async getConversation(@Param('conversationId') conversationId: string): Promise<ChatConversation> {
    return this.llmChatService.getConversation(conversationId);
  }

  /**
   * Get all conversations for specific changes
   */
  @Post('chat/by-changes')
  async getConversationsForChanges(@Body() body: { changeIds: string[] }): Promise<ChatConversation[]> {
    return this.llmChatService.getConversationsForChanges(body.changeIds);
  }

  /**
   * Delete a conversation
   */
  @Post('chat/:conversationId/delete')
  async deleteConversation(@Param('conversationId') conversationId: string): Promise<{ success: boolean }> {
    await this.llmChatService.deleteConversation(conversationId);
    return { success: true };
  }

  /**
   * Regenerate change description based on maintainer feedback
   */
  @Post('regenerate-description')
  async regenerateDescription(@Body() body: { changeId: string; feedback: string; currentChange: SchemaChangeDto }): Promise<{ updatedChange: SchemaChangeDto }> {
    return this.llmChatService.regenerateChangeDescription(body.changeId, body.feedback, body.currentChange);
  }
} 