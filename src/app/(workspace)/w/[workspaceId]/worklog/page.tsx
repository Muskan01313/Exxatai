import type { Metadata } from "next";
import { WorkLogView } from "@/components/worklog/WorkLogView";

export const metadata: Metadata = { title: "Work log" };

export default async function WorkLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { view } = await searchParams;
  return <WorkLogView initialTab={view === "submitted" ? "submitted" : "drafts"} />;
}
