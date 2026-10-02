"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { CourseDocument, CourseSection, KnowledgePoint, CourseKnowledgeDB, COURSE_KNOWLEDGE_KEY, LEGACY_COURSE_KNOWLEDGE_KEYS, extractPdfText, inferKnowledgePoints, parseSections } from "../../lib/courseKnowledge";
import { id, Task, today } from "../../lib/domain";
import { buildReviewTask, defaultReviewState, scheduleReview } from "../../lib/learningEngine";

type DB = CourseKnowledgeDB;
const blank: DB = { documents: [], sections: [], points: [], reviews: [] };

export default function CourseWorkspace() {
  const [db, setDb] = useState<DB>(blank);
  const [courseId, setCourseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("PDF 会先在设备本地提取文字，不上传文件。");
  const [selected, setSelected] = useState<string>("");
  const [fileName, setFileName] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try { let raw=JSON.parse(localStorage.getItem(COURSE_KNOWLEDGE_KEY) || "null"); if (!raw) for (const legacyKey of LEGACY_COURSE_KNOWLEDGE_KEYS) { const legacy=JSON.parse(localStorage.getItem(legacyKey)||"null"); if (legacy) { raw=legacy; localStorage.setItem(COURSE_KNOWLEDGE_KEY, JSON.stringify(legacy)); break; } } setDb({...blank,...raw,reviews:raw?.reviews||[]}); } catch {} finally { setLoaded(true); }
  }, []);
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(COURSE_KNOWLEDGE_KEY, JSON.stringify(db));
  }, [db, loaded]);

  const choosePdf = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setPendingFile(file);
    setFileName(file?.name || "");
    setMessage(file ? `已选择「${file.name}」，点击「开始导入」才会真正写入知识库。` : "尚未选择 PDF。");
    e.target.value = "";
  };

  const importPdf = async () => {
    if (!pendingFile) {
      setMessage("先点击「选择 PDF」，选中课程文件。");
      return;
    }
    const file = pendingFile;
    setBusy(true); setMessage("正在读取 PDF，并建立课程结构…");
    try {
      const { text, pages } = await extractPdfText(file);
      const documentId = id();
      const sections = parseSections(text).map(s => ({ ...s, id: id(), documentId }));
      const points = sections.flatMap(s => inferKnowledgePoints(s, courseId || undefined));
      const doc: CourseDocument = { id: documentId, courseId: courseId || undefined, name: file.name, size: file.size, pages, importedAt: new Date().toISOString(), extractedText: text };
      setDb(old => ({ documents: [...old.documents, doc], sections: [...old.sections, ...sections], points: [...old.points, ...points], reviews: old.reviews }));
      setSelected(documentId);
      setPendingFile(null);
      setMessage(`导入成功：${pages} 页，${sections.length} 个结构段，${points.length} 个知识点候选。已写入本机知识库。`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "PDF 读取失败");
    } finally { setBusy(false); }
  };

  const current = db.documents.find(d => d.id === selected);
  const currentSections = db.sections.filter(s => s.documentId === selected);
  const currentPoints = db.points.filter(p => currentSections.some(s => s.id === p.sectionId));
  const reviewFor = (point: KnowledgePoint) => db.reviews.find(r => r.knowledgePointId === point.id) || defaultReviewState(point.id);
  const setReview = (point: KnowledgePoint, success: boolean) => { const next=scheduleReview(reviewFor(point),success); setDb(old=>({...old,reviews:[...old.reviews.filter(r=>r.knowledgePointId!==point.id),next]})); };
  const createTask = (point: KnowledgePoint) => { const state=reviewFor(point); const task=buildReviewTask(point,state); try { const key="personal-learning-os-store"; const old=JSON.parse(localStorage.getItem(key)||"null")||JSON.parse(localStorage.getItem("personal-learning-os-v07")||"null")||JSON.parse(localStorage.getItem("personal-learning-os-v06")||"null")||{goals:[],courses:[],tasks:[],sessions:[],reviews:[],schedule:[],availability:{}}; const tasks=Array.isArray(old.tasks)?old.tasks:[]; if(tasks.some((t:Task)=>t.knowledgePointId===point.id && t.status!=="DONE")) { setMessage("该知识点已经在任务池里，不重复创建。"); return; } old.tasks=[...tasks,task]; old.schemaVersion=8; localStorage.setItem(key,JSON.stringify(old)); setMessage("已把该知识点加入今日任务池。返回今日计划后会自动纳入。"); } catch { setMessage("任务创建失败，请稍后重试。"); } };

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">PERSONAL LEARNING OS · V0.8.1</p><h1>课程知识库 <span>PDF → 知识点</span></h1><p className="sub">把你真正上课用的 PDF 变成可管理的课程结构，而不是把文件丢进一个黑箱。</p></div>
      <button onClick={() => { window.location.href = "/"; }}>返回 AI 管家</button>
    </header>

    <section className="two">
      <div>
        <div className="card form">
          <p className="eyebrow">IMPORT</p>
          <h2>导入课程 PDF</h2>
          <p className="hint">先选择课程，再点击下面的<strong>「选择 PDF 并导入」</strong>。文件只在本机处理，不会自动上传。</p>
          <label>课程名称（可选）
            <input value={courseId} onChange={e => setCourseId(e.target.value)} placeholder="例如：数学分析 / 线性代数 / 电子学" />
          </label>
          <input id="course-pdf-input" type="file" accept="application/pdf,.pdf" onChange={choosePdf} disabled={busy} style={{ display: "none" }} />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14}}>
            <label htmlFor="course-pdf-input" style={{display:"block",padding:"14px",border:"2px solid #555",borderRadius:12,textAlign:"center",cursor:busy?"wait":"pointer",fontWeight:700}}>
              📄 1. 选择 PDF
            </label>
            <button type="button" onClick={() => void importPdf()} disabled={busy || !pendingFile}>
              {busy ? "正在解析…" : "▶ 2. 开始导入"}
            </button>
          </div>
          <p className="hint">{fileName ? `已选择：${fileName}` : "还没有选择文件。支持 .pdf；扫描版/图片型 PDF 暂不做 OCR。"}</p>
          <div className="notice">{message}</div>
        </div>

        <div className="card">
          <h3>已导入资料</h3>
          {db.documents.length ? db.documents.map(d => <button key={d.id} className="ghost" onClick={() => setSelected(d.id)} style={{display:"block",width:"100%",textAlign:"left",marginBottom:8}}>{d.name} · {d.pages} 页 · {Math.round(d.size/1024)} KB</button>) : <p className="empty">还没有 PDF。</p>}
        </div>
      </div>

      <div>
        {current ? <>
          <div className="card"><p className="eyebrow">DOCUMENT</p><h2>{current.name}</h2><p>{current.pages} 页 · {currentSections.length} 个结构段 · {currentPoints.length} 个知识点</p></div>
          <div className="card"><h3>结构</h3>{currentSections.length ? currentSections.slice(0,40).map(s => <div key={s.id} style={{padding:"10px 0",borderBottom:"1px solid #ddd"}}><b>{s.order + 1}. {s.title}</b><p className="hint">{s.text.slice(0,280)}{s.text.length>280?"…":""}</p></div>) : <p className="empty">暂未识别章节结构。</p>}</div>
          <div className="card"><h3>知识点与复习</h3>{currentPoints.length ? currentPoints.map(p => { const r=reviewFor(p); return <div key={p.id} style={{padding:"12px 0",borderBottom:"1px solid #ddd"}}><b>{p.title}</b><small> · {p.type} · 重要度 {p.importance} · 状态 {r.status} · {r.reviewDueAt?`下次复习 ${r.reviewDueAt}`:"尚未安排复习"}</small><div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}><button onClick={()=>setReview(p,true)}>✓ 我会了</button><button className="ghost" onClick={()=>setReview(p,false)}>✕ 还不会</button><button className="ghost" onClick={()=>createTask(p)}>加入今日任务</button></div></div>; }) : <p className="empty">暂未识别。当前解析器会识别 Définition / Théorème / Propriété / Formule / Exemple 等标题；普通正文会保留在结构里。</p>}</div>
          <div className="card"><h3>原文预览</h3><pre style={{whiteSpace:"pre-wrap",maxHeight:420,overflow:"auto",fontSize:13}}>{current.extractedText.slice(0,12000)}{current.extractedText.length>12000?"\n…（已截断预览）":""}</pre></div>
        </> : <div className="card"><h2>课程资料工作台</h2><p>这里会逐步形成：PDF → Chapitre/Section → Définition/Théorème/Propriété/Formule → 知识点 → 学习任务 → 掌握度。</p><div className="notice">当前最先要做的就是上面的「选择 PDF 并导入」。</div></div>}
      </div>
    </section>
  </main>;
}
