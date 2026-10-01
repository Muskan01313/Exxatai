"use client";

import { useEffect, useState } from "react";
import { Play, Plus, Square, Trash2 } from "lucide-react";
import { addDays, dayKey, dayRange, formatClock, formatDayLabel, formatDuration, formatTime, fromInputs, todayKey, weekDays } from "./dates";
import type { RunningEntry } from "./useTimer";
import type { TimeEntryItem, TrackerTask } from "@/types/tracker";

function entrySeconds(entry: TimeEntryItem, now: number) {
  const end = entry.endedAt ? new Date(entry.endedAt).getTime() : now;
  return Math.max(0, (end - new Date(entry.startedAt).getTime()) / 1000);
}

function TaskSelect({ tasks, value, onChange }: { tasks: TrackerTask[]; value: string; onChange: (v: string) => void }) {
  return (
    <select
      aria-label="Task"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 max-w-[220px] min-w-0 rounded-md border border-line bg-white px-2 text-sm text-ink-2 outline-none focus:border-accent"
    >
      <option value="">No task</option>
      {tasks.map((t) => (
        <option key={t.id} value={t.id}>
          {t.title}
        </option>
      ))}
    </select>
  );
}

function ManualEntryForm({
  day,
  tasks,
  onSave,
  onCancel,
}: {
  day: string;
  tasks: TrackerTask[];
  onSave: (input: { description: string; taskId: string | null; startedAt: string; endedAt: string }) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState("");
  const [taskId, setTaskId] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const startedAt = fromInputs(day, start)!;
    // An end time earlier than the start means the work ran past midnight.
    const endedAt = fromInputs(end <= start ? addDays(day, 1) : day, end)!;
    const ok = await onSave({ description: description.trim(), taskId: taskId || null, startedAt, endedAt });
    if (!ok) {
      setError("Couldn't save. Check the times and try again.");
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-line p-3"
    >
      <input
        autoFocus
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What did you work on?"
        maxLength={500}
        className="h-9 min-w-[180px] flex-1 rounded-md border border-line px-2 text-sm outline-none focus:border-accent"
      />
      <TaskSelect tasks={tasks} value={taskId} onChange={setTaskId} />
      <input type="time" aria-label="From" value={start} onChange={(e) => setStart(e.target.value)} required className="h-9 rounded-md border border-line px-2 text-sm" />
      <span className="text-ink-3">–</span>
      <input type="time" aria-label="To" value={end} onChange={(e) => setEnd(e.target.value)} required className="h-9 rounded-md border border-line px-2 text-sm" />
      <button type="submit" className="h-9 rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-[#0077d4]">
        Add
      </button>
      <button type="button" onClick={onCancel} className="h-9 rounded-md px-3 text-sm text-ink-2 hover:bg-hover">
        Cancel
      </button>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </form>
  );
}

export function TimeTracker({
  workspaceId,
  weekStart,
  selectedDay,
  onSelectDay,
  tasks,
  running,
  version,
  now,
  onStart,
  onStop,
  onEntriesChanged,
  onOpenTask,
}: {
  workspaceId: string;
  weekStart: string;
  selectedDay: string;
  onSelectDay: (day: string) => void;
  tasks: TrackerTask[];
  running: RunningEntry | null;
  version: number;
  now: number;
  onStart: (input: { description?: string; taskId?: string | null }) => Promise<void>;
  onStop: () => Promise<void>;
  onEntriesChanged: (removedId?: string) => void;
  onOpenTask: (id: string) => void;
}) {
  const days = weekDays(weekStart);
  const [entries, setEntries] = useState<TimeEntryItem[]>([]);
  const [description, setDescription] = useState("");
  const [taskId, setTaskId] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let active = true;
    const { fromTime, toTime } = dayRange(weekStart, addDays(weekStart, 6));
    void fetch(`/api/workspaces/${workspaceId}/tracker/time?from=${fromTime}&to=${toTime}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) {
          setEntries(data.entries);
        }
      });
    return () => {
      active = false;
    };
  }, [workspaceId, weekStart, version]);

  const openTasks = tasks.filter((t) => t.status !== "DONE");
  const byDay = new Map(days.map((d) => [d, [] as TimeEntryItem[]]));
  for (const entry of entries) {
    byDay.get(dayKey(new Date(entry.startedAt)))?.push(entry);
  }
  const dayEntries = byDay.get(selectedDay) ?? [];
  const dayTotal = dayEntries.reduce((sum, e) => sum + entrySeconds(e, now), 0);
  const weekTotal = entries.reduce((sum, e) => sum + entrySeconds(e, now), 0);

  async function remove(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/tracker/time/${id}`, { method: "DELETE" });
    onEntriesChanged(id);
  }

  async function addManual(input: { description: string; taskId: string | null; startedAt: string; endedAt: string }) {
    const res = await fetch(`/api/workspaces/${workspaceId}/tracker/time`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "manual", ...input }),
    });
    if (res.ok) {
      setAdding(false);
      onEntriesChanged();
    }
    return res.ok;
  }

  const runningSeconds = running ? (now - new Date(running.startedAt).getTime()) / 1000 : 0;

  return (
    <div className="mx-auto max-w-[900px] px-4 pb-16 sm:px-12" data-testid="time-tracker">
      {/* The timer */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 shadow-[rgba(15,15,15,0.04)_0_2px_4px]">
        {running ? (
          <>
            <div className="min-w-0 flex-1 px-2">
              <p className="truncate text-sm font-medium">{running.description || running.taskTitle || "Working"}</p>
              {running.taskTitle && running.description && <p className="truncate text-xs text-ink-3">{running.taskTitle}</p>}
              {running.workspaceId !== workspaceId && <p className="text-xs text-ink-3">Started in another workspace</p>}
            </div>
            <span className="px-2 font-mono text-lg tabular-nums" data-testid="timer-clock">
              {formatClock(runningSeconds)}
            </span>
            <button
              type="button"
              onClick={() => void onStop()}
              className="flex h-9 items-center gap-1.5 rounded-md bg-[#eb5757] px-3 text-sm font-medium text-white hover:bg-[#d64545]"
            >
              <Square size={13} fill="currentColor" /> Stop
            </button>
          </>
        ) : (
          <form
            className="flex w-full flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void onStart({ description: description.trim(), taskId: taskId || null }).then(() => {
                setDescription("");
                setTaskId("");
              });
            }}
          >
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you working on?"
              maxLength={500}
              className="h-9 min-w-[180px] flex-1 rounded-md px-2 text-sm outline-none"
            />
            <TaskSelect tasks={openTasks} value={taskId} onChange={setTaskId} />
            <button
              type="submit"
              className="flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-[#0077d4]"
            >
              <Play size={13} fill="currentColor" /> Start
            </button>
          </form>
        )}
      </div>

      {/* The week, one day per column */}
      <div className="mt-6 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const total = (byDay.get(day) ?? []).reduce((sum, e) => sum + entrySeconds(e, now), 0);
          const selected = day === selectedDay;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(day)}
              className={`rounded-md px-1 py-2 text-center ${selected ? "bg-[#e7f3f8]" : "hover:bg-hover"}`}
            >
              <span className={`block text-xs ${day === todayKey() ? "font-semibold text-[#eb5757]" : "text-ink-3"}`}>
                {formatDayLabel(day)}
              </span>
              <span className={`block text-sm tabular-nums ${total ? "text-ink" : "text-ink-3"}`}>
                {total >= 60 ? formatDuration(total) : "–"}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-right text-xs text-ink-3">This week: {formatDuration(weekTotal)}</p>

      {/* The selected day */}
      <div className="mt-4 flex items-baseline justify-between border-b border-line pb-2">
        <h2 className="font-semibold">{formatDayLabel(selectedDay, { weekday: "long", month: "long", day: "numeric" })}</h2>
        <span className="text-sm text-ink-2 tabular-nums" data-testid="day-total">
          {formatDuration(dayTotal)}
        </span>
      </div>
      {dayEntries.length === 0 && !adding && (
        <p className="py-6 text-center text-sm text-ink-3">No time logged on this day yet.</p>
      )}
      <ul>
        {dayEntries.map((entry) => (
          <li key={entry.id} className="group flex items-center gap-3 border-b border-line py-2 text-sm" data-testid="time-entry">
            <span className="w-36 shrink-0 text-ink-3 tabular-nums">
              {formatTime(entry.startedAt)} – {entry.endedAt ? formatTime(entry.endedAt) : "now"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate">{entry.description || entry.taskTitle || "Untitled"}</p>
              {entry.taskId && entry.description && (
                <button type="button" onClick={() => onOpenTask(entry.taskId!)} className="truncate text-xs text-ink-3 hover:underline">
                  {entry.taskTitle}
                </button>
              )}
            </div>
            <span className="tabular-nums">
              {entry.endedAt ? formatDuration(entrySeconds(entry, now)) : formatClock(entrySeconds(entry, now))}
            </span>
            <button
              type="button"
              onClick={() => void remove(entry.id)}
              title="Delete entry"
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 opacity-0 group-hover:opacity-100 hover:bg-hover hover:text-danger max-md:opacity-100"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      {adding ? (
        <ManualEntryForm day={selectedDay} tasks={openTasks} onSave={addManual} onCancel={() => setAdding(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-ink-3 hover:bg-hover"
        >
          <Plus size={15} /> Add time manually
        </button>
      )}
    </div>
  );
}
