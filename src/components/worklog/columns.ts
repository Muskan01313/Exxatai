import type { WorkLogFields, WorkLogLists, WorkLogRow } from "@/types/worklog";

export type ListKey = Exclude<keyof WorkLogLists, "categories">;

export interface Column {
  key: keyof WorkLogFields;
  label: string;
  kind: "text" | "select" | "number" | "date" | "long";
  /** Which dropdown list feeds a select column. */
  list?: ListKey | "mainCategories" | "subCategories";
  width: number;
}

// Same order as the team's old Google Sheets tracker.
export const COLUMNS: Column[] = [
  { key: "ticketNumber", label: "Ticket number", kind: "text", width: 140 },
  { key: "stubName", label: "Stub name", kind: "select", list: "stubNames", width: 220 },
  { key: "domain", label: "Domain", kind: "select", list: "domains", width: 140 },
  { key: "analyst", label: "Analyst", kind: "select", list: "analysts", width: 160 },
  { key: "workType", label: "New/BAU", kind: "select", list: "workTypes", width: 110 },
  { key: "mainCategory", label: "Main category", kind: "select", list: "mainCategories", width: 160 },
  { key: "subCategory", label: "Sub category", kind: "select", list: "subCategories", width: 160 },
  { key: "formComplexity", label: "Form complexity", kind: "select", list: "complexities", width: 150 },
  { key: "completedCount", label: "Completed count", kind: "number", width: 120 },
  { key: "usedByDate", label: "Used by date", kind: "date", width: 150 },
  { key: "workDate", label: "Today's date", kind: "date", width: 150 },
  { key: "comments", label: "Comments", kind: "long", width: 240 },
  { key: "vstsNumber", label: "VSTS number", kind: "text", width: 130 },
  { key: "status", label: "Status", kind: "select", list: "statuses", width: 140 },
];

export function optionsFor(column: Column, lists: WorkLogLists, row: Pick<WorkLogRow, "mainCategory">): string[] {
  if (column.list === "mainCategories") {
    return lists.categories.map((c) => c.name);
  }
  if (column.list === "subCategories") {
    const main = lists.categories.find((c) => c.name === row.mainCategory);
    return main ? main.subs : [...new Set(lists.categories.flatMap((c) => c.subs))];
  }
  return column.list ? lists[column.list] : [];
}

/** Total time as h:mm:ss, the way AHT is reported. */
export function formatAht(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Parses "1:05:00", "65:00" (m:ss) or "45" (minutes) into seconds. */
export function parseAht(input: string): number | null {
  const parts = input.trim().split(":").map((p) => p.trim());
  if (parts.some((p) => !/^\d+$/.test(p)) || parts.length > 3) {
    return null;
  }
  const n = parts.map(Number);
  if (n.length === 1) {
    return n[0] * 60;
  }
  if (n.length === 2) {
    return n[0] * 60 + n[1];
  }
  return n[0] * 3600 + n[1] * 60 + n[2];
}

export function rowSeconds(row: Pick<WorkLogRow, "timerSeconds" | "timerStartedAt">, now: number) {
  return row.timerSeconds + (row.timerStartedAt ? Math.max(0, (now - new Date(row.timerStartedAt).getTime()) / 1000) : 0);
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(rows: WorkLogRow[]): string {
  const header = ["Recorded time", ...COLUMNS.map((c) => c.label), "Total AHT", "Logged by", "Submitted at"];
  const lines = rows.map((r) => [
    formatAht(r.timerSeconds),
    ...COLUMNS.map((c) => String(r[c.key] ?? "")),
    formatAht(r.timerSeconds),
    r.userName,
    r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "",
  ]);
  return [header, ...lines].map((line) => line.map(csvCell).join(",")).join("\n");
}
