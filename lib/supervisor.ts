import { LocalNotifications } from "@capacitor/local-notifications";
import { PlanResult } from "./planner";

export const SUPERVISOR_SETTINGS_KEY = "personal-learning-os-v05-supervisor";
export type SupervisorSettings = { enabled: boolean; quietStart: number; quietEnd: number; maxPerDay: number };
export const defaultSupervisorSettings: SupervisorSettings = { enabled: true, quietStart: 23, quietEnd: 8, maxPerDay: 3 };
function inQuietHours(hour: number, settings: SupervisorSettings) {
  return settings.quietStart > settings.quietEnd ? hour >= settings.quietStart || hour < settings.quietEnd : hour >= settings.quietStart && hour < settings.quietEnd;
}
export async function enableSupervisor(settings: SupervisorSettings) {
  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted") return false;
  await LocalNotifications.cancel({ notifications: [{ id: 5001 }, { id: 5002 }, { id: 5003 }] });
  if (!settings.enabled) return true;
  const now = new Date();
  const planTime = new Date(now); planTime.setHours(Math.max(settings.quietEnd + 1, 9), 0, 0, 0); if (planTime <= now) planTime.setDate(planTime.getDate() + 1);
  const evening = new Date(now); evening.setHours(20, 0, 0, 0); if (evening <= now) evening.setDate(evening.getDate() + 1);
  const notifications = [];
  if (!inQuietHours(planTime.getHours(), settings)) notifications.push({ id: 5001, title: "自律 AI 管家", body: "打开看看今天的计划。我会根据现实情况帮你重新安排。", schedule: { at: planTime } });
  if (!inQuietHours(evening.getHours(), settings)) notifications.push({ id: 5002, title: "自律 AI 管家", body: "晚上复盘一下今天实际完成了什么，计划不是命令。", schedule: { at: evening } });
  await LocalNotifications.schedule({ notifications: notifications.slice(0, settings.maxPerDay) });
  return true;
}
export function supervisorBrief(plan: PlanResult, availableMinutes: number) {
  const next = plan.items[0];
  if (!next) return "今天没有排入学习任务，先让管家知道现实发生了什么。";
  return "今天可用 " + availableMinutes + " 分钟，优先处理：" + next.title + "（" + next.plannedMinutes + " 分钟）。";
}