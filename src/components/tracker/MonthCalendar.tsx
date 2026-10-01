"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { addDays, dayKey, dayRange, DUE_TONE_CLASS, dueTone, formatDuration, formatTime, parseDay, startOfWeek, todayKey } from "./dates";
import type { TimeEntryItem, TrackerTask } from "@/types/tracker";

/** The 6 weeks shown for a month, Monday first. */
export function monthGrid(monthStart: string) {
  const first = startOfWeek(monthStart);
  return { first, last: addDays(first, 41) };
}

export function MonthCalendar({
  workspaceId,
  monthStart,
  tasks,
  version,
  onOpenTask,
  onOpenDay,
}: {
  workspaceId: string;
  monthStart: string;
  tasks: TrackerTask[];
  version: number;
  onOpenTask: (id: string) => void;
  onOpenDay: (day: string) => void;
}) {
  const { first, last } = monthGrid(monthStart);
  const [logged, setLogged] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let active = true;
    const { fromTime, toTime } = dayRange(first, last);
    void fetch(`/api/workspaces/${workspaceId}/tracker/time?from=${fromTime}&to=${toTime}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { entries: TimeEntryItem[] } | null) => {
        if (!active || !data) {
          return;
        }
        const totals = new Map<string, number>();
        const now = Date.now();
        for (const e of data.entries) {
          const day = dayKey(new Date(e.startedAt));
          const end = e.endedAt ? new Date(e.endedAt).getTime() : now;
          totals.set(day, (totals.get(day) ?? 0) + (end - new Date(e.startedAt).getTime()) / 1000);
        }
        setLogged(totals);
      });
    return () => {
      active = false;
    };
  }, [workspaceId, first, last, version]);

  const deliveries = new Map<string, TrackerTask[]>();
  for (const task of tasks) {
    if (task.dueAt) {
      const day = dayKey(new Date(task.dueAt));
      deliveries.set(day, [...(deliveries.get(day) ?? []), task]);
    }
  }
  for (const list of deliveries.values()) {
    list.sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
  }

  const month = parseDay(monthStart).getMonth();
  const today = todayKey();
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));

  return (
    <div className="px-4 pb-10 sm:px-12" data-testid="month-calendar">
      <div className="grid grid-cols-7 border-t border-l border-line text-sm">
        {days.slice(0, 7).map((day) => (
          <div key={`h-${day}`} className="border-r border-b border-line px-2 py-1 text-xs text-ink-3">
            {parseDay(day).toLocaleDateString([], { weekday: "short" })}
          </div>
        ))}
        {days.map((day) => {
          const list = deliveries.get(day) ?? [];
          const seconds = logged.get(day) ?? 0;
          const inMonth = parseDay(day).getMonth() === month;
          return (
            <div
              key={day}
              data-day={day}
              onClick={() => onOpenDay(day)}
              className={`group min-h-[104px] cursor-pointer border-r border-b border-line p-1 hover:bg-[#fbfbfa] ${
                inMonth ? "" : "bg-[#fbfbfa] text-ink-3"
              }`}
            >
              <div className="flex items-center justify-between px-1">
                {seconds >= 60 ? (
                  <span className="flex items-center gap-1 text-[11px] text-ink-3" title="Time logged">
                    <Clock size={10} />
                    {formatDuration(seconds)}
                  </span>
                ) : (
                  <span />
                )}
                <span
                  className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${
                    day === today ? "bg-[#eb5757] font-semibold text-white" : ""
                  }`}
                >
                  {parseDay(day).getDate()}
                </span>
              </div>
              <div className="mt-0.5 space-y-0.5">
                {list.slice(0, 4).map((task) => {
                  const tone = task.status === "DONE" ? "later" : dueTone(task.dueAt!);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTask(task.id);
                      }}
                      title={`Delivery at ${formatTime(task.dueAt!)}`}
                      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-xs ${DUE_TONE_CLASS[tone]} ${
                        task.status === "DONE" ? "line-through" : ""
                      }`}
                    >
                      {task.title}
                    </button>
                  );
                })}
                {list.length > 4 && <p className="px-1.5 text-xs text-ink-3">+{list.length - 4} more</p>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-3">
        Colored items are deliveries. Click a day to plan that week.
      </p>
    </div>
  );
}
