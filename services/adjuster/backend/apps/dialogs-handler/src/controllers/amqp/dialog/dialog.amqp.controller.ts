import { CreateDialogDto } from '@app/common/dto/create-dialog.dto';
import { DetectedChangesDto } from '@app/common/dto/detected-changes.dto';
import { DialogResponseDto } from '@app/common/dto/dialog-response.dto';
import { DialogSummaryDto } from '@app/common/dto/dialog-summary.dto';
import { SuggestionsDto } from '@app/common/dto/suggestions.dto';
import { Body, Controller, Get, Param, Post, Headers, UploadedFile, UseInterceptors } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FileInterceptor } from '@nestjs/platform-express';
import { IDialogService } from 'apps/dialogs-handler/src/services/interfaces/dialog/dialog-service.interface';

@Controller('dialogs')
export class DialogAmqpController {
    constructor(private readonly _dialogService: IDialogService) {}

    @Post()
    public async createDialog(@Headers('x-access-token') token: string, 
        @Body() dto: CreateDialogDto): Promise<DialogResponseDto> {
        return this._dialogService.startDialog('DEVELOPER', dto);
    }

    @Get(':id')
    public async getDialog(@Param('id') id: string): Promise<DialogSummaryDto> {
        return this._dialogService.getDialogSummary(id);
    }

    @MessagePattern('changes.detected')
    public handleDetectedChanges(@Payload() changes: DetectedChangesDto) {
        return null;
        //return this._dialogService.integrateChanges(changes);
    }

    @MessagePattern('suggestions.generated')
    public handleSuggestions(@Payload() suggestions: SuggestionsDto) {
        return null;
        //return this._dialogService.saveSuggestions(suggestions);
    }

}

