export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface StreamChatOptions {
  maxTokens?: number;
}

export interface TextProvider {
  streamChat(messages: ChatMessage[], options?: StreamChatOptions): AsyncIterable<string>;
}

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}
