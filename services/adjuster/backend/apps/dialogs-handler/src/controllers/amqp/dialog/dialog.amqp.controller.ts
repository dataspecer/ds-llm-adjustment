import { CreateDialogDto } from '@app/common/dto/create-dialog.dto';
import { DetectedChangesDto } from '@app/common/dto/detected-changes.dto';
import { DialogResponseDto } from '@app/common/dto/dialog-response.dto';
import { DialogSummaryDto } from '@app/common/dto/dialog-summary.dto';
import { SuggestionsDto } from '@app/common/dto/suggestions.dto';
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { IDialogService } from 'apps/dialogs-handler/src/services/interfaces/dialog/dialog-service.interface';

@Controller()
export class DialogAmqpController {
    constructor(private readonly _dialogService: IDialogService) {}

    @MessagePattern('changes.detected')
    public handleDetectedChanges(@Payload() changes: DetectedChangesDto) {
        return this._dialogService.integrateChanges(changes);
    }

    @MessagePattern('suggestions.generated')
    public handleSuggestions(@Payload() suggestions: SuggestionsDto) {
        return this._dialogService.saveSuggestions(suggestions);
    }
}

