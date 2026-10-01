"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2, Undo2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";

interface TrashedPage {
  id: string;
  title: string;
  icon: string | null;
}

export function TrashList({ close }: { close: () => void }) {
  const ws = useWorkspace();
  const router = useRouter();
  const [pages, setPages] = useState<TrashedPage[] | null>(null);
  const [filter, setFilter] = useState("");

  async function load() {
    const res = await fetch(`/api/workspaces/${ws.workspaceId}/trash`, { cache: "no-store" });
    if (res.ok) {
      setPages((await res.json()).pages);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load trash when the panel opens
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function restore(id: string) {
    await fetch(`/api/pages/${id}/restore`, { method: "POST" });
    await Promise.all([load(), ws.refreshPages()]);
    ws.toast("Page restored");
    router.refresh();
  }

  async function deleteForever(id: string, title: string) {
    if (!window.confirm(`Permanently delete "${title || "Untitled"}" and its sub-pages? This can't be undone.`)) {
      return;
    }
    await fetch(`/api/pages/${id}`, { method: "DELETE" });
    await load();
  }

  const visible = (pages ?? []).filter((p) => p.title.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="w-[380px] px-2">
      <input
        autoFocus
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search pages in Trash"
        className="mb-2 w-full rounded-md border border-line bg-[#f7f7f5] px-2 py-1.5 text-sm outline-none focus:border-accent/60"
      />
      {pages === null ? (
        <p className="px-2 py-4 text-center text-ink-3">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="px-2 py-6 text-center text-ink-3">{pages.length === 0 ? "Trash is empty" : "No matches"}</p>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          {visible.map((p) => (
            <div key={p.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-hover">
              <span className="flex w-5 justify-center text-ink-2">{p.icon || <FileText size={15} />}</span>
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => {
                  close();
                  router.push(`/w/${ws.workspaceId}/p/${p.id}`);
                }}
              >
                {p.title || "Untitled"}
              </button>
              <button
                type="button"
                title="Restore"
                onClick={() => void restore(p.id)}
                className="rounded p-1 text-ink-3 hover:bg-hover hover:text-ink"
              >
                <Undo2 size={15} />
              </button>
              <button
                type="button"
                title="Delete permanently"
                onClick={() => void deleteForever(p.id, p.title)}
                className="rounded p-1 text-ink-3 hover:bg-hover hover:text-danger"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 border-t border-line px-2 pt-2 text-xs text-ink-3">
        Pages in Trash are hidden from the sidebar, search and AI answers.
      </p>
    </div>
  );
}
