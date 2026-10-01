"use client";

import { useCallback, useEffect, useState } from "react";
import { dayRange } from "./dates";
import type { TrackerTask } from "@/types/tracker";

export type TaskInput = Partial<
  Pick<TrackerTask, "title" | "notes" | "status" | "priority" | "plannedDay" | "dueAt" | "reminderMinutes">
>;

export function useTrackerTasks(workspaceId: string, fromDay: string, toDay: string, onChange?: () => void) {
  const [tasks, setTasks] = useState<TrackerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { fromTime, toTime } = dayRange(fromDay, toDay);
    const params = new URLSearchParams({ fromDay, toDay, fromTime, toTime });
    const res = await fetch(`/api/workspaces/${workspaceId}/tracker/tasks?${params}`, { cache: "no-store" });
    if (res.ok) {
      setTasks((await res.json()).tasks);
      setError(null);
    } else {
      setError("Couldn't load your tasks. Refresh the page to try again.");
    }
    setLoading(false);
  }, [workspaceId, fromDay, toDay]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (active) {
        await load();
      }
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const create = useCallback(
    async (input: TaskInput & { title: string }) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/tracker/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't add the task.");
        return null;
      }
      const { task } = (await res.json()) as { task: TrackerTask };
      setTasks((prev) => [...prev, task]);
      onChange?.();
      return task;
    },
    [workspaceId, onChange],
  );

  const update = useCallback(
    async (id: string, patch: TaskInput) => {
      let previous: TrackerTask | undefined;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== id) {
            return t;
          }
          previous = t;
          return { ...t, ...patch };
        }),
      );
      const res = await fetch(`/api/tracker/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        if (previous) {
          const restore = previous;
          setTasks((prev) => prev.map((t) => (t.id === id ? restore : t)));
        }
        setError("Couldn't save that change.");
        return;
      }
      const { task } = (await res.json()) as { task: TrackerTask };
      setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
      onChange?.();
    },
    [onChange],
  );

  const remove = useCallback(
    async (id: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      await fetch(`/api/tracker/tasks/${id}`, { method: "DELETE" });
      onChange?.();
    },
    [onChange],
  );

  return { tasks, loading, error, setError, reload: load, create, update, remove };
}
