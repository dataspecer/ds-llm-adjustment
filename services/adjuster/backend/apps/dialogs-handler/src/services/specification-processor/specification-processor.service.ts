import { Injectable } from '@nestjs/common';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { ChatMessageEntity } from '../../entities/chat-message.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class SpecificationProcessorService {
  constructor(
    @InjectRepository(ChatMessageEntity)
    private requestRepository: Repository<ChatMessageEntity>
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
    const model = new ChatOpenAI({
      model: "gpt-4",
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = ChatPromptTemplate.fromTemplate(
      "Describe the changes made to the artifact. \nOriginal: {original} \nUpdated: {updated}"
    );

    const schema = z.object({
      Changes: z.string().describe("Changes made to the artifact"),
    });

    const chain = prompt.pipe(model.withStructuredOutput(schema));
    const result = await chain.invoke({ original, updated });

    return result.Changes;
  }

  public async processSchemaDifferences(
    oldSchema: string,
    newSchema: string,
    psm: string
  ): Promise<ChatMessageEntity> {
    const model = new ChatOpenAI({
      model: "gpt-4",
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = ChatPromptTemplate.fromTemplate(
      `You are provided with two JSON schemas.
      Old JSON schema: {oldSchema}
      New JSON schema: {newSchema}
      PSM Artifact: {psm}

      Your task is to compare the two schemas and identify the changes between them. There may be alternatives - mark them via 
      alternativeChangeId, for example - addedProperties in combination with removedProperties vs. changedProperties, 
      you do not know for sure if it is a complitley new property or just renaming. Also take into account relatedChangeId - 
      an array of changeId, for example if a new class added, addedClasses will contain chnageId's of 
      related addedProperties and vice-versa. Describe the changes in a human-readable format.
      Return a JSON object with array of following properties:

      "addedProperties",
      "removedProperties",
      "changedProperties",
      "addedClasses",
      "addedConnections",
      "removedConnections",
      "removedClasses",
      "changesDescription"`
    );

    const schema = z.object({
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

    const chain = prompt.pipe(model.withStructuredOutput(schema));
    const result = await chain.invoke({ oldSchema, newSchema, psm });

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
    const model = new ChatOpenAI({
      model: "gpt-4",
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = ChatPromptTemplate.fromTemplate(
      `You are provided with a PSM artifact and two API specifications.
      PSM Artifact: {psm}
      Old API: {oldApi}
      New API: {newApi}
      Action: {action}
      Artifact Format: {artifactFormat}

      Your task is to analyze the changes between the old and new API specifications and provide a detailed description of the changes.
      Focus on identifying:
      1. Added properties, classes, and connections
      2. Removed properties, classes, and connections
      3. Changed properties and their types
      4. Any structural changes in the API

      Provide a clear and concise description of all changes.`
    );

    const schema = z.object({
      description: z.string().describe("Detailed description of changes"),
    });

    const chain = prompt.pipe(model.withStructuredOutput(schema));
    const result = await chain.invoke({
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
    let attempts = 0;
    const maxAttempts = 30;
    const pollInterval = 2000;

    while (attempts < maxAttempts) {
      const response = await fetch(messageUrl);
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