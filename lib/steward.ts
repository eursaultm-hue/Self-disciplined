import { Course, Store, Task, TaskStatus, today } from "./domain";

export type StewardMessage = { role: "user" | "steward"; content: string; at: string };
export type StewardMemory = { summary: string; lastUserMessage?: string; updatedAt: string; issues?: string[] };
export type StewardAction =
  | { type: "UPDATE_TASK"; taskId: string; status?: TaskStatus; plannedMinutes?: number; plannedDate?: string }
  | { type: "SET_AVAILABILITY"; date: string; minutes: number }
  | { type: "CREATE_TASK"; task: Omit<Task, "id" | "actualMinutes" | "status"> };
export type StewardDecision = { reply: string; actions: StewardAction[]; memory: StewardMemory };
const now = () => new Date().toISOString();

function findCourse(text: string, courses: Course[]) {
  const normalized = text.toLowerCase();
  return courses.find(c => normalized.includes(c.title.toLowerCase()));
}
function detectMinutes(text: string) {
  const m = text.match(/(\d+)\s*(分钟|min|小时|h)/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return /小时|h/i.test(m[2]) ? n * 60 : n;
}
function activeTasks(store: Store) {
  return store.tasks.filter(t => ["TODO", "IN_PROGRESS", "OVERDUE", "SKIPPED", "BLOCKED"].includes(t.status) && (!t.plannedDate || t.plannedDate <= today()));
}
function context(store: Store) {
  const tasks = activeTasks(store);
  const actual = store.sessions.filter(s => s.startedAt.slice(0, 10) === today()).reduce((n, s) => n + s.actualMinutes, 0);
  return { tasks, actual };
}
function memoryAfter(memory: StewardMemory, summary: string, input: string): StewardMemory {
  return { ...memory, summary, lastUserMessage: input, updatedAt: now() };
}
function makeCatchUpTask(course: Course, title: string): StewardAction {
  return { type: "CREATE_TASK", task: { title, courseId: course.id, priorityTier: "SHOULD", plannedDate: today(), dueDate: today(), plannedMinutes: 25 } };
}

/** V0.3 exposes explicit actions instead of directly mutating Store. A future LLM Gateway can return the same action contract. */
export function stewardReply(text: string, store: Store, memory: StewardMemory): StewardDecision {
  const input = text.trim();
  const { tasks, actual } = context(store);
  const course = findCourse(input, store.courses);
  const minutes = detectMinutes(input);
  if (!input) return { reply: "你只需要告诉我现实发生了什么。我会把它转换成任务、时间、风险或计划调整。", actions: [], memory: memoryAfter(memory, memory.summary, input) };

  if (/(没听懂|听不懂|不会|很难|不理解|跟不上|卡住)/.test(input)) {
    const target = course ?? store.courses[0];
    if (!target) return { reply: "我记下了这是一个学习理解问题，但目前还没有对应课程。先告诉我课程名称，我才能把它放进计划。", actions: [], memory: memoryAfter(memory, "学习理解风险：" + input, input) };
    const candidate = tasks.find(t => t.courseId === target.id && t.status !== "DONE");
    const actions: StewardAction[] = candidate
      ? [{ type: "UPDATE_TASK", taskId: candidate.id, status: "BLOCKED", plannedMinutes: Math.min(Math.max(candidate.plannedMinutes, 20), 30) }]
      : [makeCatchUpTask(target, target.title + "：补理解缺口")];
    return {
      reply: candidate ? "收到。「" + target.title + "」出现理解风险，我先把相关任务标记为受阻，并缩小下一次任务规模。" : "收到。「" + target.title + "」出现理解风险，我自动建立了一个 25 分钟的补缺口任务。先补懂，再堆新内容。",
      actions, memory: memoryAfter(memory, target.title + " 存在理解风险：" + input, input)
    };
  }

  if (/(完成了|做完了|搞定了|学完了)/.test(input)) {
    const candidate = tasks.find(t => course ? t.courseId === course.id && t.status !== "DONE" : t.status === "IN_PROGRESS") ?? tasks.find(t => course ? t.courseId === course.id : true);
    if (candidate) return { reply: "已记录「" + candidate.title + "」完成。计划会自动把它移出候选池。", actions: [{ type: "UPDATE_TASK", taskId: candidate.id, status: "DONE" }], memory: memoryAfter(memory, "完成任务：" + candidate.title, input) };
  }

  if (/(没|没有|没做|没完成|拖延|打游戏|刷视频|忘了|没学成)/.test(input)) {
    const candidate = tasks.find(t => course ? t.courseId === course.id : t.status === "IN_PROGRESS") ?? tasks[0];
    if (candidate) {
      const compressed = Math.max(15, Math.round(candidate.plannedMinutes * 0.75 / 5) * 5);
      return { reply: "收到。「" + candidate.title + "」今天没有完成。我不做道德评价。下一次我会把它压缩到约 " + compressed + " 分钟，避免继续安排一个过大的任务。", actions: [{ type: "UPDATE_TASK", taskId: candidate.id, status: "SKIPPED", plannedMinutes: compressed }], memory: memoryAfter(memory, "任务未完成：" + candidate.title + "。用户反馈：" + input, input) };
    }
    return { reply: "我记录了今天没学成，但目前没有匹配到具体任务，所以不会凭空制造一条失败记录。", actions: [], memory: memoryAfter(memory, "执行偏差：" + input, input) };
  }

  if (/(今天|今晚|现在|空出|有时间)/.test(input) && minutes) {
    const target = course ?? store.courses[0];
    return { reply: "收到。我把今天的可用学习容量调整为 " + minutes + " 分钟。今日计划会立即按这个容量重新计算" + (target ? "，并优先考虑「" + target.title + "」" : "") + "。", actions: [{ type: "SET_AVAILABILITY", date: today(), minutes }], memory: memoryAfter(memory, "今日可用学习容量：" + minutes + " 分钟。" + (target ? "重点课程：" + target.title + "。" : ""), input) };
  }

  const taskNames = tasks.slice(0, 3).map(t => t.title).join("、");
  return { reply: actual > 0 ? "收到。我记下了。你今天已经学习 " + actual + " 分钟。当前候选任务：" + (taskNames || "暂无") + "。这条信息会进入下一次计划判断。" : "收到。我把这条现实反馈记下来了。当前候选任务：" + (taskNames || "暂无") + "。", actions: [], memory: memoryAfter(memory, input, input) };
}

export function buildMorningBrief(store: Store) {
  const active = store.tasks.filter(t => ["TODO", "IN_PROGRESS", "OVERDUE", "SKIPPED", "BLOCKED"].includes(t.status));
  const must = active.filter(t => t.priorityTier === "MUST").slice(0, 2);
  const blocked = active.filter(t => t.status === "BLOCKED").slice(0, 2);
  if (!active.length) return "今天还没有任务。我不会让你先填完整个系统，先告诉我最重要的一件学习事情。";
  return "今天我先替你守着：必须完成：" + (must.map(t => t.title).join("、") || "暂无") + "；" + (blocked.length ? "受阻：" + blocked.map(t => t.title).join("、") + "；" : "") + "你只需要告诉我现实发生了什么，计划由我调整。";
}