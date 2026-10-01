import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser, jsonError } from "@/lib/api";
import { loggedSecondsByTask, serializeTask } from "@/lib/tracker";
import { updateTaskSchema } from "@/lib/trackerSchemas";

type Params = { params: Promise<{ taskId: string }> };

async function ownTask(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  return task && task.userId === userId ? task : null;
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth instanceof Response) {
    return auth;
  }
  const { taskId } = await params;
  const existing = await ownTask(taskId, auth.userId);
  if (!existing) {
    return jsonError("Not found", 404);
  }

  const parsed = updateTaskSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid input", 400);
  }
  const d = parsed.data;

  const data: Prisma.TaskUpdateInput = {
    ...(d.title !== undefined ? { title: d.title } : {}),
    ...(d.notes !== undefined ? { notes: d.notes } : {}),
    ...(d.priority !== undefined ? { priority: d.priority } : {}),
    ...(d.plannedDay !== undefined ? { plannedDay: d.plannedDay } : {}),
    ...(d.reminderMinutes !== undefined ? { reminderMinutes: d.reminderMinutes } : {}),
  };
  if (d.dueAt !== undefined) {
    data.dueAt = d.dueAt ? new Date(d.dueAt) : null;
    if (!d.dueAt) {
      data.reminderMinutes = null;
    } else if (existing.dueAt === null && d.reminderMinutes === undefined) {
      data.reminderMinutes = 60;
    }
  }
  if (d.status !== undefined) {
    data.status = d.status;
    data.completedAt = d.status === "DONE" ? (existing.completedAt ?? new Date()) : null;
  }

  const task = await prisma.task.update({ where: { id: taskId }, data });
  const logged = await loggedSecondsByTask([taskId]);
  return NextResponse.json({ task: serializeTask(task, logged.get(taskId)) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (auth instanceof Response) {
    return auth;
  }
  const { taskId } = await params;
  const result = await prisma.task.deleteMany({ where: { id: taskId, userId: auth.userId } });
  if (result.count === 0) {
    return jsonError("Not found", 404);
  }
  return NextResponse.json({ ok: true });
}
