import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "文档向量化",
  description: "PDF/URL → 向量化 → 语义检索",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}