"use client";

import CourseWorkspace from "./CourseWorkspace";

export default function CoursePage() {
  return <main className="shell">
    <header className="topbar">
      <div>
        <p className="eyebrow">PERSONAL LEARNING OS · V0.8.1</p>
        <h1>课程知识库 <span>PDF → 知识点</span></h1>
        <p className="sub">把你真正上课用的 PDF 变成可管理的课程结构，而不是把文件丢进一个黑箱。</p>
      </div>
      <button onClick={() => { window.location.href = "/"; }}>返回 AI 管家</button>
    </header>
    <CourseWorkspace />
  </main>;
}
