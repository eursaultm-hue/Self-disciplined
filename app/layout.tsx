import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = { title: "Personal Learning OS", description: "目标到复盘的个人学习循环" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
