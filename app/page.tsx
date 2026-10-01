"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Course, DailyReview, Goal, PriorityTier, Store, Task, TaskStatus, id, today } from "../lib/domain";
import { generateDailyPlan } from "../lib/planner";
import { buildMorningBrief, stewardReply, StewardAction, StewardMemory, StewardMessage } from "../lib/steward";
import { askGateway, defaultGatewayConfig, GatewayConfig } from "../lib/gateway";
import { defaultSupervisorSettings, enableSupervisor, SupervisorSettings } from "../lib/supervisor";
import { APP_VERSION, checkForUpdate, UpdateManifest } from "../lib/update";

const key = "personal-learning-os-store";
const STORE_SCHEMA_VERSION = 8;
const legacyKeys = ["personal-learning-os-v07","personal-learning-os-v06","personal-learning-os-v05", "personal-learning-os-v04", "personal-learning-os-v03", "personal-learning-os-v02", "personal-learning-os-v01"];
const blank: Store = { goals: [], courses: [], tasks: [], sessions: [], reviews: [], schedule: [], availability: {} };
const labels: Record<TaskStatus, string> = { TODO: "待开始", IN_PROGRESS: "进行中", DONE: "已完成", OVERDUE: "已逾期", SKIPPED: "已跳过", BLOCKED: "受阻", CANCELLED: "已取消" };

function normalizeStore(store: Store): Store { return { ...blank, ...store, goals: store.goals || [], courses: store.courses || [], tasks: store.tasks || [], sessions: store.sessions || [], reviews: store.reviews || [], schedule: store.schedule || [], availability: store.availability || {} }; }

function hasStoreData(store: Store) {
  return store.goals.length > 0 || store.courses.length > 0 || store.tasks.length > 0 || store.sessions.length > 0 || store.reviews.length > 0 || store.schedule.length > 0 || Object.keys(store.availability).length > 0;
}

function readStore(raw: string | null): Store | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? normalizeStore(parsed) : null;
  } catch { return null; }
}

function load(): Store {
  try {
    const current = readStore(localStorage.getItem(key));
    if (current && hasStoreData(current)) return current;
    for (const legacyKey of legacyKeys) {
      const legacy = readStore(localStorage.getItem(legacyKey));
      if (legacy && hasStoreData(legacy)) return legacy;
    }
    return current || blank;
  } catch { return blank; }
}

function findLegacyStore(): Store | null {
  for (const legacyKey of legacyKeys) {
    const legacy = readStore(localStorage.getItem(legacyKey));
    if (legacy && hasStoreData(legacy)) return legacy;
  }
  return null;
}

function loadMessages(): StewardMessage[] {
  try { return JSON.parse(localStorage.getItem("personal-learning-os-v03-chat") || "[]"); } catch { return []; }
}

