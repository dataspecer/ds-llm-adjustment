export type LlmVariant = 'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano' | 'mistral-3';

export function pickModel(): LlmVariant {
  const envPool = (process.env.ADJUSTER_MODEL_POOL || '').trim();
  const parsed: string[] = envPool ? envPool.split(',').map(s => s.trim()).filter(Boolean) : [];
  const pool: LlmVariant[] = (parsed.length > 0
    ? (parsed as LlmVariant[])
    : (['gpt-5', 'gpt-5-mini', 'gpt-5-nano'] as LlmVariant[])
  );
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

export function getOpenAIModelFor(variant: LlmVariant): string {
  if (variant === 'mistral-3') {
    // Fallback mapping if OpenAI-compatible endpoint is not configured
    return process.env.MISTRAL_OPENAI_COMPAT_MODEL || 'gpt-5-mini';
  }
  return variant;
}

export async function createChatModel(variant: LlmVariant): Promise<any> {
  if (variant === 'mistral-3') {
    const { ChatOllama } = await import('@langchain/community/chat_models/ollama');
    const baseUrl: string = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
    const model: string = process.env.OLLAMA_MISTRAL_MODEL || 'mistral';
    return new ChatOllama({ baseUrl, model });
  }
  const { ChatOpenAI } = await import('@langchain/openai');
  const modelName: string = getOpenAIModelFor(variant);
  return new ChatOpenAI({
    model: modelName,
    apiKey: process.env.OPENAI_API_KEY,
  });
}



