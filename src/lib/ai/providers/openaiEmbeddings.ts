import OpenAI from "openai";
import type { EmbeddingProvider } from "../types";

let client: OpenAI | undefined;
function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export const openAiEmbeddingProvider: EmbeddingProvider = {
  async embed(texts: string[]) {
    if (texts.length === 0) {
      return [];
    }
    const response = await getClient().embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      input: texts,
    });
    return response.data.map((item) => item.embedding);
  },
};
