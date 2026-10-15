import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, jsonError } from "@/lib/api";
import { liveSeconds, serializeWorkLog, updateWorkLogSchema, workLogInclude } from "@/lib/worklog";

type Params = { params: Promise<{ entryId: string }> };

async function ownEntry(entryId: string, userId: string) {
  const entry = await prisma.workLogEntry.findUnique({ where: { id: entryId } });
  return entry && entry.userId === userId ? entry : null;
}

/** Edit your own row. `{ reopen: true }` moves a submitted row back to your drafts. */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth instanceof Response) {
    return auth;
  }
  const { entryId } = await params;
  const existing = await ownEntry(entryId, auth.userId);
  if (!existing) {
    return jsonError("Not found", 404);
  }

  const body = await request.json().catch(() => null);
  if (body && body.reopen === true) {
    const entry = await prisma.workLogEntry.update({
      where: { id: entryId },
      data: { submittedAt: null },
      include: workLogInclude,
    });
    return NextResponse.json({ entry: serializeWorkLog(entry) });
  }

  const parsed = updateWorkLogSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid input", 400);
  }
  if (existing.submittedAt) {
    return jsonError("This row is submitted. Move it back to drafts to edit it.", 409);
  }
  const { timer, timerSeconds, ...fields } = parsed.data;
  const now = new Date();

  const entry = await prisma.$transaction(async (tx) => {
    let timerData = {};
    if (timer === "start" && !existing.timerStartedAt) {
      // One timer at a time: starting this row pauses any other running row.
      const others = await tx.workLogEntry.findMany({
        where: { userId: auth.userId, timerStartedAt: { not: null }, id: { not: entryId } },
      });
      for (const o of others) {
        await tx.workLogEntry.update({
          where: { id: o.id },
          data: { timerSeconds: liveSeconds(o, now), timerStartedAt: null },
        });
      }
      timerData = { timerStartedAt: now };
    } else if (timer === "pause" && existing.timerStartedAt) {
      timerData = { timerSeconds: liveSeconds(existing, now), timerStartedAt: null };
    } else if (timerSeconds !== undefined) {
      // Restart a running stretch from now so the new total isn't double counted.
      timerData = { timerSeconds, timerStartedAt: existing.timerStartedAt ? now : null };
    }
    return tx.workLogEntry.update({
      where: { id: entryId },
      data: { ...fields, ...timerData },
      include: workLogInclude,
    });
  });
  return NextResponse.json({ entry: serializeWorkLog(entry) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth instanceof Response) {
    return auth;
  }
  const { entryId } = await params;
  const result = await prisma.workLogEntry.deleteMany({ where: { id: entryId, userId: auth.userId } });
  if (result.count === 0) {
    return jsonError("Not found", 404);
  }
  return NextResponse.json({ ok: true });
}
