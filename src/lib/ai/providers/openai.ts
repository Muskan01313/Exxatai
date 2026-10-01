import OpenAI from "openai";
import type { ChatMessage, StreamChatOptions, TextProvider } from "../types";

let client: OpenAI | undefined;
function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export const openAiTextProvider: TextProvider = {
  async *streamChat(messages: ChatMessage[], options?: StreamChatOptions) {
    const stream = await getClient().chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      max_tokens: options?.maxTokens ?? 4096,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  },
};
