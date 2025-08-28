import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SpecificationMaintainerService } from '../../../services/specification-maintainer/specification-maintainer.service';
import { 
  LlmChatService, 
} from '../../../services/specification-maintainer/llm-chat.service';
import { SpecificationDto } from '../../../dto/specification.dto';
import { AnalyzeSchemaDto } from '../../../dto/analyze-schema.dto';
import { SchemaChangeDto } from '../../../dto/schema-change.dto';
import { ChangeDecisionDto } from '../../../dto/change-decision.dto';
import { ApplyChangesDto } from '../../../dto/apply-changes.dto';
import { SharedAnalysisDto } from '../../../dto/shared-analysis.dto';
import { StoreAnalysisDto } from '../../../dto/store-analysis.dto';
import { AcceptedChangeDto } from '../../../dto/accepted-change.dto';
import { DeveloperReuploadPromptDto } from '../../../dto/developer-reupload-prompt.dto';
import { ReuploadValidationDto } from '../../../dto/reupload-validation.dto';
import { ChatConversation, StartChatDto, SendMessageDto } from '../../../dto/chats.dto';
import { AnalyzeFeedbackDto, FeedbackAnalysisReportDto } from '../../../dto/feedback-analysis.dto';

 

@ApiTags('specifications')
@Controller('specifications')
export class SpecificationMaintainerController {
  constructor(
    private readonly specificationMaintainerService: SpecificationMaintainerService,
    private readonly llmChatService: LlmChatService
  ) {}

  /**
   * Mock endpoint to get list of specifications from Dataspecer
   */
  @Get()
  @ApiOperation({ summary: 'List specifications' })
  @ApiQuery({ name: 'search', required: false })
  @ApiOkResponse({ schema: { type: 'array', items: { type: 'object' } } })
  public async getSpecifications(@Query('search') search?: string): Promise<SpecificationDto[]> {
    return this.specificationMaintainerService.getSpecifications(search);
  }

  /**
   * Get a specific specification by IRI (provided as query param to avoid route conflicts)
   */
  @Get('by-iri')
  @ApiOperation({ summary: 'Get specification by IRI' })
  @ApiQuery({ name: 'iri', required: true })
  @ApiOkResponse({ schema: { type: 'object' } })
  public async getSpecificationByIri(@Query('iri') iri: string): Promise<SpecificationDto> {
    return this.specificationMaintainerService.getSpecification(iri);
  }

  

  /**
   * Analyze a new JSON schema against a selected specification
   */
  @Post('analyses')
  @ApiOperation({ summary: 'Analyze new JSON schema against specification' })
  @ApiBody({ schema: { type: 'object' } })
  @ApiOkResponse({ schema: { type: 'object' } })
  public async analyzeSchema(@Body() analyzeDto: AnalyzeSchemaDto): Promise<{ changes: SchemaChangeDto[] }> {
    return this.specificationMaintainerService.analyzeSchema(analyzeDto);
  }

  /**
   * Apply accepted changes to the specification
   */
  @Post('changes/apply')
  @ApiOperation({ summary: 'Apply accepted changes to the specification' })
  @ApiBody({ schema: { type: 'object' } })
  @ApiOkResponse({ schema: { type: 'object' } })
  public async applyChanges(@Body() applyDto: ApplyChangesDto): Promise<{ success: boolean; message: string }> {
    return this.specificationMaintainerService.applyChanges(applyDto);
  }

  /**
   * Generate developer feedback report
   */
  @Post('reports')
  @ApiOperation({ summary: 'Generate developer feedback report' })
  @ApiBody({ schema: { type: 'object' } })
  @ApiOkResponse({ schema: { type: 'object' } })
  public async exportReport(@Body() applyDto: ApplyChangesDto): Promise<{ report: any }> {
    return this.specificationMaintainerService.exportReport(applyDto);
  }