export default function Home() {
  const [store, setStore] = useState<Store>(blank);
  const [ready, setReady] = useState(false);
  const [date, setDate] = useState(today());
  const [view, setView] = useState<"home" | "today" | "knowledge" | "data" | "review">("home");
  const [messages, setMessages] = useState<StewardMessage[]>([]);
  const [memory, setMemory] = useState<StewardMemory>({ summary: "", updatedAt: new Date().toISOString() });
  const [chat, setChat] = useState("");
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [gateway, setGateway] = useState<GatewayConfig>(defaultGatewayConfig);
  const [gatewayDraft, setGatewayDraft] = useState("");
  const [agentSource, setAgentSource] = useState<"llm" | "offline">("offline");
  const [agentBusy, setAgentBusy] = useState(false);
  const [supervisor, setSupervisor] = useState<SupervisorSettings>(defaultSupervisorSettings);
  const [updateInfo, setUpdateInfo] = useState<UpdateManifest | null>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [migrationNotice, setMigrationNotice] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);

  useEffect(() => {
    const initial = load();
    setStore(initial);
    if (hasStoreData(initial) && !hasStoreData(readStore(localStorage.getItem(key)) || blank)) {
      setMigrationNotice("已自动从旧版本恢复你的数据。");
    }
    setMessages(loadMessages());
    try { setSupervisor(JSON.parse(localStorage.getItem("personal-learning-os-v05-supervisor") || "null") || defaultSupervisorSettings); } catch {}
    try {
      const savedGateway = JSON.parse(localStorage.getItem("personal-learning-os-v04-gateway") || "null");
      if (savedGateway?.baseUrl) { setGateway(savedGateway); setGatewayDraft(savedGateway.baseUrl); }
    } catch {}
    try { setMemory(JSON.parse(localStorage.getItem("personal-learning-os-v04-memory") || "null") || { summary: "", updatedAt: new Date().toISOString() }); } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(key, JSON.stringify({ ...store, schemaVersion: STORE_SCHEMA_VERSION }));
    localStorage.setItem("personal-learning-os-v03-chat", JSON.stringify(messages.slice(-80)));
    localStorage.setItem("personal-learning-os-v05-memory", JSON.stringify(memory));
    localStorage.setItem("personal-learning-os-v05-supervisor", JSON.stringify(supervisor));
    localStorage.setItem("personal-learning-os-v04-gateway", JSON.stringify(gateway));
  }, [store, messages, memory, gateway, supervisor, ready]);

  const recoverLegacy = () => {
    const legacy = findLegacyStore();
    if (!legacy) {
      setMigrationNotice("没有找到旧版本本地数据。若你曾卸载旧 APK 或系统清除了应用数据，本机 localStorage 已不存在，不能凭空恢复。");
      return;
    }
    setStore(legacy);
    setMigrationNotice("已恢复旧版本数据，并同步到统一数据存储。");
  };

  const exportBackup = () => {
    const payload = {
      format: "personal-learning-os-backup",
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      store,
      messages,
      memory,
      supervisor,
      gateway,
      courseKnowledge: localStorage.getItem("personal-learning-os-knowledge") || localStorage.getItem("personal-learning-os-v07-knowledge") || localStorage.getItem("personal-learning-os-v06-knowledge"),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `self-disciplined-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMigrationNotice("备份文件已生成。以后换 APK 前先导出一次，就不用再赌 localStorage 的命运。");
  };

  const importBackup = async (file: File) => {
    setBackupBusy(true);
    try {
      const parsed = JSON.parse(await file.text());
      const imported = parsed?.store as Store;
      if (!imported || !Array.isArray(imported.tasks) || !Array.isArray(imported.courses)) {
        throw new Error("这不是有效的自律系统备份文件。");
      }
      setStore({
        ...blank,
        ...imported,
        goals: imported.goals || [],
        courses: imported.courses || [],
        tasks: imported.tasks || [],
        sessions: imported.sessions || [],
        reviews: imported.reviews || [],
        schedule: imported.schedule || [],
        availability: imported.availability || {},
      });
      if (Array.isArray(parsed.messages)) setMessages(parsed.messages);
      if (parsed.memory) setMemory(parsed.memory);
      if (parsed.supervisor) setSupervisor(parsed.supervisor);
      if (parsed.gateway) setGateway(parsed.gateway);
      if (parsed.courseKnowledge) localStorage.setItem("personal-learning-os-knowledge", String(parsed.courseKnowledge));
      setMigrationNotice("备份已恢复。课程知识库也会随备份一起恢复。");
    } catch (err) {
      setMigrationNotice(err instanceof Error ? err.message : "备份恢复失败。");
    } finally {
      setBackupBusy(false);
    }
  };

  const available = store.availability[date] ?? 120;
  const plan = useMemo(() => generateDailyPlan({ date, availableMinutes: available, tasks: store.tasks, goals: store.goals, courses: store.courses, schedule: store.schedule }), [store, date, available]);
  const plannedMinutes = plan.items.reduce((total, task) => total + task.plannedMinutes, 0);
  const actualToday = store.sessions.filter(s => s.startedAt.slice(0, 10) === date).reduce((n, s) => n + s.actualMinutes, 0);
  const update = (fn: (old: Store) => Store) => setStore(old => fn(old));

  const sendToSteward = async (text: string) => {
    const input = text.trim();
    if (!input || agentBusy) return;
    const userMessage: StewardMessage = { role: "user", content: input, at: new Date().toISOString() };
    const fallback = stewardReply(input, store, memory);
    setMessages(prev => [...prev, userMessage]);
    setChat("");
    setAgentBusy(true);
    const decision = await askGateway(gateway, input, store, memory, fallback);
    update(s => applyStewardActions(s, decision.actions));
    setMessages(prev => [...prev, { role: "steward", content: decision.reply, at: new Date().toISOString() }]);
    setMemory(decision.memory);
    setAgentSource(decision.source);
    setAgentBusy(false);
  };

  const requestNotification = async () => {
    const ok = await enableSupervisor(supervisor);
    setNotificationEnabled(ok);
    if (ok) setSupervisor(s => ({ ...s, enabled: true }));
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
        <p className="eyebrow">PERSONAL LEARNING OS · V0.8</p>
        <h1>自律 <span>AI 管家</span></h1>
        <p className="sub">你负责告诉我现实发生了什么，我负责把它变成可执行的下一步。</p>
      </div>
      <nav>{([["home", "管家"], ["today", "今日计划"], ["knowledge", "课程知识库"], ["data", "我的系统"], ["review", "复盘"]] as const).map(([v, n]) =>
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
        {migrationNotice && <div className="notice">{migrationNotice}</div>}

        <div className="chat-card">
          <div className="section-head"><div><h2>告诉我发生了什么</h2><p>不用填表。直接像和管家说话一样。</p></div></div>
          <div className="messages">
            {!messages.length && <div className="welcome-message">例如：<b>“今天电子学完全没听懂。”</b>、<b>“我晚上只有一个小时。”</b>、<b>“数分做完了。”</b></div>}
            {messages.slice(-8).map((m, i) => <div className={`message ${m.role}`} key={i}><span>{m.role === "user" ? "你" : "管家"}</span><p>{m.content}</p></div>)}
          </div>
          <form className="chat-input" onSubmit={e => { e.preventDefault(); void sendToSteward(chat); }}>
            <input value={chat} onChange={e => setChat(e.target.value)} placeholder={agentBusy ? "AI 正在判断…" : "今天发生了什么？"} disabled={agentBusy} />
            <button disabled={agentBusy}>{agentBusy ? "处理中" : "交给管家"}</button>
          </form>
          <div className="quick-actions">
            {["今天没学成", "今天电子学没听懂", "我现在有30分钟", "我完成了"].map(x => <button key={x} disabled={agentBusy} onClick={() => void sendToSteward(x)}>{x}</button>)}
          </div>
          <div className="agent-source">决策来源：{agentSource === "llm" ? "远程 LLM Agent" : "本地离线管家"}{gateway.enabled && agentSource === "offline" ? "（Gateway 未连接，已自动降级）" : ""}</div>
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
          <p className="eyebrow">V0.4 · AI GATEWAY</p><h3>接入真正的 AI</h3>
          <p>这里填写你部署的 Gateway 地址。API Key 永远放在服务器，不进入 APK。没配置时仍可离线工作。</p>
          <input value={gatewayDraft} onChange={e => setGatewayDraft(e.target.value)} placeholder="https://你的-gateway.example.com" />
          <div className="gateway-row"><button onClick={() => { const baseUrl = gatewayDraft.trim().replace(/\/$/, ""); setGateway({ enabled: !!baseUrl, baseUrl }); }}>保存并启用</button><button className="ghost" onClick={() => { setGateway(defaultGatewayConfig); setGatewayDraft(""); }}>离线模式</button></div>
        </div>
        <div className="card permission-card">
          <p className="eyebrow">权限中心</p><h3>让我多替你做一点</h3>
          <p>通知权限开启后，我可以开始承担主动提醒。日历、文件、屏幕使用情况等权限会在后续版本逐步接入。</p>
          <button onClick={requestNotification}>{notificationEnabled ? "✓ 通知已开启" : "开启通知权限"}</button><button className="ghost" onClick={async () => { const ok = await enableSupervisor(supervisor, true); setNotificationEnabled(ok); }}>发送测试通知</button>
        </div>
        <div className="card permission-card">
          <p className="eyebrow">V0.8 · 课程知识库</p><h3>课程知识库已独立为一级栏目</h3>
          <p>把数学分析、线代、电子学等课程 PDF 导入设备本地；知识点现在可以标记掌握状态、安排轻量 SRS 复习，并直接进入今日任务池。</p>
          <button onClick={() => setView("knowledge")}>打开课程知识库</button>
        </div>
        <div className="card permission-card">
          <p className="eyebrow">数据恢复</p><h3>真正的数据备份 / 恢复</h3>
          <p>V0.7 会优先迁移 V0.6 数据；如果旧数据仍在本机就自动恢复。JSON 备份同时包含学习数据和课程知识库。</p>
          <div className="gateway-row">
            <button onClick={recoverLegacy}>扫描并恢复旧版本</button>
            <button className="ghost" onClick={exportBackup}>导出当前数据</button>
          </div>
          <input id="backup-input" type="file" accept="application/json,.json" style={{display:"none"}} disabled={backupBusy}
            onChange={e => { const f=e.target.files?.[0]; if(f) void importBackup(f); e.target.value=""; }} />
          <label htmlFor="backup-input" style={{display:"block",marginTop:10,padding:"12px",border:"1px dashed #888",borderRadius:10,textAlign:"center",cursor:"pointer"}}>
            {backupBusy ? "正在恢复…" : "📦 从 JSON 备份恢复"}
          </label>
        </div>
        <div className="card permission-card">
          <p className="eyebrow">应用更新</p><h3>当前版本 {APP_VERSION}</h3>
          <p>{updateChecking ? "正在检查…" : updateInfo ? `发现新版本 ${updateInfo.version}` : "点击检查更新后，会从官方更新清单读取最新版本。"}</p>
          <button onClick={async () => { setUpdateChecking(true); try { setUpdateInfo(await checkForUpdate()); } finally { setUpdateChecking(false); } }}>检查更新</button>
          {updateInfo && <button className="ghost" onClick={() => { window.location.href = updateInfo.downloadUrl; }}>前往更新</button>}
          <small>更新检查读取 GitHub 官方更新清单；发现新版本后可直接打开 APK 下载页。安装仍由 Android 系统确认，当前版本不伪装成“静默更新”。</small>
        </div>
        <div className="card mini-card"><small>今日容量</small><strong>{available} 分钟</strong><span>已安排 {plannedMinutes} 分钟</span></div>
        <div className="card mini-card"><small>最近记忆</small><p>{memory.summary || "还没有。你说的第一句话就会成为系统的一部分。"}</p></div>
        <div className="card principle"><small>核心原则</small><strong>用户输入越少，AI 完成的管理越多。</strong></div>
      </aside>
    </section>}

    {view === "knowledge" && <KnowledgeHubView />}
    {view === "today" && <TodayView date={date} setDate={setDate} available={available} plan={plan} update={update} record25={record25} />}
    {view === "data" && <DataView store={store} update={update} date={date} />}
    {view === "review" && <ReviewView date={date} plannedMinutes={plannedMinutes} actualToday={actualToday} store={store} update={update} />}
  </main>;
}

function KnowledgeHubView() { return <section><div className="section-head"><div><p className="eyebrow">KNOWLEDGE HUB</p><h2>课程知识库</h2><p className="hint">课程资料、知识点、复习与任务的统一入口。</p></div></div><div className="card"><p>课程知识库现在是一级栏目。下面进入完整的 PDF → 知识点 → 复习 → 任务工作台。</p><button onClick={() => { window.location.href = "/course"; }}>进入课程工作台</button></div></section>; }

function applyStewardActions(store: Store, actions: StewardAction[]): Store {
  let next = store;
  for (const action of actions) {
    if (action.type === "SET_AVAILABILITY") {
      next = { ...next, availability: { ...next.availability, [action.date]: Math.max(0, action.minutes) } };
    } else if (action.type === "UPDATE_TASK") {
      next = {
        ...next,
        tasks: next.tasks.map(t => t.id === action.taskId ? {
          ...t,
          status: action.status ?? t.status,
          plannedMinutes: action.plannedMinutes ?? t.plannedMinutes,
          plannedDate: action.plannedDate ?? t.plannedDate,
        } : t),
      };
    } else if (action.type === "CREATE_TASK") {
      next = {
        ...next,
        tasks: [...next.tasks, { ...action.task, id: id(), status: "TODO", actualMinutes: 0 }],
      };
    }
  }
  return next;
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
