import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { PROMPTS } from "@app/common/config/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { ChatMessageEntity } from '../../entities/chat-message.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class SpecificationProcessorService {
  constructor(
    @InjectRepository(ChatMessageEntity)
    private requestRepository: Repository<ChatMessageEntity>,
    @Inject('EVALUATION') private readonly evaluationClient: ClientProxy,
  ) {}

  public async processDefinitions(
    psm: string,
    oldApi: string,
    newApi: string,
    action: string,
    artifactFormat: string,
    useRemote: boolean = false
  ): Promise<ChatMessageEntity> {
    const request = await this.requestRepository.save({ action });
    
    if (useRemote) {
      await this.processDefinitionsRemotely(psm, oldApi, newApi, action, artifactFormat, request);
    } else {
      await this.processDefinitionsChatGpt(psm, oldApi, newApi, action, artifactFormat, request);
    }

    return request;
  }

  private async processDescribeChanges(original: string, updated: string): Promise<string> {
    const { pickModel, createChatModel } = await import('@app/common/evaluation/model');
    const modelVariant = pickModel();
    const model: any = await createChatModel(modelVariant as any);
    this.evaluationClient.emit('evaluation.model', {
      runId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      service: 'dialogs-handler',
      operation: 'specification-processor.describe',
      modelName: modelVariant,
      timestamp: new Date().toISOString(),
    }).subscribe({ error: () => {} });

    const prompt = ChatPromptTemplate.fromTemplate(PROMPTS.specificationProcessor.describeChangesTemplate);

    const schema = z.object({
      Changes: z.string().describe("Changes made to the artifact"),
    });

    // @ts-ignore - suppress deep generic inference in langchain helper
    const structured1: any = (model as any).withStructuredOutput(schema as any) as any;
    const chain: any = prompt.pipe(structured1);
    const result: any = await chain.invoke({ original, updated });

    return result.Changes;
  }

  public async processSchemaDifferences(
    oldSchema: string,
    newSchema: string,
    psm: string
  ): Promise<ChatMessageEntity> {
    const { pickModel, createChatModel } = await import('@app/common/evaluation/model');
    const modelVariant = pickModel();
    const model: any = await createChatModel(modelVariant as any);
    this.evaluationClient.emit('evaluation.model', {
      runId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      service: 'dialogs-handler',
      operation: 'specification-processor.schema-diff',
      modelName: modelVariant,
      timestamp: new Date().toISOString(),
    }).subscribe({ error: () => {} });

    const prompt: ChatPromptTemplate = ChatPromptTemplate.fromTemplate(PROMPTS.specificationProcessor.schemaDifferencesTemplate);

    const schema: z.ZodObject = z.object({
      addedProperties: z.array(
        z.object({
          changeId: z.number(),
          alternativeChangeId: z.array(z.number()),
          relatedChangeId: z.array(z.number()),
          propertyName: z.string(),
          className: z.string(),
          dataType: z.string(),
          vocabulary: z.string(),
        })
      ),
      removedProperties: z.array(
        z.object({
          changeId: z.number(),
          alternativeChangeId: z.array(z.number()),
          relatedChangeId: z.array(z.number()),
          propertyName: z.string(),
          className: z.string(),
        })
      ),
      changedProperties: z.array(
        z.object({
          changeId: z.number(),
          alternativeChangeId: z.array(z.number()),
          relatedChangeId: z.array(z.number()),
          oldpropertyName: z.string(),
          newPropertyName: z.string(),
          oldDataType: z.string(),
          newDataType: z.string(),
        })
      ),
      addedClasses: z.array(
        z.object({
          changeId: z.number(),
          alternativeChangeId: z.array(z.number()),
          relatedChangeId: z.array(z.number()),
          className: z.string(),
          vocabulary: z.string(),
        })
      ),
      addedConnections: z.array(
        z.object({
          changeId: z.number(),
          alternativeChangeId: z.array(z.number()),
          relatedChangeId: z.array(z.number()),
          source: z.string(),
          target: z.string(),
          connectionType: z.string(),
        })
      ),
      removedConnections: z.array(
        z.object({
          changeId: z.number(),
          alternativeChangeId: z.array(z.number()),
          relatedChangeId: z.array(z.number()),
          source: z.string(),
          target: z.string(),
          connectionType: z.string(),
        })
      ),
      removedClasses: z.array(
        z.object({
          changeId: z.number(),
          alternativeChangeId: z.array(z.number()),
          relatedChangeId: z.array(z.number()),
          id: z.string(),
        })
      ),
      changesDescription: z.string(),
    });

    // @ts-ignore - suppress deep generic inference in langchain helper
    const structured2: any = (model as any).withStructuredOutput(schema as any) as any;
    const chain: any = prompt.pipe(structured2);
    const result: any = await chain.invoke({ oldSchema, newSchema, psm });

    const request = await this.requestRepository.save({
      oldApi: oldSchema,
      newApi: newSchema,
      psm,
      result: JSON.stringify(result),
    });

    return request;
  }

  private async processDefinitionsChatGpt(
    psm: string,
    oldApi: string,
    newApi: string,
    action: string,
    artifactFormat: string,
    request: ChatMessageEntity
  ) {
    const { pickModel, createChatModel } = await import('@app/common/evaluation/model');
    const modelVariant = pickModel();
    const model: any = await createChatModel(modelVariant as any);
    this.evaluationClient.emit('evaluation.model', {
      runId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      service: 'dialogs-handler',
      operation: 'specification-processor.definitions',
      modelName: modelVariant,
      timestamp: new Date().toISOString(),
    }).subscribe({ error: () => {} });

    const prompt: ChatPromptTemplate = ChatPromptTemplate.fromTemplate(PROMPTS.specificationProcessor.definitionsTemplate);

    const schema: z.ZodObject = z.object({
      description: z.string().describe("Detailed description of changes"),
    });

    // @ts-ignore - suppress deep generic inference in langchain helper
    const structured3: any = (model as any).withStructuredOutput(schema as any) as any;
    const chain = prompt.pipe(structured3);
    const result: any = await chain.invoke({
      psm,
      oldApi,
      newApi,
      action,
      artifactFormat,
    });

    await this.requestRepository.update(request.id, {
      psm,
      oldApi,
      newApi,
      result: result.description,
    });
  }

  private async processDefinitionsRemotely(
    psm: string,
    oldApi: string,
    newApi: string,
    action: string,
    artifactFormat: string,
    request: ChatMessageEntity
  ) {
    const chatResponse = await fetch(`${process.env.REMOTE_SERVER}/api/chat-messages/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `API Specification Analysis ${new Date().toISOString()}`,
        psm,
        oldApi,
        newApi,
        action,
        artifactFormat,
      }),
    });

    if (!chatResponse.ok) {
      throw new Error(`Failed to create chat: ${chatResponse.statusText}`);
    }

    const chatData = await chatResponse.json();
    const messageUrl = chatData.messageUrl;

    await this.pollForRemoteResponse(messageUrl, request, psm, oldApi, newApi);
  }

  private async pollForRemoteResponse(
    messageUrl: string,
    request: ChatMessageEntity,
    psm: string,
    oldApi: string,
    newApi: string
  ) {
    let attempts: number = 0;
    const maxAttempts: number = 30;
    const pollInterval: number = 2000;

    while (attempts < maxAttempts) {
      const response: any = await fetch(messageUrl);
      if (!response.ok) {
        throw new Error(`Failed to get message: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.status === 'completed') {
        await this.requestRepository.update(request.id, {
          psm,
          oldApi,
          newApi,
          result: data.content,
        });
        return;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    }

    throw new Error('Timeout waiting for remote processing');
  }

  public async getRequestById(id: number): Promise<ChatMessageEntity> {
    return this.requestRepository.findOne({ where: { id } });
  }
} 