import { Controller, Inject } from '@nestjs/common';
import { ClientProxy, MessagePattern, Payload } from '@nestjs/microservices';
import { ChangesSuggesterService } from '../changes-suggester.service';
import { SuggestionInputDto } from '@app/common/dto/suggestion-input.dto';
import { SuggestionsDto } from '@app/common/dto/suggestions.dto';

@Controller()
export class ChangesSuggesterAmqpController {
  constructor(
    private readonly _changesSuggesterService: ChangesSuggesterService,
    @Inject('DIALOG_SERVICE')
    private readonly client: ClientProxy
  ) {}

  @MessagePattern('generate.suggestions')
  async generateSuggestions(@Payload() dto: SuggestionInputDto): Promise<SuggestionsDto> {
    const suggestions = await this._changesSuggesterService.suggest(dto);
    this.client.emit('suggestions.generated', suggestions);
    return suggestions;
  }
} 