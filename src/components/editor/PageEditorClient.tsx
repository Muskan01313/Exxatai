"use client";

import dynamic from "next/dynamic";

export const PageEditorClient = dynamic(
  () => import("./PageEditor").then((mod) => mod.PageEditor),
  {
    ssr: false,
    loading: () => <div className="mx-auto max-w-3xl px-16 py-12 text-sm text-zinc-400">Loading…</div>,
  },
);
