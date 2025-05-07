"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpecificationProcessorService = void 0;
const common_1 = require("@nestjs/common");
const prompts_1 = require("@langchain/core/prompts");
const openai_1 = require("@langchain/openai");
const zod_1 = require("zod");
const chat_message_entity_1 = require("../../entities/chat-message.entity");
const typeorm_1 = require("typeorm");
const typeorm_2 = require("@nestjs/typeorm");
let SpecificationProcessorService = class SpecificationProcessorService {
    constructor(requestRepository) {
        this.requestRepository = requestRepository;
    }
    async processDefinitions(psm, oldApi, newApi, action, artifactFormat, useRemote = false) {
        const request = await this.requestRepository.save({ action });
        console.log(useRemote);
        if (useRemote) {
            await this.processDefinitionsRemotely(psm, oldApi, newApi, action, artifactFormat, request);
        }
        else {
            await this.processDefinitionsChatGpt(psm, oldApi, newApi, action, artifactFormat, request);
        }
        return request;
    }
    async processDescribeChanges(original, updated) {
        const model = new openai_1.ChatOpenAI({
            model: "gpt-4o",
            temperature: 0,
            apiKey: process.env.OPENAI_API_KEY,
        });
        const prompt = prompts_1.ChatPromptTemplate.fromTemplate("Describe the changes made to the artifact. \nOriginal: {original} \nUpdated: {updated}");
        const schema = zod_1.z.object({
            Changes: zod_1.z.string().describe("Changes made to the artifact"),
        });
        const chain = prompt.pipe(model.withStructuredOutput(schema));
        const result = await chain.invoke({ original, updated });
        console.log(result.Changes);
        return result.Changes;
    }
    async processSchemaDifferences(oldSchema, newSchema, psm) {
        const model = new openai_1.ChatOpenAI({
            model: "gpt-4o",
            temperature: 0,
            apiKey: process.env.OPENAI_API_KEY,
        });
        const prompt = prompts_1.ChatPromptTemplate.fromTemplate(`You are provided with two JSON schemas.
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
        "changesDescription"`);
        const schema = zod_1.z.object({
            addedProperties: zod_1.z.array(zod_1.z.object({
                changeId: zod_1.z.number(),
                alternativeChangeId: zod_1.z.array(zod_1.z.number()),
                relatedChangeId: zod_1.z.array(zod_1.z.number()),
                propertyName: zod_1.z.string(),
                className: zod_1.z.string(),
                dataType: zod_1.z.string(),
                vocabulary: zod_1.z.string(),
            })),
            removedProperties: zod_1.z.array(zod_1.z.object({
                changeId: zod_1.z.number(),
                alternativeChangeId: zod_1.z.array(zod_1.z.number()),
                relatedChangeId: zod_1.z.array(zod_1.z.number()),
                propertyName: zod_1.z.string(),
                className: zod_1.z.string(),
            })),
            changedProperties: zod_1.z.array(zod_1.z.object({
                changeId: zod_1.z.number(),
                alternativeChangeId: zod_1.z.array(zod_1.z.number()),
                relatedChangeId: zod_1.z.array(zod_1.z.number()),
                oldpropertyName: zod_1.z.string(),
                newPropertyName: zod_1.z.string(),
                oldDataType: zod_1.z.string(),
                newDataType: zod_1.z.string(),
            })),
            addedClasses: zod_1.z.array(zod_1.z.object({
                changeId: zod_1.z.number(),
                alternativeChangeId: zod_1.z.array(zod_1.z.number()),
                relatedChangeId: zod_1.z.array(zod_1.z.number()),
                className: zod_1.z.string(),
                vocabulary: zod_1.z.string(),
            })),
            addedConnections: zod_1.z.array(zod_1.z.object({
                changeId: zod_1.z.number(),
                alternativeChangeId: zod_1.z.array(zod_1.z.number()),
                relatedChangeId: zod_1.z.array(zod_1.z.number()),
                source: zod_1.z.string(),
                target: zod_1.z.string(),
                connectionType: zod_1.z.string(),
            })),
            removedConnections: zod_1.z.array(zod_1.z.object({
                changeId: zod_1.z.number(),
                alternativeChangeId: zod_1.z.array(zod_1.z.number()),
                relatedChangeId: zod_1.z.array(zod_1.z.number()),
                source: zod_1.z.string(),
                target: zod_1.z.string(),
                connectionType: zod_1.z.string(),
            })),
            removedClasses: zod_1.z.array(zod_1.z.object({
                changeId: zod_1.z.number(),
                alternativeChangeId: zod_1.z.array(zod_1.z.number()),
                relatedChangeId: zod_1.z.array(zod_1.z.number()),
                id: zod_1.z.string(),
            })),
            changesDescription: zod_1.z.string(),
        });
        const chain = prompt.pipe(model.withStructuredOutput(schema));
        const result = await chain.invoke({ oldSchema, newSchema, psm });
        console.log("Artifact Changes:", result);
        const request = await this.requestRepository.save({ oldApi: oldSchema, newApi: newSchema, psm, result });
        return request;
    }
    async processSchemaDifferencesRemotely(oldSchema, newSchema, psm) {
        const chatResponse = await fetch('http://localhost:3012/api/chat-messages/chat', {
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
            },
            required: [
                "addedProperties",
                "removedProperties",
                "changedProperties",
                "addedClasses",
                "addedConnections",
                "removedConnections",
                "removedClasses",
            ],
        };
        const promptContent = `You are provided with two JSON schemas.
      
      Old JSON schema:
      ${oldSchema}
      
      New JSON schema:
      ${newSchema}

      PSM Artifact:
        ${psm}
      
      Compare these schemas and output a JSON object that exactly matches the following structure:
      - addedProperties: an array of objects each having "propertyName", "className", "dataType", "vocabulary".
      - removedProperties: an array of objects each having "propertyName", "className".
      - changedProperties: an array of objects each having "propertyName", "oldDataType", "newDataType".
      - addedClasses: an array of objects each having "className", "vocabulary".
      - addedConnections: an array of objects each having "source", "target", "connectionType".
      - removedConnections: an array of objects each having "source", "target", "connectionType".
      - removedClasses: an array of objects each having "id".
      
      Do not include any additional keys or commentary.`;
        const messageResponse = await fetch(`http://localhost:3012/api/chat-messages/chat/${chatId}/message`, {
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
        const result = messageData.response;
        console.log("Schema differences result:", result);
        const request = await this.requestRepository.save({ oldApi: oldSchema, newApi: newSchema, psm, result });
        const messageUrl = `http://localhost:3012${messageData.url}`;
        this.pollForRemoteResponse(messageUrl, request, psm, oldSchema, newSchema).catch((error) => {
            console.error(`Polling failed: ${error.message}`);
        });
        return result;
    }
    async processDescribePlaceWhereMakeChanges(originalArtifact, describedChanges) {
        const model = new openai_1.ChatOpenAI({
            model: "gpt-4o",
            temperature: 0,
            apiKey: process.env.OPENAI_API_KEY,
        });
        const prompt = prompts_1.ChatPromptTemplate.fromTemplate("Take a look at the following PSM Artifact. Where should I change it to do these adjustments? \nArtifact: {artifact} \nChanges: {changes}");
        const chain = prompt.pipe(model);
        const result = await chain.invoke({ artifact: originalArtifact, changes: describedChanges });
        console.log(result.content);
        return result.content;
    }
    async processDefinitionsChatGpt(psm, oldApi, newApi, action, artifactFormat, request) {
        const model = new openai_1.ChatOpenAI({
            model: "gpt-4o",
            temperature: 0,
            apiKey: process.env.OPENAI_API_KEY,
        });
        let changes = await this.processDescribeChanges(oldApi, newApi);
        changes += "\n\n" + action;
        const placeChanges = await this.processDescribePlaceWhereMakeChanges(psm, changes);
        const prompt = prompts_1.ChatPromptTemplate.fromTemplate("Complete the Action and return updated API definition and PSM definition. \
            \nPSM Artifact: {psm} \nOld JSON schema: {oldApi} \nNew JSON schema: {newApi} \nAction: {changes} \n Where and how to make changes: {placeChanges}");
        const schema = zod_1.z.object({
            OutputArtifact: zod_1.z.string().describe(`New ${artifactFormat}`),
            API: zod_1.z.string().describe("New API definition"),
            Changes: zod_1.z.string().describe("Changes made to the artifact and API definition"),
        });
        const chain = prompt.pipe(model.withStructuredOutput(schema));
        const result = await chain.invoke({ psm, oldApi, newApi, changes, placeChanges });
        console.log(result);
        request.psm = result.OutputArtifact.replace("\n", " ").replace("\r", " ").replace("\\\"", "\"");
        request.action = changes;
        request.oldApi = oldApi;
        request.newApi = newApi;
        request.result = result;
        await this.requestRepository.save(request);
        return result;
    }
    async processDefinitionsRemotely(psm, oldApi, newApi, action, artifactFormat, request) {
        const chatResponse = await fetch('http://localhost:3012/api/chat-messages/chat', {
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
        const messageResponse = await fetch(`http://localhost:3012/api/chat-messages/chat/${chatId}/message`, {
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
        const messageUrl = `http://localhost:3012${messageData.url}`;
        this.pollForRemoteResponse(messageUrl, request, psm, oldApi, newApi).catch((error) => {
            console.error(`Polling failed: ${error.message}`);
        });
        return result;
    }
    async pollForRemoteResponse(messageUrl, request, psm, oldApi, newApi) {
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
    async getRequestById(id) {
        const request = await this.requestRepository.findOne({ where: { id } });
        if (!request) {
            throw new Error('Request not found');
        }
        return request;
    }
};
exports.SpecificationProcessorService = SpecificationProcessorService;
exports.SpecificationProcessorService = SpecificationProcessorService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_2.InjectRepository)(chat_message_entity_1.ChatMessageEntity)),
    __metadata("design:paramtypes", [typeorm_1.Repository])
], SpecificationProcessorService);
//# sourceMappingURL=specification-processor.service.js.map