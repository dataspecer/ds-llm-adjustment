import { Injectable } from '@nestjs/common';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { ChatMessageEntity } from 'src/entities/chat-message.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ArtifactChanges } from 'src/models/artifact-changes.model';

@Injectable()
export class SpecificationProcessorService {

    constructor(    
        @InjectRepository(ChatMessageEntity)
    private requestRepository: Repository<ChatMessageEntity>)
    {
    }

    public async processDefinitions(psm: string, oldApi: string, newApi: string, action: string, artifactFormat: string, useRemote: boolean = false): Promise<ChatMessageEntity> {
        const request = await this.requestRepository.save({ action });
        console.log(useRemote);
        if (useRemote) {
            await this.processDefinitionsRemotely(psm, oldApi, newApi, action, artifactFormat, request);
        } else {
            await this.processDefinitionsChatGpt(psm, oldApi, newApi, action, artifactFormat, request);
        }

        return request;
    }

    private async processDescribeChanges(original: string, updated: string): Promise<string> {
        const model = new ChatOpenAI({
            model: "gpt-4o",
            temperature: 0,
            apiKey: process.env.OPENAI_API_KEY,
        });

        const prompt = ChatPromptTemplate.fromTemplate("Describe the changes made to the artifact. \nOriginal: {original} \nUpdated: {updated}");

        const schema = z.object({
            Changes: z.string().describe("Changes made to the artifact"),
        });

        const chain = prompt.pipe(model.withStructuredOutput(schema));

        const result = await chain.invoke({ original, updated });

        console.log(result.Changes);
        return result.Changes;
    }

    public async processSchemaDifferences(oldSchema: string, newSchema: string, psm: string): Promise<ChatMessageEntity> {
        const model = new ChatOpenAI({
            model: "gpt-4o",
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

        console.log("Artifact Changes:", result);

        const request = await this.requestRepository.save({ oldApi: oldSchema, newApi: newSchema, psm, result });

        return request;
    }

    public async processSchemaDifferencesRemotely(oldSchema: string, newSchema: string, psm: string): Promise<ArtifactChanges> {
        const chatResponse = await fetch(`${process.env.REMOTE_SERVER}/api/chat-messages/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `JSON Schema Diff Chat ${new Date().toISOString()}` }),
        });
      
        if (!chatResponse.ok) {
          throw new Error(`Failed to create chat: ${chatResponse.statusText}`);
        }
      
        const chatData = await chatResponse.json();
        const chatId = chatData.id;
        console.log("Created chat with ID:", chatId);
      
        const format = {
          type: "object",
          properties: {
            addedProperties: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  propertyName: { type: "string" },
                  className: { type: "string" },
                  dataType: { type: "string" },
                  vocabulary: { type: "string" },
                },
                required: ["propertyName", "className", "dataType", "vocabulary"],
              },
            },
            removedProperties: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  propertyName: { type: "string" },
                  className: { type: "string" },
                },
                required: ["propertyName", "className"],
              },
            },
            changedProperties: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  propertyName: { type: "string" },
                  oldDataType: { type: "string" },
                  newDataType: { type: "string" },
                },
                required: ["propertyName", "oldDataType", "newDataType"],
              },
            },
            addedClasses: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  className: { type: "string" },
                  vocabulary: { type: "string" },
                },
                required: ["className", "vocabulary"],
              },
            },
            addedConnections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  source: { type: "string" },
                  target: { type: "string" },
                  connectionType: { type: "string" },
                },
                required: ["source", "target", "connectionType"],
              },
            },
            removedConnections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  source: { type: "string" },
                  target: { type: "string" },
                  connectionType: { type: "string" },
                },
                required: ["source", "target", "connectionType"],
              },
            },
            removedClasses: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                },
                required: ["id"],
              },
            },
            changesDescription: { type: "string" }
          },
          required: [
            "addedProperties",
            "removedProperties",
            "changedProperties",
            "addedClasses",
            "addedConnections",
            "removedConnections",
            "removedClasses",
            "changesDescription"
          ],
        };
      
        const promptContent = `You are provided with two JSON schemas.
      
      Old JSON schema:
      ${oldSchema}
      
      New JSON schema:
      ${newSchema}

      PSM Artifact:
        ${psm}
      
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
        "changesDescription".
      
      Do not include any additional keys or commentary.`;
      
        const messageResponse = await fetch(`${process.env.REMOTE_SERVER}/api/chat-messages/chat/${chatId}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: "user",
            content: promptContent,
            format: format,
          }),
        });
      
        if (!messageResponse.ok) {
          throw new Error(`Failed to send message: ${messageResponse.statusText}`);
        }
      
        const messageData = await messageResponse.json();
        const result: ArtifactChanges = messageData.response;
      
        console.log("Schema differences result:", result);
      
        const request = await this.requestRepository.save({ oldApi: oldSchema, newApi: newSchema, psm, result });

        const messageUrl = `${process.env.REMOTE_SERVER}${messageData.url}`;
        this.pollForRemoteResponse(messageUrl, request, psm, oldSchema, newSchema).catch((error) => {
          console.error(`Polling failed: ${error.message}`);
        });
      
