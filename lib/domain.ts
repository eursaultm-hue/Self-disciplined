export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "OVERDUE" | "SKIPPED" | "BLOCKED" | "CANCELLED";
export type PriorityTier = "MUST" | "SHOULD" | "COULD";
export type Goal = { id: string; title: string; priority: number; targetDate?: string };
export type Course = { id: string; goalId?: string; title: string; priority: number; weeklyTargetMinutes: number };
export type Task = { id: string; title: string; courseId?: string; goalId?: string; priorityTier: PriorityTier; status: TaskStatus; plannedDate?: string; dueDate?: string; plannedMinutes: number; actualMinutes: number; blockedReason?: string };
export type StudySession = { id: string; taskId?: string; courseId?: string; startedAt: string; endedAt?: string; actualMinutes: number; note?: string };
export type DailyReview = { date: string; wins: string; blockers: string; reflection: string; tomorrowAdjustment: string; energyLevel: number };
export type ScheduleBlock = { id: string; courseId: string; weekday: number; startTime: string; endTime: string; minutes: number; kind: "CLASS" | "SELF_STUDY" | "RESERVED" };
export type Store = { goals: Goal[]; courses: Course[]; tasks: Task[]; sessions: StudySession[]; reviews: DailyReview[]; schedule: ScheduleBlock[]; availability: Record<string, number> };
/** Return the calendar date in the user's local timezone, not UTC. */
export const today = () => {
  const now = new Date();
  const offsetDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
};

/** `randomUUID` is unavailable in a few older browser contexts. */
export const id = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
