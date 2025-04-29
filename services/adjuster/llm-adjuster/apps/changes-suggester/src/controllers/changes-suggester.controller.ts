import { Controller, Get, Inject } from '@nestjs/common';
import { ClientProxy, MessagePattern, Payload } from '@nestjs/microservices';
import { ChangesSuggesterService } from '../changes-suggester.service';

@Controller()
export class ChangesSuggesterController {
  constructor(private readonly _changesSuggesterService: ChangesSuggesterService,
    @Inject('DIALOG_SERVICE')
    private readonly client: ClientProxy
  ) {}

  @MessagePattern('generate.suggestions')
  async generate(@Payload() dto: SuggestionInputDto): Promise<SuggestionsDto> {
    const suggestions = await this._changesSuggesterService.suggest(dto);
    this.client.emit('suggestions.generated', suggestions);
    return suggestions;
  }

}
