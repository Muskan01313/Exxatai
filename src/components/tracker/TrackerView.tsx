"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Lock, Settings2, Square, Timer } from "lucide-react";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";
import { addDays, addMonths, formatClock, formatDuration, parseDay, startOfMonth, startOfWeek, todayKey } from "./dates";
import { useTrackerTasks } from "./useTrackerTasks";
import { useNow, useTimer } from "./useTimer";
import { WeekBoard, weekLabel } from "./WeekBoard";
import { TaskEditor } from "./TaskEditor";
import { TimeTracker } from "./TimeTracker";
import { MonthCalendar, monthGrid } from "./MonthCalendar";
import { TrackerSettings } from "./TrackerSettings";

export type TrackerTab = "week" | "time" | "calendar";

const TABS: { id: TrackerTab; label: string; icon: typeof Timer }[] = [
  { id: "week", label: "Week", icon: CalendarRange },
  { id: "time", label: "Time", icon: Timer },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
];

export function TrackerView({
  initialTab,
  initialDay,
  initialTaskId,
}: {
  initialTab: TrackerTab;
  initialDay: string | null;
  initialTaskId: string | null;
}) {
  const ws = useWorkspace();
  const [tab, setTab] = useState<TrackerTab>(initialTab);
  const [day, setDay] = useState(() => initialDay ?? todayKey());
  const [openTaskId, setOpenTaskId] = useState<string | null>(initialTaskId);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const weekStart = startOfWeek(day);
  const monthStart = startOfMonth(day);
  const range = tab === "calendar" ? monthGrid(monthStart) : { first: weekStart, last: addDays(weekStart, 6) };

  const { refreshReminders, toast } = ws;
  const tasks = useTrackerTasks(ws.workspaceId, range.first, range.last, refreshReminders);
  const timer = useTimer(ws.workspaceId, toast);
  const now = useNow(timer.running !== null);
  const { reload } = tasks;

  // Keep the address bar in step so a refresh or a shared bookmark opens the same view.
  useEffect(() => {
    const params = new URLSearchParams({ view: tab, day });
    if (openTaskId) {
      params.set("task", openTaskId);
    }
    window.history.replaceState(null, "", `?${params}`);
  }, [tab, day, openTaskId]);

  const startTimer = useCallback(
    async (input: { description?: string; taskId?: string | null }) => {
      await timer.start(input);
      if (input.taskId) {
        await reload();
      }
    },
    [timer, reload],
  );

  const stopTimer = useCallback(async () => {
    const hadTask = timer.running?.taskId;
    await timer.stop();
    if (hadTask) {
      await reload();
    }
  }, [timer, reload]);

  const closeEditor = useCallback(() => setOpenTaskId(null), []);
  const openTask = tasks.tasks.find((t) => t.id === openTaskId) ?? null;

  function move(direction: -1 | 1) {
    setDay((d) => (tab === "calendar" ? addMonths(startOfMonth(d), direction) : addDays(d, 7 * direction)));
  }

  const runningSeconds = timer.running ? (now - new Date(timer.running.startedAt).getTime()) / 1000 : 0;
  const weekTasks = tasks.tasks.filter((t) => t.plannedDay || t.dueAt);
  const doneThisWeek = weekTasks.filter((t) => t.status === "DONE").length;

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-20 flex h-11 items-center gap-2 bg-white px-3 max-md:pl-11">
        <span className="flex items-center gap-1.5 text-sm text-ink">
          <span>✅</span> My tracker
        </span>
        <span className="flex items-center gap-1 text-xs text-ink-3" title="Your tracker is private to you">
          <Lock size={12} /> Private
        </span>
        <div className="ml-auto flex items-center gap-1">
          {timer.running && (
            <button
              type="button"
              onClick={() => void stopTimer()}
              title="Stop timer"
              className="flex h-7 items-center gap-1.5 rounded-md bg-[#fbe4e4] px-2 text-xs font-medium text-[#c4314b] hover:bg-[#f8d4d4]"
            >
              <Square size={10} fill="currentColor" />
              <span className="font-mono tabular-nums">{formatClock(runningSeconds)}</span>
              <span className="max-w-[140px] truncate max-sm:hidden">
                {timer.running.description || timer.running.taskTitle || "Timer"}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-sm text-ink-2 hover:bg-hover"
          >
            <Settings2 size={15} />
            <span className="max-sm:hidden">Reminders &amp; calendar</span>
          </button>
        </div>
      </div>

      <div className="px-4 pt-10 sm:px-12">
        <div className="mb-1 text-[54px] leading-none">✅</div>
        <h1 className="mt-3 text-[32px] leading-tight font-bold sm:text-[40px]">My tracker</h1>
        <p className="mt-1 text-sm text-ink-2">
          Plan the week, track your time and never miss a delivery. Only you can see this.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 sm:px-12">
        <div className="flex" role="tablist">
          {TABS.map(({ id, label, icon: Icon }) => (
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
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1 pb-1">
          <span className="mr-2 text-sm font-medium" data-testid="range-label">
            {tab === "calendar"
              ? parseDay(monthStart).toLocaleDateString([], { month: "long", year: "numeric" })
              : weekLabel(weekStart)}
          </span>
          <button type="button" onClick={() => move(-1)} title="Previous" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-2 hover:bg-hover">
            <ChevronLeft size={16} />
          </button>
          <button type="button" onClick={() => setDay(todayKey())} className="h-7 rounded-md px-2 text-sm text-ink-2 hover:bg-hover">
            Today
          </button>
          <button type="button" onClick={() => move(1)} title="Next" className="flex h-7 w-7 items-center justify-center rounded-md text-ink-2 hover:bg-hover">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {tasks.error && (
        <div className="mx-4 mt-3 flex items-center justify-between rounded-md bg-[#fbe4e4] px-3 py-2 text-sm text-[#c4314b] sm:mx-12">
          {tasks.error}
          <button type="button" onClick={() => tasks.setError(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="pt-4">
        {tab === "week" && (
          <>
            <p className="px-4 pb-3 text-xs text-ink-3 sm:px-12">
              {weekTasks.length === 0
                ? "Add the work you've been given this week. Drag cards between days to re-plan."
                : `${doneThisWeek} of ${weekTasks.length} done · ${formatDuration(
                    weekTasks.reduce((sum, t) => sum + t.loggedSeconds, 0),
                  )} logged on these tasks`}
            </p>
            <WeekBoard
              weekStart={weekStart}
              tasks={tasks.tasks}
              loading={tasks.loading}
              onOpen={setOpenTaskId}
              onCreate={tasks.create}
              onUpdate={tasks.update}
            />
          </>
        )}
        {tab === "time" && (
          <TimeTracker
            workspaceId={ws.workspaceId}
            weekStart={weekStart}
            selectedDay={day}
            onSelectDay={setDay}
            tasks={tasks.tasks}
            running={timer.running}
            version={timer.version}
            now={now}
            onStart={startTimer}
            onStop={stopTimer}
            onEntriesChanged={(removedId) => {
              timer.entriesChanged(removedId);
              void reload();
            }}
            onOpenTask={setOpenTaskId}
          />
        )}
        {tab === "calendar" && (
          <MonthCalendar
            workspaceId={ws.workspaceId}
            monthStart={monthStart}
            tasks={tasks.tasks}
            version={timer.version}
            onOpenTask={setOpenTaskId}
            onOpenDay={(d) => {
              setDay(d);
              setTab("week");
            }}
          />
        )}
      </div>

      {openTask && (
        <TaskEditor
          key={openTask.id}
          task={openTask}
          running={timer.running}
          now={now}
          onUpdate={(patch) => tasks.update(openTask.id, patch)}
          onDelete={() => {
            if (window.confirm(`Delete "${openTask.title}"? Its logged time is kept but no longer linked.`)) {
              setOpenTaskId(null);
              void tasks.remove(openTask.id);
            }
          }}
          onStartTimer={() => void startTimer({ taskId: openTask.id })}
          onStopTimer={() => void stopTimer()}
          onClose={closeEditor}
        />
      )}
      {settingsOpen && <TrackerSettings onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
