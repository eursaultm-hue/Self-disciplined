import { Course, Goal, PriorityTier, ScheduleBlock, Task } from "./domain";

export type PlannedTask = Task & { score: number; selectionReason: string };
const tierScore: Record<PriorityTier, number> = { MUST: 300, SHOULD: 200, COULD: 100 };
export function generateDailyPlan({ date, availableMinutes, tasks, goals, courses, schedule }: { date: string; availableMinutes: number; tasks: Task[]; goals: Goal[]; courses: Course[]; schedule: ScheduleBlock[] }): { items: PlannedTask[]; scheduledMinutes: number; remainingMinutes: number } {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const safeAvailableMinutes = Number.isFinite(availableMinutes) ? Math.max(0, availableMinutes) : 0;
  const scheduledMinutes = schedule
    .filter((block) => block.weekday === weekday)
    .reduce((sum, block) => sum + (Number.isFinite(block.minutes) ? Math.max(0, block.minutes) : 0), 0);
  let remainingMinutes = Math.max(0, safeAvailableMinutes - scheduledMinutes);
  const score = (task: Task) => {
    const goal = goals.find((item) => item.id === task.goalId);
    const course = courses.find((item) => item.id === task.courseId);
    const overdue = !!task.dueDate && task.dueDate < date;
    const dueSoon = !!task.dueDate && task.dueDate <= date;
    return tierScore[task.priorityTier] + (goal?.priority ?? 0) * 10 + (course?.priority ?? 0) * 8 + (overdue ? 120 : 0) + (dueSoon ? 60 : 0);
  };
  const candidates = tasks.filter((task) => ["TODO", "IN_PROGRESS", "SKIPPED", "OVERDUE"].includes(task.status) && (!task.plannedDate || task.plannedDate <= date) && Number.isFinite(task.plannedMinutes) && task.plannedMinutes > 0)
    .map((task) => {
      const isOverdue = task.status === "OVERDUE" || (!!task.dueDate && task.dueDate < date);
      return { ...task, status: isOverdue ? "OVERDUE" as const : task.status, score: score(task), selectionReason: isOverdue ? "已逾期，优先处理" : `${task.priorityTier} 优先级任务` };
    })
    .sort((a, b) => b.score - a.score);
  const items: PlannedTask[] = [];
  for (const task of candidates) {
    if (task.plannedMinutes <= remainingMinutes) { items.push(task); remainingMinutes -= task.plannedMinutes; }
  }
  return { items, scheduledMinutes, remainingMinutes };
}
