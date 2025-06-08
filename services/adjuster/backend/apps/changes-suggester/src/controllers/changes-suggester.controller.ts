import { Controller, Get, Inject, Post, Body } from '@nestjs/common';
import { ChangesSuggesterService } from '../changes-suggester.service';
import { SuggestionInputDto } from '@app/common/dto/suggestion-input.dto';
import { SuggestionsDto } from '@app/common/dto/suggestions.dto';

@Controller('api')
export class ChangesSuggesterController {
  constructor(private readonly _changesSuggesterService: ChangesSuggesterService) {}

  @Post('suggestions')
  async generateHttp(@Body() dto: SuggestionInputDto): Promise<SuggestionsDto> {
    const suggestions = await this._changesSuggesterService.suggest(dto);
    return suggestions;
  }
}
