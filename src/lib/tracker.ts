import { z } from "zod";
import type { Task } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { TrackerTask } from "@/types/tracker";

export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const daySchema = z.string().regex(DAY_PATTERN, "Expected a date like 2026-10-01");

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date (YYYY-MM-DD) that an instant falls on in the given time zone. */
export function localDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function entrySeconds(entry: { startedAt: Date; endedAt: Date | null }, now = new Date()): number {
  const end = entry.endedAt ?? now;
  return Math.max(0, Math.round((end.getTime() - entry.startedAt.getTime()) / 1000));
}

export function serializeTask(task: Task, loggedSeconds = 0): TrackerTask {
  return {
    id: task.id,
    workspaceId: task.workspaceId,
    title: task.title,
    notes: task.notes,
    status: task.status,
    priority: task.priority,
    plannedDay: task.plannedDay,
    dueAt: task.dueAt?.toISOString() ?? null,
    reminderMinutes: task.reminderMinutes,
    completedAt: task.completedAt?.toISOString() ?? null,
    loggedSeconds,
  };
}

/** Finished time per task. A running timer isn't counted; the UI adds it live. */
export async function loggedSecondsByTask(taskIds: string[]): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (taskIds.length === 0) {
    return totals;
  }
  const entries = await prisma.timeEntry.findMany({
    where: { taskId: { in: taskIds }, endedAt: { not: null } },
    select: { taskId: true, startedAt: true, endedAt: true },
  });
  const now = new Date();
  for (const e of entries) {
    if (e.taskId) {
      totals.set(e.taskId, (totals.get(e.taskId) ?? 0) + entrySeconds(e, now));
    }
  }
  return totals;
}
