import { describe, expect, it } from "vitest";
import { validateAgentDecision } from "./agent";
import { Store } from "./domain";
import { stewardReply } from "./steward";

const store: Store = {
  goals: [{ id: "g1", title: "IELTS", priority: 5 }],
  courses: [{ id: "c1", title: "电子学", priority: 4, weeklyTargetMinutes: 180 }],
  tasks: [{ id: "t1", title: "电子学复习", courseId: "c1", priorityTier: "MUST", status: "TODO", plannedDate: "2026-09-27", plannedMinutes: 30, actualMinutes: 0 }],
  sessions: [], reviews: [], schedule: [], availability: {}
};

describe("V0.4 agent contract", () => {
  it("accepts valid LLM actions", () => {
    const fallback = stewardReply("测试", store, { summary: "", updatedAt: new Date().toISOString() });
    const decision = validateAgentDecision({
      reply: "收到，我会调整。",
      actions: [{ type: "UPDATE_TASK", taskId: "t1", status: "DONE" }],
      memory: { summary: "电子学已完成" }
    }, store, fallback, "test-model");
    expect(decision.source).toBe("llm");
    expect(decision.actions).toHaveLength(1);
    expect(decision.actions[0].type).toBe("UPDATE_TASK");
  });

  it("rejects invented task ids and unsafe minutes", () => {
    const fallback = stewardReply("测试", store, { summary: "", updatedAt: new Date().toISOString() });
    const decision = validateAgentDecision({
      reply: "bad",
      actions: [
        { type: "UPDATE_TASK", taskId: "not-real", status: "DONE" },
        { type: "SET_AVAILABILITY", date: "2026-09-27", minutes: 9999 }
      ],
      memory: { summary: "bad" }
    }, store, fallback);
    expect(decision.actions).toHaveLength(0);
  });
});
