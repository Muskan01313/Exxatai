"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import type { PageTreeNode } from "@/types/page";

export function PageTreeItem({
  node,
  childrenByParent,
  workspaceId,
  currentPageId,
  depth,
  onChanged,
}: {
  node: PageTreeNode;
  childrenByParent: Map<string | null, PageTreeNode[]>;
  workspaceId: string;
  currentPageId?: string;
  depth: number;
  onChanged: () => void;
}) {
  const router = useRouter();
  const children = childrenByParent.get(node.id) ?? [];
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(node.title);
  const isActive = node.id === currentPageId;

  async function addSubpage(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const res = await fetch(`/api/workspaces/${workspaceId}/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId: node.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setExpanded(true);
      onChanged();
      router.push(`/w/${workspaceId}/p/${data.page.id}`);
    }
  }

  async function deletePage(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete "${node.title}" and all its sub-pages?`)) {
      return;
    }
    const res = await fetch(`/api/pages/${node.id}`, { method: "DELETE" });
    if (res.ok) {
      onChanged();
      if (isActive) {
        router.push(`/w/${workspaceId}`);
      }
    }
  }

  async function commitRename() {
    setRenaming(false);
    const trimmed = title.trim() || "Untitled";
    setTitle(trimmed);
    if (trimmed === node.title) {
      return;
    }
    await fetch(`/api/pages/${node.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    onChanged();
  }

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-md px-2 py-1 text-sm ${
          isActive ? "bg-zinc-200 text-zinc-900" : "text-zinc-700 hover:bg-zinc-100"
        }`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-4 w-4 shrink-0 items-center justify-center text-zinc-400"
        >
          {children.length > 0 ? (expanded ? "▾" : "▸") : ""}
        </button>
        <span className="shrink-0">{node.icon || "📄"}</span>
        {renaming ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setTitle(node.title);
                setRenaming(false);
              }
            }}
            className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-1 text-sm outline-none"
          />
        ) : (
          <Link
            href={`/w/${workspaceId}/p/${node.id}`}
            onDoubleClick={(e) => {
              e.preventDefault();
              setRenaming(true);
            }}
            className="min-w-0 flex-1 truncate"
          >
            {node.title || "Untitled"}
          </Link>
        )}
        <div className="ml-auto hidden shrink-0 items-center gap-1 group-hover:flex">
          <button
            type="button"
            onClick={addSubpage}
            title="Add sub-page"
            className="rounded px-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
          >
            +
          </button>
          <button
            type="button"
            onClick={deletePage}
            title="Delete"
            className="rounded px-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
          >
            ×
          </button>
        </div>
      </div>
      {expanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <PageTreeItem
              key={child.id}
              node={child}
              childrenByParent={childrenByParent}
              workspaceId={workspaceId}
              currentPageId={currentPageId}
              depth={depth + 1}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}
