import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, StreamChatOptions, TextProvider } from "../types";

let client: Anthropic | undefined;
function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export const anthropicTextProvider: TextProvider = {
  async *streamChat(messages: ChatMessage[], options?: StreamChatOptions) {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const conversation = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const stream = getClient().beta.messages.stream({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
      // Current models always think first, and thinking counts toward max_tokens.
      max_tokens: options?.maxTokens ?? 16000,
      system: system || undefined,
      messages: conversation,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }

    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      yield "\n\nClaude declined this request. Try rephrasing it.";
    }
  },
};
