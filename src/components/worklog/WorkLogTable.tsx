"use client";

import { useState } from "react";
import { Copy, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import type { WorkLogFields, WorkLogLists, WorkLogRow } from "@/types/worklog";
import { COLUMNS, formatAht, optionsFor, parseAht, rowSeconds, type Column } from "./columns";

const cellInput =
  "h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm text-ink outline-none hover:border-line hover:bg-white focus:border-accent focus:bg-white disabled:hover:border-transparent";

function Cell({
  column,
  row,
  lists,
  readOnly,
  onChange,
}: {
  column: Column;
  row: WorkLogRow;
  lists: WorkLogLists;
  readOnly: boolean;
  onChange: (patch: Partial<WorkLogFields>) => void;
}) {
  const value = row[column.key];
  const label = column.label;

  if (readOnly) {
    return (
      <div className="truncate px-2 text-sm" title={String(value ?? "")}>
        {value === null || value === "" ? <span className="text-ink-3">—</span> : String(value)}
      </div>
    );
  }

  if (column.kind === "select") {
    const options = optionsFor(column, lists, row);
    if (options.length === 0) {
      // No list set up yet: let people type, and add the choice under "Dropdown lists" later.
      return (
        <input
          aria-label={label}
          value={String(value ?? "")}
          placeholder="Type…"
          onChange={(e) => onChange({ [column.key]: e.target.value })}
          className={cellInput}
        />
      );
    }
    const all = value && !options.includes(String(value)) ? [String(value), ...options] : options;
    return (
      <select
        aria-label={label}
        value={String(value ?? "")}
        onChange={(e) => {
          const patch: Partial<WorkLogFields> = { [column.key]: e.target.value };
          // A new main category clears a sub category that doesn't belong to it.
          if (column.key === "mainCategory") {
            const subs = lists.categories.find((c) => c.name === e.target.value)?.subs ?? [];
            if (row.subCategory && !subs.includes(row.subCategory)) {
              patch.subCategory = "";
            }
          }
          onChange(patch);
        }}
        className={`${cellInput} cursor-pointer ${value ? "" : "text-ink-3"}`}
      >
        <option value="">Select…</option>
        {all.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  if (column.kind === "number") {
    return (
      <input
        aria-label={label}
        type="number"
        min={0}
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => {
          const n = e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value)));
          onChange({ completedCount: Number.isFinite(n) ? n : null });
        }}
        className={`${cellInput} tabular-nums`}
      />
    );
  }

  if (column.kind === "date") {
    return (
      <input
        aria-label={label}
        type="date"
        value={String(value ?? "")}
        onChange={(e) => {
          if (column.key === "workDate") {
            if (e.target.value) {
              onChange({ workDate: e.target.value });
            }
          } else {
            onChange({ usedByDate: e.target.value || null });
          }
        }}
        className={`${cellInput} ${value ? "" : "text-ink-3"}`}
      />
    );
  }

  if (column.kind === "long") {
    return (
      <textarea
        aria-label={label}
        rows={1}
        value={String(value ?? "")}
        onChange={(e) => onChange({ comments: e.target.value })}
        className={`${cellInput} block h-8 resize-none py-1.5 leading-5 focus:absolute focus:z-10 focus:h-28 focus:w-[320px] focus:shadow-menu`}
      />
    );
  }

  return (
    <input
      aria-label={label}
      value={String(value ?? "")}
      onChange={(e) => onChange({ [column.key]: e.target.value })}
      className={cellInput}
    />
  );
}

