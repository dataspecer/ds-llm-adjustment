export declare class ChatMessageEntity {
    id: number;
    action: string;
    psm: string;
    oldApi: string;
    newApi: string;
    result: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
