"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { PartialBlock } from "@blocknote/core";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import "@blocknote/mantine/style.css";
import { notifyPagesChanged } from "@/components/sidebar/Sidebar";
import { AiAssistPanel } from "@/components/ai/AiAssistPanel";

interface PageEditorProps {
  pageId: string;
  workspaceId: string;
  initialTitle: string;
  initialIcon: string | null;
  initialContent: unknown;
}

export function PageEditor({ pageId, initialTitle, initialIcon, initialContent }: PageEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [icon, setIcon] = useState(initialIcon);
  const [saving, setSaving] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChanges = useRef<Record<string, unknown>>({});

  const editor = useCreateBlockNote({
    initialContent:
      Array.isArray(initialContent) && initialContent.length > 0
        ? (initialContent as PartialBlock[])
        : undefined,
  });

  const scheduleSave = useCallback(
    (data: Record<string, unknown>) => {
      pendingChanges.current = { ...pendingChanges.current, ...data };
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
      saveTimeout.current = setTimeout(async () => {
        const payload = pendingChanges.current;
        pendingChanges.current = {};
        setSaving(true);
        await fetch(`/api/pages/${pageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSaving(false);
        notifyPagesChanged();
      }, 600);
    },
    [pageId],
  );

  useEffect(() => {
    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
      if (Object.keys(pendingChanges.current).length > 0) {
        const payload = pendingChanges.current;
        pendingChanges.current = {};
        void fetch(`/api/pages/${pageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        });
      }
    };
  }, [pageId]);

  function onTitleChange(value: string) {
    setTitle(value);
    scheduleSave({ title: value });
  }

  const getSlashMenuItems = useMemo(
    () => async (query: string) =>
      filterSuggestionItems(
        [
          ...getDefaultReactSlashMenuItems(editor),
          {
            title: "Ask AI",
            onItemClick: () => setAiPanelOpen(true),
            subtext: "Generate or edit text with AI",
            aliases: ["ai", "assistant", "gpt", "claude"],
            group: "AI",
            icon: <span>✨</span>,
          },
        ],
        query,
      ),
    [editor],
  );

  function onPickIcon() {
    const next = window.prompt("Set an emoji for this page", icon ?? "");
    if (next === null) {
      return;
    }
    const trimmed = next.trim().slice(0, 8);
    setIcon(trimmed || null);
    scheduleSave({ icon: trimmed || null });
  }

  return (
    <div className="mx-auto max-w-3xl px-16 py-12">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onPickIcon}
          className="rounded-md px-2 py-1 text-4xl hover:bg-zinc-100"
          title="Change icon"
        >
          {icon || "📄"}
        </button>
        <button
          type="button"
          onClick={() => setAiPanelOpen(true)}
          className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
        >
          ✨ Ask AI
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Untitled"
        className="w-full border-none text-4xl font-bold text-zinc-900 outline-none placeholder:text-zinc-300"
      />
      <div className="mt-6">
        <BlockNoteView
          editor={editor}
          slashMenu={false}
          onChange={() => {
            scheduleSave({ content: editor.document });
          }}
        >
          <SuggestionMenuController triggerCharacter="/" getItems={getSlashMenuItems} />
        </BlockNoteView>
      </div>
      <div className="pointer-events-none fixed bottom-4 right-4 text-xs text-zinc-400 transition-opacity">
        {saving ? "Saving…" : ""}
      </div>
      {aiPanelOpen && <AiAssistPanel editor={editor} onClose={() => setAiPanelOpen(false)} />}
    </div>
  );
}
