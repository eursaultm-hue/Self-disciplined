"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Course, DailyReview, Goal, PriorityTier, Store, Task, TaskStatus, id, today } from "../lib/domain";
import { generateDailyPlan } from "../lib/planner";
import { buildMorningBrief, stewardReply, StewardMemory, StewardMessage } from "../lib/steward";

const key = "personal-learning-os-v02";
const legacyKey = "personal-learning-os-v01";
const blank: Store = { goals: [], courses: [], tasks: [], sessions: [], reviews: [], schedule: [], availability: {} };
const labels: Record<TaskStatus, string> = { TODO: "待开始", IN_PROGRESS: "进行中", DONE: "已完成", OVERDUE: "已逾期", SKIPPED: "已跳过", BLOCKED: "受阻", CANCELLED: "已取消" };

function load(): Store {
  try {
    const current = localStorage.getItem(key);
    if (current) return JSON.parse(current);
    const legacy = localStorage.getItem(legacyKey);
    return legacy ? JSON.parse(legacy) : blank;
  } catch { return blank; }
}

function loadMessages(): StewardMessage[] {
  try { return JSON.parse(localStorage.getItem("personal-learning-os-v02-chat") || "[]"); } catch { return []; }
}

export default function Home() {
  const [store, setStore] = useState<Store>(blank);
  const [ready, setReady] = useState(false);
  const [date, setDate] = useState(today());
  const [view, setView] = useState<"home" | "today" | "data" | "review">("home");
  const [messages, setMessages] = useState<StewardMessage[]>([]);
  const [memory, setMemory] = useState<StewardMemory>({ summary: "", updatedAt: new Date().toISOString() });
  const [chat, setChat] = useState("");
  const [notificationEnabled, setNotificationEnabled] = useState(false);

  useEffect(() => {
    setStore(load());
    setMessages(loadMessages());
    try { setMemory(JSON.parse(localStorage.getItem("personal-learning-os-v02-memory") || "null") || { summary: "", updatedAt: new Date().toISOString() }); } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(key, JSON.stringify(store));
    localStorage.setItem("personal-learning-os-v02-chat", JSON.stringify(messages.slice(-80)));
    localStorage.setItem("personal-learning-os-v02-memory", JSON.stringify(memory));
  }, [store, messages, memory, ready]);

  const available = store.availability[date] ?? 120;
  const plan = useMemo(() => generateDailyPlan({ date, availableMinutes: available, tasks: store.tasks, goals: store.goals, courses: store.courses, schedule: store.schedule }), [store, date, available]);
  const plannedMinutes = plan.items.reduce((total, task) => total + task.plannedMinutes, 0);
  const actualToday = store.sessions.filter(s => s.startedAt.slice(0, 10) === date).reduce((n, s) => n + s.actualMinutes, 0);
  const update = (fn: (old: Store) => Store) => setStore(old => fn(old));

  const sendToSteward = (text: string) => {
    const input = text.trim();
    if (!input) return;
    const userMessage: StewardMessage = { role: "user", content: input, at: new Date().toISOString() };
    const decision = stewardReply(input, store, memory);
    update(s => {
      let next = s;
      if (decision.taskUpdates?.length) {
        next = { ...next, tasks: next.tasks.map(t => {
          const change = decision.taskUpdates?.find(x => x.taskId === t.id);
          return change ? { ...t, status: change.status ?? t.status, actualMinutes: t.actualMinutes + (change.addMinutes ?? 0) } : t;
        }) };
      }
      if (decision.newTask) next = { ...next, tasks: [...next.tasks, { ...decision.newTask, id: id(), status: "TODO", actualMinutes: 0 }] };
      return next;
    });
    setMessages(prev => [...prev, userMessage, { role: "steward", content: decision.reply, at: new Date().toISOString() }]);
    setMemory(decision.memory);
    setChat("");
  };

  const requestNotification = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setNotificationEnabled(result === "granted");
    if (result === "granted") new Notification("自律 AI 管家", { body: "通知权限已开启。后续版本会把主动监督接入这里。" });
  };

  const record25 = (task: Task) => {
    const recordedAt = new Date().toISOString();
    update(s => ({
      ...s,
      sessions: [...s.sessions, { id: id(), taskId: task.id, courseId: task.courseId, startedAt: recordedAt, endedAt: recordedAt, actualMinutes: 25, note: "专注学习" }],
      tasks: s.tasks.map(t => t.id === task.id ? { ...t, status: "IN_PROGRESS", actualMinutes: t.actualMinutes + 25 } : t)
    }));
  };

  if (!ready) return <main className="shell">正在启动 AI 管家…</main>;

  return <main className="shell">
    <header className="topbar">
      <div>
        <p className="eyebrow">PERSONAL LEARNING OS · V0.2</p>
        <h1>自律 <span>AI 管家</span></h1>
        <p className="sub">你负责告诉我现实发生了什么，我负责把它变成可执行的下一步。</p>
      </div>
      <nav>{([["home", "管家"], ["today", "今日计划"], ["data", "我的系统"], ["review", "复盘"]] as const).map(([v, n]) =>
        <button key={v} className={view === v ? "active" : ""} onClick={() => setView(v)}>{n}</button>
      )}</nav>
    </header>

    {view === "home" && <section className="home-grid">
      <div className="main-column">
        <div className="steward-hero">
          <div className="status-dot" />
          <div>
            <p className="eyebrow">AI 管家在线</p>
            <h2>今天我替你盯着。</h2>
            <p>{buildMorningBrief(store)}</p>
          </div>
        </div>

        <div className="chat-card">
          <div className="section-head"><div><h2>告诉我发生了什么</h2><p>不用填表。直接像和管家说话一样。</p></div></div>
          <div className="messages">
            {!messages.length && <div className="welcome-message">例如：<b>“今天电子学完全没听懂。”</b>、<b>“我晚上只有一个小时。”</b>、<b>“数分做完了。”</b></div>}
            {messages.slice(-8).map((m, i) => <div className={`message ${m.role}`} key={i}><span>{m.role === "user" ? "你" : "管家"}</span><p>{m.content}</p></div>)}
          </div>
          <form className="chat-input" onSubmit={e => { e.preventDefault(); sendToSteward(chat); }}>
            <input value={chat} onChange={e => setChat(e.target.value)} placeholder="今天发生了什么？" />
            <button>交给管家</button>
          </form>
          <div className="quick-actions">
            {["今天没学成", "今天电子学没听懂", "我现在有30分钟", "我完成了"].map(x => <button key={x} onClick={() => sendToSteward(x)}>{x}</button>)}
          </div>
        </div>

        <div className="section-head"><div><h2>今天要做什么</h2><p>{date} · 实际学习 {actualToday} 分钟</p></div><button className="ghost" onClick={() => setView("today")}>查看完整计划</button></div>
        {plan.items.length ? <div className="plan">{(["MUST", "SHOULD", "COULD"] as PriorityTier[]).map(tier => {
          const items = plan.items.filter(x => x.priorityTier === tier);
          if (!items.length) return null;
          return <div key={tier}><h3 className={`tier ${tier.toLowerCase()}`}>{tier === "MUST" ? "必须完成" : tier === "SHOULD" ? "建议完成" : "有时间再做"}</h3>
            {items.map(task => <TaskCard key={task.id} task={task} record25={record25} />)}</div>;
        })}</div> : <div className="empty">现在没有任务。我不会要求你先填完整个系统。去「我的系统」告诉我最重要的目标和课程，之后我会逐步接管。</div>}
      </div>

      <aside className="side-column">
        <div className="card permission-card">
          <p className="eyebrow">权限中心</p><h3>让我多替你做一点</h3>
          <p>通知权限开启后，我可以开始承担主动提醒。日历、文件、屏幕使用情况等权限会在后续版本逐步接入。</p>
          <button onClick={requestNotification}>{notificationEnabled ? "✓ 通知已开启" : "开启通知权限"}</button>
        </div>
        <div className="card mini-card"><small>今日容量</small><strong>{available} 分钟</strong><span>已安排 {plannedMinutes} 分钟</span></div>
        <div className="card mini-card"><small>最近记忆</small><p>{memory.summary || "还没有。你说的第一句话就会成为系统的一部分。"}</p></div>
        <div className="card principle"><small>核心原则</small><strong>用户输入越少，AI 完成的管理越多。</strong></div>
      </aside>
    </section>}

    {view === "today" && <TodayView date={date} setDate={setDate} available={available} plan={plan} update={update} record25={record25} />}
    {view === "data" && <DataView store={store} update={update} date={date} />}
    {view === "review" && <ReviewView date={date} plannedMinutes={plannedMinutes} actualToday={actualToday} store={store} update={update} />}
  </main>;
}

