"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { CourseDocument, CourseSection, KnowledgePoint, COURSE_KNOWLEDGE_KEY, extractPdfText, inferKnowledgePoints, parseSections } from "../../lib/courseKnowledge";
import { id } from "../../lib/domain";

type DB = { documents: CourseDocument[]; sections: CourseSection[]; points: KnowledgePoint[] };
const blank: DB = { documents: [], sections: [], points: [] };

export default function CourseWorkspace() {
  const [db, setDb] = useState<DB>(blank);
  const [courseId, setCourseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("PDF 会先在设备本地提取文字，不上传文件。");
  const [selected, setSelected] = useState<string>("");
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    try { setDb(JSON.parse(localStorage.getItem(COURSE_KNOWLEDGE_KEY) || "null") || blank); } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem(COURSE_KNOWLEDGE_KEY, JSON.stringify(db));
  }, [db]);

  const importPdf = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setBusy(true); setMessage("正在读取 PDF…");
    try {
      const { text, pages } = await extractPdfText(file);
      const documentId = id();
      const sections = parseSections(text).map(s => ({ ...s, id: id(), documentId }));
      const points = sections.flatMap(s => inferKnowledgePoints(s, courseId || undefined));
      const doc: CourseDocument = { id: documentId, courseId: courseId || undefined, name: file.name, size: file.size, pages, importedAt: new Date().toISOString(), extractedText: text };
      setDb(old => ({ documents: [...old.documents, doc], sections: [...old.sections, ...sections], points: [...old.points, ...points] }));
      setSelected(documentId);
      setMessage(`已导入 ${pages} 页，识别 ${sections.length} 个结构段、${points.length} 个知识点。后续可交给 Gateway 做更精细的知识点整理。`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "PDF 读取失败");
    } finally { setBusy(false); e.target.value = ""; }
  };

  const current = db.documents.find(d => d.id === selected);
  const currentSections = db.sections.filter(s => s.documentId === selected);
  const currentPoints = db.points.filter(p => currentSections.some(s => s.id === p.sectionId));

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">PERSONAL LEARNING OS · V0.6</p><h1>课程知识库 <span>PDF → 知识点</span></h1><p className="sub">把你真正上课用的 PDF 变成可管理的课程结构，而不是把文件丢进一个黑箱。</p></div>
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
          <input id="course-pdf-input" type="file" accept="application/pdf,.pdf" onChange={importPdf} disabled={busy} style={{ display: "none" }} />
          <label htmlFor="course-pdf-input" style={{ display: "block", padding: "16px 18px", marginTop: 14, border: "2px dashed #888", borderRadius: 12, textAlign: "center", cursor: busy ? "wait" : "pointer", fontWeight: 700 }}>
            {busy ? "正在导入 PDF…" : "📄 选择 PDF 并导入"}
          </label>
          <p className="hint">{fileName ? `已选择：${fileName}` : "支持 .pdf；扫描版/图片型 PDF 暂不做 OCR。"}</p>
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
          <div className="card"><h3>知识点候选</h3>{currentPoints.length ? currentPoints.map(p => <div key={p.id} style={{padding:"9px 0",borderBottom:"1px solid #ddd"}}><b>{p.title}</b><small> · {p.type} · 重要度 {p.importance}</small></div>) : <p className="empty">暂未识别。后续可以让 Gateway 做语义整理。</p>}</div>
        </> : <div className="card"><h2>课程资料工作台</h2><p>这里会逐步形成：PDF → Chapitre/Section → Définition/Théorème/Propriété/Formule → 知识点 → 学习任务 → 掌握度。</p><div className="notice">当前最先要做的就是上面的「选择 PDF 并导入」。</div></div>}
      </div>
    </section>
  </main>;
}
