"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { Copy, Ellipsis, FileText, Globe, Link as LinkIcon, MessageSquare, Star, Trash2, Users } from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { Dropdown, MenuDivider, MenuItem } from "@/components/ui/Dropdown";
import type { SaveState } from "@/components/editor/useAutosave";

function timeAgo(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) {
    return "just now";
  }
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, "y"],
    [60 * 60 * 24 * 30, "mo"],
    [60 * 60 * 24, "d"],
    [60 * 60, "h"],
    [60, "m"],
  ];
  const [size, label] = units.find(([s]) => seconds >= s) ?? [60, "m"];
  return `${Math.floor(seconds / size)}${label} ago`;
}

function ShareMenu({ pageId, isPublic, onTogglePublic }: { pageId: string; isPublic: boolean; onTogglePublic: (v: boolean) => void }) {
  const ws = useWorkspace();
  const [copied, setCopied] = useState(false);
  const publicUrl = typeof window === "undefined" ? "" : `${window.location.origin}/s/${pageId}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this link", publicUrl);
    }
  }

  return (
    <div className="w-[380px] space-y-3 px-3 py-1">
      <button
        type="button"
        onClick={ws.openSettings}
        className="flex w-full items-center gap-3 rounded-md px-1 py-1.5 text-left hover:bg-hover"
      >
        <Users size={18} className="text-ink-2" />
        <span>
          <span className="block text-sm">Invite people to {ws.workspaceName}</span>
          <span className="block text-xs text-ink-3">Members can view and edit every page</span>
        </span>
      </button>
      <div className="border-t border-line pt-3">
        <label className="flex cursor-pointer items-center gap-3 px-1">
          <Globe size={18} className={isPublic ? "text-accent" : "text-ink-2"} />
          <span className="flex-1">
            <span className="block text-sm">Share to web</span>
            <span className="block text-xs text-ink-3">
              {isPublic ? "Anyone with the link can view this page" : "Only workspace members can see this page"}
            </span>
          </span>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => onTogglePublic(e.target.checked)}
            className="h-4 w-4 accent-[#2383e2]"
          />
        </label>
        {isPublic && (
          <div className="mt-2 flex gap-2">
            <input readOnly value={publicUrl} className="min-w-0 flex-1 rounded-md border border-line bg-[#f7f7f5] px-2 text-xs text-ink-2 outline-none" />
            <button
              type="button"
              onClick={() => void copy()}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0077d4]"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function PageTopBar({
  pageId,
  title,
  icon,
  updatedAt,
  saveState,
  isPublic,
  isTrashed,
  onTogglePublic,
  onShowComments,
}: {
  pageId: string;
  title: string;
  icon: string | null;
  updatedAt: string;
  saveState: SaveState;
  isPublic: boolean;
  isTrashed: boolean;
  onTogglePublic: (value: boolean) => void;
  onShowComments: () => void;
}) {
  const ws = useWorkspace();
  const isFavorite = ws.favoriteIds.includes(pageId);

  const ancestors: { id: string; title: string; icon: string | null }[] = [];
  let cursor = ws.pagesById.get(pageId);
  while (cursor?.parentId) {
    const parent = ws.pagesById.get(cursor.parentId);
    if (!parent) {
      break;
    }
    ancestors.unshift(parent);
    cursor = parent;
  }
  const crumbs = [...ancestors, { id: pageId, title, icon }];
  // Like Notion, fold the middle of deep paths into "…".
  const shown = crumbs.length > 4 ? [crumbs[0], null, ...crumbs.slice(-2)] : crumbs;

  const status = saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : `Edited ${timeAgo(updatedAt)}`;

  return (
    <header className="sticky top-0 z-30 flex h-11 items-center gap-2 bg-white/95 px-3 backdrop-blur max-md:pl-11">
      <nav className="flex min-w-0 flex-1 items-center text-sm">
        {shown.map((crumb, i) => (
          <Fragment key={crumb?.id ?? "ellipsis"}>
            {i > 0 && <span className="px-1 text-ink-3">/</span>}
            {crumb === null ? (
              <span className="px-1 text-ink-3">…</span>
            ) : (
              <Link
                href={`/w/${ws.workspaceId}/p/${crumb.id}`}
                className="flex min-w-0 items-center gap-1.5 truncate rounded px-1.5 py-0.5 text-ink hover:bg-hover"
              >
                <span className="shrink-0">{crumb.icon || <FileText size={14} />}</span>
                <span className="truncate">{crumb.title || "Untitled"}</span>
              </Link>
            )}
          </Fragment>
        ))}
      </nav>

      <span className="hidden shrink-0 text-xs text-ink-3 sm:block">{status}</span>

      {!isTrashed && (
        <Dropdown
          align="right"
          trigger={({ toggle }) => (
            <button type="button" onClick={toggle} className="rounded-md px-2 py-1 text-sm hover:bg-hover">
              Share
            </button>
          )}
        >
          {() => <ShareMenu pageId={pageId} isPublic={isPublic} onTogglePublic={onTogglePublic} />}
        </Dropdown>
      )}
      <button type="button" onClick={onShowComments} title="Comments" className="rounded-md p-1.5 text-ink-2 hover:bg-hover">
        <MessageSquare size={17} />
      </button>
      {!isTrashed && (
        <button
          type="button"
          onClick={() => void ws.toggleFavorite(pageId)}
          title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
          className="rounded-md p-1.5 text-ink-2 hover:bg-hover"
        >
          <Star size={17} className={isFavorite ? "fill-[#f5c518] text-[#f5c518]" : ""} />
        </button>
      )}
      {!isTrashed && (
        <Dropdown
          align="right"
          className="w-56"
          trigger={({ toggle }) => (
            <button type="button" onClick={toggle} aria-label="More" className="rounded-md p-1.5 text-ink-2 hover:bg-hover">
              <Ellipsis size={17} />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon={<LinkIcon size={15} />}
                onClick={() => {
                  close();
                  void ws.copyPageLink(pageId);
                }}
              >
                Copy link
              </MenuItem>
              <MenuItem
                icon={<Copy size={15} />}
                onClick={() => {
                  close();
                  void ws.duplicatePage(pageId);
                }}
              >
                Duplicate
              </MenuItem>
              <MenuDivider />
              <MenuItem
                danger
                icon={<Trash2 size={15} />}
                onClick={() => {
                  close();
                  void ws.trashPage(pageId, pageId);
                }}
              >
                Move to Trash
              </MenuItem>
            </>
          )}
        </Dropdown>
      )}
    </header>
  );
}
