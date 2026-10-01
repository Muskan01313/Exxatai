import { prisma } from "@/lib/prisma";
import type { TimeEntryItem } from "@/types/tracker";

export const timeEntryInclude = { task: { select: { title: true } } } as const;

export function serializeEntry(entry: {
  id: string;
  taskId: string | null;
  description: string;
  startedAt: Date;
  endedAt: Date | null;
  task: { title: string } | null;
}): TimeEntryItem {
  return {
    id: entry.id,
    taskId: entry.taskId,
    taskTitle: entry.task?.title ?? null,
    description: entry.description,
    startedAt: entry.startedAt.toISOString(),
    endedAt: entry.endedAt?.toISOString() ?? null,
  };
}

/** A task can only be linked if it's one of your own tasks in this workspace. */
export async function isOwnTask(taskId: string, userId: string, workspaceId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { userId: true, workspaceId: true } });
  return task?.userId === userId && task.workspaceId === workspaceId;
}

export const MAX_ENTRY_MS = 24 * 60 * 60 * 1000;
