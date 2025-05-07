import { Injectable } from '@nestjs/common';
import { DetectChangesDto } from '@app/common/dto/detect-changes.dto';
import { DetectedChangesDto, DetectedChange } from '@app/common/dto/detected-changes.dto';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';

@Injectable()
export class ChangesDetectorService {
  async detect(dto: DetectChangesDto): Promise<DetectedChangesDto> {
    const model = new ChatOpenAI({
      model: "gpt-4",
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = ChatPromptTemplate.fromTemplate(
      `Analyze the changes between two API specifications.
      Old API: {oldApi}
      New API: {newApi}
      PSM Artifact: {psm}

      Identify all changes and categorize them as:
      - addition: New elements added
      - removal: Elements removed
      - rename: Elements renamed
      - type-change: Type changes in properties

      For each change, provide:
      - A unique changeId
      - The type of change
      - The path to the changed element
      - A clear description
      - Whether the change is acceptable based on the PSM
      - A groupId if the change is related to other changes`
    );

    const schema = z.object({
      changes: z.array(
        z.object({
          changeId: z.string().min(1),
          type: z.enum(['addition', 'removal', 'rename', 'type-change']),
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
      type: change.type,
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
}
