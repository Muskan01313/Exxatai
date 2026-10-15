"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CloudOff, Download, ListChecks, Loader2, Plus, Send, SlidersHorizontal } from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { useNow } from "@/components/tracker/useTimer";
import { addDays, startOfMonth, startOfWeek, todayKey } from "@/components/tracker/dates";
import { DEFAULT_WORKLOG_LISTS, type WorkLogLists, type WorkLogRow } from "@/types/worklog";
import { useWorkLogDrafts } from "./useWorkLog";
import { WorkLogTable } from "./WorkLogTable";
import { WorkLogListsEditor } from "./WorkLogListsEditor";
import { formatAht, rowSeconds, toCsv } from "./columns";

export type WorkLogTab = "drafts" | "submitted";
type Range = "today" | "week" | "month" | "custom";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2">
      <div className="text-[11px] tracking-wide text-ink-3 uppercase">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function rangeDays(range: Range, custom: { from: string; to: string }) {
  const today = todayKey();
  if (range === "today") {
    return { from: today, to: today };
  }
  if (range === "week") {
    const start = startOfWeek(today);
    return { from: start, to: addDays(start, 6) };
  }
  if (range === "month") {
    const start = startOfMonth(today);
    const d = new Date(`${start}T00:00`);
    d.setMonth(d.getMonth() + 1, 0);
    return { from: start, to: `${start.slice(0, 8)}${String(d.getDate()).padStart(2, "0")}` };
  }
  return custom;
}

