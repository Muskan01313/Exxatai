"use client";

import dynamic from "next/dynamic";

// BlockNote touches `window` while creating the editor, so it can only render in the browser.
export const PageEditorClient = dynamic(() => import("./PageEditor").then((mod) => mod.PageEditor), {
  ssr: false,
  loading: () => <div className="h-11" />,
});
