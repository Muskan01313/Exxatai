"use client";

import { useRouter } from "next/navigation";
import { notifyPagesChanged } from "./Sidebar";

export function EmptyWorkspaceState({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();

  async function createFirstPage() {
    const res = await fetch(`/api/workspaces/${workspaceId}/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = await res.json();
      notifyPagesChanged();
      router.push(`/w/${workspaceId}/p/${data.page.id}`);
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500">
      <p>This workspace doesn&apos;t have any pages yet.</p>
      <button
        type="button"
        onClick={createFirstPage}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
      >
        Create your first page
      </button>
    </div>
  );
}
