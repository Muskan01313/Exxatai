import { Bell, Clock } from "lucide-react";
import { DUE_TONE_CLASS, dueTone, formatDue, formatDuration } from "./dates";
import type { TaskPriority, TaskStatus, TrackerTask } from "@/types/tracker";

export const STATUS_LABEL: Record<TaskStatus, string> = { TODO: "To do", IN_PROGRESS: "In progress", DONE: "Done" };
export const STATUS_CLASS: Record<TaskStatus, string> = {
  TODO: "bg-[#f1f1ef] text-ink-2",
  IN_PROGRESS: "bg-[#e7f3f8] text-[#1f6c9f]",
  DONE: "bg-[#edf3ec] text-[#448361]",
};
export const PRIORITY_LABEL: Record<TaskPriority, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };
export const PRIORITY_CLASS: Record<TaskPriority, string> = {
  LOW: "bg-[#f1f1ef] text-ink-2",
  MEDIUM: "bg-[#fbf3db] text-[#9a6b00]",
  HIGH: "bg-[#fbe4e4] text-[#c4314b]",
};

export function DueChip({ task }: { task: Pick<TrackerTask, "dueAt" | "reminderMinutes" | "status"> }) {
  if (!task.dueAt) {
    return null;
  }
  const tone = task.status === "DONE" ? "later" : dueTone(task.dueAt);
  return (
    <span
      title="Delivery"
      className={`inline-flex items-center gap-1 rounded px-1.5 py-px text-xs ${DUE_TONE_CLASS[tone]}`}
    >
      {task.reminderMinutes !== null && task.status !== "DONE" && <Bell size={11} />}
      {tone === "overdue" ? "Overdue · " : ""}
      {formatDue(task.dueAt)}
    </span>
  );
}

export function TaskMeta({ task }: { task: TrackerTask }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <DueChip task={task} />
      {task.priority !== "MEDIUM" && (
        <span className={`rounded px-1.5 py-px text-xs ${PRIORITY_CLASS[task.priority]}`}>
          {PRIORITY_LABEL[task.priority]}
        </span>
      )}
      {task.status === "IN_PROGRESS" && (
        <span className={`rounded px-1.5 py-px text-xs ${STATUS_CLASS.IN_PROGRESS}`}>In progress</span>
      )}
      {task.loggedSeconds >= 60 && (
        <span className="inline-flex items-center gap-1 text-xs text-ink-3">
          <Clock size={11} />
          {formatDuration(task.loggedSeconds)}
        </span>
      )}
    </div>
  );
}
