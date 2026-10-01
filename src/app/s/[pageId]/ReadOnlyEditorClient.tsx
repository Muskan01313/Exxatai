"use client";

import dynamic from "next/dynamic";

export const ReadOnlyEditorClient = dynamic(
  () => import("@/components/editor/ReadOnlyEditor").then((mod) => mod.ReadOnlyEditor),
  { ssr: false },
);
