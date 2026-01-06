import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { DetectChangesDto, DetectChangesFromIriDto, DetectChangesHybridDto, DetectChangesAutomaticDto } from '@app/common/dto/detect-changes.dto';
import { DetectedChangesDto, DetectedChange, ChangeType } from '@app/common/dto/detected-changes.dto';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { PROMPTS } from '@app/common/config/prompts';
import { z } from 'zod';
import { firstValueFrom } from 'rxjs';
import { extractKeywordsFromDiff, selectRelevantPsmContext } from '@app/common/utils/psm-context';
import { ChangesDetectorServiceInterface } from '@interfaces/changes-detector.service.interface';

@Injectable()
export class ChangesDetectorService implements ChangesDetectorServiceInterface {
  constructor(
    @Inject('DATASPECER_ADAPTER')
    private readonly dataspecerAdapterClient: ClientProxy,
    @Inject('EVALUATION')
    private readonly evaluationClient: ClientProxy,
  ) {}

  public async detectFromIri(dto: DetectChangesFromIriDto): Promise<DetectedChangesDto> {
    const dataspecerBaseUrl: string = this.getDataspecerBaseUrl();
    const oldJsonSchema: string = await firstValueFrom(
      this.dataspecerAdapterClient.send('get.json.schema', {
        dataspecerBaseUrl,
        dataSpecificationIri: dto.dataSpecificationIri,
        psmIri: dto.psmIri,
      })
    );

    const detectChangesDto: DetectChangesDto = {
      dialogId: dto.dialogId,
      oldApi: oldJsonSchema,
      newApi: dto.newJsonSchema,
      psmIri: dto.psmIri,
      artifactFormat: dto.artifactFormat
    };

    return this.detect(detectChangesDto);
  }

  public async detectHybrid(dto: DetectChangesHybridDto): Promise<DetectedChangesDto> {
    const detectChangesDto: DetectChangesDto = {
      dialogId: dto.dialogId,
      oldApi: dto.oldJsonSchema,
      newApi: dto.newJsonSchema,
      psmIri: dto.psmIri,
      artifactFormat: dto.artifactFormat
    };

    return this.detect(detectChangesDto);
  }

  public async detectAutomatic(dto: DetectChangesAutomaticDto): Promise<DetectedChangesDto> {
    console.log('Starting automatic detection using DSV approach for:', dto.dataSpecificationIri);
    const dataspecerBaseUrl: string = this.getDataspecerBaseUrl();
    const oldJsonSchema: string = await firstValueFrom(
      this.dataspecerAdapterClient.send('get.json.schema', {
        dataspecerBaseUrl,
        dataSpecificationIri: dto.dataSpecificationIri,
        psmIri: dto.psmIri,
      })
    );

    const detectChangesDto: DetectChangesDto = {
      dialogId: dto.dialogId,
      oldApi: oldJsonSchema,
      newApi: dto.newJsonSchema,
      psmIri: dto.psmIri,
      artifactFormat: dto.artifactFormat
    };

    return this.detect(detectChangesDto);
  }

  public async fetchJsonSchemaViaDsv(dataSpecificationIri: string): Promise<string> {
    console.log('Fetching JSON schema via DSV for:', dataSpecificationIri);
    const dataspecerBaseUrl: string = this.getDataspecerBaseUrl();
    return await firstValueFrom(
      this.dataspecerAdapterClient.send('get.json.schema', {
        dataspecerBaseUrl,
        dataSpecificationIri,
      })
    );
  }

