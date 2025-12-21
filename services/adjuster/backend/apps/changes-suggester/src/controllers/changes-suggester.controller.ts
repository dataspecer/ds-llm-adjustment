import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ChangesSuggesterService } from '../services/changes-suggester.service';
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { SuggestionInputDto } from '@app/common/dto/suggestion-input.dto';
import { SuggestionsDto } from '@app/common/dto/suggestions.dto';

@ApiTags('suggestions')
@Controller('suggestions')
export class ChangesSuggesterController {
  constructor(private readonly _changesSuggesterService: ChangesSuggesterService) {}

  @Post()
  @ApiOperation({ summary: 'Generate suggestions for detected changes' })
  @ApiBody({ type: SuggestionInputDto })
  @ApiCreatedResponse({ type: SuggestionsDto })
  async generateHttp(@Body() dto: SuggestionInputDto): Promise<SuggestionsDto> {
    const suggestions: SuggestionsDto = await this._changesSuggesterService.suggest(dto);
    return suggestions;
  }

  @Get('psm-preview/:id')
  @ApiOperation({ summary: 'Preview PSM after accepted changes via analysis id' })
  @ApiParam({ name: 'id', required: true })
  @ApiOkResponse({ schema: { type: 'object' } })
  async previewPsmHttp(@Param('id') id: string): Promise<string> {
    return this._changesSuggesterService.previewPsm(id);
  }
}
