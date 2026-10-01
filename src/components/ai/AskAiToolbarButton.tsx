"use client";

import { useComponentsContext } from "@blocknote/react";
import { Sparkles } from "lucide-react";

export function AskAiToolbarButton({ onClick }: { onClick: () => void }) {
  const Components = useComponentsContext()!;
  return (
    <Components.FormattingToolbar.Button mainTooltip="Ask AI (Ctrl+J)" onClick={onClick}>
      <span className="flex items-center gap-1 px-0.5 text-sm font-medium text-[#9065b0]">
        <Sparkles size={14} /> Ask AI
      </span>
    </Components.FormattingToolbar.Button>
  );
}
