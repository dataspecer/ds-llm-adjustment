import { ChangeDecisionDto } from './change-decision.dto';

export interface ApplyChangesDto {
  specificationId: string;
  decisions: ChangeDecisionDto[];
}


