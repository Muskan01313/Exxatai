import { z } from "zod";
import type { WorkLogEntry } from "@/generated/prisma/client";
import { daySchema } from "@/lib/tracker";
import { DEFAULT_WORKLOG_LISTS, type WorkLogLists, type WorkLogRow } from "@/types/worklog";

const text = (max: number) => z.string().trim().max(max);

export const workLogFields = {
  ticketNumber: text(100),
  stubName: text(200),
  domain: text(200),
  analyst: text(200),
  workType: text(100),
  mainCategory: text(200),
  subCategory: text(200),
  formComplexity: text(100),
  completedCount: z.number().int().min(0).max(1_000_000).nullable(),
  usedByDate: daySchema.nullable(),
  workDate: daySchema,
  comments: z.string().max(5000),
  vstsNumber: text(100),
  status: text(100),
};

export const createWorkLogSchema = z.object(workLogFields).partial();
export const updateWorkLogSchema = z
  .object({
    ...workLogFields,
    // Set the timer total by hand, in seconds (only while it isn't running).
    timerSeconds: z.number().int().min(0).max(7 * 24 * 3600),
    timer: z.enum(["start", "pause"]),
  })
  .partial();

const list = z.array(z.string().trim().min(1).max(200)).max(500);
export const listsSchema = z.object({
  stubNames: list,
  domains: list,
  analysts: list,
  workTypes: list,
  categories: z.array(z.object({ name: z.string().trim().min(1).max(200), subs: list })).max(500),
  complexities: list,
  statuses: list,
});

/** Stored lists merged over the defaults, so older or partial data still loads. */
export function readLists(stored: unknown): WorkLogLists {
  const parsed = listsSchema.partial().safeParse(stored);
  return { ...DEFAULT_WORKLOG_LISTS, ...(parsed.success ? parsed.data : {}) };
}

/** Timer seconds including the stretch that's running right now. */
export function liveSeconds(entry: { timerSeconds: number; timerStartedAt: Date | null }, now = new Date()) {
  const running = entry.timerStartedAt ? Math.max(0, Math.floor((now.getTime() - entry.timerStartedAt.getTime()) / 1000)) : 0;
  return entry.timerSeconds + running;
}

export const workLogInclude = { user: { select: { name: true } } } as const;

export function serializeWorkLog(entry: WorkLogEntry & { user: { name: string } }): WorkLogRow {
  return {
    id: entry.id,
    userId: entry.userId,
    userName: entry.user.name,
    ticketNumber: entry.ticketNumber,
    stubName: entry.stubName,
    domain: entry.domain,
    analyst: entry.analyst,
    workType: entry.workType,
    mainCategory: entry.mainCategory,
    subCategory: entry.subCategory,
    formComplexity: entry.formComplexity,
    completedCount: entry.completedCount,
    usedByDate: entry.usedByDate,
    workDate: entry.workDate,
    comments: entry.comments,
    vstsNumber: entry.vstsNumber,
    status: entry.status,
    timerSeconds: entry.timerSeconds,
    timerStartedAt: entry.timerStartedAt?.toISOString() ?? null,
    submittedAt: entry.submittedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
  };
}