function TaskCard({ task, record25 }: { task: Task & { selectionReason?: string }; record25: (task: Task) => void }) {
  return <article className="task">
    <div><strong>{task.title}</strong><small>{task.plannedMinutes} 分钟 · {task.selectionReason || "管家安排"}</small></div>
    <button onClick={() => record25(task)}>记录 25 分钟</button>
  </article>;
}

function TodayView({ date, setDate, available, plan, update, record25 }: { date: string; setDate: (v: string) => void; available: number; plan: ReturnType<typeof generateDailyPlan>; update: (fn: (old: Store) => Store) => void; record25: (task: Task) => void }) {
  return <section><div className="section-head"><div><p className="eyebrow">TODAY</p><h2>今天的执行面板</h2></div><label>日期 <input type="date" value={date} onChange={e => setDate(e.target.value)} /></label></div>
    <div className="stats"><Stat label="可用时间" value={`${available} 分钟`} /><Stat label="固定课程" value={`${plan.scheduledMinutes} 分钟`} /><Stat label="已安排" value={`${plan.items.reduce((n, t) => n + t.plannedMinutes, 0)} 分钟`} /><Stat label="剩余容量" value={`${plan.remainingMinutes} 分钟`} /></div>
    <div className="notice">计划不是命令。现实变化时，直接告诉管家，它会重新安排。</div>
    {plan.items.map(task => <TaskCard key={task.id} task={task} record25={record25} />)}
  </section>;
}

