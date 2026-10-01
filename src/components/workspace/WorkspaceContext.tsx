"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { PageTreeNode, WorkspaceSummary } from "@/types/page";

interface WorkspaceContextValue {
  workspaceId: string;
  workspaceName: string;
  workspaces: WorkspaceSummary[];
  userName: string;
  pages: PageTreeNode[];
  pagesById: Map<string, PageTreeNode>;
  childrenByParent: Map<string | null, PageTreeNode[]>;
  favoriteIds: string[];
  refreshPages: () => Promise<void>;
  /** Optimistically reflect a title/icon change in the sidebar and breadcrumbs. */
  patchPageLocally: (id: string, patch: Partial<PageTreeNode>) => void;
  createPage: (parentId?: string | null) => Promise<void>;
  duplicatePage: (id: string) => Promise<void>;
  trashPage: (id: string, currentPageId?: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  copyPageLink: (id: string) => Promise<void>;
  movePage: (id: string, parentId: string | null, index: number) => Promise<void>;
  openSearch: () => void;
  openSettings: () => void;
  openChat: () => void;
  toast: (message: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  }
  return value;
}

export function WorkspaceProvider({
  workspaceId,
  workspaceName,
  workspaces,
  userName,
  ui,
  children,
}: {
  workspaceId: string;
  workspaceName: string;
  workspaces: WorkspaceSummary[];
  userName: string;
  ui: Pick<WorkspaceContextValue, "openSearch" | "openSettings" | "openChat" | "toast">;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pages, setPages] = useState<PageTreeNode[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  const refreshPages = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspaceId}/pages`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setPages(data.pages);
      setFavoriteIds(data.favoritePageIds);
    }
  }, [workspaceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void refreshPages();
  }, [refreshPages]);

  const pagesById = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, PageTreeNode[]>();
    for (const page of pages) {
      const list = map.get(page.parentId) ?? [];
      list.push(page);
      map.set(page.parentId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.order - b.order);
    }
    return map;
  }, [pages]);

  const patchPageLocally = useCallback((id: string, patch: Partial<PageTreeNode>) => {
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const createPage = useCallback(
    async (parentId: string | null = null) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId }),
      });
      if (res.ok) {
        const { page } = await res.json();
        await refreshPages();
        router.push(`/w/${workspaceId}/p/${page.id}`);
      }
    },
    [workspaceId, refreshPages, router],
  );

  const duplicatePage = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/pages/${id}/duplicate`, { method: "POST" });
      if (res.ok) {
        const { page } = await res.json();
        await refreshPages();
        router.push(`/w/${workspaceId}/p/${page.id}`);
      }
    },
    [workspaceId, refreshPages, router],
  );

  const trashPage = useCallback(
    async (id: string, currentPageId?: string) => {
      const res = await fetch(`/api/pages/${id}/trash`, { method: "POST" });
      if (!res.ok) {
        return;
      }
      await refreshPages();
      ui.toast("Moved to Trash");
      if (currentPageId === id) {
        router.push(`/w/${workspaceId}`);
      } else {
        router.refresh();
      }
    },
    [workspaceId, refreshPages, router, ui],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const isFavorite = favoriteIds.includes(id);
      setFavoriteIds((prev) => (isFavorite ? prev.filter((f) => f !== id) : [...prev, id]));
      await fetch(`/api/pages/${id}/favorite`, { method: isFavorite ? "DELETE" : "PUT" });
    },
    [favoriteIds],
  );

  const copyPageLink = useCallback(
    async (id: string) => {
      const url = `${window.location.origin}/w/${workspaceId}/p/${id}`;
      try {
        await navigator.clipboard.writeText(url);
        ui.toast("Link copied");
      } catch {
        window.prompt("Copy this link", url);
      }
    },
    [workspaceId, ui],
  );

  const movePage = useCallback(
    async (id: string, parentId: string | null, index: number) => {
      const res = await fetch(`/api/pages/${id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId, index }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        ui.toast(data.error ?? "Couldn't move the page");
      }
      await refreshPages();
    },
    [refreshPages, ui],
  );

  const value: WorkspaceContextValue = {
    workspaceId,
    workspaceName,
    workspaces,
    userName,
    pages,
    pagesById,
    childrenByParent,
    favoriteIds,
    refreshPages,
    patchPageLocally,
    createPage,
    duplicatePage,
    trashPage,
    toggleFavorite,
    copyPageLink,
    movePage,
    ...ui,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
