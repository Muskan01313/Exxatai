import { z } from "zod";
import { daySchema } from "@/lib/tracker";

export const isoDateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Expected a date and time");

export const taskFields = {
  title: z.string().trim().min(1).max(300),
  notes: z.string().max(10000),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  plannedDay: daySchema.nullable(),
  dueAt: isoDateTime.nullable(),
  reminderMinutes: z.number().int().min(0).max(60 * 24 * 14).nullable(),
};

export const createTaskSchema = z.object({
  title: taskFields.title,
  notes: taskFields.notes.optional(),
  status: taskFields.status.optional(),
  priority: taskFields.priority.optional(),
  plannedDay: taskFields.plannedDay.optional(),
  dueAt: taskFields.dueAt.optional(),
  reminderMinutes: taskFields.reminderMinutes.optional(),
});

export const updateTaskSchema = createTaskSchema.partial();
