import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, jsonError } from "@/lib/api";
import { isoDateTime } from "@/lib/trackerSchemas";
import { isOwnTask, MAX_ENTRY_MS, serializeEntry, timeEntryInclude } from "@/lib/timeEntries";

type Params = { params: Promise<{ entryId: string }> };

const updateSchema = z.object({
  stop: z.boolean().optional(),
  description: z.string().max(500).optional(),
  taskId: z.string().uuid().nullable().optional(),
  startedAt: isoDateTime.optional(),
  endedAt: isoDateTime.optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth instanceof Response) {
    return auth;
  }
  const { entryId } = await params;
  const existing = await prisma.timeEntry.findUnique({ where: { id: entryId } });
  if (!existing || existing.userId !== auth.userId) {
    return jsonError("Not found", 404);
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid input", 400);
  }
  const d = parsed.data;

  if (d.taskId && !(await isOwnTask(d.taskId, auth.userId, existing.workspaceId))) {
    return jsonError("Unknown task", 400);
  }

  const startedAt = d.startedAt ? new Date(d.startedAt) : existing.startedAt;
  const endedAt = d.stop ? new Date() : d.endedAt ? new Date(d.endedAt) : existing.endedAt;
  if (endedAt) {
    const length = endedAt.getTime() - startedAt.getTime();
    if (length <= 0) {
      return jsonError("The end time must be after the start time", 400);
    }
    if (length > MAX_ENTRY_MS && !d.stop) {
      return jsonError("A single entry can be at most 24 hours", 400);
    }
  }

  const entry = await prisma.timeEntry.update({
    where: { id: entryId },
    data: {
      startedAt,
      endedAt,
      ...(d.description !== undefined ? { description: d.description } : {}),
      ...(d.taskId !== undefined ? { taskId: d.taskId } : {}),
    },
    include: timeEntryInclude,
  });
  return NextResponse.json({ entry: serializeEntry(entry) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth instanceof Response) {
    return auth;
  }
  const { entryId } = await params;
  const result = await prisma.timeEntry.deleteMany({ where: { id: entryId, userId: auth.userId } });
  if (result.count === 0) {
    return jsonError("Not found", 404);
  }
  return NextResponse.json({ ok: true });
}