export function WorkLogView({ initialTab }: { initialTab: WorkLogTab }) {
  const ws = useWorkspace();
  const { toast, workspaceId, userName } = ws;
  const [tab, setTab] = useState<WorkLogTab>(initialTab);
  const [lists, setLists] = useState<WorkLogLists>(DEFAULT_WORKLOG_LISTS);
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [listsOpen, setListsOpen] = useState(false);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  const drafts = useWorkLogDrafts(workspaceId, toast);
  const anyRunning = drafts.rows.some((r) => r.timerStartedAt);
  const now = useNow(anyRunning);

  useEffect(() => {
    window.history.replaceState(null, "", tab === "drafts" ? "?" : `?view=${tab}`);
  }, [tab]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch(`/api/workspaces/${workspaceId}/worklog/options`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/workspaces/${workspaceId}/members`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ]).then(([options, members]) => {
      if (!active) {
        return;
      }
      if (options) {
        setLists(options.lists);
      }
      if (members) {
        setCurrentUserId(members.currentUserId);
        setMemberNames(members.members.map((m: { name: string }) => m.name));
      }
    });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  // Until someone fills in the analyst list, offer the people in this workspace.
  const effectiveLists = useMemo(
    () => (lists.analysts.length ? lists : { ...lists, analysts: memberNames }),
    [lists, memberNames],
  );

  const addRow = useCallback(async () => {
    const analyst = effectiveLists.analysts.includes(userName) || effectiveLists.analysts.length === 0 ? userName : "";
    await drafts.create({ workDate: todayKey(), analyst });
  }, [drafts, effectiveLists.analysts, userName]);

  const duplicate = useCallback(
    async (row: WorkLogRow) => {
      const { ticketNumber, stubName, domain, analyst, workType, mainCategory, subCategory, formComplexity, usedByDate, vstsNumber, status } = row;
      await drafts.create({ ticketNumber, stubName, domain, analyst, workType, mainCategory, subCategory, formComplexity, usedByDate, vstsNumber, status, workDate: todayKey() });
    },
    [drafts],
  );

  const submitAll = useCallback(async () => {
    const missing = drafts.rows.filter((r) => !r.ticketNumber.trim());
    const ready = drafts.rows.filter((r) => r.ticketNumber.trim());
    setFlagged(new Set(missing.map((r) => r.id)));
    if (ready.length === 0) {
      toast("Add a ticket number before submitting.");
      return;
    }
    if (!window.confirm(`Submit ${ready.length} row${ready.length === 1 ? "" : "s"}? Running timers will stop.`)) {
      return;
    }
    const count = await drafts.submit(ready.map((r) => r.id));
    if (count > 0) {
      toast(
        missing.length
          ? `Submitted ${count}. ${missing.length} row${missing.length === 1 ? " needs" : "s need"} a ticket number.`
          : `Submitted ${count} row${count === 1 ? "" : "s"}.`,
      );
    }
  }, [drafts, toast]);

  const saveLists = useCallback(
    async (next: WorkLogLists) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/worklog/options`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        toast("Couldn't save the lists.");
        return false;
      }
      setLists((await res.json()).lists);
      toast("Lists saved");
      return true;
    },
    [workspaceId, toast],
  );

  const totalSeconds = drafts.rows.reduce((sum, r) => sum + rowSeconds(r, now), 0);
  const totalCompleted = drafts.rows.reduce((sum, r) => sum + (r.completedCount ?? 0), 0);

  return (
    <div className="min-h-full pb-24">
      <div className="sticky top-0 z-30 flex h-11 items-center gap-2 bg-white px-3 max-md:pl-11">
        <span className="flex items-center gap-1.5 text-sm text-ink">
          <span>📋</span> Work log
        </span>
        <span className="ml-auto flex items-center gap-1 text-xs text-ink-3" data-testid="save-state">
          {drafts.saveState === "saving" && (
            <>
              <Loader2 size={12} className="animate-spin" /> Saving…
            </>
          )}
          {drafts.saveState === "saved" && (
            <>
              <Check size={12} /> All changes saved
            </>
          )}
          {drafts.saveState === "error" && (
            <span className="flex items-center gap-1 text-danger">
              <CloudOff size={12} /> Not saved, retrying on your next edit
            </span>
          )}
        </span>
      </div>

      <div className="px-4 pt-10 sm:px-12">
        <div className="mb-1 text-[54px] leading-none">📋</div>
        <h1 className="mt-3 text-[32px] leading-tight font-bold sm:text-[40px]">Work log</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          Log each ticket you work on. Everything saves as you type, and timers keep running even if you reload or close
          the tab. Submit when you&apos;re done for the day.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 sm:px-12">
        <div className="flex" role="tablist">
          {(
            [
              { id: "drafts", label: "Today's work", icon: ListChecks, count: drafts.rows.length },
              { id: "submitted", label: "Submitted", icon: Send, count: null },
            ] as const
          ).map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`-mb-px flex h-9 items-center gap-1.5 border-b-2 px-2 text-sm ${
                tab === id ? "border-ink font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink"
              }`}
            >
              <Icon size={15} /> {label}
              {count !== null && count > 0 && <span className="rounded bg-hover px-1.5 text-xs">{count}</span>}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setListsOpen(true)}
          className="mb-1 ml-auto flex h-7 items-center gap-1.5 rounded-md px-2 text-sm text-ink-2 hover:bg-hover"
        >
          <SlidersHorizontal size={15} /> Dropdown lists
        </button>
      </div>

      {tab === "drafts" ? (
        <div className="px-4 pt-5 sm:px-12">
          <div className="mb-4 grid max-w-xl grid-cols-3 gap-2">
            <Stat label="Rows" value={drafts.rows.length} />
            <Stat label="Time logged" value={formatAht(totalSeconds)} />
            <Stat label="Completed" value={totalCompleted} />
          </div>

          {drafts.loading ? (
            <div className="py-10 text-center text-sm text-ink-3">Loading…</div>
          ) : drafts.rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line py-12 text-center">
              <p className="text-sm text-ink-2">Nothing logged yet. Add a row and press ▶ to start the clock.</p>
              <button
                type="button"
                onClick={() => void addRow()}
                className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-[#0077d4]"
              >
                <Plus size={15} /> Add row
              </button>
            </div>
          ) : (
            <WorkLogTable
              rows={drafts.rows}
              lists={effectiveLists}
              now={now}
              mode="drafts"
              highlightIds={flagged}
              onUpdate={(id, patch) => {
                if (patch.ticketNumber && flagged.has(id)) {
                  setFlagged((prev) => new Set([...prev].filter((f) => f !== id)));
                }
                drafts.update(id, patch);
              }}
              onTimer={(id, action) => void drafts.setTimer(id, action)}
              onDuplicate={(row) => void duplicate(row)}
              onDelete={(row) => {
                if (window.confirm(`Delete this row${row.ticketNumber ? ` (${row.ticketNumber})` : ""}?`)) {
                  void drafts.remove(row.id);
                }
              }}
            />
          )}

          {drafts.rows.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void addRow()}
                className="flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-sm hover:bg-hover"
              >
                <Plus size={15} /> Add row
              </button>
              <button
                type="button"
                onClick={() => void submitAll()}
                className="flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-[#0077d4]"
              >
                <Send size={14} /> Submit
              </button>
              {flagged.size > 0 && <span className="text-xs text-danger">Rows in red need a ticket number.</span>}
            </div>
          )}
        </div>
      ) : (
        <SubmittedLog
          workspaceId={workspaceId}
          lists={effectiveLists}
          currentUserId={currentUserId}
          onReopen={async (row) => {
            const res = await fetch(`/api/worklog/${row.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reopen: true }),
            });
            if (!res.ok) {
              toast("Couldn't move it back to drafts.");
              return false;
            }
            await drafts.reload();
            toast("Moved back to Today's work");
            return true;
          }}
        />
      )}

      {listsOpen && <WorkLogListsEditor lists={effectiveLists} onSave={saveLists} onClose={() => setListsOpen(false)} />}
    </div>
  );
}

function SubmittedLog({
  workspaceId,
  lists,
  currentUserId,
  onReopen,
}: {
  workspaceId: string;
  lists: WorkLogLists;
  currentUserId?: string;
  onReopen: (row: WorkLogRow) => Promise<boolean>;
}) {
  const [range, setRange] = useState<Range>("week");
  const [custom, setCustom] = useState(() => ({ from: addDays(todayKey(), -30), to: todayKey() }));
  const [who, setWho] = useState<"me" | "all">("me");
  const [rows, setRows] = useState<WorkLogRow[] | null>(null);
  const { from, to } = rangeDays(range, custom);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ view: "submitted", from, to, who });
    const res = await fetch(`/api/workspaces/${workspaceId}/worklog?${params}`, { cache: "no-store" });
    setRows(res.ok ? (await res.json()).entries : []);
  }, [workspaceId, from, to, who]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch when the filters change
    void load();
  }, [load]);

  const total = rows?.reduce((s, r) => s + r.timerSeconds, 0) ?? 0;
  const completed = rows?.reduce((s, r) => s + (r.completedCount ?? 0), 0) ?? 0;
  const chip = (active: boolean) =>
    `h-7 rounded-md px-2.5 text-sm ${active ? "bg-ink text-white" : "text-ink-2 hover:bg-hover"}`;

  return (
    <div className="px-4 pt-5 sm:px-12">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["today", "week", "month", "custom"] as const).map((r) => (
          <button key={r} type="button" onClick={() => setRange(r)} className={chip(range === r)}>
            {{ today: "Today", week: "This week", month: "This month", custom: "Custom" }[r]}
          </button>
        ))}
        {range === "custom" && (
          <span className="flex items-center gap-1 text-sm">
            <input type="date" aria-label="From" value={custom.from} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} className="h-7 rounded-md border border-line px-1.5" />
            –
            <input type="date" aria-label="To" value={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} className="h-7 rounded-md border border-line px-1.5" />
          </span>
        )}
        <span className="mx-1 h-5 w-px bg-line" />
        <button type="button" onClick={() => setWho("me")} className={chip(who === "me")}>
          Mine
        </button>
        <button type="button" onClick={() => setWho("all")} className={chip(who === "all")}>
          Whole team
        </button>
        <button
          type="button"
          disabled={!rows?.length}
          onClick={() => {
            const blob = new Blob([toCsv(rows ?? [])], { type: "text/csv;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `work-log-${from}-to-${to}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
          }}
          className="ml-auto flex h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-sm hover:bg-hover disabled:opacity-50"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="mb-4 grid max-w-xl grid-cols-3 gap-2">
        <Stat label="Rows" value={rows?.length ?? "–"} />
        <Stat label="Total AHT" value={formatAht(total)} />
        <Stat label="Completed" value={completed} />
      </div>

      {rows === null ? (
        <div className="py-10 text-center text-sm text-ink-3">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line py-12 text-center text-sm text-ink-2">
          Nothing submitted in this period.
        </div>
      ) : (
        <WorkLogTable
          rows={rows}
          lists={lists}
          // Submitted rows never have a running timer.
          now={0}
          mode="submitted"
          showOwner={who === "all"}
          currentUserId={currentUserId}
          onReopen={async (row) => {
            if (await onReopen(row)) {
              setRows((prev) => prev?.filter((r) => r.id !== row.id) ?? null);
            }
          }}
        />
      )}
    </div>
  );
}
