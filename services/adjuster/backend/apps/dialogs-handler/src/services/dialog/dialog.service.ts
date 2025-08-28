import { Inject, Injectable } from '@nestjs/common';
import { IDialogService } from '../interfaces/dialog/dialog-service.interface';
import { CreateDialogDto } from '@app/common/dto/create-dialog.dto';
import { DialogResponseDto } from '@app/common/dto/dialog-response.dto';
import { ClientsModule, ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessageEntity } from '../../entities/chat-message.entity';
import { DetectChangesDto } from '@app/common/dto/detect-changes.dto';
import { DetectedChangesDto } from '@app/common/dto/detected-changes.dto';
import { SuggestionInputDto } from '@app/common/dto/suggestion-input.dto';
import { SuggestionsDto } from '@app/common/dto/suggestions.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class DialogService implements IDialogService {
    constructor(
        @Inject('CHANGES_DETECTOR') private readonly changesDetectorClient: ClientProxy,
        @Inject('CHANGES_SUGGESTER') private readonly changesSuggesterClient: ClientProxy,
        @InjectRepository(ChatMessageEntity)
        private readonly chatRepository: Repository<ChatMessageEntity>,
    ) {}

    public async startDialog(role: 'MAINTAINER' | 'DEVELOPER', dto: CreateDialogDto): Promise<DialogResponseDto> {
        const dialogId: string = this.generateDialogId();
        
        await this.chatRepository.save({
            action: 'startDialog',
            psm: dto.psmId,
            oldApi: '',
            newApi: JSON.stringify(dto.schema),
            result: '',
        });

        const detectDto: DetectChangesDto = {
            dialogId,
            oldApi: '{}',
            newApi: JSON.stringify(dto.schema),
            psmIri: dto.psmId,
            artifactFormat: 'json-schema',
        };

        const detected: DetectedChangesDto = await firstValueFrom(
            this.changesDetectorClient.send('detect.changes', detectDto)
        );

        const suggestionInput: SuggestionInputDto = {
            dialogId,
            changes: detected.changes,
            psm: detected.psm ?? '',
        };

        await firstValueFrom(
            this.changesSuggesterClient.send('generate.suggestions', suggestionInput)
        );

        return {
            dialogId,
            status: 'processing',
            message: 'Dialog started. Changes detection and suggestion generation in progress.',
        };
    }

    public async getDialogSummary(id: string): Promise<any> {
        const messages: ChatMessageEntity[] = await this.chatRepository.find({ order: { createdAt: 'DESC' } });
        return {
            dialogId: id,
            changes: [],
            suggestions: [],
            status: 'processing',
            messages,
        } as any;
    }

    public async integrateChanges(changes: DetectedChangesDto): Promise<any> {
        await this.chatRepository.save({
            action: 'changes.detected',
            result: JSON.stringify(changes),
        });
        return { ok: true };
    }

    public async saveSuggestions(suggestions: SuggestionsDto): Promise<any> {
        await this.chatRepository.save({
            action: 'suggestions.generated',
            result: JSON.stringify(suggestions),
        });
        return { ok: true };
    }

    private generateDialogId(): string {
        return 'dlg_' + Math.random().toString(36).slice(2, 10);
    }
}
