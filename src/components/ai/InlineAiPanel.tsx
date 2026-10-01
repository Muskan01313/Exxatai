"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import { TextSelection } from "@tiptap/pm/state";
import {
  AlignLeft,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Languages,
  Lightbulb,
  ListChecks,
  ListPlus,
  ListTree,
  Maximize2,
  MessageSquareText,
  Mic,
  Minimize2,
  Newspaper,
  PenLine,
  RefreshCw,
  Sparkles,
  SpellCheck,
  Square,
  Trash2,
  Wand2,
} from "lucide-react";

export interface AiTarget {
  anchorBlockId: string;
  mode: "write" | "edit";
  selectedText: string;
  selectionRange?: { from: number; to: number };
  selectionBlockIds?: string[];
}

interface AiRequest {
  instruction: string;
  selectedText?: string;
  context?: string;
  append?: boolean;
}

type Action =
  | { type: "write"; instruction: string }
  | { type: "edit"; instruction: string }
  | { type: "refine"; instruction: string }
  | { type: "continue" }
  | { type: "accept-write" }
  | { type: "replace-selection" }
  | { type: "insert-below" }
  | { type: "retry" }
  | { type: "discard" };

interface MenuEntry {
  label: string;
  icon: ReactNode;
  action?: Action;
  /** Fills the prompt box instead of running, for prompts that need a topic. */
  prefill?: string;
  submenu?: MenuEntry[];
}

const TONES = ["Professional", "Casual", "Straightforward", "Confident", "Friendly"];
const LANGUAGES = ["English", "Hindi", "Spanish", "French", "German", "Japanese", "Chinese"];

const WRITE_MENU: MenuEntry[] = [
  {
    label: "Continue writing",
    icon: <PenLine size={16} />,
    action: { type: "write", instruction: "Continue writing from where the document leaves off, matching its tone and style." },
  },
  { label: "Brainstorm ideas…", icon: <Lightbulb size={16} />, prefill: "Brainstorm ideas on " },
  { label: "Summarize this page", icon: <AlignLeft size={16} />, action: { type: "write", instruction: "Write a concise summary of this page." } },
  {
    label: "Make a to-do list from this page",
    icon: <ListChecks size={16} />,
    action: { type: "write", instruction: "Turn the action items in this page into a markdown checklist (- [ ] item)." },
  },
  { label: "Draft an outline…", icon: <ListTree size={16} />, prefill: "Draft an outline for " },
  { label: "Write a blog post…", icon: <Newspaper size={16} />, prefill: "Write a blog post about " },
  { label: "Write a meeting agenda…", icon: <Mic size={16} />, prefill: "Write a meeting agenda for " },
];

const EDIT_MENU: MenuEntry[] = [
  { label: "Improve writing", icon: <Wand2 size={16} />, action: { type: "edit", instruction: "Improve the writing quality, clarity, and flow." } },
  {
    label: "Fix spelling & grammar",
    icon: <SpellCheck size={16} />,
    action: { type: "edit", instruction: "Fix all spelling and grammar mistakes without changing the meaning or tone." },
  },
  { label: "Make shorter", icon: <Minimize2 size={16} />, action: { type: "edit", instruction: "Make this more concise." } },
  { label: "Make longer", icon: <Maximize2 size={16} />, action: { type: "edit", instruction: "Expand this with more detail." } },
  {
    label: "Simplify language",
    icon: <AlignLeft size={16} />,
    action: { type: "edit", instruction: "Simplify the language so it's easier to understand." },
  },
  {
    label: "Change tone",
    icon: <MessageSquareText size={16} />,
    submenu: TONES.map((tone) => ({
      label: tone,
      icon: <MessageSquareText size={16} />,
      action: { type: "edit", instruction: `Rewrite this in a ${tone.toLowerCase()} tone.` },
    })),
  },
  {
    label: "Translate",
    icon: <Languages size={16} />,
    submenu: LANGUAGES.map((language) => ({
      label: language,
      icon: <Languages size={16} />,
      action: { type: "edit", instruction: `Translate this into ${language}. Keep the formatting.` },
    })),
  },
  { label: "Explain this", icon: <Lightbulb size={16} />, action: { type: "edit", instruction: "Explain this in simple terms." } },
  { label: "Summarize", icon: <AlignLeft size={16} />, action: { type: "edit", instruction: "Summarize this into a few key points." } },
];

const EDIT_RESULT_MENU: MenuEntry[] = [
  { label: "Replace selection", icon: <Check size={16} />, action: { type: "replace-selection" } },
  { label: "Insert below", icon: <ListPlus size={16} />, action: { type: "insert-below" } },
  { label: "Try again", icon: <RefreshCw size={16} />, action: { type: "retry" } },
  { label: "Discard", icon: <Trash2 size={16} />, action: { type: "discard" } },
];

