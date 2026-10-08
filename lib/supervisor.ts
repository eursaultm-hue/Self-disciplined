import { LocalNotifications } from "@capacitor/local-notifications";
import { Store, Task } from "./domain";

export const SUPERVISOR_SETTINGS_KEY = "personal-learning-os-v05-supervisor";
export type SupervisorSettings = { enabled: boolean; quietStart: number; quietEnd: number; maxPerDay: number };
export const defaultSupervisorSettings: SupervisorSettings = { enabled: true, quietStart: 23, quietEnd: 8, maxPerDay: 8 };

function inQuietHours(hour: number, settings: SupervisorSettings) {
  return settings.quietStart > settings.quietEnd ? hour >= settings.quietStart || hour < settings.quietEnd : hour >= settings.quietStart && hour < settings.quietEnd;
}
function notificationId(index: number, followUp = false) { return 5100 + index * 2 + (followUp ? 1 : 0); }
function today() {
  const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function loadStore(): Store | null {
  try { const raw = localStorage.getItem("personal-learning-os-store"); return raw ? JSON.parse(raw) as Store : null; } catch { return null; }
}
function taskStartTime(task: Task, index: number) {
  const d = new Date();
  if (task.plannedStartTime) {
    const [h,m] = task.plannedStartTime.split(":").map(Number); d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  } else {
    d.setHours(9,0,0,0); d.setMinutes(d.getMinutes() + index * Math.max(25, Number(task.plannedMinutes) || 30));
  }
  return d;
}
export async function refreshSupervisor(store: Store, settings: SupervisorSettings) {
  if (typeof window === "undefined") return false;
  const permission = await LocalNotifications.checkPermissions(); if (permission.display !== "granted") return false;
  await LocalNotifications.cancel({ notifications: [...Array.from({length:20},(_,i)=>({id:5100+i})), {id:5001},{id:5002},{id:5003},{id:5099}] });
  if (!settings.enabled) return true;
  const now = new Date();
  const candidates = (store.tasks || []).filter(t => t.plannedDate === today() && ["TODO","IN_PROGRESS","OVERDUE"].includes(t.status))
    .sort((a,b) => taskStartTime(a,0).getTime() - taskStartTime(b,0).getTime())
    .slice(0, Math.max(1, Math.floor(settings.maxPerDay / 2)));
  const notifications: any[] = [];
  candidates.forEach((task,index) => {
    const start = taskStartTime(task,index);
    if (start > now && !inQuietHours(start.getHours(),settings)) notifications.push({id:notificationId(index),title:"该开始了 · 自律 AI 管家",body:task.title+" · 计划 "+task.plannedMinutes+" 分钟。打开 App 记录开始。",schedule:{at:start}});
    const follow = new Date(start.getTime()+10*60000);
    if (follow > now && !inQuietHours(follow.getHours(),settings)) notifications.push({id:notificationId(index,true),title:"执行检查 · 自律 AI 管家",body:task.title+" 已开始 10 分钟。如果还没开始，点进 App 更新现实状态。",schedule:{at:follow}});
  });
  const evening = new Date(); evening.setHours(20,30,0,0); if (evening <= now) evening.setDate(evening.getDate()+1);
  if (!inQuietHours(evening.getHours(),settings)) notifications.push({id:5002,title:"今日执行复盘",body:"看看今天完成了多少。没完成的任务不要装死，重新安排。",schedule:{at:evening}});
  if (notifications.length) await LocalNotifications.schedule({notifications:notifications.slice(0,settings.maxPerDay)});
  return true;
}
export async function enableSupervisor(settings: SupervisorSettings, testOnly=false) {
  const permission = await LocalNotifications.requestPermissions(); if (permission.display !== "granted") return false;
  if (testOnly) { await LocalNotifications.schedule({notifications:[{id:5099,title:"自律 AI 管家",body:"原生通知测试成功。主动监督已经可以工作。",schedule:{at:new Date(Date.now()+5000)}}]}); return true; }
  const store=loadStore(); return store ? refreshSupervisor(store,settings) : true;
}