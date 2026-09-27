import { Store, TaskStatus, Task, today } from "./domain";
import { StewardAction, StewardDecision, StewardMemory } from "./steward";

export type AgentDecision = StewardDecision & {
  source: "llm" | "offline";
  model?: string;
};

function validStatus(value: unknown): value is TaskStatus {
  return ["TODO","IN_PROGRESS","DONE","OVERDUE","SKIPPED","BLOCKED","CANCELLED"].includes(String(value));
}

function sanitizeAction(action: any, store: Store): StewardAction | null {
  if (!action || typeof action.type !== "string") return null;

  if (action.type === "SET_AVAILABILITY") {
    const minutes = Number(action.minutes);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) return null;
    const date = typeof action.date === "string" ? action.date : today();
    if (date !== today()) return null;
    return { type: "SET_AVAILABILITY", date, minutes: Math.round(minutes) };
  }

  if (action.type === "UPDATE_TASK") {
    const taskId = String(action.taskId || "");
    const task = store.tasks.find(t => t.id === taskId);
    if (!task) return null;
    const next: StewardAction = { type: "UPDATE_TASK", taskId };
    if (action.status !== undefined) {
      if (!validStatus(action.status)) return null;
      next.status = action.status;
    }
    if (action.plannedMinutes !== undefined) {
      const minutes = Number(action.plannedMinutes);
      if (!Number.isFinite(minutes) || minutes < 5 || minutes > 480) return null;
      next.plannedMinutes = Math.round(minutes);
    }
    if (action.plannedDate !== undefined) {
      if (typeof action.plannedDate !== "string") return null;
      next.plannedDate = action.plannedDate;
    }
    return next;
  }

  if (action.type === "CREATE_TASK") {
    const raw = action.task;
    if (!raw || typeof raw.title !== "string" || !raw.title.trim()) return null;
    const plannedMinutes = Number(raw.plannedMinutes);
    if (!Number.isFinite(plannedMinutes) || plannedMinutes < 5 || plannedMinutes > 180) return null;
    if (!["MUST","SHOULD","COULD"].includes(raw.priorityTier)) return null;
    const courseId = raw.courseId ? String(raw.courseId) : undefined;
    const goalId = raw.goalId ? String(raw.goalId) : undefined;
    if (courseId && !store.courses.some(c => c.id === courseId)) return null;
    if (goalId && !store.goals.some(g => g.id === goalId)) return null;
    return {
      type: "CREATE_TASK",
      task: {
        title: raw.title.trim().slice(0, 120),
        courseId,
        goalId,
        priorityTier: raw.priorityTier,
        plannedDate: typeof raw.plannedDate === "string" ? raw.plannedDate : today(),
        dueDate: typeof raw.dueDate === "string" ? raw.dueDate : undefined,
        plannedMinutes: Math.round(plannedMinutes),
      },
    };
  }

  return null;
}

export function validateAgentDecision(raw: unknown, store: Store, fallback: StewardDecision, model?: string): AgentDecision {
  if (!raw || typeof raw !== "object") return { ...fallback, source: "offline" };
  const value = raw as any;
  const reply = typeof value.reply === "string" && value.reply.trim() ? value.reply.trim().slice(0, 1200) : fallback.reply;
  const actions = Array.isArray(value.actions)
    ? value.actions.map((a: any) => sanitizeAction(a, store)).filter(Boolean) as StewardAction[]
    : [];
  const memory: StewardMemory = {
    summary: typeof value.memory?.summary === "string" ? value.memory.summary.slice(0, 500) : fallback.memory.summary,
    lastUserMessage: fallback.memory.lastUserMessage,
    updatedAt: new Date().toISOString(),
    issues: Array.isArray(value.memory?.issues) ? value.memory.issues.filter((x: unknown) => typeof x === "string").slice(0, 10) : fallback.memory.issues,
  };
  return { reply, actions, memory, source: "llm", model };
}
