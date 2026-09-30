"use client";

import { useRouter } from "next/navigation";
import type { WorkspaceSummary } from "@/types/page";

export function WorkspaceSwitcher({
  workspaces,
  currentWorkspaceId,
}: {
  workspaces: WorkspaceSummary[];
  currentWorkspaceId: string;
}) {
  const router = useRouter();

  async function createWorkspace() {
    const name = window.prompt("Name your new workspace");
    if (!name) {
      return;
    }
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/w/${data.workspace.id}`);
    }
  }

  return (
    <select
      value={currentWorkspaceId}
      onChange={(e) => {
        if (e.target.value === "__new__") {
          void createWorkspace();
          return;
        }
        router.push(`/w/${e.target.value}`);
      }}
      className="w-full truncate rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium text-zinc-800 hover:border-zinc-200 hover:bg-zinc-100"
    >
      {workspaces.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
        </option>
      ))}
      <option value="__new__">+ New workspace…</option>
    </select>
  );
}
