import { Course, Goal, PriorityTier, ScheduleBlock, Task } from "./domain";
import { CourseKnowledgeDB, COURSE_KNOWLEDGE_KEY } from "./courseKnowledge";
import { buildReviewTask, isReviewDue } from "./learningEngine";

export type PlannedTask = Task & { score: number; selectionReason: string };
const tierScore: Record<PriorityTier, number> = { MUST: 300, SHOULD: 200, COULD: 100 };

function loadDueReviewTasks(date: string, tasks: Task[]): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COURSE_KNOWLEDGE_KEY);
    if (!raw) return [];
    const db = JSON.parse(raw) as CourseKnowledgeDB;
    const activeKnowledgeTasks = new Set(tasks.filter(t => t.status !== "DONE" && t.knowledgePointId).map(t => t.knowledgePointId));
    return (db.points || []).flatMap(point => {
      const state = (db.reviews || []).find(r => r.knowledgePointId === point.id);
      if (!state || !isReviewDue(state, date) || activeKnowledgeTasks.has(point.id)) return [];
      return [buildReviewTask(point, state)];
    });
  } catch { return []; }
}

export function generateDailyPlan({ date, availableMinutes, tasks, goals, courses, schedule }: { date: string; availableMinutes: number; tasks: Task[]; goals: Goal[]; courses: Course[]; schedule: ScheduleBlock[] }): { items: PlannedTask[]; scheduledMinutes: number; remainingMinutes: number } {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const safeAvailableMinutes = Number.isFinite(availableMinutes) ? Math.max(0, availableMinutes) : 0;
  const scheduledMinutes = schedule.filter((block) => block.weekday === weekday).reduce((sum, block) => sum + (Number.isFinite(block.minutes) ? Math.max(0, block.minutes) : 0), 0);
  let remainingMinutes = Math.max(0, safeAvailableMinutes - scheduledMinutes);
  const reviewTasks = loadDueReviewTasks(date, tasks);
  const candidatesInput = [...tasks, ...reviewTasks];
  const score = (task: Task) => {
    const goal = goals.find((item) => item.id === task.goalId);
    const course = courses.find((item) => item.id === task.courseId);
    const overdue = !!task.dueDate && task.dueDate < date;
    const dueSoon = !!task.dueDate && task.dueDate <= date;
    const reviewBoost = task.knowledgePointId ? 90 : 0;
    return tierScore[task.priorityTier] + (goal?.priority ?? 0) * 10 + (course?.priority ?? 0) * 8 + (overdue ? 120 : 0) + (dueSoon ? 60 : 0) + reviewBoost;
  };
  const candidates = candidatesInput.filter((task, index, all) => ["TODO", "IN_PROGRESS", "SKIPPED", "OVERDUE"].includes(task.status) && (!task.plannedDate || task.plannedDate <= date) && Number.isFinite(task.plannedMinutes) && task.plannedMinutes > 0 && all.findIndex(x => x.id === task.id) === index)
    .map((task) => {
      const isOverdue = task.status === "OVERDUE" || (!!task.dueDate && task.dueDate < date);
      const isReview = !!task.knowledgePointId && reviewTasks.some(x => x.id === task.id);
      return { ...task, status: isOverdue ? "OVERDUE" as const : task.status, score: score(task), selectionReason: isReview ? "SRS 到期复习" : isOverdue ? "已逾期，优先处理" : task.priorityTier + " 优先级任务" };
    })
    .sort((a, b) => b.score - a.score);
  const items: PlannedTask[] = [];
  for (const task of candidates) {
    if (task.plannedMinutes <= remainingMinutes) { items.push(task); remainingMinutes -= task.plannedMinutes; }
  }
  return { items, scheduledMinutes, remainingMinutes };
}