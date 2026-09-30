import type { EmbeddingProvider } from "../types";

export const voyageEmbeddingProvider: EmbeddingProvider = {
  async embed(texts: string[]) {
    if (texts.length === 0) {
      return [];
    }
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        input: texts,
        model: process.env.VOYAGE_EMBEDDING_MODEL || "voyage-3-lite",
      }),
    });

    if (!res.ok) {
      throw new Error(`Voyage embeddings request failed (${res.status}): ${await res.text()}`);
    }

    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data.map((item) => item.embedding);
  },
};
