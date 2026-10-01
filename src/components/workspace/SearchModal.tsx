"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, FileText, Search } from "lucide-react";
import { Modal } from "@/components/ui/Dropdown";

interface Result {
  id: string;
  title: string;
  icon: string | null;
  snippet: string;
}

export function SearchModal({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          setResults((await res.json()).results);
          setActive(0);
        }
      } catch {
        // Superseded by a newer query.
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, workspaceId]);

  function open(id: string) {
    onClose();
    router.push(`/w/${workspaceId}/p/${id}`);
  }

  return (
    <Modal onClose={onClose} className="max-w-[620px]">
      <div className="flex items-center gap-2 border-b border-line px-4">
        <Search size={18} className="text-ink-3" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              open(results[active].id);
            }
          }}
          placeholder="Search pages…"
          className="h-12 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3"
        />
      </div>
      <div className="max-h-[50vh] overflow-y-auto py-1.5">
        <p className="px-4 pt-1 pb-1 text-xs font-medium text-ink-3">{query ? "Best matches" : "Recent pages"}</p>
        {results.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink-3">No pages found</p>
        ) : (
          results.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => open(r.id)}
              className={`mx-1.5 flex w-[calc(100%-0.75rem)] items-start gap-3 rounded-md px-2.5 py-2 text-left ${
                i === active ? "bg-hover" : ""
              }`}
            >
              <span className="mt-0.5 flex w-5 justify-center text-ink-2">{r.icon || <FileText size={16} />}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.title || "Untitled"}</span>
                {r.snippet && <span className="block truncate text-xs text-ink-3">{r.snippet}</span>}
              </span>
              {i === active && <CornerDownLeft size={14} className="mt-1 text-ink-3" />}
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}
