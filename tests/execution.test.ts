import { describe, expect, it } from "vitest";
import { buildExecutionSummary, reconcileOverdueTasks } from "../lib/execution";
import type { Store, Task } from "../lib/domain";

const task = (overrides: Partial<Task>): Task => ({
  id: "t1", title: "task", priorityTier: "MUST", status: "TODO",
  plannedDate: "2026-10-11", plannedMinutes: 30, actualMinutes: 0, ...overrides,
});
const store: Store = { goals: [], courses: [], tasks: [], sessions: [], reviews: [], schedule: [], availability: {} };

describe("execution tracking", () => {
  it("marks unfinished tasks from previous days as overdue but preserves in-progress tasks", () => {
    const input = { ...store, tasks: [
      task({ id: "old" }),
      task({ id: "running", status: "IN_PROGRESS" }),
      task({ id: "done", status: "DONE" }),
      task({ id: "today", plannedDate: "2026-10-12" }),
    ] };
    const result = reconcileOverdueTasks(input, "2026-10-12");
    expect(result.tasks.find(t => t.id === "old")?.status).toBe("OVERDUE");
    expect(result.tasks.find(t => t.id === "running")?.status).toBe("IN_PROGRESS");
    expect(result.tasks.find(t => t.id === "done")?.status).toBe("DONE");
    expect(result.tasks.find(t => t.id === "today")?.status).toBe("TODO");
  });

  it("summarizes planned, completed, overdue, deferred, skipped and recorded minutes", () => {
    const tasks = [
      task({ id: "done", plannedDate: "2026-10-12", status: "DONE", plannedMinutes: 40 }),
      task({ id: "skip", plannedDate: "2026-10-12", status: "SKIPPED", plannedMinutes: 20 }),
      task({ id: "old", plannedDate: "2026-10-11", status: "OVERDUE" }),
      task({ id: "later", plannedDate: "2026-10-13" }),
    ];
    const sessions = [
      { id: "s1", taskId: "done", startedAt: "2026-10-12T09:00:00.000Z", endedAt: "2026-10-12T09:25:00.000Z", actualMinutes: 25 },
      { id: "s2", taskId: "done", startedAt: "2026-10-11T09:00:00.000Z", endedAt: "2026-10-11T09:25:00.000Z", actualMinutes: 25 },
    ];
    expect(buildExecutionSummary(tasks, sessions, "2026-10-12")).toEqual({
      plannedCount: 2, completedCount: 1, completionRate: 50, plannedMinutes: 60,
      overdueCount: 1, deferredCount: 1, skippedCount: 1, actualMinutes: 25,
    });
  });
});
