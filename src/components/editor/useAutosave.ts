"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved";

export function useAutosave(pageId: string, initialVersion: number) {
  const versionRef = useRef(initialVersion);
  const pendingMeta = useRef<Record<string, unknown>>({});
  const pendingContent = useRef<unknown[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const conflictRef = useRef(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [conflict, setConflict] = useState(false);

  const flush = useCallback(
    (keepalive = false) => {
      const meta = pendingMeta.current;
      const content = pendingContent.current;
      pendingMeta.current = {};
      pendingContent.current = null;
      const hasMeta = Object.keys(meta).length > 0;
      if (!hasMeta && content === null) {
        return chain.current;
      }

      const send = (body: Record<string, unknown>) =>
        fetch(`/api/pages/${pageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          keepalive,
        });

      // Run saves one after another so each content save carries the latest version.
      chain.current = chain.current.then(async () => {
        setSaveState("saving");
        try {
          if (content !== null && !conflictRef.current) {
            const res = await send({ ...meta, content, baseVersion: versionRef.current });
            if (res.ok) {
              versionRef.current = (await res.json()).page.contentVersion;
            } else if (res.status === 409) {
              conflictRef.current = true;
              setConflict(true);
              if (hasMeta) {
                await send(meta);
              }
            }
          } else if (hasMeta) {
            await send(meta);
          }
        } finally {
          setSaveState("saved");
        }
      });
      return chain.current;
    },
    [pageId],
  );

  const schedule = useCallback(
    (change: { meta?: Record<string, unknown>; content?: unknown[] }) => {
      if (change.meta) {
        pendingMeta.current = { ...pendingMeta.current, ...change.meta };
      }
      if (change.content) {
        pendingContent.current = change.content;
      }
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => void flush(), 600);
    },
    [flush],
  );

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      void flush(true);
    };
  }, [flush]);

  return { schedule, saveState, conflict };
}
