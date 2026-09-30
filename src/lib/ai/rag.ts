import { prisma } from "@/lib/prisma";
import { getEmbeddingProvider } from "@/lib/ai";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;

function extractInlineText(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((item) => {
      if (item && typeof item === "object") {
        const node = item as Record<string, unknown>;
        if (typeof node.text === "string") {
          return node.text;
        }
        if (Array.isArray(node.content)) {
          return extractInlineText(node.content);
        }
      }
      return "";
    })
    .join("");
}

export function blocksToPlainText(blocks: unknown): string {
  if (!Array.isArray(blocks)) {
    return "";
  }
  const lines: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const node = block as Record<string, unknown>;
    const text = extractInlineText(node.content);
    if (text.trim()) {
      lines.push(text.trim());
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      const childText = blocksToPlainText(node.children);
      if (childText) {
        lines.push(childText);
      }
    }
  }
  return lines.join("\n");
}

function chunkText(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }
  if (normalized.length <= CHUNK_SIZE) {
    return [normalized];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    chunks.push(normalized.slice(start, end));
    if (end === normalized.length) {
      break;
    }
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

export async function indexPage(pageId: string): Promise<void> {
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page) {
    return;
  }

  const text = `${page.title}\n\n${blocksToPlainText(page.content)}`;
  const chunks = chunkText(text);

  await prisma.pageChunk.deleteMany({ where: { pageId } });
  if (chunks.length === 0) {
    return;
  }

  const embeddings = await getEmbeddingProvider().embed(chunks);

  await prisma.pageChunk.createMany({
    data: chunks.map((content, index) => ({
      pageId,
      chunkIndex: index,
      content,
      embedding: embeddings[index] ?? [],
    })),
  });
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return -1;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return -1;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface RetrievedChunk {
  pageId: string;
  pageTitle: string;
  content: string;
  score: number;
}

export async function retrieveRelevantChunks(
  workspaceId: string,
  query: string,
  topK = 6,
): Promise<RetrievedChunk[]> {
  const [queryEmbedding] = await getEmbeddingProvider().embed([query]);
  if (!queryEmbedding) {
    return [];
  }

  const chunks = await prisma.pageChunk.findMany({
    where: { page: { workspaceId } },
    include: { page: { select: { title: true } } },
  });

  return chunks
    .map((chunk) => ({
      pageId: chunk.pageId,
      pageTitle: chunk.page.title,
      content: chunk.content,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((chunk) => chunk.score > 0);
}
