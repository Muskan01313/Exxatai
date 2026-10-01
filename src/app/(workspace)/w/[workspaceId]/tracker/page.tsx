import type { Metadata } from "next";
import { TrackerView, type TrackerTab } from "@/components/tracker/TrackerView";

export const metadata: Metadata = { title: "My tracker" };

const TABS: TrackerTab[] = ["week", "time", "calendar"];

export default async function TrackerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { view, day, task } = await searchParams;
  const tab = TABS.find((t) => t === view) ?? "week";
  const initialDay = typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  const initialTaskId = typeof task === "string" ? task : null;

  // A new key per link means following a reminder link while already here opens it fresh.
  return (
    <TrackerView
      key={`${tab}:${initialDay}:${initialTaskId}`}
      initialTab={tab}
      initialDay={initialDay}
      initialTaskId={initialTaskId}
    />
  );
}
