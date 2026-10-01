"use client";

import Link from "next/link";
import { useState, type DragEvent } from "react";
import { ChevronRight, Copy, Ellipsis, FileText, Link as LinkIcon, PenLine, Plus, Star, Trash2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { Dropdown, MenuDivider, MenuItem } from "@/components/ui/Dropdown";
import type { PageTreeNode } from "@/types/page";

type DropZone = "before" | "inside" | "after";

export interface TreeDragState {
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
}

export function PageTreeItem({
  node,
  depth,
  currentPageId,
  expanded,
  toggleExpanded,
  drag,
}: {
  node: PageTreeNode;
  depth: number;
  currentPageId?: string;
  expanded: Set<string>;
  toggleExpanded: (id: string, open?: boolean) => void;
  drag: TreeDragState;
}) {
  const ws = useWorkspace();
  const children = ws.childrenByParent.get(node.id) ?? [];
  const isOpen = expanded.has(node.id);
  const isActive = node.id === currentPageId;
  const isFavorite = ws.favoriteIds.includes(node.id);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(node.title);
  const [dropZone, setDropZone] = useState<DropZone | null>(null);

  function isInvalidTarget() {
    const dragging = drag.draggingId;
    if (!dragging) {
      return true;
    }
    // Can't drop a page onto itself or into one of its own sub-pages.
    let cursor: PageTreeNode | undefined = node;
    while (cursor) {
      if (cursor.id === dragging) {
        return true;
      }
      cursor = cursor.parentId ? ws.pagesById.get(cursor.parentId) : undefined;
    }
    return false;
  }

  function zoneFor(e: DragEvent): DropZone {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    return y < rect.height * 0.25 ? "before" : y > rect.height * 0.75 ? "after" : "inside";
  }

  function onDragOver(e: DragEvent) {
    if (isInvalidTarget()) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setDropZone(zoneFor(e));
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Read the zone from the drop itself; the hover state may not have updated on a quick drag.
    const zone = zoneFor(e);
    setDropZone(null);
    const dragging = drag.draggingId;
    drag.setDraggingId(null);
    if (!dragging || !zone || isInvalidTarget()) {
      return;
    }
    if (zone === "inside") {
      toggleExpanded(node.id, true);
      await ws.movePage(dragging, node.id, children.filter((c) => c.id !== dragging).length);
      return;
    }
    const siblings = (ws.childrenByParent.get(node.parentId) ?? []).filter((s) => s.id !== dragging);
    const index = siblings.findIndex((s) => s.id === node.id);
    await ws.movePage(dragging, node.parentId, zone === "before" ? index : index + 1);
  }

  async function commitRename() {
    setRenaming(false);
    const trimmed = title.trim() || "Untitled";
    setTitle(trimmed);
    if (trimmed === node.title) {
      return;
    }
    ws.patchPageLocally(node.id, { title: trimmed });
    await fetch(`/api/pages/${node.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
  }

  return (
    <div>
      <div
        draggable={!renaming}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", node.id);
          drag.setDraggingId(node.id);
        }}
        onDragEnd={() => {
          drag.setDraggingId(null);
          setDropZone(null);
        }}
        onDragOver={onDragOver}
        onDragLeave={() => setDropZone(null)}
        onDrop={onDrop}
        className={`group relative flex h-[30px] items-center rounded-md pr-1 text-sm ${
          isActive ? "bg-hover font-medium text-ink" : "text-ink-2 hover:bg-hover"
        } ${dropZone === "inside" ? "bg-accent/15 ring-1 ring-accent/40" : ""} ${
          drag.draggingId === node.id ? "opacity-40" : ""
        }`}
        style={{ paddingLeft: 6 + depth * 14 }}
      >
        {dropZone === "before" && <div className="absolute inset-x-1 top-0 h-0.5 rounded bg-accent" />}
        {dropZone === "after" && <div className="absolute inset-x-1 bottom-0 h-0.5 rounded bg-accent" />}

        <button
          type="button"
          onClick={() => toggleExpanded(node.id)}
          className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-hover"
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          <span className="group-hover:invisible">
            {node.icon ? <span className="text-[15px] leading-none">{node.icon}</span> : <FileText size={16} />}
          </span>
          <ChevronRight
            size={15}
            className={`invisible absolute text-ink-3 transition-transform group-hover:visible ${isOpen ? "rotate-90" : ""}`}
          />
        </button>

        {renaming ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void commitRename();
              }
              if (e.key === "Escape") {
                setTitle(node.title);
                setRenaming(false);
              }
            }}
            className="ml-1 min-w-0 flex-1 rounded border border-accent/60 bg-white px-1 text-sm text-ink outline-none"
          />
        ) : (
          <Link
            href={`/w/${ws.workspaceId}/p/${node.id}`}
            onDoubleClick={(e) => {
              e.preventDefault();
              setTitle(node.title);
              setRenaming(true);
            }}
            className="ml-1 min-w-0 flex-1 truncate"
            draggable={false}
          >
            {node.title || "Untitled"}
          </Link>
        )}

        <div className="ml-auto hidden shrink-0 items-center group-hover:flex has-[[data-open=true]]:flex">
          <Dropdown
            align="left"
            className="w-56"
            trigger={({ open, toggle }) => (
              <button
                type="button"
                data-open={open}
                onClick={toggle}
                aria-label="Page options"
                className="flex h-6 w-6 items-center justify-center rounded text-ink-3 hover:bg-hover hover:text-ink"
              >
                <Ellipsis size={16} />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem
                  icon={<Star size={15} />}
                  onClick={() => {
                    close();
                    void ws.toggleFavorite(node.id);
                  }}
                >
                  {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                </MenuItem>
                <MenuDivider />
                <MenuItem
                  icon={<LinkIcon size={15} />}
                  onClick={() => {
                    close();
                    void ws.copyPageLink(node.id);
                  }}
                >
                  Copy link
                </MenuItem>
                <MenuItem
                  icon={<Copy size={15} />}
                  onClick={() => {
                    close();
                    void ws.duplicatePage(node.id);
                  }}
                >
                  Duplicate
                </MenuItem>
                <MenuItem
                  icon={<PenLine size={15} />}
                  onClick={() => {
                    close();
                    setTitle(node.title);
                    setRenaming(true);
                  }}
                >
                  Rename
                </MenuItem>
                <MenuDivider />
                <MenuItem
                  danger
                  icon={<Trash2 size={15} />}
                  onClick={() => {
                    close();
                    void ws.trashPage(node.id, currentPageId);
                  }}
                >
                  Move to Trash
                </MenuItem>
              </>
            )}
          </Dropdown>
          <button
            type="button"
            onClick={() => {
              toggleExpanded(node.id, true);
              void ws.createPage(node.id);
            }}
            aria-label="Add a page inside"
            className="flex h-6 w-6 items-center justify-center rounded text-ink-3 hover:bg-hover hover:text-ink"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {isOpen &&
        (children.length > 0 ? (
          children.map((child) => (
            <PageTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              currentPageId={currentPageId}
              expanded={expanded}
              toggleExpanded={toggleExpanded}
              drag={drag}
            />
          ))
        ) : (
          <div className="py-1 text-xs text-ink-3" style={{ paddingLeft: 34 + depth * 14 }}>
            No pages inside
          </div>
        ))}
    </div>
  );
}
