"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { PartialBlock } from "@blocknote/core";
import "@blocknote/mantine/style.css";

export function ReadOnlyEditor({ content }: { content: unknown }) {
  const editor = useCreateBlockNote({
    initialContent: Array.isArray(content) && content.length > 0 ? (content as PartialBlock[]) : undefined,
  });
  return (
    <BlockNoteView
      editor={editor}
      editable={false}
      theme={{ fontFamily: "var(--font-notion)", colors: { editor: { text: "#37352f", background: "#ffffff" } } }}
      sideMenu={false}
      slashMenu={false}
      formattingToolbar={false}
    />
  );
}
