import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { SuggestionInputDto } from '@app/common/dto/suggestion-input.dto';
import { SuggestionsDto, Suggestion } from '@app/common/dto/suggestions.dto';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { PROMPTS } from '@app/common/config/prompts';
import { z } from 'zod';
import { ChangesSuggesterServiceInterface } from '@interfaces/changes-suggester.service.interface';
import { extractKeywordsFromChanges, selectRelevantPsmContext, selectRelevantRdfContext } from '@app/common/utils/psm-context';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ChangesSuggesterService implements ChangesSuggesterServiceInterface {

  public constructor(
    @Inject('EVALUATION') private readonly evaluationClient: ClientProxy,
    @Inject('DATASPECER_ADAPTER') private readonly dataspecerAdapterClient: ClientProxy,
    @Inject('DIALOG_SERVICE') private readonly dialogServiceClient: ClientProxy,
  ) {}

  public async suggest(dto: SuggestionInputDto): Promise<SuggestionsDto> {
    const { pickGpt5Model } = await import('@app/common/evaluation/model');
    const modelName: 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano' | 'gpt-oss-120b' = pickGpt5Model();
    const model = new ChatOpenAI({
      model: modelName,
      apiKey: process.env.OPENAI_API_KEY,
    });
    // emit model selection event
    const runId: string | undefined = (dto as any).runId;
    // Randomly decide whether to use RAG by default; allow explicit override via dto.useRag
    const randomUse: boolean = Math.random() < 0.5;
    const useRag: boolean = typeof (dto as any).useRag === 'boolean' ? (dto as any).useRag : randomUse;
    if (runId) {
      this.evaluationClient.emit('evaluation.model', {
        runId,
        service: 'changes-suggester',
        operation: useRag ? 'suggest.rag' : 'suggest.no_rag',
        modelName,
        timestamp: new Date().toISOString(),
      }).subscribe({ error: () => {} });
    }

    // Select relevant chunks from PSM to keep token usage bounded
    const MAX_PSM_CONTEXT_CHARS: number = 3000;
    const MAX_ONTOLOGY_CONTEXT_CHARS: number = 2000;
    const keywords: string[] = extractKeywordsFromChanges(dto.changes as any);
    const selectedPsmRaw: string = selectRelevantPsmContext(dto.psm || '', keywords, MAX_PSM_CONTEXT_CHARS);
    const selectedOntologyRaw: string = selectRelevantRdfContext(dto.ontology || '', keywords, MAX_ONTOLOGY_CONTEXT_CHARS);
    const selectedPsm: string = useRag ? selectedPsmRaw : '';
    const selectedOntology: string = useRag ? selectedOntologyRaw : '';

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

  public async previewPsm(id: string): Promise<string> {
    const logger = new Logger(ChangesSuggesterService.name);
    // 1) Load shared analysis by ID (includes changes + decisions)
    let analysis: {
      analysisId: string;
      oldSchemaName: string;
      newSchemaName: string;
      psmFileName: string;
      changes: Array<{ id: string; type: string; path: string; description: string; [k: string]: any }>;
      decisions?: Array<{ changeId: string; decision: string; comment?: string }>;
      schema: string;
      timestamp: string;
    };
    try {
      analysis = await firstValueFrom(
        this.dialogServiceClient.send('analysis.get', { analysisId: id })
      ) as any;
    } catch (e) {
      logger.error(`previewPsm: cannot load analysis ${id}: ${e instanceof Error ? e.message : e}`);
      throw e instanceof Error ? e : new Error('Failed to load analysis via AMQP');
    }

    // Build accepted changes payload
    const acceptedChangeIds = new Set(
      (analysis.decisions || [])
        .filter(d => d.decision === 'accept')
        .map(d => d.changeId)
    );
    const acceptedChanges = (analysis.changes || []).filter(c => acceptedChangeIds.has((c as any).id));

    // 2) Fetch PSM from Dataspecer
    const dataspecerBaseUrl: string =
      process.env.DATASPECER_BACKEND_URL ||
      process.env.DATASPECER_API_URL ||
      'http://dataspecer:80';
    const psmIri: string = analysis.psmFileName;
    let originalPsm: string;
    try {
      originalPsm = await firstValueFrom(
        this.dataspecerAdapterClient.send('get.psm', { dataspecerBaseUrl, iri: psmIri })
      ) as string;
    } catch (e) {
      logger.error(`previewPsm: cannot fetch PSM for iri=${psmIri}: ${e instanceof Error ? e.message : e}`);
      throw new Error('Failed to fetch PSM from Dataspecer');
    }

    // 3) Call LLM to produce modified PSM JSON
    const { pickGpt5Model } = await import('@app/common/evaluation/model');
    const modelName: 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano' | 'gpt-oss-120b' = pickGpt5Model();
    const model = new ChatOpenAI({
      model: modelName,
      apiKey: process.env.OPENAI_API_KEY,
      temperature: 0,
    });

    const prompt: ChatPromptTemplate = ChatPromptTemplate.fromTemplate(PROMPTS.changesSuggester.psmPreviewTemplate);

    const chain: any = prompt.pipe(model);
    const llmResponse = await chain.invoke({
      acceptedChanges: JSON.stringify(acceptedChanges),
      psm: originalPsm,
    });

    const text: string = typeof llmResponse?.content === 'string'
      ? llmResponse.content
      : Array.isArray(llmResponse?.content)
        ? (llmResponse.content.find((c: any) => typeof c?.text === 'string')?.text || '')
        : '';

    // 4) Ensure it is JSON (pretty-print if possible)
    try {
      const parsed = JSON.parse(text);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // Return raw if not strictly JSON, caller can handle
      return text;
    }
  }

}