        return result;
      }


    /**
     * 
     * @param originalArtifact 
     * @param describedChanges 
     * @returns 
     */

    private async processDescribePlaceWhereMakeChanges(originalArtifact: string, describedChanges: string): Promise<Object> {
        const model = new ChatOpenAI({
            model: "gpt-4o",
            temperature: 0,
            apiKey: process.env.OPENAI_API_KEY,
        });

        const prompt = ChatPromptTemplate.fromTemplate("Take a look at the following PSM Artifact. Where should I change it to do these adjustments? \nArtifact: {artifact} \nChanges: {changes}");

        const chain = prompt.pipe(model);

        const result = await chain.invoke({ artifact: originalArtifact, changes: describedChanges });

        console.log(result.content);

        return result.content;
    }

    private async processDefinitionsChatGpt(psm: string, oldApi: string, newApi: string, action: string, artifactFormat: string, request: ChatMessageEntity) {
        const model = new ChatOpenAI({
            model: "gpt-4o",
            temperature: 0,
            apiKey: process.env.OPENAI_API_KEY,
        });

        let changes = await this.processDescribeChanges(oldApi, newApi);
        changes += "\n\n" + action;

        const placeChanges = await this.processDescribePlaceWhereMakeChanges(psm, changes);

        const prompt = ChatPromptTemplate.fromTemplate("Complete the Action and return updated API definition and PSM definition. \
            \nPSM Artifact: {psm} \nOld JSON schema: {oldApi} \nNew JSON schema: {newApi} \nAction: {changes} \n Where and how to make changes: {placeChanges}");

        const schema = z.object({
            OutputArtifact: z.string().describe(`New ${artifactFormat}`),
            API: z.string().describe("New API definition"),
            Changes: z.string().describe("Changes made to the artifact and API definition"),
        });

        const chain = prompt.pipe(model.withStructuredOutput(schema));

        const result = await chain.invoke({ psm, oldApi, newApi, changes, placeChanges});

        console.log(result);

        request.psm = result.OutputArtifact.replace("\n", " ").replace("\r", " ").replace("\\\"", "\"");
        request.action = changes;
        request.oldApi = oldApi;
        request.newApi = newApi;
        request.result = result;

        await this.requestRepository.save(request);

        return result;
    }

    private async processDefinitionsRemotely(psm: string, oldApi: string, newApi: string, action: string, artifactFormat: string, request: ChatMessageEntity) {
        const chatResponse = await fetch(`${process.env.REMOTE_SERVER}/api/chat-messages/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: `PSM API Update Chat ${new Date().toISOString()}` }),
        });
    
        if (!chatResponse.ok) {
            throw new Error(`Failed to create chat: ${chatResponse.statusText}`);
        }
    
        const chatData = await chatResponse.json();

        console.log(chatData);

        const chatId = chatData.id;

        const format = {
            type: "object",
            properties: {
                OutputArtifact: {
                    type: "object",
                    description: `New PSM Artifact of format ${artifactFormat}`,
                },
                API: {
                    type: "object",
                    description: "New API definition",
                },
                Changes: {
                    type: "string",
                    description: "Changes made to the ontology and API definition",
                },
            },
            required: ["OutputArtifact", "API", "Changes"],
        };
    
        const messageResponse = await fetch(`${process.env.REMOTE_SERVER}/api/chat-messages/chat/${chatId}/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                role: "user",
                content: `Complete the Action. \nPSM Artifact: ${psm} \
                    \nOld OpenAPI: ${oldApi} \nNew OpenAPI: ${newApi} \nAction: ${action}`,
                format: format,
            }),
        });

        console.log(`Complete the Action. \nPSM Artifact: ${psm} \
                    \nOld OpenAPI: ${oldApi} \nNew OpenAPI: ${newApi} \nAction: ${action}`);
    
        if (!messageResponse.ok) {
            throw new Error(`Failed to send message: ${messageResponse.statusText}`);
        }
    
        const messageData = await messageResponse.json();
    
        const result = messageData.response;
    
        request.psm = psm;
        request.oldApi = oldApi;
        request.newApi = newApi;
        request.result = result;
    
        await this.requestRepository.save(request);

        const messageUrl = `${process.env.REMOTE_SERVER}${messageData.url}`;
        this.pollForRemoteResponse(messageUrl, request, psm, oldApi, newApi).catch((error) => {
            console.error(`Polling failed: ${error.message}`);
        });
    
        return result;
    }

    private async pollForRemoteResponse(
        messageUrl: string,
        request: ChatMessageEntity,
        psm: string,
        oldApi: string,
        newApi: string
    ) {
        const MAX_RETRIES = 10;
        const POLLING_INTERVAL = 5000;
    
        let retries = 0;
        let finalMessageContent = null;
    
        while (retries < MAX_RETRIES) {
            const statusResponse = await fetch(messageUrl, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
    
            if (!statusResponse.ok) {
                console.error(`Failed to get message status: ${statusResponse.statusText}`);
                retries++;
                await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL));
                continue;
            }
    
            const statusData = await statusResponse.json();
    
            if (statusData.message && statusData.message.content) {
                finalMessageContent = statusData.message.content;
                break;
            }
    
            await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL));
            retries++;
        }
    
        if (!finalMessageContent) {
            console.error(`Failed to retrieve message content after ${MAX_RETRIES} retries.`);
            return;
        }
    

        request.psm = psm;
        request.oldApi = oldApi;
        request.newApi = newApi;
        request.result = finalMessageContent;
    
        await this.requestRepository.save(request);
        console.log('Polling complete: Request result saved successfully.');
    }
    

    public async getRequestById(id: number): Promise<ChatMessageEntity> {
        const request = await this.requestRepository.findOne({ where: { id } });
        if (!request) {
          throw new Error('Request not found');
        }
        return request;
      }

}
