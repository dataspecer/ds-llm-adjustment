import { Controller, Get, Inject, Post, Body } from '@nestjs/common';
import { ClientProxy, MessagePattern, Payload } from '@nestjs/microservices';
import { ChangesSuggesterService } from '../changes-suggester.service';
import { SuggestionInputDto } from '@app/common/dto/suggestion-input.dto';
import { SuggestionsDto } from '@app/common/dto/suggestions.dto';

@Controller('api')
export class ChangesSuggesterController {
  constructor(private readonly _changesSuggesterService: ChangesSuggesterService,
    @Inject('DIALOG_SERVICE')
    private readonly client: ClientProxy
  ) {}

  @Post('suggestions')
  async generateHttp(@Body() dto: SuggestionInputDto): Promise<SuggestionsDto> {
    const suggestions = await this._changesSuggesterService.suggest(dto);
    this.client.emit('suggestions.generated', suggestions);
    return suggestions;
  }
}
