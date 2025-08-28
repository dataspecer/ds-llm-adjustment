import { CreateDialogDto } from '@app/common/dto/create-dialog.dto';
import { DialogResponseDto } from '@app/common/dto/dialog-response.dto';
import { DialogSummaryDto } from '@app/common/dto/dialog-summary.dto';
import { Body, Controller, Get, Param, Post, Headers } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { IDialogService } from 'apps/dialogs-handler/src/services/interfaces/dialog/dialog-service.interface';

@ApiTags('dialogs')
@Controller('dialogs')
export class DialogHttpController {
    constructor(private readonly _dialogService: IDialogService) {}

    @Post()
    @ApiOperation({ summary: 'Start a new dialog for developer' })
    @ApiBearerAuth()
    @ApiBody({ type: CreateDialogDto })
    @ApiCreatedResponse({ type: DialogResponseDto })
    public async createDialog(@Headers('x-access-token') token: string, 
        @Body() dto: CreateDialogDto): Promise<DialogResponseDto> {
        return this._dialogService.startDialog('DEVELOPER', dto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get dialog summary by id' })
    @ApiParam({ name: 'id', type: String })
    @ApiOkResponse({ type: DialogSummaryDto })
    public async getDialog(@Param('id') id: string): Promise<DialogSummaryDto> {
        return this._dialogService.getDialogSummary(id);
    }
}
