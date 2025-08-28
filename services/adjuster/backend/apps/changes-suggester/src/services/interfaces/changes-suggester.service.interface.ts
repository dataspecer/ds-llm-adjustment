import { SuggestionInputDto } from '@app/common/dto/suggestion-input.dto';
import { SuggestionsDto } from '@app/common/dto/suggestions.dto';

export interface ChangesSuggesterServiceInterface {
  suggest(dto: SuggestionInputDto): Promise<SuggestionsDto>;
}


