"use client";

import { useCallback, useEffect, useState, type DragEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import {
  Bell,
  CircleCheckBig,
  ChevronDown,
  ChevronsLeft,
  FileText,
  LogOut,
  Plus,
  Search,
  Settings,
  Sparkles,
  SquarePen,
  Trash2,
} from "lucide-react";
import { PageTreeItem } from "./PageTreeItem";
import { TrashList } from "./TrashList";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { Dropdown, MenuDivider, MenuItem } from "@/components/ui/Dropdown";
import { DUE_TONE_CLASS, dueTone, formatDue } from "@/components/tracker/dates";
import { groupReminders, reminderHref, urgentCount } from "@/components/tracker/reminders";

function useExpanded(workspaceId: string) {
  const storageKey = `sidebar-expanded:${workspaceId}`;
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey) ?? "[]"));
    } catch {
      return new Set();
    }
  });

  const update = useCallback(
    (fn: (prev: Set<string>) => Set<string>) => {
      setExpanded((prev) => {
        const next = fn(prev);
        try {
          localStorage.setItem(storageKey, JSON.stringify([...next]));
        } catch {
          // Storage can be unavailable (private mode); expansion just won't persist.
        }
        return next;
      });
    },
    [storageKey],
  );

  return [expanded, update] as const;
}

function NavItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-sm text-ink-2 hover:bg-hover"
    >
      <span className="flex w-5 justify-center">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </button>
  );
}

function RemindersMenu({ close }: { close: () => void }) {
  const ws = useWorkspace();
  const router = useRouter();
  const groups = groupReminders(ws.reminders);
  const sections = (Object.keys(groups) as (keyof typeof groups)[]).filter((g) => groups[g].length > 0);

  return (
    <div className="w-[300px]" data-testid="reminders-menu">
      <p className="px-3 pt-1 pb-1.5 text-xs font-medium text-ink-3">Deliveries</p>
      {sections.length === 0 && <p className="px-3 pb-2 text-sm text-ink-2">Nothing due in the next 7 days.</p>}
      {sections.map((group) => (
        <div key={group} className="pb-1">
          <p className="px-3 pt-1 text-[11px] font-medium tracking-wide text-ink-3 uppercase">{group}</p>
          {groups[group].map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                close();
                router.push(reminderHref(r));
              }}
              className="mx-1 flex w-[calc(100%-0.5rem)] flex-col items-start rounded-md px-2 py-1.5 text-left hover:bg-hover"
            >
              <span className="w-full truncate">{r.title}</span>
              <span className={`mt-0.5 rounded px-1.5 py-px text-xs ${DUE_TONE_CLASS[dueTone(r.dueAt)]}`}>
                {formatDue(r.dueAt)}
                {r.workspaceId !== ws.workspaceId && " · other workspace"}
              </span>
            </button>
          ))}
        </div>
      ))}
      <MenuDivider />
      <MenuItem
        icon={<CircleCheckBig size={15} />}
        onClick={() => {
          close();
          router.push(`/w/${ws.workspaceId}/tracker`);
        }}
      >
        Open my tracker
      </MenuItem>
    </div>
  );
}

