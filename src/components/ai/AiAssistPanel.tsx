"use client";

import { useState } from "react";
import type { BlockNoteEditor } from "@blocknote/core";

const PRESETS: { label: string; instruction: string }[] = [
  { label: "Continue writing", instruction: "Continue writing from where the text leaves off, matching its tone and style." },
  { label: "Improve writing", instruction: "Improve the writing quality, clarity, and flow." },
  { label: "Fix spelling & grammar", instruction: "Fix all spelling and grammar mistakes without changing the meaning." },
  { label: "Make shorter", instruction: "Make this more concise." },
  { label: "Make longer", instruction: "Expand this with more detail." },
  { label: "Simplify language", instruction: "Simplify the language so it's easier to understand." },
  { label: "Summarize", instruction: "Summarize this into a few key points." },
  { label: "Explain this", instruction: "Explain this in simple terms." },
  { label: "Brainstorm ideas", instruction: "Brainstorm a bulleted list of ideas related to this." },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function AiAssistPanel({ editor, onClose }: { editor: BlockNoteEditor<any, any, any>; onClose: () => void }) {
  const [instruction, setInstruction] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  const selectedText = editor.getSelectedText();
  const hasSelection = selectedText.trim().length > 0;

  async function run(customInstruction?: string) {
    const finalInstruction = customInstruction ?? instruction;
    if (!finalInstruction.trim() || loading) {
      return;
    }
    setLoading(true);
    setResult("");
    setHasResult(false);

    const context = hasSelection ? undefined : editor.blocksToMarkdownLossy(editor.document).slice(-4000);

    try {
      const res = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: finalInstruction,
          selectedText: hasSelection ? selectedText : undefined,
          context,
        }),
      });

      if (!res.ok || !res.body) {
        const message = await res.text().catch(() => "");
        setResult(message || "Something went wrong talking to the AI provider.");
        setHasResult(true);
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
        setResult(acc);
      }
      setHasResult(true);
    } catch {
      setResult("Couldn't reach the AI provider. Please try again.");
      setHasResult(true);
    } finally {
      setLoading(false);
    }
  }

  function insertResult() {
    const blocks = editor.tryParseMarkdownToBlocks(result);
    if (hasSelection) {
      const selection = editor.getSelection();
      if (selection) {
        editor.replaceBlocks(selection.blocks.map((b) => b.id), blocks);
      }
    } else {
      const cursor = editor.getTextCursorPosition();
      editor.insertBlocks(blocks, cursor.block.id, "after");
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/10 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[70vh] w-full max-w-lg flex-col rounded-xl border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <span className="text-sm font-medium text-zinc-700">
            ✨ Ask AI{hasSelection ? " about your selection" : ""}
          </span>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            ✕
          </button>
        </div>

        {(result || loading) && (
          <div className="max-h-64 overflow-y-auto border-b border-zinc-100 px-4 py-3 text-sm whitespace-pre-wrap text-zinc-800">
            {result || "Thinking…"}
          </div>
        )}

        {!loading && !hasResult && (
          <div className="flex flex-wrap gap-1.5 px-4 py-3">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => run(p.instruction)}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 p-3">
          {hasResult ? (
            <>
              <button
                type="button"
                onClick={insertResult}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
              >
                {hasSelection ? "Replace selection" : "Insert below"}
              </button>
              <button
                type="button"
                onClick={() => run(instruction || "Try again with a different take.")}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600"
              >
                Try again
              </button>
              <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-zinc-400">
                Discard
              </button>
            </>
          ) : (
            <>
              <input
                autoFocus
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    run();
                  }
                }}
                placeholder={hasSelection ? "Or tell AI what to do with the selection…" : "Ask AI to write something…"}
                disabled={loading}
                className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => run()}
                disabled={loading || !instruction.trim()}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {loading ? "…" : "Go"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