/** Total AHT: follows the timer, and you can type a corrected time. */
function AhtCell({ seconds, running, readOnly, onSet }: { seconds: number; running: boolean; readOnly: boolean; onSet: (s: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  if (readOnly || running) {
    return <div className="px-2 font-mono text-sm tabular-nums">{formatAht(seconds)}</div>;
  }
  return (
    <input
      aria-label="Total AHT"
      title="Type a time like 1:05:00, 25:30 or 45 (minutes)"
      value={draft ?? formatAht(seconds)}
      onFocus={(e) => {
        setDraft(formatAht(seconds));
        e.target.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      onBlur={() => {
        const parsed = draft === null ? null : parseAht(draft);
        if (parsed !== null && parsed !== Math.floor(seconds)) {
          onSet(parsed);
        }
        setDraft(null);
      }}
      className={`${cellInput} font-mono tabular-nums`}
    />
  );
}

export function WorkLogTable({
  rows,
  lists,
  now,
  mode,
  currentUserId,
  showOwner = false,
  highlightIds,
  onUpdate,
  onTimer,
  onDuplicate,
  onDelete,
  onReopen,
}: {
  rows: WorkLogRow[];
  lists: WorkLogLists;
  now: number;
  mode: "drafts" | "submitted";
  currentUserId?: string;
  showOwner?: boolean;
  /** Rows to flag, e.g. ones missing a ticket number at submit. */
  highlightIds?: Set<string>;
  onUpdate?: (id: string, patch: Partial<WorkLogFields> & { timerSeconds?: number }) => void;
  onTimer?: (id: string, action: "start" | "pause") => void;
  onDuplicate?: (row: WorkLogRow) => void;
  onDelete?: (row: WorkLogRow) => void;
  onReopen?: (row: WorkLogRow) => void;
}) {
  const readOnly = mode === "submitted";
  const th = "sticky top-0 z-10 border-b border-line bg-[#f7f7f5] px-2 py-2 text-left text-xs font-medium whitespace-nowrap text-ink-2";

  return (
    <div className="overflow-x-auto rounded-lg border border-line" data-testid="worklog-table">
      <table className="w-max min-w-full border-collapse">
        <thead>
          <tr>
            <th className={`${th} sticky left-0 z-20 w-[190px]`}>Recorded time</th>
            {showOwner && <th className={th}>Logged by</th>}
            {COLUMNS.map((c) => (
              <th key={c.key} className={th} style={{ minWidth: c.width }}>
                {c.label}
              </th>
            ))}
            <th className={th} style={{ minWidth: 120 }}>
              Total AHT
            </th>
            {readOnly && <th className={th}>Submitted</th>}
            {readOnly && <th className={th} />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const running = row.timerStartedAt !== null;
            const seconds = rowSeconds(row, now);
            const flagged = highlightIds?.has(row.id);
            return (
              <tr
                key={row.id}
                data-testid="worklog-row"
                className={`group border-b border-line last:border-b-0 ${flagged ? "bg-[#fdf2f2]" : running ? "bg-[#f1f8ff]" : "hover:bg-[#fafaf9]"}`}
              >
                <td className={`sticky left-0 z-[5] px-2 py-1.5 ${flagged ? "bg-[#fdf2f2]" : running ? "bg-[#f1f8ff]" : "bg-white group-hover:bg-[#fafaf9]"}`}>
                  <div className="flex items-center gap-1">
                    {!readOnly && onTimer && (
                      <button
                        type="button"
                        onClick={() => onTimer(row.id, running ? "pause" : "start")}
                        title={running ? "Pause" : seconds > 0 ? "Resume" : "Start"}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          running ? "bg-[#fbe4e4] text-[#c4314b] hover:bg-[#f8d4d4]" : "bg-[#e7f3ff] text-accent hover:bg-[#d3e9ff]"
                        }`}
                      >
                        {running ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
                      </button>
                    )}
                    <span className={`w-[68px] font-mono text-sm tabular-nums ${running ? "font-semibold text-accent" : ""}`}>
                      {formatAht(seconds)}
                    </span>
                    {!readOnly && (
                      <span className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
                        <button type="button" onClick={() => onDuplicate?.(row)} title="Duplicate row" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-hover hover:text-ink">
                          <Copy size={14} />
                        </button>
                        <button type="button" onClick={() => onDelete?.(row)} title="Delete row" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-hover hover:text-danger">
                          <Trash2 size={14} />
                        </button>
                      </span>
                    )}
                  </div>
                </td>
                {showOwner && <td className="px-2 text-sm whitespace-nowrap">{row.userName}</td>}
                {COLUMNS.map((c) => (
                  <td key={c.key} className="relative px-0.5 py-1" style={{ minWidth: c.width, maxWidth: readOnly ? c.width + 80 : undefined }}>
                    <Cell column={c} row={row} lists={lists} readOnly={readOnly} onChange={(patch) => onUpdate?.(row.id, patch)} />
                  </td>
                ))}
                <td className="px-0.5 py-1">
                  <AhtCell seconds={seconds} running={running} readOnly={readOnly} onSet={(s) => onUpdate?.(row.id, { timerSeconds: s })} />
                </td>
                {readOnly && (
                  <td className="px-2 text-xs whitespace-nowrap text-ink-2">
                    {row.submittedAt && new Date(row.submittedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                )}
                {readOnly && (
                  <td className="px-2">
                    {row.userId === currentUserId && onReopen && (
                      <button type="button" onClick={() => onReopen(row)} title="Move back to drafts to edit" className="flex h-7 items-center gap-1 rounded-md px-2 text-xs whitespace-nowrap text-ink-2 hover:bg-hover">
                        <RotateCcw size={13} /> Edit
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
