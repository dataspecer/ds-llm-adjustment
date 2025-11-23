import { Injectable } from '@nestjs/common';
import { SuggestionInputDto } from '@app/common/dto/suggestion-input.dto';
import { SuggestionsDto, Suggestion } from '@app/common/dto/suggestions.dto';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { PROMPTS } from '@app/common/config/prompts';
import { z } from 'zod';
import { ChangesSuggesterServiceInterface } from '@interfaces/changes-suggester.service.interface';
import { extractKeywordsFromChanges, selectRelevantPsmContext, selectRelevantRdfContext } from '@app/common/utils/psm-context';

@Injectable()
export class ChangesSuggesterService implements ChangesSuggesterServiceInterface {

  public async suggest(dto: SuggestionInputDto): Promise<SuggestionsDto> {
    const model = new ChatOpenAI({
      model: "gpt-4.1",
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Select relevant chunks from PSM to keep token usage bounded
    const MAX_PSM_CONTEXT_CHARS: number = 3000;
    const MAX_ONTOLOGY_CONTEXT_CHARS: number = 2000;
    const keywords: string[] = extractKeywordsFromChanges(dto.changes as any);
    const selectedPsm: string = selectRelevantPsmContext(dto.psm || '', keywords, MAX_PSM_CONTEXT_CHARS);
    const selectedOntology: string = selectRelevantRdfContext(dto.ontology || '', keywords, MAX_ONTOLOGY_CONTEXT_CHARS);

    const prompt: ChatPromptTemplate = ChatPromptTemplate.fromTemplate(PROMPTS.changesSuggester.suggestionsTemplate);

    const schema: z.ZodObject = z.object({
      suggestions: z.array(
        z.object({
          changeId: z.string().min(1),
          suggestion: z.string().min(1),
          rationale: z.string().min(1)
        }).strict()
      ),
    });


    const structured: any = (model as any).withStructuredOutput(schema as any) as any;
    const chain: any = prompt.pipe(structured);
    const result: any = await chain.invoke({
      changes: JSON.stringify(dto.changes),
      psm: selectedPsm,
      ontology: selectedOntology,
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
