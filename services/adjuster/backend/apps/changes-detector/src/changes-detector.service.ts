import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { DetectChangesDto } from '@app/common/dto/detect-changes.dto';
import { DetectedChangesDto, DetectedChange, ChangeType } from '@app/common/dto/detected-changes.dto';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ChangesDetectorService {
  constructor(
    @Inject('DATASPECER_ADAPTER')
    private readonly dataspecerAdapterClient: ClientProxy
  ) {}

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

    const model = new ChatOpenAI({
      model: "gpt-4",
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = ChatPromptTemplate.fromTemplate(
      `Your task is to:
      1. Identify all differences between the old and new API specifications.
      2. Categorize each difference into one of the following change types:
        - addition: A new element was introduced.
        - removal: An existing element was removed.
        - rename: An element's identifier was changed.
        - type-change: The datatype or structure of an element was modified.

      For each detected change, provide:
      - 'changeId': A unique identifier for the change.
      - 'type': One of the four categories above.
      - 'path': The fully qualified path (e.g. JSONPath or OpenAPI path) to the changed element.
      - 'description': A short, clear explanation of the change.
      - 'acceptable': 'true' or 'false', based on whether the change complies with the semantics defined in the OWL-based PSM vocabularies.
      - 'reason': Explain *why* the change is or isn't acceptable, with reference to specific classes, properties, or constraints in the vocabulary.
      - 'groupId': An optional identifier if the change is logically grouped with others (e.g. a rename and a type-change together).`
    );

    const schema = z.object({
      changes: z.array(
        z.object({
          changeId: z.string().min(1),
          type: z.array(z.enum(['addition', 'removal', 'rename', 'type-change'])),
          path: z.string().min(1),
          description: z.string().min(1),
          isAcceptable: z.boolean(),
          groupId: z.string().optional(),
        }).strict()
      ),
    });

    const chain = prompt.pipe(model.withStructuredOutput(schema));
    const result = await chain.invoke({
      oldApi: dto.oldApi,
      newApi: dto.newApi,
      psm: dto.psm,
    });

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
  }

  async processChanges(dto: DetectedChangesDto): Promise<DetectedChangesDto> {
    // If PSM is not provided but psmIri is, load PSM via dataspecer-adapter
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

    // Here you would implement your changes detection logic
    // using the PSM (either provided directly or loaded via adapter)

    return dto;
  }
}
