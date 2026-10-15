import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAccess, jsonError } from "@/lib/api";
import { liveSeconds } from "@/lib/worklog";

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

/** Submits your drafts: their timers stop and they move to the submitted history. */
export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceAccess(workspaceId);
  if (access instanceof Response) {
    return access;
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid input", 400);
  }

  const now = new Date();
  const submitted = await prisma.$transaction(async (tx) => {
    const drafts = await tx.workLogEntry.findMany({
      where: { id: { in: parsed.data.ids }, workspaceId, userId: access.userId, submittedAt: null },
    });
    for (const d of drafts) {
      await tx.workLogEntry.update({
        where: { id: d.id },
        data: { timerSeconds: liveSeconds(d, now), timerStartedAt: null, submittedAt: now },
      });
    }
    return drafts.map((d) => d.id);
  });
  return NextResponse.json({ submitted });
}
