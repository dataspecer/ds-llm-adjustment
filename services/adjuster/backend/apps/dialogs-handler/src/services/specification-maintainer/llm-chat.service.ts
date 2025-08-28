import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { SchemaChangeDto } from '../../dto/schema-change.dto';
import { z } from 'zod';
import { ReuploadValidationDto } from '../../dto/reupload-validation.dto';
import { ChatConversation, StartChatDto, SendMessageDto, GenerateDeveloperReuploadPromptDto, ChatMessage } from '../../dto/chats.dto';
import { AnalyzeFeedbackDto, FeedbackAnalysisReportDto } from '../../dto/feedback-analysis.dto';


@Injectable()
export class LlmChatService {
  private readonly llm: ChatOpenAI;
  private readonly conversations = new Map<string, ChatConversation>();

  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4o-mini', // Cost-effective model for chat
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Start a new chat conversation about specific changes
   */
  async startChat(startChatDto: StartChatDto): Promise<ChatConversation> {
    const conversationId: string = this.generateId();
    
    const systemPrompt: string = this.buildSystemPrompt(startChatDto.changes);
    const initialUserPrompt: string = startChatDto.initialPrompt || this.buildInitialPrompt(startChatDto.changes);

    const conversation: ChatConversation = {
      id: conversationId,
      changeIds: startChatDto.changeIds,
      changes: startChatDto.changes,
      messages: [
        {
          id: this.generateId(),
          role: 'system',
          content: systemPrompt,
          timestamp: new Date(),
          changeIds: startChatDto.changeIds,
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Generate initial AI response
    const aiResponse: string = await this.generateResponse(conversation, initialUserPrompt);
    
    // Add user message
    conversation.messages.push({
      id: this.generateId(),
      role: 'user',
      content: initialUserPrompt,
      timestamp: new Date(),
      changeIds: startChatDto.changeIds,
    });

    // Add AI response
    conversation.messages.push({
      id: this.generateId(),
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date(),
      changeIds: startChatDto.changeIds,
    });

    conversation.updatedAt = new Date();
    this.conversations.set(conversationId, conversation);

    return conversation;
  }

  /**
   * Analyze detected changes against maintainer feedback (batch, structured JSON output)
   */
  public async analyzeChangesAgainstFeedback(dto: AnalyzeFeedbackDto): Promise<FeedbackAnalysisReportDto> {
    const system: SystemMessage = new SystemMessage('You are an expert API schema reviewer. Given changes and maintainer notes, classify alignment and risks, and produce actionable recommendations. Return only valid JSON matching the given schema.');

    const notesMap: Map<string, string> = new Map<string, string>();
    for (const n of dto.notes || []) {
      notesMap.set(n.changeId, n.feedback);
    }

    const changeLines: string = dto.changes.map(c => {
      const note: string | undefined = notesMap.get(c.id);
      return `- ${c.id} [${c.type}] ${c.path}\n  desc: ${c.description}\n  acceptable: ${c.isAcceptable} problematic: ${c.isProblematic}${c.groupId ? `\n  group: ${c.groupId}` : ''}${c.suggestion ? `\n  suggestion: ${c.suggestion}` : ''}${c.rationale ? `\n  rationale: ${c.rationale}` : ''}${note ? `\n  maintainer-note: ${note}` : ''}`;
    }).join('\n');

    const prompt: string = `Specification: ${dto.specificationId}\nChanges with maintainer notes:\n${changeLines}\n\nFor each change, assess: alignment (aligned/partially-aligned/misaligned), risk (low/medium/high), recommendation (actionable, concise), and optionally an updatedDescription that incorporates the note. Output JSON only.`;

    const schema: z.ZodObject = z.object({
      summary: z.object({
        aligned: z.number(),
        partiallyAligned: z.number(),
        misaligned: z.number(),
      }),
      items: z.array(z.object({
        changeId: z.string(),
        alignment: z.enum(['aligned', 'partially-aligned', 'misaligned']),
        risk: z.enum(['low', 'medium', 'high']),
        recommendation: z.string(),
        updatedDescription: z.string().optional(),
      })),
    });

    try {
      const response: any = await this.llm.withStructuredOutput(schema).invoke([
        system,
        new HumanMessage(prompt),
      ]);

      // Basic safety net to ensure counts are consistent
      const aligned: number = response.items.filter((i: any) => i.alignment === 'aligned').length;
      const partially: number = response.items.filter((i: any) => i.alignment === 'partially-aligned').length;
      const misaligned: number = response.items.filter((i: any) => i.alignment === 'misaligned').length;

      return {
        summary: {
          aligned,
          partiallyAligned: partially,
          misaligned,
        },
        items: response.items,
      };
    } catch (error) {
      const items = dto.changes.map(c => ({
        changeId: c.id,
        alignment: 'partially-aligned' as const,
        risk: 'low' as const,
        recommendation: 'Manual review required due to analysis failure. Consider maintainer notes when finalizing.',
      }));
      return {
        summary: {
          aligned: 0,
          partiallyAligned: items.length,
          misaligned: 0,
        },
        items,
      };
    }
  }

  /**
   * Send a message to an existing conversation
   */
  async sendMessage(sendMessageDto: SendMessageDto): Promise<ChatConversation> {
    const conversation: ChatConversation = this.conversations.get(sendMessageDto.conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${sendMessageDto.conversationId} not found`);
    }

    conversation.messages.push({
      id: this.generateId(),
      role: 'user',
      content: sendMessageDto.message,
      timestamp: new Date(),
      changeIds: conversation.changeIds,
    });

    const aiResponse = await this.generateResponse(conversation, sendMessageDto.message);

    conversation.messages.push({
      id: this.generateId(),
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date(),
      changeIds: conversation.changeIds,
    });

    conversation.updatedAt = new Date();
    this.conversations.set(conversation.id, conversation);

    return conversation;
  }

  /**
   * Get an existing conversation
   */
  async getConversation(conversationId: string): Promise<ChatConversation> {
    const conversation: ChatConversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    return conversation;
  }

  /**
   * Get all conversations for specific changes
   */
  async getConversationsForChanges(changeIds: string[]): Promise<ChatConversation[]> {
    return Array.from(this.conversations.values()).filter(conv => 
      changeIds.some(id => conv.changeIds.includes(id))
    );
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    this.conversations.delete(conversationId);
  }

  /**
   * Regenerate change description based on maintainer feedback
   */
  async regenerateChangeDescription(changeId: string, feedback: string, currentChange: SchemaChangeDto): Promise<{ updatedChange: SchemaChangeDto }> {
    try {
      const regenerationPrompt = `
As an expert in API schema evolution, please regenerate the change description for the following schema change based on the maintainer's feedback.

Current Change Details:
- ID: ${currentChange.id}
- Type: ${currentChange.type}
- Path: ${currentChange.path}
- Current Description: ${currentChange.description}
- Currently Acceptable: ${currentChange.isAcceptable}
- Currently Problematic: ${currentChange.isProblematic}
- Current Suggestion: ${currentChange.suggestion || 'None'}
- Current Rationale: ${currentChange.rationale || 'None'}

Maintainer Feedback: ${feedback}

Please provide an improved analysis in this exact JSON format:
{
  "description": "Clear, concise description of what changed",
  "isAcceptable": true/false,
  "isProblematic": true/false,
  "suggestion": "Actionable recommendation for handling this change",
  "rationale": "Technical reasoning for the acceptability assessment and suggestion"
}

Focus on:
1. Addressing the maintainer's specific concerns
2. Providing accurate acceptability assessment
3. Offering practical, actionable suggestions
4. Clear rationale for your recommendations
5. Consider backward compatibility implications

Return only the JSON object, no additional text.`;

      const response: any = await this.llm.invoke([
        new SystemMessage('You are an expert API schema analyst. Return only valid JSON as requested.'),
        new HumanMessage(regenerationPrompt)
      ]);

      const responseText: string = response.content as string;
      
      // Parse the JSON response
      let updatedData: any;
      try {
        updatedData = JSON.parse(responseText);
      } catch (parseError) {
        // If JSON parsing fails, try to extract JSON from the response
        const jsonMatch: RegExpMatchArray | null = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          updatedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Invalid JSON response from AI');
        }
      }

      // Create updated change with regenerated description
      const updatedChange: SchemaChangeDto = {
        ...currentChange,
        description: updatedData.description || currentChange.description,
        isAcceptable: updatedData.isAcceptable !== undefined ? updatedData.isAcceptable : currentChange.isAcceptable,
        isProblematic: updatedData.isProblematic !== undefined ? updatedData.isProblematic : currentChange.isProblematic,
        suggestion: updatedData.suggestion || currentChange.suggestion,
        rationale: updatedData.rationale || currentChange.rationale,
      };

      return { updatedChange };
    } catch (error) {
      console.error('Error regenerating change description:', error);
      throw new Error('Failed to regenerate change description. Please try again.');
    }
  }

  /**
   * Create a concise developer-facing prompt for re-upload after maintainer review
   */
  async generateDeveloperReuploadPrompt(dto: GenerateDeveloperReuploadPromptDto): Promise<string> {
    const accepted: Set<string> = new Set(
      dto.decisions.filter(d => d.decision === 'accept').map(d => d.changeId)
    );
    const rejected: Set<string> = new Set(
      dto.decisions.filter(d => d.decision === 'reject').map(d => d.changeId)
    );
    const toDeveloper: Map<string, string> = new Map(
      dto.decisions
        .filter(d => d.decision === 'developer')
        .map(d => [d.changeId, d.comment || ''])
    );

    const summarize: (change: SchemaChangeDto) => string = (change: SchemaChangeDto): string => {
      const status: string = accepted.has(change.id)
        ? 'accepted'
        : rejected.has(change.id)
        ? 'rejected'
        : toDeveloper.has(change.id)
        ? 'requires-developer-action'
        : 'pending';

      const devNote: string | undefined = toDeveloper.get(change.id);
      return `- [${status}] ${change.id} ${change.type} at ${change.path}: ${change.description}` +
        (devNote ? `\n  note: ${devNote}` : '') +
        (change.suggestion ? `\n  suggestion: ${change.suggestion}` : '') +
        (change.rationale ? `\n  rationale: ${change.rationale}` : '');
    };

    const lines: string = dto.changes.map(summarize).join('\n');

    const promptTemplate = `You received review feedback from the specification maintainer. Please update the JSON Schema accordingly and re-upload using the link below.

Context:
- Specification ID: ${dto.specificationId}
- Upload URL: ${dto.uploadUrl}
${dto.maintainerNote ? `- Maintainer note: ${dto.maintainerNote}` : ''}

Decisions and guidance per change:
${lines}

Instructions:
1) Apply all items marked as [accepted] to align with the maintained spec.
2) For [rejected], revert those changes if present in your schema.
3) For [requires-developer-action], implement the described adjustments and follow any notes/suggestions.
4) Validate locally if possible, then re-upload the updated schema via the link.

When ready, use: ${dto.uploadUrl}
`;

    // Keep this method pure string assembly to be fast/cost-free; if needed we could LLM-polish it later.
    return promptTemplate.trim();
  }

  /**
   * Assess a developer's re-uploaded schema against a shared analysis using LLM
   */
  async assessReuploadAgainstAnalysis(
    sharedAnalysis: {
      analysisId: string;
      oldSchemaName: string;
      newSchemaName: string;
      psmFileName: string;
      changes: SchemaChangeDto[];
      schema: string;
      decisions?: { changeId: string; decision: 'accept' | 'reject' | 'developer'; comment?: string }[];
    },
    newSchema: string
  ): Promise<ReuploadValidationDto>{
    const system: SystemMessage = new SystemMessage('You are an expert API schema reviewer. Assess whether maintainer-raised issues are addressed in the new JSON Schema. Return only valid JSON matching the schema.');

    const decisionsMap: Map<string, string> = new Map<string, string>();
    for (const d of sharedAnalysis.decisions || []) {
      decisionsMap.set(d.changeId, d.decision);
    }

    const changesBrief: string = sharedAnalysis.changes.map(c => `- ${c.id} [${c.type}] ${c.path}: ${c.description}`).join('\n');
    const prompt: string = `Original analysis (maintainer concerns):\n${changesBrief}\n\nMaintainer decisions (if any):\n${(sharedAnalysis.decisions || []).map(d => `- ${d.changeId}: ${d.decision}${d.comment ? ` (note: ${d.comment})` : ''}`).join('\n') || 'n/a'}\n\nOld analyzed schema name: ${sharedAnalysis.newSchemaName}\nRe-uploaded JSON Schema content (developer):\n${newSchema}`;

    const schema: z.ZodObject = z.object({
      analysisId: z.string(),
      summary: z.object({ addressed: z.number(), stillPresent: z.number(), unclear: z.number() }),
      items: z.array(z.object({
        changeId: z.string(),
        decision: z.string(),
        status: z.enum(['addressed', 'still-present', 'unclear']),
        notes: z.string(),
      })),
    });

    try {
      const response: any = await this.llm.withStructuredOutput(schema).invoke([
        system,
        new HumanMessage(`Evaluate if the new schema addresses the above concerns. For each changeId, set status to one of: addressed (fixed), still-present (issue persists), unclear (cannot determine). Provide brief notes if useful. Always return JSON.`),
        new HumanMessage(prompt)
      ]);

      const items: any[] = response.items.map((it: any) => ({
        ...it,
        decision: it.decision || decisionsMap.get(it.changeId) || 'pending',
        notes: it.notes ?? '',
      }));
      const addressed: number = items.filter((i: any) => i.status === 'addressed').length;
      const stillPresent: number = items.filter((i: any) => i.status === 'still-present').length;
      const unclear: number = items.filter((i: any) => i.status === 'unclear').length;

      return {
        analysisId: sharedAnalysis.analysisId,
        summary: { addressed, stillPresent, unclear },
        items,
      };
    } catch (error) {
      console.error('Error assessing re-uploaded schema against analysis:', error);
      const items: any[] = sharedAnalysis.changes.map(c => ({
        changeId: c.id,
        decision: decisionsMap.get(c.id),
        status: 'unclear' as const,
        notes: 'Automatic assessment failed; manual review required.',
      }));
      return {
        analysisId: sharedAnalysis.analysisId,
        summary: { addressed: 0, stillPresent: 0, unclear: items.length },
        items,
      };
    }
  }

  /**
   * Generate AI response using LangChain
   */
  private async generateResponse(conversation: ChatConversation, userMessage: string): Promise<string> {
    try {
      const messageHistory: any[] = conversation.messages
        .filter(msg => msg.role !== 'system')
        .slice(-10)
        .map(msg => {
          if (msg.role === 'user') {
            return new HumanMessage(msg.content);
          } else {
            return new AIMessage(msg.content);
          }
        });

      messageHistory.push(new HumanMessage(userMessage));

      const systemMessage: ChatMessage | undefined = conversation.messages.find(msg => msg.role === 'system');
      const messages: any[] = [
        new SystemMessage(systemMessage?.content || ''),
        ...messageHistory
      ];

      const response: any = await this.llm.invoke(messages);
      return response.content as string;
    } catch (error) {
      console.error('Error generating LLM response:', error);
      return 'I apologize, but I encountered an error while processing your request. Please try again or rephrase your question.';
    }
  }

  /**
   * Build system prompt for the conversation
   */
  private buildSystemPrompt(changes: SchemaChangeDto[]): string {
    const changesContext = changes.map(change => {
      return `
Change ID: ${change.id}
Type: ${change.type}
Path: ${change.path}
Description: ${change.description}
Is Acceptable: ${change.isAcceptable}
Is Problematic: ${change.isProblematic}
Current Suggestion: ${change.suggestion || 'None'}
Current Rationale: ${change.rationale || 'None'}
${change.oldValue ? `Old Value: ${JSON.stringify(change.oldValue)}` : ''}
${change.newValue ? `New Value: ${JSON.stringify(change.newValue)}` : ''}
${change.groupId ? `Group ID: ${change.groupId}` : ''}
      `.trim();
    }).join('\n\n---\n\n');

    return `You are an expert AI assistant specializing in API schema evolution and data specification management. You are helping a specification maintainer analyze and understand schema changes.

Context: You are analyzing ${changes.length} schema change(s) in a data specification. Your role is to:

1. Provide clear, actionable insights about the changes
2. Explain the implications of each change
3. Suggest best practices for handling breaking vs non-breaking changes
4. Help the maintainer make informed decisions
5. Offer alternative solutions when appropriate
6. Consider backward compatibility and API evolution principles

Schema Changes to Analyze:
${changesContext}

Guidelines for your responses:
- Be concise but comprehensive
- Focus on practical implications
- Consider both technical and business perspectives  
- Highlight potential risks and benefits
- Suggest mitigation strategies for problematic changes
- Use clear, professional language
- Reference specific changes by their IDs when discussing them
- Provide reasoning for your recommendations

The maintainer may ask follow-up questions, request clarifications, or seek alternative approaches. Adapt your responses based on their feedback and concerns.`;
  }

  /**
   * Build initial prompt for the conversation
   */
  private buildInitialPrompt(changes: SchemaChangeDto[]): string {
    const changeCount: number = changes.length;
    const changeTypes: string[] = [...new Set(changes.map(c => c.type))];
    const problematic: SchemaChangeDto[] = changes.filter(c => c.isProblematic);
    const acceptable: SchemaChangeDto[] = changes.filter(c => c.isAcceptable);

    return `I need your expert analysis of ${changeCount} schema change${changeCount > 1 ? 's' : ''} detected in our API specification. 

The changes include: ${changeTypes.join(', ')} operations.
- ${acceptable.length} change${acceptable.length !== 1 ? 's' : ''} marked as acceptable
- ${problematic.length} change${problematic.length !== 1 ? 's' : ''} marked as potentially problematic

Please provide:
1. An overall assessment of these changes
2. Key risks and benefits I should consider
3. Recommendations for handling any problematic changes
4. Best practices for implementing these changes safely

Feel free to ask if you need more context about our use case or existing system architecture.`;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
} 