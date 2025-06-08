import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { DetectChangesDto, DetectChangesFromIriDto, DetectChangesHybridDto } from '@app/common/dto/detect-changes.dto';
import { DetectedChangesDto, DetectedChange, ChangeType } from '@app/common/dto/detected-changes.dto';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { firstValueFrom } from 'rxjs';
import { DataspecerFetcherService } from './services/dataspecer-fetcher.service';

@Injectable()
export class ChangesDetectorService {
  constructor(
    @Inject('DATASPECER_ADAPTER')
    private readonly dataspecerAdapterClient: ClientProxy,
    private readonly dataspecerFetcherService: DataspecerFetcherService
  ) {}

  async detectFromIri(dto: DetectChangesFromIriDto): Promise<DetectedChangesDto> {
    const psmSchema = await this.dataspecerFetcherService.fetchPsmSchema(dto.psmIri);

    console.log('psmSchema', psmSchema);
    
    const oldJsonSchema = await this.dataspecerFetcherService.generateJsonSchema(dto.dataSpecificationIri, dto.psmIri);

    console.log('oldJsonSchema', oldJsonSchema);
    
    const detectChangesDto: DetectChangesDto = {
      dialogId: dto.dialogId,
      oldApi: oldJsonSchema,
      newApi: dto.newJsonSchema,
      psm: psmSchema,
      psmIri: dto.psmIri,
      artifactFormat: dto.artifactFormat
    };

    return this.detect(detectChangesDto);
  }

  async detectHybrid(dto: DetectChangesHybridDto): Promise<DetectedChangesDto> {
    const psmSchema = await this.dataspecerFetcherService.fetchPsmSchema(dto.psmIri);
    
    const detectChangesDto: DetectChangesDto = {
      dialogId: dto.dialogId,
      oldApi: dto.oldJsonSchema,
      newApi: dto.newJsonSchema,
      psm: psmSchema,
      psmIri: dto.psmIri,
      artifactFormat: dto.artifactFormat
    };

    return this.detect(detectChangesDto);
  }

  async detect(dto: DetectChangesDto): Promise<DetectedChangesDto> {
    if (!dto.psm && dto.psmIri) {
      try {
        const psm = await firstValueFrom(
          this.dataspecerAdapterClient.send('get.psm', { 
            dataspecerBaseUrl: process.env.DATASPECER_API_URL,
            iri: dto.psmIri 
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

    let oldApiObj, newApiObj;
    try {
      oldApiObj = JSON.parse(dto.oldApi);
      newApiObj = JSON.parse(dto.newApi);
    } catch (error) {
      throw new Error(`Failed to parse JSON schemas: ${error.message}`);
    }

    let diffString = '';
    let useJsonDiff = false;
    
    try {
      const jsonDiff = eval('require')('json-diff');
      
      const structuralDiff = jsonDiff.diff(oldApiObj, newApiObj);
      
      if (!structuralDiff) {
        console.log('No structural differences detected by json-diff');
        return {
          dialogId: dto.dialogId,
          changes: [],
        };
      }

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

    const model = new ChatOpenAI({
      model: "gpt-4.1",
      temperature: 0.1,
      maxTokens: 4000,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const MAX_DIFF_LENGTH = 8000;
    const MAX_PSM_LENGTH = 4000;
    
    let truncatedDiff = diffString;
    let truncatedPsm = dto.psm || '';
    
    if (diffString.length > MAX_DIFF_LENGTH) {
      truncatedDiff = diffString.substring(0, MAX_DIFF_LENGTH) + '\n... [truncated for length]';
      console.warn(`Diff truncated from ${diffString.length} to ${MAX_DIFF_LENGTH} characters`);
    }
    
    if (truncatedPsm.length > MAX_PSM_LENGTH) {
      truncatedPsm = truncatedPsm.substring(0, MAX_PSM_LENGTH) + '\n... [truncated for length]';
      console.warn(`PSM truncated from ${dto.psm?.length || 0} to ${MAX_PSM_LENGTH} characters`);
    }

    const prompt = ChatPromptTemplate.fromTemplate(
      useJsonDiff ? 
      `You are a data model expert who tries to control how the data are used in JSON Schemas regarding vocabularies (for example OWL). Analyze JSON  differences and categorize changes.

IMPORTANT: Provide a valid, complete JSON response. Limit your analysis to the most significant changes if there are many.

Task:
1. Categorize each difference: addition, removal, rename, type-change
2. Assess PSM compliance for each change - there is some vocabulary behind PSM, which describes the data model of the API with usage of OWL, LOD etc.

For each change provide:
- changeId: unique string identifier
- type: array of change types
- path: JSONPath to element
- description: brief explanation
- isAcceptable: boolean for PSM compliance
- groupId: optional grouping identifier

Differences:
{differences}

PSM Schema:
{psm}

Return only valid JSON with the changes array.`
      :
      `Analyze API specifications to identify differences.

IMPORTANT: Provide a valid, complete JSON response. Limit analysis to significant changes only.

Task:
1. Find differences between old and new API
2. Categorize: addition, removal, rename, type-change  
3. Assess PSM compliance

For each change:
- changeId: unique identifier
- type: array of change types
- path: JSONPath to changed element
- description: brief explanation
- isAcceptable: boolean for PSM compliance
- groupId: optional grouping

API Data:
{differences}

PSM Schema:
{psm}

Return only valid JSON with changes array.`
    );

    const schema = z.object({
      changes: z.array(
        z.object({
          changeId: z.string().min(1),
          type: z.array(z.enum(['addition', 'removal', 'rename', 'type-change'])),
          path: z.string().min(1),
          description: z.string().min(1).max(200), 
          isAcceptable: z.boolean(),
          groupId: z.string().optional(),
        }).strict()
      ).max(20),
    });

    console.log('=== Invoking LLM for semantic analysis ===');
    console.log('Input lengths - Diff:', truncatedDiff.length, 'PSM:', truncatedPsm.length);
    
    try {
      const chain = prompt.pipe(model.withStructuredOutput(schema));
      const result = await chain.invoke({
        differences: truncatedDiff,
        psm: truncatedPsm,
      });

      console.log('=== LLM Result ===');
      console.log('Number of changes detected:', result.changes?.length || 0);
      console.log('First change (if any):', result.changes?.[0]);

      const changes: DetectedChange[] = result.changes.map(change => ({
        changeId: change.changeId,
        type: change.type as ChangeType[],
        path: change.path,
        description: change.description,
        isAcceptable: change.isAcceptable,
        groupId: change.groupId,
      }));

      return {
        dialogId: dto.dialogId,
        changes,
      };
    } catch (error) {
      console.error('LLM invocation failed:', error.message);
      
      // Fallback: return empty changes with error info
      return {
        dialogId: dto.dialogId,
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

  async processChanges(dto: DetectedChangesDto): Promise<DetectedChangesDto> {
    if (!dto.psm && dto.psmIri) {
      try {
        const psm = await firstValueFrom(
          this.dataspecerAdapterClient.send('get.psm', { iri: dto.psmIri })
        );
        dto.psm = psm;
      } catch (error) {
        throw new Error(`Failed to load PSM from dataspecer-adapter: ${error.message}`);
      }
    }
    return dto;
  }
}
