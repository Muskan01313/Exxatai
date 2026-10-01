// Date helpers for the tracker. Everything is in the viewer's own (browser) time zone.

const pad = (n: number) => String(n).padStart(2, "0");

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight at the start of a YYYY-MM-DD day. */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: string, days: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + days);
  return dayKey(d);
}

export function todayKey(): string {
  return dayKey(new Date());
}

/** Weeks start on Monday. */
export function startOfWeek(day: string): string {
  const d = parseDay(day);
  const offset = (d.getDay() + 6) % 7;
  return addDays(day, -offset);
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function startOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function addMonths(monthStart: string, months: number): string {
  const d = parseDay(monthStart);
  d.setMonth(d.getMonth() + months, 1);
  return dayKey(d);
}

/** The instants spanning whole local days fromDay..toDay (inclusive). */
export function dayRange(fromDay: string, toDay: string) {
  return { fromTime: parseDay(fromDay).toISOString(), toTime: parseDay(addDays(toDay, 1)).toISOString() };
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) {
    return `${m}m`;
  }
  return m === 0 ? `${h}h` : `${h}h ${pad(m)}m`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDayLabel(day: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric" }) {
  return parseDay(day).toLocaleDateString([], opts);
}

export function formatDue(iso: string): string {
  const date = new Date(iso);
  const day = dayKey(date);
  const today = todayKey();
  const label =
    day === today
      ? "Today"
      : day === addDays(today, 1)
        ? "Tomorrow"
        : day === addDays(today, -1)
          ? "Yesterday"
          : date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  return `${label} ${formatTime(iso)}`;
}

export type DueTone = "overdue" | "today" | "soon" | "later";

export function dueTone(iso: string, now = new Date()): DueTone {
  const due = new Date(iso);
  if (due.getTime() < now.getTime()) {
    return "overdue";
  }
  const day = dayKey(due);
  const today = dayKey(now);
  if (day === today) {
    return "today";
  }
  return day <= addDays(today, 2) ? "soon" : "later";
}

export const DUE_TONE_CLASS: Record<DueTone, string> = {
  overdue: "bg-[#fbe4e4] text-[#c4314b]",
  today: "bg-[#fbecdd] text-[#c4651d]",
  soon: "bg-[#fbf3db] text-[#9a6b00]",
  later: "bg-[#f1f1ef] text-ink-2",
};

/** Splits an ISO instant into local date and time input values. */
export function toInputs(iso: string | null): { date: string; time: string } {
  if (!iso) {
    return { date: "", time: "" };
  }
  const d = new Date(iso);
  return { date: dayKey(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

export function fromInputs(date: string, time: string): string | null {
  if (!date) {
    return null;
  }
  const [h, m] = (time || "17:00").split(":").map(Number);
  const d = parseDay(date);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
