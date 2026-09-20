import { describe, expect, it } from "vitest";
import { generateDailyPlan } from "../lib/planner";
it("keeps plan within capacity and prioritizes MUST", () => {
 const plan = generateDailyPlan({ date:"2026-09-21", availableMinutes:60, schedule:[], goals:[], courses:[], tasks:[
  {id:"a",title:"must",priorityTier:"MUST",status:"TODO",plannedMinutes:30,actualMinutes:0,plannedDate:"2026-09-21"},
  {id:"b",title:"could",priorityTier:"COULD",status:"TODO",plannedMinutes:45,actualMinutes:0,plannedDate:"2026-09-21"}
 ]});
 expect(plan.items.map(x=>x.id)).toEqual(["a"]); expect(plan.remainingMinutes).toBe(30);
});

it("marks a past-due candidate as overdue and ignores invalid task durations", () => {
 const plan = generateDailyPlan({ date:"2026-09-21", availableMinutes:60, schedule:[], goals:[], courses:[], tasks:[
  {id:"overdue",title:"late",priorityTier:"SHOULD",status:"TODO",plannedMinutes:30,actualMinutes:0,dueDate:"2026-09-20"},
  {id:"invalid",title:"invalid",priorityTier:"MUST",status:"TODO",plannedMinutes:0,actualMinutes:0}
 ]});
 expect(plan.items).toHaveLength(1); expect(plan.items[0]?.status).toBe("OVERDUE");
});