  public async detect(dto: DetectChangesDto): Promise<DetectedChangesDto> {
    if (!dto.psm && dto.psmIri) {
      try {
        const dataspecerBaseUrl: string = this.getDataspecerBaseUrl();
        console.log('dataspecerBaseUrl', dataspecerBaseUrl);
        const psm: string = await firstValueFrom(
          this.dataspecerAdapterClient.send('get.psm', {
            dataspecerBaseUrl,
            iri: dto.psmIri,
          })
        );
        dto.psm = psm;
      } catch (error) {
        throw new Error(`Failed to load PSM from dataspecer-adapter: ${error.message}`);
      }
    }

    console.log('=== Data being processed ===');
    console.log('oldApi length:', dto.oldApi?.length || 0);
    console.log('newApi length:', dto.newApi?.length || 0);
    console.log('psm length:', dto.psm?.length || 0);

    let oldApiObj: object, newApiObj: object;
    try {
      oldApiObj = JSON.parse(dto.oldApi);
      newApiObj = JSON.parse(dto.newApi);
    } catch (error) {
      throw new Error(`Failed to parse JSON schemas: ${error.message}`);
    }

    let diffString: string = '';
    let useJsonDiff: boolean = false;
    
    try {
      const jsonDiff = eval('require')('json-diff');
      
      // @ts-ignore - json-diff is not typed, dynamically loaded
      const structuralDiff: any = jsonDiff.diff(oldApiObj, newApiObj);
      
      if (!structuralDiff) {
        console.log('No structural differences detected by json-diff');
        return {
          dialogId: dto.dialogId,
          changes: [],
        };
      }

      // @ts-ignore - json-diff is not typed, dynamically loaded
      diffString = jsonDiff.diffString(oldApiObj, newApiObj, { color: false });
      useJsonDiff = true;
      
      console.log('=== Structural differences detected by json-diff ===');
      console.log('Diff string length:', diffString.length);
      console.log('Diff preview:', diffString.substring(0, 500) + '...');
      
    } catch (error) {
      console.warn('json-diff not available, using fallback approach:', error.message);
      
      if (JSON.stringify(oldApiObj) === JSON.stringify(newApiObj)) {
        console.log('No differences detected (fallback comparison)');
        return {
          dialogId: dto.dialogId,
          changes: [],
        };
      }
      
      diffString = `Old API:\n${JSON.stringify(oldApiObj, null, 2)}\n\nNew API:\n${JSON.stringify(newApiObj, null, 2)}`;
      console.log('=== Using fallback diff approach ===');
      console.log('Fallback diff length:', diffString.length);
    }

    const { pickGpt5Model } = await import('@app/common/evaluation/model');
    const modelName: 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano' | 'gpt-oss-120b' = pickGpt5Model();
    const model = new ChatOpenAI({
      model: modelName,
      maxTokens: 4000,
      apiKey: process.env.OPENAI_API_KEY,
    });
    // emit model selection event
    if (dto.runId) {
      this.evaluationClient.emit('evaluation.model', {
        runId: dto.runId,
        service: 'changes-detector',
        operation: 'detect',
        modelName,
        timestamp: new Date().toISOString(),
      }).subscribe({ error: () => {} });
    }

    const MAX_DIFF_LENGTH = 6000;
    const MAX_PSM_CONTEXT_CHARS = 2500;
    
    let truncatedDiff: string = diffString;
    if (diffString.length > MAX_DIFF_LENGTH) {
      truncatedDiff = diffString.substring(0, MAX_DIFF_LENGTH) + '\n... [truncated for length]';
      console.warn(`Diff truncated from ${diffString.length} to ${MAX_DIFF_LENGTH} characters`);
    }

    const keywords: string[] = extractKeywordsFromDiff(truncatedDiff);
    const relevantPsm: string = selectRelevantPsmContext(dto.psm || '', keywords, MAX_PSM_CONTEXT_CHARS);

    console.log('=== Prompts ===');
    console.log(PROMPTS);
    const prompt: ChatPromptTemplate = ChatPromptTemplate.fromTemplate(
      useJsonDiff ? PROMPTS.changesDetector.jsonDiffTemplate : PROMPTS.changesDetector.fallbackTemplate
    );

    const schema: z.ZodObject = z.object({
      changes: z.array(
        z.object({
          changeId: z.string().min(1),
          type: z.array(z.enum(['addition', 'removal', 'rename', 'type-change'])),
          path: z.string().min(1),
          description: z.string().min(1).max(200), 
          isAcceptable: z.boolean(),
          groupId: z.string().nullable(),
        }).strict()
      ).max(20),
    });

    console.log('=== Invoking LLM for semantic analysis ===');
      console.log('Input lengths - Diff:', truncatedDiff.length, 'PSM:', relevantPsm.length);
    
    try {
      const structured: any = (model as any).withStructuredOutput(schema as any) as any;
      const chain: any = prompt.pipe(structured);
      const result: any = await chain.invoke({
        // @ts-ignore - truncatedDiff is a string, but the schema expects a string
        differences: truncatedDiff,
        psm: relevantPsm,
      });

      console.log('=== LLM Result ===');
      console.log('Number of changes detected:', result.changes?.length || 0);
      console.log('First change (if any):', result.changes?.[0]);

      const changes: DetectedChange[] = result.changes.map((change: any) => ({
        // @ts-ignore - change.type is an array of strings, but the schema expects an array of ChangeType
        changeId: change.changeId,
        type: change.type as ChangeType[],
        path: change.path,
        description: change.description,
        isAcceptable: change.isAcceptable,
        groupId: change.groupId ?? undefined,
      }));

      return {
        dialogId: dto.dialogId,
        runId: dto.runId,
        changes,
      };
    } catch (error) {
      console.error('LLM invocation failed:', error.message);
      
      // Fallback: return empty changes with error info
      return {
        dialogId: dto.dialogId,
        runId: dto.runId,
        changes: [{
          changeId: 'error-1',
          type: [ChangeType.ADDITION],
          path: '$.error',
          description: `Analysis failed: ${error.message}. Manual review required.`,
          isAcceptable: false,
        }],
      };
    }
  }

  public async processChanges(dto: DetectedChangesDto): Promise<DetectedChangesDto> {
    if (!dto.psm && dto.psmIri) {
      try {
        const dataspecerBaseUrl: string = this.getDataspecerBaseUrl();
        const psm: string = await firstValueFrom(
          this.dataspecerAdapterClient.send('get.psm', { dataspecerBaseUrl, iri: dto.psmIri })
        );
        dto.psm = psm;
      } catch (error) {
        throw new Error(`Failed to load PSM from dataspecer-adapter: ${error.message}`);
      }
    }
    return dto;
  }

  private getDataspecerBaseUrl(): string {
    return process.env.DATASPECER_BACKEND_URL || process.env.DATASPECER_API_URL || 'http://dataspecer:80';
  }
}
