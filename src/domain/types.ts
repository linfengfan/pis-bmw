// src/domain/types.ts
// 核心领域类型 —— 所有模块共享的契约，禁止 any

/** PDF 页面中的单个文本元素（来自 pdfjs-dist TextItem） */
export interface TextItem {
  /** 文本内容 */
  text: string;
  /** 页面坐标系（左下原点）: x 轴向右，y 轴向上 */
  x: number;
  y: number;
  /** 文本渲染宽度（pt） */
  width: number;
  /** 文本渲染高度（pt，近似字体大小） */
  height: number;
  /** 字体名称（用于标题/公式检测） */
  fontName: string;
  /** 字体大小（pt） */
  fontSize: number;
  /** 是否粗体（从 fontName 推断） */
  bold: boolean;
  /** 是否斜体 */
  italic: boolean;
  /** 原始 transform 矩阵 [scaleX, skewX, skewY, scaleY, translateX, translateY] */
  transform: [number, number, number, number, number, number];
}

/** PDF 页面中的线条（从操作符流提取） */
export interface PdfLine {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** 是否水平（abs(y1-y0) < 2） */
  horizontal: boolean;
}

/** PDF 页面中的矩形（来自 `re` 操作符） */
export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 单个页面的原始提取结果 */
export interface ExtractedPage {
  pageNumber: number;
  /** 页面宽度（pt） */
  width: number;
  /** 页面高度（pt） */
  height: number;
  items: TextItem[];
  lines: PdfLine[];
  rects: PdfRect[];
  /** 图片资源数量（仅计数，占位用） */
  imageCount: number;
}

// ─────────────────────────────────────────────
// 文档块 —— 辨识联合（Discriminated Union）
// ─────────────────────────────────────────────

export interface HeadingBlock {
  kind: 'heading';
  level: 1 | 2 | 3 | 4;
  text: string;
}

export interface ParagraphBlock {
  kind: 'paragraph';
  text: string;
}

export interface TableBlock {
  kind: 'table';
  /** 第一行作为表头 */
  headers: string[];
  rows: string[][];
}

export interface ImageBlock {
  kind: 'image';
  /** 图片序号（跨页全局编号） */
  index: number;
  alt: string;
}

export interface FormulaBlock {
  kind: 'formula';
  /** LaTeX 或原始文本 */
  latex: string;
  /** true = 行内 $...$，false = 独立 $$...$$ */
  inline: boolean;
}

export interface FootnoteBlock {
  kind: 'footnote';
  /** 脚注标记，如 "1"、"*" */
  marker: string;
  text: string;
}

export interface PageBreakBlock {
  kind: 'pagebreak';
}

export type DocumentBlock =
  | HeadingBlock
  | ParagraphBlock
  | TableBlock
  | ImageBlock
  | FormulaBlock
  | FootnoteBlock
  | PageBreakBlock;

/** 转换结果统计元数据 */
export interface ConvertMeta {
  pages: number;
  tables: number;
  images: number;
  headings: number;
  footnotes: number;
}

/** 转换策略 */
export type TableStrategy = 'auto' | 'line' | 'text';