export function Sidebar({ onCollapse }: { onCollapse: () => void }) {
  const ws = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const currentPageId = pathname?.match(/\/p\/([^/]+)/)?.[1];
  const onTracker = pathname?.endsWith("/tracker") ?? false;
  const urgent = urgentCount(ws.reminders);
  const [expanded, setExpanded] = useExpanded(ws.workspaceId);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [rootDrop, setRootDrop] = useState(false);

  const toggleExpanded = useCallback(
    (id: string, open?: boolean) =>
      setExpanded((prev) => {
        const next = new Set(prev);
        if (open ?? !next.has(id)) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      }),
    [setExpanded],
  );

  // Open the path down to the page you're on, like Notion does.
  useEffect(() => {
    if (!currentPageId) {
      return;
    }
    const ancestors: string[] = [];
    let cursor = ws.pagesById.get(currentPageId);
    while (cursor?.parentId) {
      ancestors.push(cursor.parentId);
      cursor = ws.pagesById.get(cursor.parentId);
    }
    if (ancestors.some((id) => !expanded.has(id))) {
      setExpanded((prev) => new Set([...prev, ...ancestors]));
    }
  }, [currentPageId, ws.pagesById, expanded, setExpanded]);

  const roots = ws.childrenByParent.get(null) ?? [];
  const favorites = ws.favoriteIds.map((id) => ws.pagesById.get(id)).filter((p) => p !== undefined);

  async function createWorkspace() {
    const name = window.prompt("Name your new workspace");
    if (!name?.trim()) {
      return;
    }
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      router.push(`/w/${data.workspace.id}`);
      router.refresh();
    }
  }

  function onRootDragOver(e: DragEvent) {
    if (!draggingId) {
      return;
    }
    e.preventDefault();
    setRootDrop(true);
  }

  async function onRootDrop(e: DragEvent) {
    e.preventDefault();
    setRootDrop(false);
    const dragging = draggingId;
    setDraggingId(null);
    if (dragging) {
      await ws.movePage(dragging, null, roots.filter((r) => r.id !== dragging).length);
    }
  }

  const drag = { draggingId, setDraggingId };

  return (
    <aside className="group/sidebar flex h-full w-60 shrink-0 flex-col bg-sidebar">
      <div className="flex items-center gap-1 px-2 pt-2">
        <Dropdown
          wrapperClassName="relative min-w-0 flex-1"
          className="w-64"
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className="flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-1.5 text-sm font-medium hover:bg-hover"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-ink-3 text-[11px] font-semibold text-white">
                {ws.workspaceName.charAt(0).toUpperCase()}
              </span>
              <span className="truncate">{ws.workspaceName}</span>
              <ChevronDown size={14} className="shrink-0 text-ink-3" />
            </button>
          )}
        >
          {(close) => (
            <>
              <p className="px-3 pt-1 pb-1.5 text-xs text-ink-3">{ws.userName}</p>
              {ws.workspaces.map((w) => (
                <MenuItem
                  key={w.id}
                  icon={
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-ink-3 text-[11px] font-semibold text-white">
                      {w.name.charAt(0).toUpperCase()}
                    </span>
                  }
                  hint={w.id === ws.workspaceId ? "✓" : undefined}
                  onClick={() => {
                    close();
                    router.push(`/w/${w.id}`);
                  }}
                >
                  {w.name}
                </MenuItem>
              ))}
              <MenuItem
                icon={<Plus size={15} />}
                onClick={() => {
                  close();
                  void createWorkspace();
                }}
              >
                New workspace
              </MenuItem>
              <MenuDivider />
              <MenuItem icon={<LogOut size={15} />} onClick={() => void signOut({ callbackUrl: "/login" })}>
                Log out
              </MenuItem>
            </>
          )}
        </Dropdown>
        <button
          type="button"
          onClick={onCollapse}
          title="Close sidebar"
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 opacity-0 hover:bg-hover group-hover/sidebar:opacity-100"
        >
          <ChevronsLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => void ws.createPage(null)}
          title="New page"
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-2 hover:bg-hover"
        >
          <SquarePen size={16} />
        </button>
      </div>

      <nav className="px-2 pt-1 pb-2">
        <NavItem icon={<Search size={16} />} label="Search" hint="Ctrl K" onClick={ws.openSearch} />
        <NavItem icon={<Sparkles size={16} />} label="Ask AI" onClick={ws.openChat} />
        <Link
          href={`/w/${ws.workspaceId}/tracker`}
          className={`flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-hover ${
            onTracker ? "bg-hover font-medium text-ink" : "text-ink-2"
          }`}
        >
          <span className="flex w-5 justify-center">
            <CircleCheckBig size={16} />
          </span>
          <span className="flex-1">My tracker</span>
        </Link>
        <Dropdown
          className="py-2"
          trigger={({ toggle }) => (
            <NavItem
              icon={<Bell size={16} />}
              label="Reminders"
              hint={
                urgent > 0 ? (
                  <span
                    data-testid="reminder-count"
                    className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#eb5757] px-1 text-[11px] font-semibold text-white"
                  >
                    {urgent}
                  </span>
                ) : undefined
              }
              onClick={toggle}
            />
          )}
        >
          {(close) => <RemindersMenu close={close} />}
        </Dropdown>
        <NavItem icon={<Settings size={16} />} label="Settings & members" onClick={ws.openSettings} />
      </nav>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {favorites.length > 0 && (
          <section className="mb-3">
            <p className="px-2 pb-1 text-xs font-medium text-ink-3">Favorites</p>
            {favorites.map((page) => (
              <Link
                key={page.id}
                href={`/w/${ws.workspaceId}/p/${page.id}`}
                className={`flex h-[30px] items-center gap-2 rounded-md px-2 text-sm ${
                  page.id === currentPageId ? "bg-hover font-medium text-ink" : "text-ink-2 hover:bg-hover"
                }`}
              >
                <span className="flex w-5 justify-center">{page.icon || <FileText size={16} />}</span>
                <span className="truncate">{page.title || "Untitled"}</span>
              </Link>
            ))}
          </section>
        )}

        <section>
          <div
            onDragOver={onRootDragOver}
            onDragLeave={() => setRootDrop(false)}
            onDrop={onRootDrop}
            className={`group/pages flex h-7 items-center rounded-md px-2 ${rootDrop ? "bg-accent/15" : ""}`}
          >
            <p className="flex-1 text-xs font-medium text-ink-3">Pages</p>
            <button
              type="button"
              onClick={() => void ws.createPage(null)}
              title="Add a page"
              className="flex h-5 w-5 items-center justify-center rounded text-ink-3 opacity-0 hover:bg-hover group-hover/pages:opacity-100"
            >
              <Plus size={14} />
            </button>
          </div>
          {roots.map((node) => (
            <PageTreeItem
              key={node.id}
              node={node}
              depth={0}
              currentPageId={currentPageId}
              expanded={expanded}
              toggleExpanded={toggleExpanded}
              drag={drag}
            />
          ))}
          <button
            type="button"
            onClick={() => void ws.createPage(null)}
            className="flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-sm text-ink-3 hover:bg-hover"
          >
            <Plus size={16} className="mx-0.5" /> Add a page
          </button>
        </section>
      </div>

      <div className="border-t border-line p-2">
        <Dropdown
          side="top"
          className="py-2"
          trigger={({ toggle }) => (
            <NavItem icon={<Trash2 size={16} />} label="Trash" onClick={toggle} />
          )}
        >
          {(close) => <TrashList close={close} />}
        </Dropdown>
      </div>
    </aside>
  );
}