  /**
   * Generate validation link for developers
   */
  @Post('validation-links')
  @ApiOperation({ summary: 'Generate validation link for developers' })
  @ApiBody({ schema: { type: 'object' } })
  @ApiOkResponse({ schema: { type: 'object' } })
  public async generateValidationLink(@Body() body: { specificationId: string }): Promise<{ token: string; url: string }> {
    return this.specificationMaintainerService.generateValidationLink(body.specificationId);
  }

  /**
   * Validate a schema using a validation token
   */
  @Get('validation')
  @ApiOperation({ summary: 'Validate a schema using a validation token' })
  @ApiQuery({ name: 'token', required: true })
  @ApiOkResponse({ schema: { type: 'object' } })
  public async validateWithToken(@Query('token') token: string): Promise<{ valid: boolean; specification: SpecificationDto }> {
    return this.specificationMaintainerService.validateWithToken(token);
  }

  /**
   * Store analysis results for sharing
   */
  @Post('analyses/share')
  @ApiOperation({ summary: 'Store analysis results for sharing' })
  @ApiBody({ schema: { type: 'object' } })
  @ApiOkResponse({ schema: { type: 'object' } })
  public async storeAnalysis(@Body() storeDto: StoreAnalysisDto): Promise<{ success: boolean; shareUrl: string }> {
    return this.specificationMaintainerService.storeAnalysis(storeDto);
  }

  /**
   * Retrieve shared analysis results
   */
  @Get('analyses/:analysisId')
  @ApiOperation({ summary: 'Retrieve shared analysis results' })
  @ApiParam({ name: 'analysisId', type: String })
  @ApiOkResponse({ schema: { type: 'object' } })
  public async getSharedAnalysis(@Param('analysisId') analysisId: string): Promise<SharedAnalysisDto> {
    return this.specificationMaintainerService.getSharedAnalysis(analysisId);
  }

  /**
   * Fetch PSM content from IRI
   */
  @Get('psm')
  @ApiOperation({ summary: 'Fetch PSM content from IRI' })
  @ApiQuery({ name: 'iri', required: true })
  @ApiOkResponse({ schema: { type: 'object' } })
  public async fetchPsmFromIri(@Query('iri') psmIri: string): Promise<{ content: string; name: string }> {
    return this.specificationMaintainerService.fetchPsmFromIri(psmIri);
  }

  /**
   * Fetch PSM content from IRI (POST variant to avoid long query strings)
   */
  @Post('psm')
  @ApiOperation({ summary: 'Fetch PSM content from IRI (POST)' })
  @ApiBody({ schema: { type: 'object', properties: { iri: { type: 'string' } }, required: ['iri'] } })
  @ApiOkResponse({ schema: { type: 'object' } })
  public async fetchPsmFromIriPost(@Body() body: { iri: string }): Promise<{ content: string; name: string }> {
    return this.specificationMaintainerService.fetchPsmFromIri(body.iri);
  }

  // ========== LLM Chat Endpoints ==========

  /**
   * Start a new chat conversation about specific changes
   */
  @Post('chats')
  @ApiOperation({ summary: 'Start a new chat conversation about specific changes' })
  @ApiBody({ schema: { type: 'object' } })
  @ApiOkResponse({ schema: { type: 'object' } })
  public async startChat(@Body() startChatDto: StartChatDto): Promise<ChatConversation> {
    return this.llmChatService.startChat(startChatDto);
  }

  /**
   * Send a message to an existing conversation
   */
  @Post('chats/message')
  @ApiOperation({ summary: 'Send a message to an existing conversation' })
  @ApiBody({ schema: { type: 'object' } })
  @ApiOkResponse({ schema: { type: 'object' } })
  public  async sendMessage(@Body() sendMessageDto: SendMessageDto): Promise<ChatConversation> {
    return this.llmChatService.sendMessage(sendMessageDto);
  }

  /**
   * Get an existing conversation
   */
  @Get('chats/:conversationId')
  @ApiOperation({ summary: 'Get an existing conversation' })
  @ApiParam({ name: 'conversationId', type: String })
  @ApiOkResponse({ schema: { type: 'object' } })
  public async getConversation(@Param('conversationId') conversationId: string): Promise<ChatConversation> {
    return this.llmChatService.getConversation(conversationId);
  }

