import { z } from "zod";
import { getCurrentUserId } from "@/lib/session";
import { getTextProvider, getTextProviderConfigError } from "@/lib/ai";
import { toStreamResponse } from "@/lib/ai/streamResponse";

const assistSchema = z.object({
  instruction: z.string().min(1).max(2000),
  selectedText: z.string().max(20000).optional(),
  context: z.string().max(20000).optional(),
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const configError = getTextProviderConfigError();
  if (configError) {
    return new Response(configError, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = assistSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Invalid input", { status: 400 });
  }

  const { instruction, selectedText, context } = parsed.data;

  const userPrompt = selectedText
    ? [
        `Instruction: ${instruction}`,
        "",
        `Here is the selected text to work with:\n"""\n${selectedText}\n"""`,
        "",
        "Respond with only the resulting text (plain text, or simple markdown for lists/headings if appropriate), and nothing else — no preamble, no explanation.",
      ].join("\n")
    : [
        `Instruction: ${instruction}`,
        "",
        context ? `Here is the document so far, for context:\n"""\n${context}\n"""\n` : "",
        "Write the requested content to be inserted into the document. Respond with only the resulting text (plain text, or simple markdown for lists/headings if appropriate), and nothing else — no preamble, no explanation.",
      ].join("\n");

  const stream = getTextProvider().streamChat([
    {
      role: "system",
      content:
        "You are an AI writing assistant embedded in a document editor, similar to Notion AI. You help the user write, edit, and brainstorm content directly inside their document. Keep responses focused and never wrap output in markdown code fences.",
    },
    { role: "user", content: userPrompt },
  ]);

  return toStreamResponse(stream);
}
