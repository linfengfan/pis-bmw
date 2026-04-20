// src/extractors/pdf-extractor.ts
// 封装 pdfjs-dist v4，提取每页文本元素、线条几何、图片资源
// Node.js 环境无需 canvas，仅使用文本层和操作符层

import { readFile } from 'node:fs/promises';
import type { ExtractedPage, PdfLine, PdfRect, TextItem } from '../domain/types.js';

// pdfjs-dist v4 Node.js 环境使用 legacy 构建（避免 Web 专属 API 依赖）
const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
// 指向 worker 文件（Node.js 中需要显式提供，不能为空字符串）
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url,
).href;

// ─────────────────────────────────────────────
// 从字体名推断粗体 / 斜体
// ─────────────────────────────────────────────
function inferFontStyle(fontName: string): { bold: boolean; italic: boolean } {
  const lower = fontName.toLowerCase();
  return {
    bold: /bold|black|heavy|demi|semibold/.test(lower),
    italic: /italic|oblique|slant/.test(lower),
  };
}

// ─────────────────────────────────────────────
// 从 PDF transform 矩阵提取 fontSize（pt）
// transform = [a, b, c, d, e, f]，fontSize ≈ ||(a, b)||
// ─────────────────────────────────────────────
function extractFontSize(transform: number[]): number {
  const a = transform[0] ?? 1;
  const b = transform[1] ?? 0;
  return Math.round(Math.sqrt(a * a + b * b) * 10) / 10;
}

// ─────────────────────────────────────────────
// 主提取函数
// ─────────────────────────────────────────────
export async function extractPdf(filePath: string): Promise<ExtractedPage[]> {
  const data = await readFile(filePath);
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  }).promise;

  const pages: ExtractedPage[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const pageH = viewport.height;

    // ── 文本内容提取 ──
    const textContent = await page.getTextContent();
    const items: TextItem[] = [];

    for (const raw of textContent.items) {
      if (!('str' in raw) || typeof raw.str !== 'string') continue;
      if (!raw.str.trim()) continue;

      const transform = Array.isArray(raw.transform)
        ? (raw.transform as number[])
        : [1, 0, 0, 1, 0, 0];

      const fontSize = extractFontSize(transform);
      const x = transform[4] ?? 0;
      // pdfjs Y 轴原点在左下，转为左上原点
      const yRaw = transform[5] ?? 0;
      const y = pageH - yRaw;

      const fontName: string =
        typeof raw.fontName === 'string' ? raw.fontName : 'unknown';
      const { bold, italic } = inferFontStyle(fontName);
      const width = typeof raw.width === 'number' ? Math.abs(raw.width) : 0;
      const height = typeof raw.height === 'number' ? Math.abs(raw.height) : fontSize;

      items.push({
        text: raw.str,
        x,
        y,
        width: width || fontSize * raw.str.length * 0.5,
        height: height || fontSize,
        fontName,
        fontSize,
        bold,
        italic,
        transform: transform as [number, number, number, number, number, number],
      });
    }

    // ── 操作符流：提取线条和矩形 ──
    const { lines, rects, imageCount } = await extractGeometry(page, pageH);

    pages.push({
      pageNumber: pageNum,
      width: viewport.width,
      height: pageH,
      items,
      lines,
      rects,
      imageCount,
    });

    page.cleanup();
  }

  return pages;
}

// ─────────────────────────────────────────────
// 从操作符流提取几何信息（线条、矩形）和图片计数
// ─────────────────────────────────────────────
async function extractGeometry(
  // pdfjs-dist 的 PDFPageProxy 类型
  page: Awaited<ReturnType<ReturnType<typeof pdfjsLib.getDocument>['promise']['then']>>,
  pageHeight: number,
): Promise<{ lines: PdfLine[]; rects: PdfRect[]; imageCount: number }> {
  const lines: PdfLine[] = [];
  const rects: PdfRect[] = [];
  let imageCount = 0;

  try {
    // pdfjs-dist 类型不完整，使用类型断言
    const ops = await (page as unknown as {
      getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
    }).getOperatorList();

    const OPS = pdfjsLib.OPS as Record<string, number>;
    const MV = OPS['moveTo'] ?? 13;
    const LT = OPS['lineTo'] ?? 14;
    const RE = OPS['rectangle'] ?? 67;
    const IMG = OPS['paintImageXObject'] ?? 85;
    const IMG2 = OPS['paintInlineImageXObject'] ?? 86;

    let curX = 0;
    let curY = 0;

    for (let i = 0; i < ops.fnArray.length; i++) {
      const op = ops.fnArray[i] as number;
      const args = (ops.argsArray[i] ?? []) as number[];

      if (op === MV) {
        curX = args[0] ?? 0;
        curY = args[1] ?? 0;
      } else if (op === LT) {
        const x1 = args[0] ?? 0;
        const y1 = args[1] ?? 0;
        const y0t = pageHeight - curY;
        const y1t = pageHeight - y1;
        const isH = Math.abs(y1t - y0t) < 2;
        const isV = Math.abs(x1 - curX) < 2;
        if (isH || isV) {
          lines.push({ x0: curX, y0: y0t, x1, y1: y1t, horizontal: isH });
        }
        curX = x1;
        curY = y1;
      } else if (op === RE) {
        const rx = args[0] ?? 0;
        const ry = args[1] ?? 0;
        const rw = args[2] ?? 0;
        const rh = args[3] ?? 0;
        const aw = Math.abs(rw);
        const ah = Math.abs(rh);

        if (aw > 5 && ah > 5) {
          const top = pageHeight - ry;
          const bottom = pageHeight - ry - ah;
          rects.push({ x: rx, y: Math.min(top, bottom), width: aw, height: ah });
          // 矩形四边加入 lines
          lines.push(
            { x0: rx, y0: top, x1: rx + aw, y1: top, horizontal: true },
            { x0: rx, y0: bottom, x1: rx + aw, y1: bottom, horizontal: true },
            { x0: rx, y0: top, x1: rx, y1: bottom, horizontal: false },
            { x0: rx + aw, y0: top, x1: rx + aw, y1: bottom, horizontal: false },
          );
        }
      } else if (op === IMG || op === IMG2) {
        imageCount++;
      }
    }
  } catch {
    // 静默降级：操作符解析失败不影响文本提取
  }

  return { lines, rects, imageCount };
}
