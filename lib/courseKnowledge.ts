export type CourseDocument = {
  id: string;
  courseId?: string;
  name: string;
  size: number;
  pages: number;
  importedAt: string;
  extractedText: string;
};

export type CourseSection = {
  id: string;
  documentId: string;
  title: string;
  order: number;
  pageStart?: number;
  pageEnd?: number;
  text: string;
};

export type KnowledgePoint = {
  id: string;
  courseId?: string;
  sectionId?: string;
  title: string;
  type: "DEFINITION" | "THEOREM" | "PROPERTY" | "FORMULA" | "CONCEPT" | "EXAMPLE";
  importance: 1 | 2 | 3;
  sourceText?: string;
  status: "UNKNOWN" | "LEARNING" | "MASTERED";
};

export const COURSE_KNOWLEDGE_KEY = "personal-learning-os-v06-knowledge";

export function parseSections(text: string): Omit<CourseSection, "id" | "documentId">[] {
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const heading = /^(chapitre|chapter|section|partie|définition|definition|théorème|theorem|propriété|property|proposition|lem(me)?|exemple|example)\b/i;
  const sections: Omit<CourseSection, "id" | "documentId">[] = [];
  let current: Omit<CourseSection, "id" | "documentId"> | null = null;
  let order = 0;
  for (const line of lines) {
    if (heading.test(line) || /^\d+(?:\.\d+)*\s+\S/.test(line)) {
      if (current) sections.push(current);
      current = { title: line.slice(0, 160), order: order++, text: line };
    } else if (current) {
      current.text += "\n" + line;
    }
  }
  if (current) sections.push(current);
  if (!sections.length && text.trim()) sections.push({ title: "全文", order: 0, text: text.trim() });
  return sections;
}

export function inferKnowledgePoints(section: CourseSection, courseId?: string): KnowledgePoint[] {
  const lines = section.text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const results: KnowledgePoint[] = [];
  const patterns: Array<[RegExp, KnowledgePoint["type"]]> = [
    [/^(définition|definition)\b/i, "DEFINITION"],
    [/^(théorème|theorem|proposition|lemme|lemma)\b/i, "THEOREM"],
    [/^(propriété|property)\b/i, "PROPERTY"],
    [/^(formule|formula)\b/i, "FORMULA"],
    [/^(exemple|example)\b/i, "EXAMPLE"]
  ];
  for (const line of lines) {
    const match = patterns.find(([re]) => re.test(line));
    if (match) {
      results.push({
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        courseId,
        sectionId: section.id,
        title: line.slice(0, 120),
        type: match[1],
        importance: match[1] === "THEOREM" || match[1] === "DEFINITION" ? 3 : 2,
        sourceText: line,
        status: "UNKNOWN"
      });
    }
  }
  return results;
}

export async function extractPdfText(file: File): Promise<{ text: string; pages: number }> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error("请选择 PDF 文件");
  const pdfjs = await import("pdfjs-dist");
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const chunks: string[] = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: { str?: string }) => item.str || "").join(" ").replace(/\s+/g, " ").trim();
    chunks.push(`[第 ${pageNo} 页]\n${pageText}`);
  }
  return { text: chunks.join("\n\n"), pages: pdf.numPages };
}
