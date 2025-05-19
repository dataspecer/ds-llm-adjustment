import { CreateDialogDto } from '@app/common/dto/create-dialog.dto';
import { DialogResponseDto } from '@app/common/dto/dialog-response.dto';
import { DialogSummaryDto } from '@app/common/dto/dialog-summary.dto';
import { Body, Controller, Get, Param, Post, Headers } from '@nestjs/common';
import { IDialogService } from 'apps/dialogs-handler/src/services/interfaces/dialog/dialog-service.interface';

@Controller('dialogs')
export class DialogHttpController {
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
}
