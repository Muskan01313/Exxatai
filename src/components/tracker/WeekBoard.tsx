"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Check, Plus } from "lucide-react";
import { addDays, dayKey, formatDayLabel, todayKey, weekDays } from "./dates";
import { TaskMeta } from "./TaskChips";
import type { TaskInput } from "./useTrackerTasks";
import type { TrackerTask } from "@/types/tracker";

const INBOX = "inbox";

/** Which column a task shows in: its planned day, else the day it's due, else "No date". */
function columnFor(task: TrackerTask, days: string[]): string | null {
  if (task.plannedDay) {
    if (days.includes(task.plannedDay)) {
      return task.plannedDay;
    }
  } else if (!task.dueAt) {
    return INBOX;
  }
  if (task.dueAt) {
    const due = dayKey(new Date(task.dueAt));
    if (days.includes(due)) {
      return due;
    }
  }
  return null;
}

function TaskCard({
  task,
  onOpen,
  onToggleDone,
  onDragStart,
}: {
  task: TrackerTask;
  onOpen: () => void;
  onToggleDone: () => void;
  onDragStart: (e: DragEvent) => void;
}) {
  const done = task.status === "DONE";
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      data-testid="task-card"
      className="group cursor-pointer rounded-md bg-white px-2 py-1.5 text-sm shadow-[rgba(15,15,15,0.1)_0_0_0_1px,rgba(15,15,15,0.1)_0_2px_4px] hover:bg-[#fafaf9]"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label={done ? "Mark as not done" : "Mark as done"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone();
          }}
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border ${
            done ? "border-accent bg-accent text-white" : "border-[#c7c6c4] hover:bg-hover"
          }`}
        >
          {done && <Check size={12} strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`break-words ${done ? "text-ink-3 line-through" : ""}`}>{task.title}</p>
          <TaskMeta task={task} />
        </div>
      </div>
    </div>
  );
}

function NewTaskInput({ onCreate, onDone }: { onCreate: (title: string) => Promise<unknown>; onDone: () => void }) {
  const [title, setTitle] = useState("");
  return (
    <input
      autoFocus
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      placeholder="Type a name, press Enter"
      maxLength={300}
      onBlur={() => {
        if (title.trim()) {
          void onCreate(title.trim());
        }
        onDone();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && title.trim()) {
          void onCreate(title.trim());
          setTitle("");
        } else if (e.key === "Escape") {
          setTitle("");
          onDone();
        }
      }}
      className="w-full rounded-md bg-white px-2 py-1.5 text-sm shadow-[rgba(15,15,15,0.1)_0_0_0_1px] outline-none focus:shadow-[#2383e2_0_0_0_2px]"
    />
  );
}

export function WeekBoard({
  weekStart,
  tasks,
  loading,
  onOpen,
  onCreate,
  onUpdate,
}: {
  weekStart: string;
  tasks: TrackerTask[];
  loading: boolean;
  onOpen: (id: string) => void;
  onCreate: (input: TaskInput & { title: string }) => Promise<unknown>;
  onUpdate: (id: string, patch: TaskInput) => Promise<unknown>;
}) {
  const days = weekDays(weekStart);
  const today = todayKey();
  const [adding, setAdding] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // On a narrow screen the week doesn't fit, so bring today's column into view.
  useEffect(() => {
    const board = boardRef.current;
    const column = board?.querySelector<HTMLElement>(`[data-column="${todayKey()}"]`);
    if (!board || !column) {
      return;
    }
    const overflow = column.offsetLeft + column.offsetWidth - board.clientWidth;
    if (overflow > 0) {
      board.scrollLeft = overflow + 48;
    }
  }, [weekStart]);

  const columns = new Map<string, TrackerTask[]>([[INBOX, []], ...days.map((d) => [d, []] as [string, TrackerTask[]])]);
  for (const task of tasks) {
    const column = columnFor(task, days);
    if (column) {
      columns.get(column)!.push(task);
    }
  }
  for (const list of columns.values()) {
    // Open work first, then by delivery time.
    list.sort(
      (a, b) =>
        Number(a.status === "DONE") - Number(b.status === "DONE") ||
        (a.dueAt ?? "~").localeCompare(b.dueAt ?? "~"),
    );
  }

  function drop(e: DragEvent, column: string) {
    e.preventDefault();
    setDropTarget(null);
    const id = e.dataTransfer.getData("text/x-task");
    const task = tasks.find((t) => t.id === id);
    if (!task) {
      return;
    }
    const plannedDay = column === INBOX ? null : column;
    if (task.plannedDay !== plannedDay) {
      void onUpdate(id, { plannedDay });
    }
  }

  return (
    <div ref={boardRef} className="flex gap-3 overflow-x-auto px-4 pb-6 sm:px-12" data-testid="week-board">
      {[INBOX, ...days].map((column) => {
        const isToday = column === today;
        const list = columns.get(column)!;
        const openCount = list.filter((t) => t.status !== "DONE").length;
        return (
          <section
            key={column}
            data-column={column}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("text/x-task")) {
                e.preventDefault();
                setDropTarget(column);
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDropTarget(null);
              }
            }}
            onDrop={(e) => drop(e, column)}
            className={`flex w-[230px] shrink-0 flex-col rounded-lg p-1.5 ${
              dropTarget === column ? "bg-accent/10" : column === INBOX ? "bg-[#f7f7f5]" : "bg-[#fbfbfa]"
            }`}
          >
            <header className="flex h-8 items-center gap-2 px-1 text-sm">
              {column === INBOX ? (
                <span className="font-medium text-ink-2">No date</span>
              ) : (
                <>
                  <span className={isToday ? "font-semibold text-ink" : "font-medium text-ink-2"}>
                    {formatDayLabel(column, { weekday: "short" })}
                  </span>
                  <span
                    className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${
                      isToday ? "bg-[#eb5757] font-semibold text-white" : "text-ink-3"
                    }`}
                  >
                    {formatDayLabel(column, { day: "numeric" })}
                  </span>
                </>
              )}
              <span className="ml-auto text-xs text-ink-3">{openCount || ""}</span>
            </header>
            <div className="flex flex-col gap-1.5">
              {list.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onOpen={() => onOpen(task.id)}
                  onToggleDone={() => void onUpdate(task.id, { status: task.status === "DONE" ? "TODO" : "DONE" })}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/x-task", task.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                />
              ))}
              {adding === column ? (
                <NewTaskInput
                  onCreate={(title) => onCreate({ title, plannedDay: column === INBOX ? null : column })}
                  onDone={() => setAdding(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(column)}
                  className="flex h-8 items-center gap-1.5 rounded-md px-1.5 text-sm text-ink-3 hover:bg-hover"
                >
                  <Plus size={15} /> New
                </button>
              )}
              {loading && list.length === 0 && <div className="h-10 animate-pulse rounded-md bg-hover" />}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function weekLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(`${addDays(weekStart, 6)}T12:00:00`);
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = start.toLocaleDateString([], { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString([], sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
  return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
}
