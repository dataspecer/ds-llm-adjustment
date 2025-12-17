export type Gpt5Variant = 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano' | 'gpt-oss-120b';

export function pickGpt5Model(): Gpt5Variant {
  const variants: Gpt5Variant[] = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-oss-120b'];
  const idx = Math.floor(Math.random() * variants.length);
  return variants[idx];
}



