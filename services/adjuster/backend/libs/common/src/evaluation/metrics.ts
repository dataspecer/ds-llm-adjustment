import { ChangeKind, DiffQualityInputDto, DiffQualityResultDto, PerTypeScores, TypedChangeRef } from '../dto/evaluation/diff-quality.dto';

function toKey(c: TypedChangeRef): string {
  return `${c.type}::${c.path}`.toLowerCase();
}

function f1(precision: number, recall: number): number {
  if (precision === 0 && recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

export function computeDiffQuality(input: DiffQualityInputDto): DiffQualityResultDto {
  const kinds: ChangeKind[] = ['addition', 'removal', 'modify', 'rename', 'type-change'];
  const goldByType: Record<ChangeKind, Set<string>> = {
    addition: new Set(),
    removal: new Set(),
    modify: new Set(),
    rename: new Set(),
    'type-change': new Set(),
  };
  const predByType: Record<ChangeKind, Set<string>> = {
    addition: new Set(),
    removal: new Set(),
    modify: new Set(),
    rename: new Set(),
    'type-change': new Set(),
  };
  for (const g of input.gold) goldByType[g.type].add(toKey(g));
  for (const p of input.predicted) predByType[p.type].add(toKey(p));

  const perType: PerTypeScores[] = kinds.map((type) => {
    const gold = goldByType[type];
    const pred = predByType[type];
    let tp = 0;
    for (const k of pred) {
      if (gold.has(k)) tp += 1;
    }
    const fp = Math.max(0, pred.size - tp);
    const fn = Math.max(0, gold.size - tp);
    const precision = pred.size === 0 ? 0 : tp / pred.size;
    const recall = gold.size === 0 ? 0 : tp / gold.size;
    return {
      type,
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
      precision,
      recall,
      f1: f1(precision, recall),
    };
  });

  // Micro-averaged precision/recall over all types
  const totals = perType.reduce(
    (acc, s) => {
      acc.tp += s.truePositives;
      acc.fp += s.falsePositives;
      acc.fn += s.falseNegatives;
      return acc;
    },
    { tp: 0, fp: 0, fn: 0 }
  );
  const microPrecision = totals.tp + totals.fp === 0 ? 0 : totals.tp / (totals.tp + totals.fp);
  const microRecall = totals.tp + totals.fn === 0 ? 0 : totals.tp / (totals.tp + totals.fn);

  return {
    runId: input.runId,
    perType,
    microAveraged: {
      precision: microPrecision,
      recall: microRecall,
      f1: f1(microPrecision, microRecall),
    },
  };
}



