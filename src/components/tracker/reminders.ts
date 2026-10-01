import { dayKey } from "./dates";
import type { ReminderItem } from "@/types/tracker";

/** Opens the delivery in its week on the tracker. */
export function reminderHref(r: Pick<ReminderItem, "id" | "workspaceId" | "dueAt">): string {
  return `/w/${r.workspaceId}/tracker?view=week&day=${dayKey(new Date(r.dueAt))}&task=${r.id}`;
}

/** Pop-ups only go out for reminders that came due in the last 12 hours, so old ones don't pile up. */
const POPUP_WINDOW_MS = 12 * 60 * 60 * 1000;

export function reminderIsDue(r: ReminderItem, now: number): boolean {
  if (r.reminderMinutes === null) {
    return false;
  }
  const at = new Date(r.dueAt).getTime() - r.reminderMinutes * 60 * 1000;
  return at <= now && now - at <= POPUP_WINDOW_MS;
}

export function reminderKey(r: ReminderItem): string {
  return `reminded:${r.id}:${r.dueAt}:${r.reminderMinutes}`;
}

export type ReminderGroup = "Overdue" | "Today" | "Coming up";

export function groupReminders(reminders: ReminderItem[], now = new Date()) {
  const today = dayKey(now);
  const groups: Record<ReminderGroup, ReminderItem[]> = { Overdue: [], Today: [], "Coming up": [] };
  for (const r of reminders) {
    const due = new Date(r.dueAt);
    if (due.getTime() < now.getTime()) {
      groups.Overdue.push(r);
    } else if (dayKey(due) === today) {
      groups.Today.push(r);
    } else {
      groups["Coming up"].push(r);
    }
  }
  return groups;
}

/** The number on the bell: overdue, or due within a day. */
export function urgentCount(reminders: ReminderItem[], now = Date.now()): number {
  return reminders.filter((r) => new Date(r.dueAt).getTime() - now < 24 * 60 * 60 * 1000).length;
}
