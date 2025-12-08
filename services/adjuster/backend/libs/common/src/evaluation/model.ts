export type Gpt5Variant = 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano';

export function pickGpt5Model(): Gpt5Variant {
  const variants: Gpt5Variant[] = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano'];
  const idx = Math.floor(Math.random() * variants.length);
  return variants[idx];
}



