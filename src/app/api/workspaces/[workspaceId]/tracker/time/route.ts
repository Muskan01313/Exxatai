import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAccess, jsonError } from "@/lib/api";
import { isoDateTime } from "@/lib/trackerSchemas";
import { isOwnTask, MAX_ENTRY_MS, serializeEntry, timeEntryInclude } from "@/lib/timeEntries";

type Params = { params: Promise<{ workspaceId: string }> };

/** Your time entries overlapping [from, to], plus whichever timer you have running. */
export async function GET(request: Request, { params }: Params) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceAccess(workspaceId);
  if (access instanceof Response) {
    return access;
  }
  const q = new URL(request.url).searchParams;
  const from = new Date(q.get("from") ?? "");
  const to = new Date(q.get("to") ?? "");
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return jsonError("Missing or invalid date range", 400);
  }

  const [entries, running] = await Promise.all([
    prisma.timeEntry.findMany({
      where: {
        userId: access.userId,
        workspaceId,
        startedAt: { lt: to },
        OR: [{ endedAt: { gt: from } }, { endedAt: null }],
      },
      orderBy: { startedAt: "asc" },
      include: timeEntryInclude,
    }),
    prisma.timeEntry.findFirst({ where: { userId: access.userId, endedAt: null }, include: timeEntryInclude }),
  ]);

  return NextResponse.json({
    entries: entries.map(serializeEntry),
    running: running ? { ...serializeEntry(running), workspaceId: running.workspaceId } : null,
  });
}

const startSchema = z.object({
  mode: z.literal("start"),
  description: z.string().max(500).optional(),
  taskId: z.string().uuid().nullable().optional(),
});

const manualSchema = z.object({
  mode: z.literal("manual"),
  description: z.string().max(500).optional(),
  taskId: z.string().uuid().nullable().optional(),
  startedAt: isoDateTime,
  endedAt: isoDateTime,
});

export async function POST(request: Request, { params }: Params) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceAccess(workspaceId);
  if (access instanceof Response) {
    return access;
  }

  const parsed = z.discriminatedUnion("mode", [startSchema, manualSchema]).safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid input", 400);
  }
  const d = parsed.data;

  if (d.taskId && !(await isOwnTask(d.taskId, access.userId, workspaceId))) {
    return jsonError("Unknown task", 400);
  }

  if (d.mode === "manual") {
    const startedAt = new Date(d.startedAt);
    const endedAt = new Date(d.endedAt);
    const length = endedAt.getTime() - startedAt.getTime();
    if (length <= 0) {
      return jsonError("The end time must be after the start time", 400);
    }
    if (length > MAX_ENTRY_MS) {
      return jsonError("A single entry can be at most 24 hours", 400);
    }
    const entry = await prisma.timeEntry.create({
      data: { userId: access.userId, workspaceId, taskId: d.taskId ?? null, description: d.description ?? "", startedAt, endedAt },
      include: timeEntryInclude,
    });
    return NextResponse.json({ entry: serializeEntry(entry) }, { status: 201 });
  }

  const now = new Date();
  const entry = await prisma.$transaction(async (tx) => {
    // Only one timer runs at a time: starting a new one stops the old one.
    await tx.timeEntry.updateMany({ where: { userId: access.userId, endedAt: null }, data: { endedAt: now } });
    return tx.timeEntry.create({
      data: { userId: access.userId, workspaceId, taskId: d.taskId ?? null, description: d.description ?? "", startedAt: now },
      include: timeEntryInclude,
    });
  });
  if (entry.taskId) {
    await prisma.task.updateMany({ where: { id: entry.taskId, status: "TODO" }, data: { status: "IN_PROGRESS" } });
  }
  return NextResponse.json({ entry: serializeEntry(entry) }, { status: 201 });
}