function DataView({ store, update, date }: { store: Store; update: (fn: (old: Store) => Store) => void; date: string }) {
  const addGoal = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); const title = String(f.get("title") || "").trim(); if (!title) return; update(s => ({ ...s, goals: [...s.goals, { id: id(), title, priority: Number(f.get("priority") || 3), targetDate: String(f.get("targetDate") || "") || undefined }] })); e.currentTarget.reset(); };
  const addCourse = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); const title = String(f.get("title") || "").trim(); if (!title) return; update(s => ({ ...s, courses: [...s.courses, { id: id(), title, goalId: String(f.get("goalId") || "") || undefined, priority: Number(f.get("priority") || 3), weeklyTargetMinutes: Number(f.get("minutes") || 180) }] })); e.currentTarget.reset(); };
  const addTask = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); const title = String(f.get("title") || "").trim(); if (!title) return; update(s => ({ ...s, tasks: [...s.tasks, { id: id(), title, courseId: String(f.get("courseId") || "") || undefined, goalId: String(f.get("goalId") || "") || undefined, priorityTier: String(f.get("tier")) as PriorityTier, status: "TODO", plannedDate: date, dueDate: String(f.get("dueDate") || "") || undefined, plannedMinutes: Number(f.get("minutes") || 30), actualMinutes: 0 }] })); e.currentTarget.reset(); };
  return <section className="two">
    <div><p className="eyebrow">LOW INPUT</p><h2>我的系统</h2><p className="hint">这里只保留 AI 暂时还无法从现实中自动获取的信息。以后会继续减少手动输入。</p>
      <div className="card"><h3>长期目标</h3>{store.goals.map(g => <p key={g.id}><b>{g.title}</b><br/><small>优先级 {g.priority} · {g.targetDate || "无截止日期"}</small></p>)}{!store.goals.length && <Empty text="例如：2027 年 IELTS 7.0、法国研究生申请。" />}</div>
      <div className="card"><h3>课程</h3>{store.courses.map(c => <p key={c.id}><b>{c.title}</b><br/><small>每周 {c.weeklyTargetMinutes} 分钟 · 优先级 {c.priority}</small></p>)}{!store.courses.length && <Empty text="例如：数学分析、线性代数、电子学。" />}</div>
    </div>
    <div>
      <form className="card form" onSubmit={addGoal}><h3>只需要第一次告诉我目标</h3><input name="title" placeholder="例如：2027 年 IELTS 7.0" required/><label>优先级 <input name="priority" type="number" min="1" max="5" defaultValue="5"/></label><label>目标日期 <input name="targetDate" type="date"/></label><button>交给管家</button></form>
      <form className="card form" onSubmit={addCourse}><h3>课程</h3><input name="title" placeholder="例如：数学分析" required/><label>每周目标分钟 <input name="minutes" type="number" defaultValue="180"/></label><label>优先级 <input name="priority" type="number" min="1" max="5" defaultValue="4"/></label><button>保存课程</button></form>
      <form className="card form" onSubmit={addTask}><h3>只有 AI 不知道的任务才需要手动加</h3><input name="title" placeholder="例如：完成集合与映射习题" required/><select name="tier"><option>MUST</option><option>SHOULD</option><option>COULD</option></select><select name="courseId"><option value="">不关联课程</option>{store.courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select><label>分钟 <input name="minutes" type="number" min="5" defaultValue="30"/></label><button>加入任务池</button></form>
    </div>
  </section>;
}

function ReviewView({ date, plannedMinutes, actualToday, store, update }: { date: string; plannedMinutes: number; actualToday: number; store: Store; update: (fn: (old: Store) => Store) => void }) {
  const save = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); const review: DailyReview = { date, wins: String(f.get("wins") || ""), blockers: String(f.get("blockers") || ""), reflection: String(f.get("reflection") || ""), tomorrowAdjustment: String(f.get("adjustment") || ""), energyLevel: Number(f.get("energy") || 3) }; update(s => ({ ...s, reviews: [...s.reviews.filter(r => r.date !== date), review] })); };
  return <section className="two"><div><p className="eyebrow">REVIEW</p><h2>今天结束时，告诉管家现实。</h2><div className="stats"><Stat label="计划" value={`${plannedMinutes} 分钟`} /><Stat label="实际" value={`${actualToday} 分钟`} /></div><div className="notice">以后这里会由 AI 主动追问。现在保留一个极短的兜底入口，避免系统假装自己知道你发生了什么。</div><p className="hint">历史复盘：{store.reviews.length} 天</p></div><form className="card form" onSubmit={save}><textarea name="wins" placeholder="今天发生了什么？"/><textarea name="blockers" placeholder="哪里卡住了？"/><label>精力 1–5 <input name="energy" type="number" min="1" max="5" defaultValue="3"/></label><textarea name="adjustment" placeholder="明天有什么变化？"/><button>让管家记住</button></form></section>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="stat"><small>{label}</small><strong>{value}</strong></div>; }
function Empty({ text }: { text: string }) { return <p className="empty">{text}</p>; }
