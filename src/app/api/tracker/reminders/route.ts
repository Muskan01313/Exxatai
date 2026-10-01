import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api";
import type { ReminderItem } from "@/types/tracker";

/** Your open deliveries that are overdue or due within the next week, across your workspaces. */
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof Response) {
    return auth;
  }
  const inAWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const tasks = await prisma.task.findMany({
    where: {
      userId: auth.userId,
      status: { not: "DONE" },
      dueAt: { not: null, lte: inAWeek },
      workspace: { members: { some: { userId: auth.userId } } },
    },
    orderBy: { dueAt: "asc" },
    take: 100,
    select: { id: true, workspaceId: true, title: true, dueAt: true, reminderMinutes: true },
  });

  const reminders: ReminderItem[] = tasks.map((t) => ({
    id: t.id,
    workspaceId: t.workspaceId,
    title: t.title,
    dueAt: t.dueAt!.toISOString(),
    reminderMinutes: t.reminderMinutes,
  }));
  return NextResponse.json({ reminders });
}
