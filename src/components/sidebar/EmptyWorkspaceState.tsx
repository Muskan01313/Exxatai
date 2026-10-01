"use client";

import { Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";

export function EmptyWorkspaceState() {
  const ws = useWorkspace();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-2">
      <p>This workspace doesn&apos;t have any pages yet.</p>
      <button
        type="button"
        onClick={() => void ws.createPage(null)}
        className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0077d4]"
      >
        <Plus size={16} /> New page
      </button>
    </div>
  );
}
