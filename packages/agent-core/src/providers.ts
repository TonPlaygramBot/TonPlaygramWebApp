export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

export interface LLMProvider {
  complete(prompt: string): Promise<string>;
}

export class NoopEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    return [text.length];
  }
}

export class RuleOnlyLLMProvider implements LLMProvider {
  async complete(prompt: string): Promise<string> {
    return `Public-help-only response: ${prompt.slice(0, 200)}`;
  }
}
