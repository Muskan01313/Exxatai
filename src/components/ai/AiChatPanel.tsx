"use client";

import Link from "next/link";
import { useRef, useState } from "react";

interface Source {
  pageId: string;
  title: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

export function AiChatPanel({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  async function ask() {
    const q = question.trim();
    if (!q || loading) {
      return;
    }
    setQuestion("");
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: q }, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, question: q }),
      });

      let sources: Source[] = [];
      const sourcesHeader = res.headers.get("X-Ai-Sources");
      if (sourcesHeader) {
        try {
          sources = JSON.parse(decodeURIComponent(sourcesHeader));
        } catch {
          sources = [];
        }
      }

      if (!res.ok || !res.body) {
        const message = await res.text().catch(() => "");
        updateLastAssistant(message || "Something went wrong talking to the AI provider.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        acc += decoder.decode(value, { stream: true });
        updateLastAssistant(acc);
      }
      updateLastAssistant(acc, sources);
    } catch {
      updateLastAssistant("Couldn't reach the AI provider. Please try again.");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
      });
    }
  }

  function updateLastAssistant(content: string, sources?: Source[]) {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === "assistant") {
        next[next.length - 1] = { ...last, content, sources: sources ?? last.sources };
      }
      return next;
    });
  }

  return (
    <div className="flex h-full w-96 shrink-0 flex-col border-l border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-sm font-medium text-ink">✨ Ask AI about your workspace</span>
        <button type="button" onClick={onClose} className="text-ink-3 hover:text-ink-2">
          ✕
        </button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-ink-3">
            Ask a question about anything in this workspace, and I&apos;ll search your pages for the answer.
          </p>
        )}
        <div className="flex flex-col gap-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <div
                className={`inline-block max-w-[90%] rounded-lg px-3 py-2 text-left text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-accent text-white" : "bg-[#f7f7f5] text-ink"
                }`}
              >
                {m.content || (m.role === "assistant" && loading ? "Thinking…" : "")}
              </div>
              {m.sources && m.sources.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {m.sources.map((s) => (
                    <Link
                      key={s.pageId}
                      href={`/w/${workspaceId}/p/${s.pageId}`}
                      className="rounded-full bg-[#f7f7f5] px-2 py-0.5 text-xs text-ink-2 underline hover:text-ink"
                    >
                      {s.title || "Untitled"}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-line p-3">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void ask();
            }
          }}
          placeholder="Ask about your workspace…"
          disabled={loading}
          className="flex-1 rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-accent/60 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void ask()}
          disabled={loading || !question.trim()}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {loading ? "…" : "Ask"}
        </button>
      </div>
    </div>
  );
}
