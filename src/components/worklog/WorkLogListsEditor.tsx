"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Modal } from "@/components/ui/Dropdown";
import type { WorkLogLists } from "@/types/worklog";
import type { ListKey } from "./columns";

const SIMPLE: { key: ListKey; label: string }[] = [
  { key: "stubNames", label: "Stub names" },
  { key: "domains", label: "Domains" },
  { key: "analysts", label: "Analysts" },
  { key: "workTypes", label: "New/BAU" },
  { key: "complexities", label: "Form complexity" },
  { key: "statuses", label: "Status" },
];

const lines = (text: string) => [...new Set(text.split("\n").map((l) => l.trim()).filter(Boolean))];

function categoriesToText(categories: WorkLogLists["categories"]) {
  return categories.map((c) => (c.subs.length ? `${c.name}: ${c.subs.join(", ")}` : c.name)).join("\n");
}

function textToCategories(text: string): WorkLogLists["categories"] {
  const byName = new Map<string, Set<string>>();
  for (const line of lines(text)) {
    const colon = line.indexOf(":");
    const name = colon === -1 ? line : line.slice(0, colon);
    const subs = colon === -1 ? "" : line.slice(colon + 1);
    const set = byName.get(name.trim()) ?? new Set<string>();
    subs.split(",").map((s) => s.trim()).filter(Boolean).forEach((s) => set.add(s));
    byName.set(name.trim(), set);
  }
  return [...byName].filter(([name]) => name).map(([name, subs]) => ({ name, subs: [...subs] }));
}

/** Edit the dropdown choices. They're shared with everyone in the workspace. */
export function WorkLogListsEditor({
  lists,
  onSave,
  onClose,
}: {
  lists: WorkLogLists;
  onSave: (lists: WorkLogLists) => Promise<boolean>;
  onClose: () => void;
}) {
  const [texts, setTexts] = useState<Record<ListKey, string>>(
    () => Object.fromEntries(SIMPLE.map(({ key }) => [key, lists[key].join("\n")])) as Record<ListKey, string>,
  );
  const [categories, setCategories] = useState(() => categoriesToText(lists.categories));
  const [busy, setBusy] = useState(false);

  const field = "w-full rounded-md border border-line bg-[#fbfbfa] px-2 py-1.5 text-sm outline-none focus:border-accent focus:bg-white";

  return (
    <Modal onClose={onClose} className="max-w-3xl">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div>
          <h2 className="text-base font-semibold">Dropdown lists</h2>
          <p className="text-xs text-ink-2">One choice per line. Everyone in this workspace sees the same lists.</p>
        </div>
        <button type="button" onClick={onClose} title="Close" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-2 hover:bg-hover">
          <X size={16} />
        </button>
      </div>
      <div className="grid max-h-[60vh] gap-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
        {SIMPLE.map(({ key, label }) => (
          <label key={key} className="block">
            <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
            <textarea
              rows={5}
              value={texts[key]}
              onChange={(e) => setTexts((t) => ({ ...t, [key]: e.target.value }))}
              className={field}
            />
          </label>
        ))}
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-ink-2">Main and sub categories</span>
          <textarea
            rows={6}
            value={categories}
            placeholder={"Forms: New form, Update form\nReports: Fix, Enhancement"}
            onChange={(e) => setCategories(e.target.value)}
            className={`${field} font-mono text-xs`}
          />
          <span className="mt-1 block text-xs text-ink-3">
            One main category per line, then a colon and its sub categories separated by commas.
          </span>
        </label>
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
        <button type="button" onClick={onClose} className="h-8 rounded-md px-3 text-sm text-ink-2 hover:bg-hover">
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const next = {
              ...(Object.fromEntries(SIMPLE.map(({ key }) => [key, lines(texts[key])])) as Record<ListKey, string[]>),
              categories: textToCategories(categories),
            };
            const ok = await onSave(next);
            setBusy(false);
            if (ok) {
              onClose();
            }
          }}
          className="h-8 rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-[#0077d4] disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save lists"}
        </button>
      </div>
    </Modal>
  );
}
