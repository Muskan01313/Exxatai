"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Bell, CalendarDays, ChevronsRight, CircleDot, Clock, Flag, Play, Square, Text, Trash2, Truck } from "lucide-react";
import { formatClock, formatDuration, fromInputs, toInputs } from "./dates";
import { PRIORITY_LABEL, STATUS_LABEL } from "./TaskChips";
import type { TaskInput } from "./useTrackerTasks";
import type { RunningEntry } from "./useTimer";
import { REMINDER_OPTIONS, type TaskPriority, type TaskStatus, type TrackerTask } from "@/types/tracker";

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[34px] items-center gap-2 text-sm">
      <span className="flex w-36 shrink-0 items-center gap-2 text-ink-2">
        {icon}
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const fieldClass =
  "w-full rounded-md bg-transparent px-2 py-1 text-sm outline-none hover:bg-hover focus:bg-white focus:shadow-[#2383e2_0_0_0_2px] disabled:text-ink-3 disabled:hover:bg-transparent";

export function TaskEditor({
  task,
  running,
  now,
  onUpdate,
  onDelete,
  onStartTimer,
  onStopTimer,
  onClose,
}: {
  task: TrackerTask;
  running: RunningEntry | null;
  now: number;
  onUpdate: (patch: TaskInput) => Promise<unknown>;
  onDelete: () => void;
  onStartTimer: () => void;
  onStopTimer: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const initialDue = toInputs(task.dueAt);
  const [dueDate, setDueDate] = useState(initialDue.date);
  const [dueTime, setDueTime] = useState(initialDue.time || "17:00");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLElement && e.target.closest("input,textarea,select"))) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const timingThis = running?.taskId === task.id;
  const runningSeconds = timingThis && running ? (now - new Date(running.startedAt).getTime()) / 1000 : 0;

  function saveTitle() {
    const next = title.trim();
    if (!next) {
      setTitle(task.title);
    } else if (next !== task.title) {
      void onUpdate({ title: next });
    }
  }

  function saveDue(date: string, time: string) {
    setDueDate(date);
    setDueTime(time);
    const dueAt = fromInputs(date, time);
    if (dueAt !== task.dueAt) {
      // The server picks a default reminder (1 hour before) for a new delivery date.
      void onUpdate(dueAt ? { dueAt } : { dueAt: null, reminderMinutes: null });
    }
  }

  return (
    <aside
      data-testid="task-editor"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[480px] flex-col bg-white shadow-menu"
    >
      <div className="flex h-11 shrink-0 items-center gap-1 px-3">
        <button
          type="button"
          onClick={onClose}
          title="Close"
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-2 hover:bg-hover"
        >
          <ChevronsRight size={18} />
        </button>
        <span className="text-xs text-ink-3">Only you can see this</span>
        <button
          type="button"
          onClick={onDelete}
          title="Delete"
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-ink-2 hover:bg-hover hover:text-danger"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-10 sm:px-10">
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          rows={1}
          maxLength={300}
          aria-label="Title"
          placeholder="Untitled"
          className="field-sizing-content mt-4 mb-3 w-full resize-none text-[28px] leading-tight font-bold outline-none placeholder:text-[#e1e1e0]"
        />

        <div className="space-y-0.5">
          <Row icon={<CircleDot size={15} />} label="Status">
            <select
              aria-label="Status"
              value={task.status}
              onChange={(e) => void onUpdate({ status: e.target.value as TaskStatus })}
              className={fieldClass}
            >
              {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Row>
          <Row icon={<Flag size={15} />} label="Priority">
            <select
              aria-label="Priority"
              value={task.priority}
              onChange={(e) => void onUpdate({ priority: e.target.value as TaskPriority })}
              className={fieldClass}
            >
              {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </Row>
          <Row icon={<CalendarDays size={15} />} label="Work on">
            <input
              type="date"
              aria-label="Work on"
              value={task.plannedDay ?? ""}
              onChange={(e) => void onUpdate({ plannedDay: e.target.value || null })}
              className={fieldClass}
            />
          </Row>
          <Row icon={<Truck size={15} />} label="Delivery">
            <div className="flex gap-1">
              <input
                type="date"
                aria-label="Delivery date"
                value={dueDate}
                onChange={(e) => saveDue(e.target.value, dueTime)}
                className={fieldClass}
              />
              <input
                type="time"
                aria-label="Delivery time"
                value={dueTime}
                disabled={!dueDate}
                onChange={(e) => saveDue(dueDate, e.target.value)}
                className={`${fieldClass} max-w-[120px]`}
              />
            </div>
          </Row>
          <Row icon={<Bell size={15} />} label="Remind me">
            <select
              aria-label="Remind me"
              value={task.reminderMinutes ?? ""}
              disabled={!task.dueAt}
              onChange={(e) => void onUpdate({ reminderMinutes: e.target.value === "" ? null : Number(e.target.value) })}
              className={fieldClass}
            >
              {REMINDER_OPTIONS.map((o) => (
                <option key={o.label} value={o.minutes ?? ""}>
                  {task.dueAt ? o.label : "Set a delivery date first"}
                </option>
              ))}
            </select>
          </Row>
          <Row icon={<Clock size={15} />} label="Time logged">
            <div className="flex items-center gap-2 px-2">
              <span className="tabular-nums">
                {timingThis ? formatClock(task.loggedSeconds + runningSeconds) : formatDuration(task.loggedSeconds)}
              </span>
              {timingThis ? (
                <button
                  type="button"
                  onClick={onStopTimer}
                  className="ml-auto flex items-center gap-1 rounded-md bg-[#eb5757] px-2 py-1 text-xs font-medium text-white hover:bg-[#d64545]"
                >
                  <Square size={11} fill="currentColor" /> Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onStartTimer}
                  className="ml-auto flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-ink-2 hover:bg-hover"
                >
                  <Play size={11} fill="currentColor" /> Start timer
                </button>
              )}
            </div>
          </Row>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-1 flex items-center gap-2 text-sm text-ink-2">
            <Text size={15} /> Notes
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== task.notes) {
                void onUpdate({ notes });
              }
            }}
            maxLength={10000}
            placeholder="Add details, links or a checklist…"
            className="field-sizing-content min-h-32 w-full resize-none rounded-md text-[15px] leading-relaxed outline-none placeholder:text-ink-3"
          />
        </div>
      </div>
    </aside>
  );
}
