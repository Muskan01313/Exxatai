"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { PageTreeItem } from "./PageTreeItem";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { PAGES_CHANGED_EVENT, type PageTreeNode, type WorkspaceSummary } from "@/types/page";

export function Sidebar({
  workspaceId,
  workspaces,
  userName,
  onOpenAiChat,
}: {
  workspaceId: string;
  workspaces: WorkspaceSummary[];
  userName: string;
  onOpenAiChat: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const currentPageId = pathname?.match(/\/p\/([^/]+)/)?.[1];
  const [pages, setPages] = useState<PageTreeNode[]>([]);

  const fetchPages = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspaceId}/pages`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setPages(data.pages);
    }
  }, [workspaceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void fetchPages();
    const handler = () => void fetchPages();
    window.addEventListener(PAGES_CHANGED_EVENT, handler);
    return () => window.removeEventListener(PAGES_CHANGED_EVENT, handler);
  }, [fetchPages]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, PageTreeNode[]>();
    for (const page of pages) {
      const key = page.parentId;
      const list = map.get(key) ?? [];
      list.push(page);
      map.set(key, list);
    }
    return map;
  }, [pages]);

  const roots = childrenByParent.get(null) ?? [];

  async function createRootPage() {
    const res = await fetch(`/api/workspaces/${workspaceId}/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = await res.json();
      await fetchPages();
      router.push(`/w/${workspaceId}/p/${data.page.id}`);
    }
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50">
      <div className="p-2">
        <WorkspaceSwitcher workspaces={workspaces} currentWorkspaceId={workspaceId} />
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {roots.map((node) => (
          <PageTreeItem
            key={node.id}
            node={node}
            childrenByParent={childrenByParent}
            workspaceId={workspaceId}
            currentPageId={currentPageId}
            depth={0}
            onChanged={fetchPages}
          />
        ))}
        <button
          type="button"
          onClick={createRootPage}
          className="mt-1 flex w-full items-center gap-1 rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
        >
          + New page
        </button>
      </div>

      <div className="border-t border-zinc-200 p-2">
        <button
          type="button"
          onClick={onOpenAiChat}
          className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
        >
          ✨ Ask AI about workspace
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-200 p-2 text-sm text-zinc-500">
        <span className="truncate">{userName}</span>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="shrink-0 rounded px-2 py-1 hover:bg-zinc-200"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}

export function notifyPagesChanged() {
  window.dispatchEvent(new Event(PAGES_CHANGED_EVENT));
}
