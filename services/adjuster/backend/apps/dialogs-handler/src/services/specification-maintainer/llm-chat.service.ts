import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { SchemaChangeDto } from '../../controllers/http/specification-maintainer/specification-maintainer.controller';

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
    const conversationId = this.generateId();
    
    const systemPrompt = this.buildSystemPrompt(startChatDto.changes);
    const initialUserPrompt = startChatDto.initialPrompt || this.buildInitialPrompt(startChatDto.changes);

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
    const aiResponse = await this.generateResponse(conversation, initialUserPrompt);
    
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
   * Send a message to an existing conversation
   */
  async sendMessage(sendMessageDto: SendMessageDto): Promise<ChatConversation> {
    const conversation = this.conversations.get(sendMessageDto.conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${sendMessageDto.conversationId} not found`);
    }

    // Add user message
    conversation.messages.push({
      id: this.generateId(),
      role: 'user',
      content: sendMessageDto.message,
      timestamp: new Date(),
      changeIds: conversation.changeIds,
    });

    // Generate AI response
    const aiResponse = await this.generateResponse(conversation, sendMessageDto.message);

    // Add AI response
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
    const conversation = this.conversations.get(conversationId);
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

      const response = await this.llm.invoke([
        new SystemMessage('You are an expert API schema analyst. Return only valid JSON as requested.'),
        new HumanMessage(regenerationPrompt)
      ]);

      const responseText = response.content as string;
      
      // Parse the JSON response
      let updatedData;
      try {
        updatedData = JSON.parse(responseText);
      } catch (parseError) {
        // If JSON parsing fails, try to extract JSON from the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
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
   * Generate AI response using LangChain
   */
  private async generateResponse(conversation: ChatConversation, userMessage: string): Promise<string> {
    try {
      // Build message history for context (exclude system message from API call)
      const messageHistory = conversation.messages
        .filter(msg => msg.role !== 'system')
        .slice(-10) // Keep last 10 messages for context
        .map(msg => {
          if (msg.role === 'user') {
            return new HumanMessage(msg.content);
          } else {
            return new AIMessage(msg.content);
          }
        });

      // Add current user message
      messageHistory.push(new HumanMessage(userMessage));

      // Get system message
      const systemMessage = conversation.messages.find(msg => msg.role === 'system');
      const messages = [
        new SystemMessage(systemMessage?.content || ''),
        ...messageHistory
      ];

      const response = await this.llm.invoke(messages);
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
    const changeCount = changes.length;
    const changeTypes = [...new Set(changes.map(c => c.type))];
    const problematic = changes.filter(c => c.isProblematic);
    const acceptable = changes.filter(c => c.isAcceptable);

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