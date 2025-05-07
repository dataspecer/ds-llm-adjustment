import { SpecificationProcessorService } from 'src/services/specification-processor/specification-processor.service';
export declare class SpecificationDialogController {
    private readonly _specificationProcessorService;
    constructor(_specificationProcessorService: SpecificationProcessorService);
    processDefinitions(files: {
        psmArtifact?: any;
        newApi?: any;
        oldApi?: any;
    }, action: string, artifactFormat: string, useRemote?: string): Promise<import("../../entities/chat-message.entity").ChatMessageEntity>;
    processDifference(files: {
        psmArtifact?: any;
        newApi?: any;
        oldApi?: any;
    }, useOpenAi?: string): Promise<import("../../entities/chat-message.entity").ChatMessageEntity>;
    getRequestById(id: number): Promise<import("../../entities/chat-message.entity").ChatMessageEntity>;
}
