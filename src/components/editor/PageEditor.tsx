"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  FormattingToolbar,
  FormattingToolbarController,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { PartialBlock } from "@blocknote/core";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { en } from "@blocknote/core/locales";
import "@blocknote/mantine/style.css";
import { Image as ImageIcon, MessageSquare, Smile, Sparkles } from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { Dropdown } from "@/components/ui/Dropdown";
import { PageTopBar } from "@/components/page/PageTopBar";
import { CoverPicker, IconPicker } from "@/components/page/Pickers";
import { CommentsSection, type CommentsHandle } from "@/components/page/CommentsSection";
import { InlineAiPanel, type AiTarget } from "@/components/ai/InlineAiPanel";
import { AskAiToolbarButton } from "@/components/ai/AskAiToolbarButton";
import { coverStyle, randomCover } from "@/lib/covers";
import { randomEmoji } from "@/lib/emojis";
import { useAutosave } from "./useAutosave";
import type { EditorPageData } from "@/types/page";

const PLACEHOLDER = "Press 'space' for AI, '/' for commands…";

const notionTheme = {
  fontFamily: "var(--font-notion)",
  colors: { editor: { text: "#37352f", background: "#ffffff" } },
};

export function PageEditor({ page }: { page: EditorPageData }) {
  const ws = useWorkspace();
  const router = useRouter();
  const [title, setTitle] = useState(page.title);
  const [icon, setIcon] = useState(page.icon);
  const [cover, setCover] = useState(page.cover);
  const [isPublic, setIsPublic] = useState(page.isPublic);
  const [trashed, setTrashed] = useState(page.deletedAt !== null);
  const [aiTarget, setAiTarget] = useState<AiTarget | null>(null);
  const { schedule, saveState, conflict } = useAutosave(page.id, page.contentVersion);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const commentsRef = useRef<CommentsHandle>(null);

  const editor = useCreateBlockNote({
    initialContent:
      Array.isArray(page.content) && page.content.length > 0 ? (page.content as PartialBlock[]) : undefined,
    dictionary: { ...en, placeholders: { ...en.placeholders, default: PLACEHOLDER, emptyDocument: PLACEHOLDER } },
  });

  // Grow the title box with its text, like Notion's wrapping titles.
  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = "0px";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [title]);

  function updateTitle(value: string) {
    setTitle(value);
    ws.patchPageLocally(page.id, { title: value || "Untitled" });
    schedule({ meta: { title: value } });
  }

  function updateIcon(value: string | null) {
    setIcon(value);
    ws.patchPageLocally(page.id, { icon: value });
    schedule({ meta: { icon: value } });
  }

  function updateCover(value: string | null) {
    setCover(value);
    schedule({ meta: { cover: value } });
  }

  async function togglePublic(value: boolean) {
    setIsPublic(value);
    await fetch(`/api/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: value }),
    });
    ws.toast(value ? "This page is now public" : "This page is private again");
  }

  async function restore() {
    await fetch(`/api/pages/${page.id}/restore`, { method: "POST" });
    setTrashed(false);
    await ws.refreshPages();
    ws.toast("Page restored");
  }

  async function deleteForever() {
    if (!window.confirm("Permanently delete this page and its sub-pages? This can't be undone.")) {
      return;
    }
    await fetch(`/api/pages/${page.id}`, { method: "DELETE" });
    router.push(`/w/${ws.workspaceId}`);
  }

  function openAiAtCursor() {
    const selectedText = editor.getSelectedText();
    if (selectedText.trim()) {
      let blocks = editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block];
      const { from, to, $to } = editor.prosemirrorState.selection;
      // A selection ending at the very start of a block doesn't really include that block.
      if (blocks.length > 1 && $to.parentOffset === 0) {
        blocks = blocks.slice(0, -1);
      }
      setAiTarget({
        mode: "edit",
        anchorBlockId: blocks[blocks.length - 1].id,
        selectedText,
        selectionRange: { from, to },
        selectionBlockIds: blocks.map((b) => b.id),
      });
    } else {
      setAiTarget({ mode: "write", anchorBlockId: editor.getTextCursorPosition().block.id, selectedText: "" });
    }
  }

  function onEditorKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (aiTarget || trashed || !(e.target as HTMLElement).isContentEditable) {
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
      e.preventDefault();
      openAiAtCursor();
      return;
    }
    // Space on an empty line opens AI, like Notion.
    if (e.key === " " && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const block = editor.getTextCursorPosition().block;
      const empty = block.type === "paragraph" && Array.isArray(block.content) && block.content.length === 0;
      if (empty && !editor.getSelectedText()) {
        e.preventDefault();
        e.stopPropagation();
        setAiTarget({ mode: "write", anchorBlockId: block.id, selectedText: "" });
      }
    }
  }

  const getSlashMenuItems = useMemo(
    () => async (query: string) =>
      filterSuggestionItems(
        [
          {
            title: "Ask AI",
            onItemClick: () =>
              setAiTarget({ mode: "write", anchorBlockId: editor.getTextCursorPosition().block.id, selectedText: "" }),
            subtext: "Write, summarize, brainstorm and more",
            aliases: ["ai", "assistant", "claude", "write"],
            group: "AI",
            icon: <Sparkles size={18} className="text-[#9065b0]" />,
          },
          ...getDefaultReactSlashMenuItems(editor),
        ],
        query,
      ),
    [editor],
  );

  return (
    <div className="flex min-h-full flex-col">
      <PageTopBar
        pageId={page.id}
        title={title}
        icon={icon}
        updatedAt={page.updatedAt}
        saveState={saveState}
        isPublic={isPublic}
        isTrashed={trashed}
        onTogglePublic={(v) => void togglePublic(v)}
        onShowComments={() => commentsRef.current?.focus()}
      />

      {trashed && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-danger px-4 py-2 text-sm text-white">
          <span>This page is in Trash.</span>
          <button type="button" onClick={() => void restore()} className="rounded border border-white/70 px-2 py-0.5 hover:bg-white/15">
            Restore page
          </button>
          <button type="button" onClick={() => void deleteForever()} className="rounded border border-white/70 px-2 py-0.5 hover:bg-white/15">
            Delete permanently
          </button>
        </div>
      )}
      {conflict && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-[#fbf3db] px-4 py-2 text-sm">
          <span>Someone else edited this page while you had it open, so your latest changes weren&apos;t saved.</span>
          <button type="button" onClick={() => window.location.reload()} className="rounded border border-ink-3 px-2 py-0.5 hover:bg-hover">
            Reload page
          </button>
        </div>
      )}

      {cover && (
        <div className="group/cover relative h-[30vh] max-h-[280px] min-h-[140px] w-full" style={coverStyle(cover)}>
          {!trashed && (
            <div className="absolute right-6 bottom-3 flex gap-1 opacity-0 group-hover/cover:opacity-100 has-[[data-open=true]]:opacity-100">
              <Dropdown
                align="right"
                trigger={({ open, toggle }) => (
                  <button
                    type="button"
                    data-open={open}
                    onClick={toggle}
                    className="rounded-md bg-white/90 px-2.5 py-1 text-xs text-ink-2 hover:bg-white"
                  >
                    Change cover
                  </button>
                )}
              >
                {(close) => (
                  <CoverPicker
                    onPick={(c) => {
                      close();
                      updateCover(c);
                    }}
                    onRemove={() => {
                      close();
                      updateCover(null);
                    }}
                  />
                )}
              </Dropdown>
            </div>
          )}
        </div>
      )}

      <div className={`mx-auto w-full max-w-[816px] flex-1 px-6 pb-[30vh] sm:px-[54px] ${cover ? "" : "pt-16"}`}>
        <div className="group/header">
          {icon && (
            <div className={cover ? "relative z-10 -mt-[42px]" : ""}>
              <Dropdown
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    onClick={trashed ? undefined : toggle}
                    className="rounded-md p-1 text-[72px] leading-none hover:bg-hover"
                    title="Change icon"
                  >
                    {icon}
                  </button>
                )}
              >
                {(close) => (
                  <IconPicker
                    onPick={(emoji) => {
                      close();
                      updateIcon(emoji);
                    }}
                    onRemove={() => {
                      close();
                      updateIcon(null);
                    }}
                  />
                )}
              </Dropdown>
            </div>
          )}

          {!trashed && (
            <div className={`flex h-8 items-center gap-1 text-sm text-ink-3 opacity-0 group-hover/header:opacity-100 ${icon || cover ? "mt-2" : ""}`}>
              {!icon && (
                <button type="button" onClick={() => updateIcon(randomEmoji())} className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-hover">
                  <Smile size={15} /> Add icon
                </button>
              )}
              {!cover && (
                <button type="button" onClick={() => updateCover(randomCover())} className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-hover">
                  <ImageIcon size={15} /> Add cover
                </button>
              )}
              <button type="button" onClick={() => commentsRef.current?.focus()} className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-hover">
                <MessageSquare size={15} /> Add comment
              </button>
            </div>
          )}

          <textarea
            ref={titleRef}
            rows={1}
            value={title}
            readOnly={trashed}
            onChange={(e) => updateTitle(e.target.value.replace(/\n/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const first = editor.document[0];
                if (first) {
                  editor.setTextCursorPosition(first, "start");
                }
                editor.focus();
              }
            }}
            placeholder="Untitled"
            className="block w-full resize-none overflow-hidden bg-transparent pt-1 text-[40px] leading-[1.2] font-bold text-ink outline-none placeholder:text-[#e1e0dd]"
          />
        </div>

        <div
          ref={wrapperRef}
          data-ai-open={aiTarget !== null}
          className="notion-editor relative mt-3 sm:-mx-[54px]"
          onKeyDownCapture={onEditorKeyDown}
        >
          <BlockNoteView
            editor={editor}
            theme={notionTheme}
            editable={!trashed}
            slashMenu={false}
            formattingToolbar={false}
            onChange={() => schedule({ content: editor.document })}
          >
            <SuggestionMenuController triggerCharacter="/" getItems={getSlashMenuItems} />
            <FormattingToolbarController
              formattingToolbar={() => (
                <FormattingToolbar>
                  <AskAiToolbarButton key="ask-ai" onClick={openAiAtCursor} />
                  {...getFormattingToolbarItems()}
                </FormattingToolbar>
              )}
            />
          </BlockNoteView>
          {aiTarget && (
            <InlineAiPanel
              key={`${aiTarget.anchorBlockId}-${aiTarget.mode}`}
              editor={editor}
              target={aiTarget}
              wrapperRef={wrapperRef}
              onClose={() => setAiTarget(null)}
            />
          )}
        </div>

        <CommentsSection ref={commentsRef} pageId={page.id} />
      </div>
    </div>
  );
}
