export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export interface TrackerTask {
  id: string;
  workspaceId: string;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: TaskPriority;
  plannedDay: string | null;
  dueAt: string | null;
  reminderMinutes: number | null;
  completedAt: string | null;
  loggedSeconds: number;
}

export interface TimeEntryItem {
  id: string;
  taskId: string | null;
  taskTitle: string | null;
  description: string;
  startedAt: string;
  endedAt: string | null;
}

export interface ReminderItem {
  id: string;
  workspaceId: string;
  title: string;
  dueAt: string;
  reminderMinutes: number | null;
}

export const REMINDER_OPTIONS: { label: string; minutes: number | null }[] = [
  { label: "No reminder", minutes: null },
  { label: "At time of delivery", minutes: 0 },
  { label: "15 minutes before", minutes: 15 },
  { label: "1 hour before", minutes: 60 },
  { label: "3 hours before", minutes: 180 },
  { label: "1 day before", minutes: 1440 },
  { label: "2 days before", minutes: 2880 },
];
