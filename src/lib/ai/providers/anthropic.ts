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

    const stream = getClient().messages.stream({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature,
      system: system || undefined,
      messages: conversation,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  },
};
