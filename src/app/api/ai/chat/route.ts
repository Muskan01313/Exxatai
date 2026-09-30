import { z } from "zod";
import { getCurrentUserId } from "@/lib/session";
import { isWorkspaceMember } from "@/lib/workspace";
import { getTextProvider, getTextProviderConfigError, getEmbeddingProviderConfigError } from "@/lib/ai";
import { retrieveRelevantChunks } from "@/lib/ai/rag";
import { toStreamResponse } from "@/lib/ai/streamResponse";

const chatSchema = z.object({
  workspaceId: z.string().uuid(),
  question: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Invalid input", { status: 400 });
  }

  const { workspaceId, question } = parsed.data;

  if (!(await isWorkspaceMember(workspaceId, userId))) {
    return new Response("Not found", { status: 404 });
  }

  const embeddingConfigError = getEmbeddingProviderConfigError();
  if (embeddingConfigError) {
    return new Response(embeddingConfigError, { status: 503 });
  }
  const textConfigError = getTextProviderConfigError();
  if (textConfigError) {
    return new Response(textConfigError, { status: 503 });
  }

  const chunks = await retrieveRelevantChunks(workspaceId, question);

  const sources = Array.from(new Map(chunks.map((c) => [c.pageId, c.pageTitle])).entries()).map(
    ([pageId, title]) => ({ pageId, title }),
  );

  const contextBlock =
    chunks.length > 0
      ? chunks
          .map((c, i) => `[${i + 1}] (from page: "${c.pageTitle}")\n${c.content}`)
          .join("\n\n---\n\n")
      : "(No matching notes were found in this workspace.)";

  const stream = getTextProvider().streamChat([
    {
      role: "system",
      content:
        "You are an AI assistant answering questions about the user's own workspace notes. Only use the provided context to answer. If the context doesn't contain the answer, say you don't know rather than making something up. Mention which page(s) you used, by title, when relevant.",
    },
    {
      role: "user",
      content: `Context from the workspace:\n\n${contextBlock}\n\nQuestion: ${question}`,
    },
  ]);

  return toStreamResponse(stream, {
    "X-Ai-Sources": encodeURIComponent(JSON.stringify(sources)),
  });
}