  /**
   * Get all conversations for specific changes
   */
  @Post('chats/by-changes')
  @ApiOperation({ summary: 'Get all conversations for specific changes' })
  @ApiBody({ schema: { type: 'object' } })
  @ApiOkResponse({ schema: { type: 'array', items: { type: 'object' } } })
  public async getConversationsForChanges(@Body() body: { changeIds: string[] }): Promise<ChatConversation[]> {
    return this.llmChatService.getConversationsForChanges(body.changeIds);
  }

  /**
   * Delete a conversation
   */
  @Post('chats/:conversationId/delete')
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiParam({ name: 'conversationId', type: String })
  @ApiOkResponse({ schema: { type: 'object' } })
  public async deleteConversation(@Param('conversationId') conversationId: string): Promise<{ success: boolean }> {
    await this.llmChatService.deleteConversation(conversationId);
    return { success: true };
  }

  /**
   * Regenerate change description based on maintainer feedback
   */
  @Post('changes/regenerate-description')
  @ApiOperation({ summary: 'Regenerate change description based on maintainer feedback' })
  @ApiBody({ schema: { type: 'object' } })
  @ApiOkResponse({ schema: { type: 'object' } })
  public async regenerateDescription(@Body() body: { changeId: string; feedback: string; currentChange: SchemaChangeDto }): Promise<{ updatedChange: SchemaChangeDto }> {
    return this.llmChatService.regenerateChangeDescription(body.changeId, body.feedback, body.currentChange);
  }

  /**
   * Generate a developer-facing prompt and fresh validation link for re-upload after maintainer review
   */
  @Post(':id/developer-reupload-prompt')
  @ApiOperation({ summary: 'Generate developer-facing prompt and validation link for re-upload' })
  @ApiBody({ schema: { type: 'object' } })
  @ApiOkResponse({ schema: { type: 'object' } })
  public async generateDeveloperReuploadPrompt(@Body() body: DeveloperReuploadPromptDto): Promise<{ prompt: string; token: string; url: string }>{
    const { token, url } = await this.specificationMaintainerService.generateValidationLink(body.specificationId);
    const prompt: string = await this.llmChatService.generateDeveloperReuploadPrompt({
      specificationId: body.specificationId,
      changes: body.changes,
      decisions: body.decisions,
      maintainerNote: body.maintainerNote,
      uploadUrl: url,
    });
    return { prompt, token, url };
  }

  /**
   * Validate a developer re-uploaded JSON schema against the shared analysis using LLM
   */
  @Post('analyses/:analysisId/reupload-validations')
  @ApiOperation({ summary: 'Validate developer re-upload against the shared analysis' })
  @ApiParam({ name: 'analysisId', type: String })
  @ApiBody({ schema: { type: 'object', properties: { newSchema: { type: 'string' } }, required: ['newSchema'] } })
  @ApiOkResponse({ schema: { type: 'object' } })
  public async validateReupload(
    @Param('analysisId') analysisId: string,
    @Body() body: { newSchema: string }
  ): Promise<ReuploadValidationDto>{
    const sharedAnalysis: SharedAnalysisDto = await this.specificationMaintainerService.getSharedAnalysis(analysisId);
    const report: ReuploadValidationDto = await this.llmChatService.assessReuploadAgainstAnalysis(sharedAnalysis, body.newSchema);
    return report;
  }

  /**
   * Get all accepted changes from stored analyses
   */
  @Get('changes/accepted')
  @ApiOperation({ summary: 'Get all accepted changes from stored analyses' })
  @ApiOkResponse({ schema: { type: 'object' } })
  public async getAcceptedChanges(): Promise<{ acceptedChanges: AcceptedChangeDto[] }> {
    return this.specificationMaintainerService.getAcceptedChanges();
  }
} 