"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkLogFields, WorkLogRow } from "@/types/worklog";

type Patch = Partial<WorkLogFields> & { timerSeconds?: number };
export type SaveState = "saved" | "saving" | "error";

const SAVE_DELAY_MS = 600;

/**
 * Your draft rows. Edits show at once and are saved to the server shortly after you stop
 * typing (and right away if you leave the page), so a reload never loses work.
 */
export function useWorkLogDrafts(workspaceId: string, onError: (message: string) => void) {
  const [rows, setRows] = useState<WorkLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const pending = useRef(new Map<string, Patch>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspaceId}/worklog`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { entries: WorkLogRow[] };
      setRows(data.entries);
    } else {
      onError("Couldn't load your work log.");
    }
    setLoading(false);
  }, [workspaceId, onError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void load();
  }, [load]);

  const send = useCallback(async (id: string, body: object, keepalive = false) => {
    inFlight.current += 1;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/worklog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive,
      });
      if (!res.ok) {
        throw new Error();
      }
      const { entry } = (await res.json()) as { entry: WorkLogRow };
      return entry;
    } catch {
      setSaveState("error");
      return null;
    } finally {
      inFlight.current -= 1;
      if (inFlight.current === 0 && pending.current.size === 0) {
        setSaveState((s) => (s === "error" ? s : "saved"));
      }
    }
  }, []);

  /** Sends every queued edit now. */
  const flush = useCallback(
    async (keepalive = false) => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      const batch = [...pending.current];
      pending.current.clear();
      await Promise.all(
        batch.map(async ([id, patch]) => {
          if (!(await send(id, patch, keepalive))) {
            // Keep the edit queued (under anything typed since) so the next save retries it.
            pending.current.set(id, { ...patch, ...pending.current.get(id) });
          }
        }),
      );
    },
    [send],
  );

  // Save right away when the tab is hidden or closed.
  useEffect(() => {
    const onHide = () => void flush(true);
    const onVisibility = () => document.visibilityState === "hidden" && onHide();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      onHide();
    };
  }, [flush]);

  const update = useCallback(
    (id: string, patch: Patch) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      pending.current.set(id, { ...pending.current.get(id), ...patch });
      setSaveState("saving");
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  const create = useCallback(
    async (fields: Partial<WorkLogFields>) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/worklog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        onError("Couldn't add a row.");
        return null;
      }
      const { entry } = (await res.json()) as { entry: WorkLogRow };
      setRows((prev) => [...prev, entry]);
      return entry;
    },
    [workspaceId, onError],
  );

  const remove = useCallback(
    async (id: string) => {
      pending.current.delete(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      const res = await fetch(`/api/worklog/${id}`, { method: "DELETE" });
      if (!res.ok) {
        onError("Couldn't delete the row.");
        await load();
      }
    },
    [onError, load],
  );

  const setTimer = useCallback(
    async (id: string, action: "start" | "pause") => {
      await flush();
      const entry = await send(id, { timer: action });
      if (!entry) {
        onError(action === "start" ? "Couldn't start the timer." : "Couldn't pause the timer.");
        return;
      }
      // Starting one timer pauses the others on the server; reload to show that.
      if (action === "start") {
        await load();
      } else {
        setRows((prev) => prev.map((r) => (r.id === id ? entry : r)));
      }
    },
    [flush, send, load, onError],
  );

  const submit = useCallback(
    async (ids: string[]) => {
      await flush();
      const res = await fetch(`/api/workspaces/${workspaceId}/worklog/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        onError("Couldn't submit. Your rows are still saved as drafts.");
        return 0;
      }
      const { submitted } = (await res.json()) as { submitted: string[] };
      setRows((prev) => prev.filter((r) => !submitted.includes(r.id)));
      return submitted.length;
    },
    [workspaceId, flush, onError],
  );

  return { rows, loading, saveState, update, create, remove, setTimer, submit, reload: load };
}
