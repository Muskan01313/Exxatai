"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { AiChatPanel } from "@/components/ai/AiChatPanel";
import type { WorkspaceSummary } from "@/types/page";

export function WorkspaceShell({
  workspaceId,
  workspaces,
  userName,
  children,
}: {
  workspaceId: string;
  workspaces: WorkspaceSummary[];
  userName: string;
  children: ReactNode;
}) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <Sidebar
        workspaceId={workspaceId}
        workspaces={workspaces}
        userName={userName}
        onOpenAiChat={() => setChatOpen(true)}
      />
      <main className="flex-1 overflow-y-auto bg-white">{children}</main>
      {chatOpen && <AiChatPanel workspaceId={workspaceId} onClose={() => setChatOpen(false)} />}
    </>
  );
}
