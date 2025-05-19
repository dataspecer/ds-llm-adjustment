import { ChatMessageEntity } from 'src/entities/chat-message.entity';
import { Repository } from 'typeorm';
import { ArtifactChanges } from 'src/models/artifact-changes.model';
export declare class SpecificationProcessorService {
    private requestRepository;
    constructor(requestRepository: Repository<ChatMessageEntity>);
    processDefinitions(psm: string, oldApi: string, newApi: string, action: string, artifactFormat: string, useRemote?: boolean): Promise<ChatMessageEntity>;
    private processDescribeChanges;
    processSchemaDifferences(oldSchema: string, newSchema: string, psm: string): Promise<ChatMessageEntity>;
    processSchemaDifferencesRemotely(oldSchema: string, newSchema: string, psm: string): Promise<ArtifactChanges>;
    private processDescribePlaceWhereMakeChanges;
    private processDefinitionsChatGpt;
    private processDefinitionsRemotely;
    private pollForRemoteResponse;
    getRequestById(id: number): Promise<ChatMessageEntity>;
}
