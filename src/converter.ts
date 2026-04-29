// src/converter.ts
// Pipeline Facade：编排 extract → analyze → render
// 各阶段之间传递不可变数据，互不依赖

import type { ConvertMeta, DocumentBlock, TableStrategy, TextItem } from './domain/types.js';
import { extractPdf } from './extractors/pdf-extractor.js';
import { detectTables } from './analyzers/table-analyzer.js';
import { computeBaseFontSize, detectHeadings } from './analyzers/heading-analyzer.js';
import { analyzeLayout } from './analyzers/layout-analyzer.js';
import { detectFootnotes } from './analyzers/footnote-analyzer.js';
import { detectFormulas } from './analyzers/formula-analyzer.js';
import { renderMarkdown } from './renderers/markdown-renderer.js';

export interface ConvertResult {
  markdown: string;
  meta: ConvertMeta;
}

export interface ConvertOptions {
  strategy: TableStrategy;
  /** 是否输出调试信息到 stderr */
  debug?: boolean | undefined;
}

export async function convertPdf(
  filePath: string,
  options: ConvertOptions = { strategy: 'auto' },
): Promise<ConvertResult> {
  const { strategy, debug } = options;

  // ── Phase 1: 提取 ──
  const pages = await extractPdf(filePath);

  if (debug) {
    console.error(`[debug] 解析完成: ${pages.length} 页`);
  }

  // ── Phase 2: 计算全局基准字体大小（跨页统一）──
  const allItems = pages.flatMap((p) => p.items);
  const baseFontSize = computeBaseFontSize(allItems);

  if (debug) {
    console.error(`[debug] 正文基准字体大小: ${baseFontSize.toFixed(1)}pt`);
  }

  // ── Phase 3: 逐页分析，构建 DocumentBlock[] ──
  const allBlocks: DocumentBlock[] = [];
  let totalTables = 0;
  let totalImages = 0;
  let totalFootnotes = 0;
  let totalHeadings = 0;
  let globalImageIndex = 0;

  for (const page of pages) {
    const consumed = new Set<number>();

    // 3-1: 表格检测（优先，消费表格区域 items）
    const tables = detectTables(page, strategy);
    for (const t of tables) {
      t.consumedIndexes.forEach((i) => consumed.add(i));
    }
    totalTables += tables.length;

    // 3-2: 数学公式检测
    const formulas = detectFormulas(page.items, page.width, consumed);
    for (const f of formulas) {
      f.consumedIndexes.forEach((i) => consumed.add(i));
    }

    // 3-3: 脚注检测
    const footnotes = detectFootnotes(page.items, page.height, baseFontSize, consumed);
    for (const fn of footnotes) {
      fn.consumedIndexes.forEach((i) => consumed.add(i));
    }
    totalFootnotes += footnotes.length;

    // 3-4: 图片块（基于 imageCount 生成占位）
    const imageBlocks: DocumentBlock[] = [];
    for (let img = 0; img < page.imageCount; img++) {
      globalImageIndex++;
      imageBlocks.push({ kind: 'image', index: globalImageIndex, alt: `图片 ${globalImageIndex}` });
    }
    totalImages += page.imageCount;

    // 3-5: 标题检测（在剩余 items 中）
    const headings = detectHeadings(
      page.items.filter((_, idx) => !consumed.has(idx)),
      baseFontSize,
    );
    // 标题消费其对应的 itemIndex（相对于过滤后的 items，需映射回原始索引）
    const filteredItems = page.items.map((item, idx) => ({ item, idx })).filter(
      ({ idx }) => !consumed.has(idx),
    );
    for (const h of headings) {
      const originalIdx = filteredItems[h.itemIndex]?.idx;
      if (originalIdx !== undefined) consumed.add(originalIdx);
    }
    totalHeadings += headings.length;

    // 3-6: 阅读顺序重建（剩余段落 items）
    const orderedItems = analyzeLayout(page, consumed);

    // ── Phase 4: 将本页所有元素按 Y 坐标合并为有序 blocks ──
    // 构建带 Y 坐标的 block 列表，再全局排序
    type Positioned = { y: number; block: DocumentBlock };
    const positioned: Positioned[] = [];

    // 表格
    for (const t of tables) {
      positioned.push({ y: t.yMin, block: t.block });
    }

    // 公式
    for (const f of formulas) {
      positioned.push({ y: f.y, block: f.block });
    }

    // 标题
    for (const h of headings) {
      positioned.push({ y: h.y, block: h.block });
    }

    // 图片（紧跟在当前位置，Y 取所有已消费 item 的均值做近似）
    if (imageBlocks.length > 0) {
      const midY = page.height * 0.5;
      for (const img of imageBlocks) {
        positioned.push({ y: midY, block: img });
      }
    }

    // 段落：将有序 TextItem 合并为段落
    const paragraphBlocks = buildParagraphs(orderedItems, baseFontSize);
    for (const pb of paragraphBlocks) {
      positioned.push(pb);
    }

    // 按 Y 坐标排序
    positioned.sort((a, b) => a.y - b.y);
    allBlocks.push(...positioned.map((p) => p.block));

    // 脚注排在本页最后
    for (const fn of footnotes) {
      allBlocks.push(fn.block);
    }

    // 分页标记（非最后一页）
    if (page.pageNumber < pages.length) {
      allBlocks.push({ kind: 'pagebreak' });
    }
  }

  if (debug) {
    console.error(
      `[debug] 检测结果: ${totalTables} 表格, ${totalImages} 图片, ${totalHeadings} 标题, ${totalFootnotes} 脚注`,
    );
  }

  const markdown = renderMarkdown(allBlocks);

  return {
    markdown,
    meta: {
      pages: pages.length,
      tables: totalTables,
      images: totalImages,
      headings: totalHeadings,
      footnotes: totalFootnotes,
    },
  };
}

// ─────────────────────────────────────────────
// 将有序 TextItem 序列重建为段落 DocumentBlock
// 相邻 item Y 差 ≤ lineSpacing → 同段落；否则新段落
// ─────────────────────────────────────────────
function buildParagraphs(
  items: TextItem[],
  baseFontSize: number,
): Array<{ y: number; block: DocumentBlock }> {
  if (items.length === 0) return [];

  const lineSpacing = baseFontSize * 2.0;
  const paragraphs: Array<{ y: number; block: DocumentBlock }> = [];
  let currentLines: string[] = [];
  let currentY = items[0]!.y;
  let prevY = items[0]!.y;

  const flush = (): void => {
    if (currentLines.length === 0) return;
    const text = currentLines.join(' ').trim();
    if (text) {
      paragraphs.push({ y: currentY, block: { kind: 'paragraph', text } });
    }
    currentLines = [];
  };

  for (const item of items) {
    if (Math.abs(item.y - prevY) > lineSpacing && currentLines.length > 0) {
      flush();
      currentY = item.y;
    }

    // 判断是否需要行内换行（同段落内换行）
    // pdfjs 会将同行的多个 span 分开，需要合并
    currentLines.push(item.text.trim());
    prevY = item.y;
  }

  flush();
  return paragraphs;
}
