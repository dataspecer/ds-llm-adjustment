export type ChangeKind = 'addition' | 'removal' | 'modify' | 'rename' | 'type-change';

export interface TypedChangeRef {
  id: string;
  type: ChangeKind;
  path: string;
}

export interface PerTypeScores {
  type: ChangeKind;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface DiffQualityInputDto {
  runId: string;
  gold: TypedChangeRef[];
  predicted: TypedChangeRef[];
}

export interface DiffQualityResultDto {
  runId: string;
  perType: PerTypeScores[];
  microAveraged: {
    precision: number;
    recall: number;
    f1: number;
  };
}



