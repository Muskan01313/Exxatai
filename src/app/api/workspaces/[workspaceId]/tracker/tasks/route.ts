import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceAccess, jsonError } from "@/lib/api";
import { DAY_PATTERN, loggedSecondsByTask, serializeTask } from "@/lib/tracker";
import { createTaskSchema } from "@/lib/trackerSchemas";

type Params = { params: Promise<{ workspaceId: string }> };

/**
 * Your tasks for a date range: planned on a day in [fromDay, toDay], or due in [fromTime, toTime),
 * plus open tasks with no day and no due date (the "No date" column).
 */
export async function GET(request: Request, { params }: Params) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceAccess(workspaceId);
  if (access instanceof Response) {
    return access;
  }

  const q = new URL(request.url).searchParams;
  const fromDay = q.get("fromDay") ?? "";
  const toDay = q.get("toDay") ?? "";
  const fromTime = new Date(q.get("fromTime") ?? "");
  const toTime = new Date(q.get("toTime") ?? "");
  if (!DAY_PATTERN.test(fromDay) || !DAY_PATTERN.test(toDay) || isNaN(fromTime.getTime()) || isNaN(toTime.getTime())) {
    return jsonError("Missing or invalid date range", 400);
  }

  const tasks = await prisma.task.findMany({
    where: {
      userId: access.userId,
      workspaceId,
      OR: [
        { plannedDay: { gte: fromDay, lte: toDay } },
        { dueAt: { gte: fromTime, lt: toTime } },
        { plannedDay: null, dueAt: null, status: { not: "DONE" } },
      ],
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
  });

  const logged = await loggedSecondsByTask(tasks.map((t) => t.id));
  return NextResponse.json({ tasks: tasks.map((t) => serializeTask(t, logged.get(t.id))) });
}

export async function POST(request: Request, { params }: Params) {
  const { workspaceId } = await params;
  const access = await requireWorkspaceAccess(workspaceId);
  if (access instanceof Response) {
    return access;
  }

  const parsed = createTaskSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Please give the work a title", 400);
  }
  const d = parsed.data;

  const task = await prisma.task.create({
    data: {
      userId: access.userId,
      workspaceId,
      title: d.title,
      notes: d.notes ?? "",
      status: d.status ?? "TODO",
      priority: d.priority ?? "MEDIUM",
      plannedDay: d.plannedDay ?? null,
      dueAt: d.dueAt ? new Date(d.dueAt) : null,
      reminderMinutes: d.dueAt ? (d.reminderMinutes === undefined ? 60 : d.reminderMinutes) : null,
      completedAt: d.status === "DONE" ? new Date() : null,
    },
  });

  return NextResponse.json({ task: serializeTask(task) }, { status: 201 });
}
