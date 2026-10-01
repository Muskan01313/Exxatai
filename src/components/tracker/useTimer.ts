"use client";

import { useCallback, useEffect, useState } from "react";
import type { TimeEntryItem } from "@/types/tracker";

export type RunningEntry = TimeEntryItem & { workspaceId: string };

/** The current time, refreshed every `intervalMs` while `active`. */
export function useNow(active: boolean, intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

/**
 * The one timer you can have running (across all workspaces). `version` goes up whenever
 * time entries change so views showing entries know to reload.
 */
export function useTimer(workspaceId: string, onError: (message: string) => void) {
  const [running, setRunning] = useState<RunningEntry | null>(null);
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let active = true;
    const now = new Date().toISOString();
    void fetch(`/api/workspaces/${workspaceId}/tracker/time?from=${now}&to=${now}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) {
          setRunning(data.running);
        }
      });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  const start = useCallback(
    async (input: { description?: string; taskId?: string | null }) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/tracker/time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "start", ...input }),
      });
      if (!res.ok) {
        onError("Couldn't start the timer.");
        return;
      }
      const { entry } = (await res.json()) as { entry: TimeEntryItem };
      setRunning({ ...entry, workspaceId });
      bump();
    },
    [workspaceId, onError, bump],
  );

  const stop = useCallback(async () => {
    if (!running) {
      return;
    }
    const res = await fetch(`/api/tracker/time/${running.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stop: true }),
    });
    if (!res.ok) {
      onError("Couldn't stop the timer.");
      return;
    }
    setRunning(null);
    bump();
  }, [running, onError, bump]);

  /** Call after editing or deleting entries directly. */
  const entriesChanged = useCallback(
    (removedId?: string) => {
      if (removedId && running?.id === removedId) {
        setRunning(null);
      }
      bump();
    },
    [running, bump],
  );

  return { running, version, start, stop, entriesChanged };
}
