import { Store, StudySession, Task } from "./domain";

const ACTIVE_STATUSES = new Set(["TODO", "OVERDUE"]);

export function reconcileOverdueTasks(store: Store, date: string): Store {
  let changed = false;
  const tasks = store.tasks.map((task) => {
    if (task.plannedDate && task.plannedDate < date && ACTIVE_STATUSES.has(task.status)) {
      if (task.status !== "OVERDUE") changed = true;
      return { ...task, status: "OVERDUE" as const };
    }
    return task;
  });
  return changed ? { ...store, tasks } : store;
}

export type ExecutionSummary = {
  plannedCount: number;
  completedCount: number;
  completionRate: number;
  plannedMinutes: number;
  overdueCount: number;
  deferredCount: number;
  skippedCount: number;
  actualMinutes: number;
};

export function buildExecutionSummary(tasks: Task[], sessions: StudySession[], date: string): ExecutionSummary {
  const planned = tasks.filter((task) => task.plannedDate === date);
  const completedCount = planned.filter((task) => task.status === "DONE").length;
  const overdueCount = tasks.filter((task) =>
    (task.status === "OVERDUE" || task.status === "TODO") &&
    (!!task.plannedDate && task.plannedDate < date)
  ).length;
  const deferredCount = tasks.filter((task) =>
    task.status !== "DONE" && task.status !== "SKIPPED" &&
    !!task.plannedDate && task.plannedDate > date
  ).length;
  const skippedCount = planned.filter((task) => task.status === "SKIPPED").length;
  const actualMinutes = sessions
    .filter((session) => session.startedAt.slice(0, 10) === date)
    .reduce((total, session) => total + Math.max(0, Number(session.actualMinutes) || 0), 0);

  return {
    plannedCount: planned.length,
    completedCount,
    completionRate: planned.length ? Math.round((completedCount / planned.length) * 100) : 0,
    plannedMinutes: planned.reduce((total, task) => total + Math.max(0, Number(task.plannedMinutes) || 0), 0),
    overdueCount,
    deferredCount,
    skippedCount,
    actualMinutes,
  };
}
