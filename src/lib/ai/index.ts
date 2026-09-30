import type { EmbeddingProvider, TextProvider } from "./types";
import { openAiTextProvider } from "./providers/openai";
import { anthropicTextProvider } from "./providers/anthropic";
import { openAiEmbeddingProvider } from "./providers/openaiEmbeddings";
import { voyageEmbeddingProvider } from "./providers/voyageEmbeddings";

export * from "./types";

export function getTextProvider(): TextProvider {
  return process.env.AI_TEXT_PROVIDER === "anthropic" ? anthropicTextProvider : openAiTextProvider;
}

export function getEmbeddingProvider(): EmbeddingProvider {
  return process.env.AI_EMBEDDING_PROVIDER === "voyage" ? voyageEmbeddingProvider : openAiEmbeddingProvider;
}

export function getTextProviderConfigError(): string | null {
  const name = process.env.AI_TEXT_PROVIDER === "anthropic" ? "anthropic" : "openai";
  const key = name === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  if (!key) {
    const envVar = name === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
    return `The AI text provider ("${name}") is not configured. Set ${envVar} in your environment and restart the server.`;
  }
  return null;
}

export function getEmbeddingProviderConfigError(): string | null {
  const name = process.env.AI_EMBEDDING_PROVIDER === "voyage" ? "voyage" : "openai";
  const key = name === "voyage" ? process.env.VOYAGE_API_KEY : process.env.OPENAI_API_KEY;
  if (!key) {
    const envVar = name === "voyage" ? "VOYAGE_API_KEY" : "OPENAI_API_KEY";
    return `The AI embedding provider ("${name}") is not configured. Set ${envVar} in your environment and restart the server.`;
  }
  return null;
}
