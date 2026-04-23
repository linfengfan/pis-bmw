// src/services/pdfParser.ts
import { getDocument } from "pdfjs-dist";

/**
 * 将 PDF 字节流 → 纯文本
 *
 * 使用 pdfjs-dist（纯 JS，无 C 依赖，跨平台友好）
 */
export async function pdfToText(fileBuffer: Buffer): Promise<string> {
  const loadingTask = getDocument({ data: new Uint8Array(fileBuffer) });
  const pdf = await loadingTask.promise;
  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(" ");
    textParts.push(pageText);
  }

  // 清理：合并多余空格、去除空行
  return textParts
    .join("\n")
    .replace(/\s+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

/**
 * 从 PDF 提取元信息（标题、作者）
 */
export async function extractPdfMetadata(
  fileBuffer: Buffer
): Promise<{ title?: string; author?: string }> {
  try {
    const loadingTask = getDocument({ data: new Uint8Array(fileBuffer) });
    const pdf = await loadingTask.promise;
    const meta = await pdf.getMetadata();
    const info = meta?.info as any;
    return {
      title: info?.Title || undefined,
      author: info?.Author || undefined,
    };
  } catch {
    return {};
  }
}
