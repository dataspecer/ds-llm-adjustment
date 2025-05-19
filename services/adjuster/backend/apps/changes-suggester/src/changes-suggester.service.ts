import { Injectable } from '@nestjs/common';
import { SuggestionInputDto } from '@app/common/dto/suggestion-input.dto';
import { SuggestionsDto, Suggestion } from '@app/common/dto/suggestions.dto';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';

@Injectable()
export class ChangesSuggesterService {
  getHello(): string {
    return 'Hello World!';
  }

  async suggest(dto: SuggestionInputDto): Promise<SuggestionsDto> {
    const model = new ChatOpenAI({
      model: "gpt-4",
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = ChatPromptTemplate.fromTemplate(
      `You are provided with a list of changes detected in an API specification and a PSM artifact.
      Changes: {changes}
      PSM Artifact: {psm}

      For each change, provide:
      - A suggestion for how to handle the change
      - A rationale explaining why this suggestion is appropriate
      - A confidence score (0-1) indicating how certain you are about the suggestion

      Consider:
      1. The impact on existing systems
      2. Backward compatibility
      3. Best practices for API design`
    );

    const schema = z.object({
      suggestions: z.array(
        z.object({
          changeId: z.string().min(1),
          suggestion: z.string().min(1),
          rationale: z.string().min(1)
        }).strict()
      ),
    });

    const chain = prompt.pipe(model.withStructuredOutput(schema));
    const result = await chain.invoke({
      changes: JSON.stringify(dto.changes),
      psm: dto.psm,
    });

    const suggestions: Suggestion[] = result.suggestions.map(suggestion => ({
      changeId: suggestion.changeId,
      suggestion: suggestion.suggestion,
      rationale: suggestion.rationale
    }));

    return {
      dialogId: dto.dialogId,
      suggestions,
    };
  }
}