const WRITE_RESULT_MENU: MenuEntry[] = [
  { label: "Done", icon: <Check size={16} />, action: { type: "accept-write" } },
  { label: "Continue writing", icon: <PenLine size={16} />, action: { type: "continue" } },
  { label: "Make longer", icon: <Maximize2 size={16} />, action: { type: "refine", instruction: "Expand this with more detail." } },
  { label: "Try again", icon: <RefreshCw size={16} />, action: { type: "retry" } },
  { label: "Discard", icon: <Trash2 size={16} />, action: { type: "discard" } },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEditor = BlockNoteEditor<any, any, any>;

export function InlineAiPanel({
  editor,
  target,
  wrapperRef,
  onClose,
}: {
  editor: AnyEditor;
  target: AiTarget;
  wrapperRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [phase, setPhase] = useState<"idle" | "streaming" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [submenu, setSubmenu] = useState<MenuEntry | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [top, setTop] = useState(0);
  const [inset, setInset] = useState(54);
  const resultRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const lastRequest = useRef<AiRequest | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const update = () => {
      const wrap = wrapperRef.current;
      const block = wrap?.querySelector(`[data-id="${target.anchorBlockId}"]`);
      if (wrap && block) {
        setTop(block.getBoundingClientRect().bottom - wrap.getBoundingClientRect().top + 6);
        // Line the panel up with the text column, which has no side margin on phones.
        const editorEl = wrap.querySelector(".bn-editor");
        setInset(editorEl ? parseFloat(getComputedStyle(editorEl).paddingLeft) || 0 : 54);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [target.anchorBlockId, wrapperRef]);

  useEffect(() => {
    inputRef.current?.focus();
    return () => abortRef.current?.abort();
  }, []);

  function documentContext() {
    return editor.blocksToMarkdownLossy(editor.document).slice(-6000);
  }

  async function generate(request: AiRequest) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    lastRequest.current = request;
    const base = request.append && resultRef.current ? `${resultRef.current}\n\n` : "";
    resultRef.current = base;
    setResult(base);
    setError(null);
    setSubmenu(null);
    setPrompt("");
    setActiveIndex(0);
    setPhase("streaming");

    try {
      const res = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: request.instruction,
          selectedText: request.selectedText || undefined,
          context: request.context,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        setError((await res.text().catch(() => "")) || "Something went wrong talking to the AI provider.");
        setPhase(resultRef.current ? "done" : "idle");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        resultRef.current += decoder.decode(value, { stream: true });
        setResult(resultRef.current);
      }
      setPhase("done");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Couldn't reach the AI provider. Check your connection and try again.");
      }
      setPhase(resultRef.current ? "done" : "idle");
    } finally {
      inputRef.current?.focus();
    }
  }

  function finish() {
    onClose();
    editor.focus();
  }

  function acceptWrite() {
    const blocks = editor.tryParseMarkdownToBlocks(resultRef.current);
    const anchor = editor.getBlock(target.anchorBlockId);
    const isEmpty = anchor?.type === "paragraph" && Array.isArray(anchor.content) && anchor.content.length === 0;
    if (anchor && isEmpty) {
      editor.replaceBlocks([anchor.id], blocks);
    } else {
      editor.insertBlocks(blocks, target.anchorBlockId, "after");
    }
    finish();
  }

  function replaceSelection() {
    const blocks = editor.tryParseMarkdownToBlocks(resultRef.current);
    const ids = target.selectionBlockIds ?? [target.anchorBlockId];
    const range = target.selectionRange;
    const single = blocks[0];
    const inline =
      blocks.length === 1 && single.type === "paragraph" && single.children.length === 0 && Array.isArray(single.content)
        ? single.content
        : null;

    if (range && ids.length === 1 && inline) {
      // Swap just the selected characters, keeping the block's own type (heading, list item, ...).
      editor.transact((tr) => {
        tr.setSelection(TextSelection.create(tr.doc, range.from, range.to));
      });
      editor.insertInlineContent(inline);
    } else {
      editor.replaceBlocks(ids, blocks);
    }
    finish();
  }

  function perform(action: Action) {
    switch (action.type) {
      case "write":
        return void generate({ instruction: action.instruction, context: documentContext() });
      case "edit":
        return void generate({ instruction: action.instruction, selectedText: target.selectedText });
      case "refine":
        return void generate({ instruction: action.instruction, selectedText: resultRef.current });
      case "continue":
        return void generate({
          instruction: "Continue writing from where the text leaves off. Don't repeat what's already there.",
          context: `${documentContext()}\n\n${resultRef.current}`,
          append: true,
        });
      case "accept-write":
        return acceptWrite();
      case "replace-selection":
        return replaceSelection();
      case "insert-below":
        editor.insertBlocks(editor.tryParseMarkdownToBlocks(resultRef.current), target.anchorBlockId, "after");
        return finish();
      case "retry":
        return lastRequest.current ? void generate({ ...lastRequest.current, append: false }) : undefined;
      case "discard":
        return finish();
    }
  }

  function submitPrompt() {
    const text = prompt.trim();
    if (!text) {
      return;
    }
    if (phase === "done" && result) {
      perform({ type: "refine", instruction: text });
    } else {
      perform({ type: target.mode === "edit" ? "edit" : "write", instruction: text });
    }
  }

  const hasResult = phase === "done" && result.length > 0;
  const baseMenu = hasResult
    ? target.mode === "edit"
      ? EDIT_RESULT_MENU
      : WRITE_RESULT_MENU
    : target.mode === "edit"
      ? EDIT_MENU
      : WRITE_MENU;
  const items = submenu?.submenu ?? baseMenu;
  const showMenu = phase !== "streaming" && (!prompt.trim() || submenu !== null);

  function choose(entry: MenuEntry) {
    if (entry.submenu) {
      setSubmenu(entry);
      setActiveIndex(0);
    } else if (entry.prefill) {
      setPrompt(entry.prefill);
      inputRef.current?.focus();
    } else if (entry.action) {
      perform(entry.action);
    }
  }

  const previewHtml = useMemo(() => {
    if (!result.trim()) {
      return "";
    }
    try {
      return editor.blocksToHTMLLossy(editor.tryParseMarkdownToBlocks(result));
    } catch {
      return "";
    }
  }, [editor, result]);

  return (
    <div className="absolute z-40" style={{ top, left: inset, right: inset }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="rounded-lg bg-white shadow-menu">
        {target.mode === "edit" && !result && (
          <p className="truncate border-b border-line px-4 py-2 text-xs text-ink-3">
            Editing: “{target.selectedText.slice(0, 160)}”
          </p>
        )}
        {(previewHtml || phase === "streaming") && (
          <div className="max-h-[45vh] overflow-y-auto border-b border-line px-4 py-3 text-[15px] leading-relaxed">
            {previewHtml ? (
              <div className="ai-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <p className="text-ink-3">AI is writing…</p>
            )}
          </div>
        )}
        {error && <p className="border-b border-line px-4 py-2 text-sm text-danger">{error}</p>}
        <div className="flex items-center gap-2 px-3 py-2">
          <Sparkles size={18} className="shrink-0 text-[#9065b0]" />
          <input
            ref={inputRef}
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                if (phase === "streaming") {
                  abortRef.current?.abort();
                } else if (submenu) {
                  setSubmenu(null);
                } else {
                  finish();
                }
              } else if (showMenu && e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => (i + 1) % items.length);
              } else if (showMenu && e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => (i - 1 + items.length) % items.length);
              } else if (showMenu && e.key === "ArrowRight" && items[activeIndex]?.submenu) {
                e.preventDefault();
                choose(items[activeIndex]);
              } else if (showMenu && e.key === "ArrowLeft" && submenu && !prompt) {
                e.preventDefault();
                setSubmenu(null);
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (prompt.trim()) {
                  submitPrompt();
                } else if (showMenu && items[activeIndex]) {
                  choose(items[activeIndex]);
                }
              }
            }}
            disabled={phase === "streaming"}
            placeholder={
              phase === "streaming"
                ? "AI is writing…"
                : hasResult
                  ? "Tell AI what to do next…"
                  : target.mode === "edit"
                    ? "Ask AI to edit or review…"
                    : "Ask AI anything…"
            }
            className="h-8 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3 disabled:opacity-60"
          />
          {phase === "streaming" ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              title="Stop (Esc)"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white"
            >
              <Square size={11} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submitPrompt}
              disabled={!prompt.trim()}
              title="Submit"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white disabled:bg-ink-3/30"
            >
              <ArrowUp size={15} />
            </button>
          )}
        </div>
      </div>

      {showMenu && (
        <div className="mt-1.5 w-[280px] rounded-lg bg-white py-1.5 text-sm shadow-menu">
          {submenu ? (
            <button
              type="button"
              onClick={() => setSubmenu(null)}
              className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-md px-2 py-1.5 text-ink-3 hover:bg-hover"
            >
              <ChevronLeft size={16} /> {submenu.label}
            </button>
          ) : (
            !hasResult && (
              <p className="px-3 pt-1 pb-1 text-xs font-medium text-ink-3">
                {target.mode === "edit" ? "Edit or review selection" : "Write with AI"}
              </p>
            )
          )}
          {items.map((item, i) => (
            <button
              key={item.label}
              type="button"
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => choose(item)}
              className={`mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-md px-2 py-1.5 text-left ${
                i === activeIndex ? "bg-hover" : ""
              }`}
            >
              <span className="flex w-5 justify-center text-[#9065b0]">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.submenu && <ChevronRight size={14} className="text-ink-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
