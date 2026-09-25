import { Course, DailyReview, Goal, Store, Task, TaskStatus, today } from "./domain";

export type StewardMessage = { role: "user" | "steward"; content: string; at: string };
export type StewardMemory = {
  summary: string;
  lastUserMessage?: string;
  updatedAt: string;
};

export type StewardDecision = {
  reply: string;
  taskUpdates?: { taskId: string; status?: TaskStatus; addMinutes?: number }[];
  newTask?: Omit<Task, "id" | "actualMinutes" | "status">;
  memory: StewardMemory;
};

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

function buildContext(store: Store) {
  const active = store.tasks.filter(t => ["TODO", "IN_PROGRESS", "OVERDUE", "SKIPPED"].includes(t.status));
  const todayTasks = active.filter(t => !t.plannedDate || t.plannedDate <= today());
  const actual = store.sessions
    .filter(s => s.startedAt.slice(0, 10) === today())
    .reduce((n, s) => n + s.actualMinutes, 0);
  return { todayTasks, actual };
}

/**
 * V0.2 local steward. It intentionally uses deterministic rules first.
 * The UI can later swap this decision layer for a remote LLM without changing the data model.
 */
export function stewardReply(text: string, store: Store, memory: StewardMemory): StewardDecision {
  const input = text.trim();
  const lower = input.toLowerCase();
  const { todayTasks, actual } = buildContext(store);
  const course = findCourse(input, store.courses);
  const minutes = detectMinutes(input);
  const updatedAt = now();

  if (!input) {
    return { reply: "你只需要告诉我今天发生了什么。我会负责把它转换成计划、记录或调整。", memory: { ...memory, updatedAt } };
  }

  if (/没|没有|没做|没完成|拖延|打游戏|刷视频|忘了/.test(input)) {
    const candidate = todayTasks.find(t => course ? t.courseId === course.id : true);
    if (candidate) {
      return {
        reply: `收到。我把「${candidate.title}」记录为今天未完成，不批判原因。明天我会重新安排它，并根据这次执行情况调整任务大小。`,
        taskUpdates: [{ taskId: candidate.id, status: "SKIPPED" }],
        memory: { summary: `最近一次反馈：任务未完成。原因由用户描述为：${input}`, lastUserMessage: input, updatedAt }
      };
    }
    return {
      reply: "我记录下来了。今天没有匹配到具体任务，所以我不会凭空创造失败记录。你之后提到具体课程或任务时，我会关联起来。",
      memory: { summary: input, lastUserMessage: input, updatedAt }
    };
  }

  if (/完成了|做完了|搞定了|学完了/.test(input)) {
    const candidate = todayTasks.find(t => course ? t.courseId === course.id : t.status === "IN_PROGRESS") ?? todayTasks[0];
    if (candidate) {
      return {
        reply: `已记录「${candidate.title}」完成。你不用再手动改任务状态。`,
        taskUpdates: [{ taskId: candidate.id, status: "DONE" }],
        memory: { summary: `完成任务：${candidate.title}`, lastUserMessage: input, updatedAt }
      };
    }
  }

  if (/没听懂|听不懂|不会|很难|不理解|跟不上/.test(input)) {
    const target = course ?? store.courses[0];
    if (target) {
      return {
        reply: `收到，我把「${target.title}」标记为理解风险。今天先不盲目增加新任务，下一次计划会优先安排一个小的补缺口任务。`,
        memory: { summary: `${target.title} 存在理解风险：${input}`, lastUserMessage: input, updatedAt }
      };
    }
  }

  if (/今天|今晚|现在|空出|有时间/.test(input) && minutes) {
    const target = course ?? store.courses[0];
    if (target) {
      return {
        reply: `收到，你现在大约有 ${minutes} 分钟。我会把这段时间视为新增可用容量，优先安排「${target.title}」相关任务。下一次打开今日页时会按新的容量重新规划。`,
        memory: { summary: `新增可用学习时间：${minutes} 分钟。用户反馈：${input}`, lastUserMessage: input, updatedAt }
      };
    }
  }

  const taskNames = todayTasks.slice(0, 3).map(t => t.title).join("、");
  return {
    reply: actual > 0
      ? `收到。我记下了。你今天已经有 ${actual} 分钟学习记录。当前候选任务是：${taskNames || "暂无"}。我会把你的这条信息作为下一次计划调整的依据。`
      : `收到。我会处理这件事，不需要你自己维护任务表。当前候选任务是：${taskNames || "暂无"}。`,
    memory: { summary: input, lastUserMessage: input, updatedAt }
  };
}

export function buildMorningBrief(store: Store) {
  const active = store.tasks.filter(t => ["TODO", "IN_PROGRESS", "OVERDUE", "SKIPPED"].includes(t.status));
  const must = active.filter(t => t.priorityTier === "MUST").slice(0, 2);
  const should = active.filter(t => t.priorityTier === "SHOULD").slice(0, 2);
  if (!active.length) return "今天还没有任务。我不会让你填一堆表格，先告诉我最近最重要的一件学习事情，我再帮你建立第一条任务。";
  return `今天我先替你守着：必须完成：${must.map(t => t.title).join("、") || "暂无"}；建议完成：${should.map(t => t.title).join("、") || "暂无"}。你只需要告诉我现实中发生了什么，剩下的计划由我调整。`;
}
