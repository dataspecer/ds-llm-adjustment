import { ChangeDecisionDto } from './change-decision.dto';
import { SchemaChangeDto } from './schema-change.dto';

export interface DeveloperReuploadPromptDto {
  specificationId: string;
  changes: SchemaChangeDto[];
  decisions: ChangeDecisionDto[];
  maintainerNote?: string;
}


