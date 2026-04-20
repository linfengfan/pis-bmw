// src/analyzers/layout-analyzer.ts
// 阅读顺序重建：检测多列布局，按正确顺序输出 TextItem
// 多列判断：X 坐标出现双峰分布（峰间距 > 页宽×0.08）

import type { ExtractedPage, TextItem } from '../domain/types.js';

export interface LayoutRow {
  yCenter: number;
  items: TextItem[];
  /** 所属列区间 [xMin, xMax]，单列时为全页宽 */
  column: number;
}

/**
 * 将页面 TextItem 按阅读顺序排列为行序列。
 * 多列布局时，同一列的行从上到下，列间从左到右。
 */
export function analyzeLayout(
  page: ExtractedPage,
  excludedIndexes: Set<number>,
): TextItem[] {
  const available = page.items.filter((_, idx) => !excludedIndexes.has(idx));
  if (available.length === 0) return [];

  // 检测列数（双峰 X 分布）
  const columns = detectColumns(available, page.width);

  if (columns.length <= 1) {
    // 单列：直接按 Y 排序
    return sortByY(available);
  }

  // 多列：按列分组，列内按 Y 排序，列间按 X 排序
  const result: TextItem[] = [];
  const sortedCols = columns.sort((a, b) => a.xMin - b.xMin);

  for (const col of sortedCols) {
    const colItems = available.filter(
      (item) => item.x >= col.xMin - 5 && item.x < col.xMax + 5,
    );
    result.push(...sortByY(colItems));
  }

  return result;
}

interface Column {
  xMin: number;
  xMax: number;
}

// ─────────────────────────────────────────────
// 列检测：X 坐标直方图 → 低谷分割
// ─────────────────────────────────────────────
function detectColumns(items: TextItem[], pageWidth: number): Column[] {
  if (items.length < 10) return [{ xMin: 0, xMax: pageWidth }];

  const binCount = 20;
  const binWidth = pageWidth / binCount;
  const hist = new Array<number>(binCount).fill(0);

  for (const item of items) {
    const bin = Math.min(Math.floor(item.x / binWidth), binCount - 1);
    hist[bin] = (hist[bin] ?? 0) + 1;
  }

  // 找出连续的"空谷"区间（item 数 < 全局均值×0.2，宽度 > 页宽×0.05）
  const avg = hist.reduce((s, v) => s + v, 0) / binCount;
  const threshold = avg * 0.2;

  const gaps: Array<{ start: number; end: number }> = [];
  let gapStart = -1;

  for (let i = 0; i < binCount; i++) {
    if ((hist[i] ?? 0) <= threshold) {
      if (gapStart === -1) gapStart = i;
    } else if (gapStart !== -1) {
      const gapWidth = (i - gapStart) * binWidth;
      if (gapWidth >= pageWidth * 0.05) {
        gaps.push({ start: gapStart, end: i - 1 });
      }
      gapStart = -1;
    }
  }

  if (gaps.length === 0) return [{ xMin: 0, xMax: pageWidth }];

  // 将空谷分割为列区间
  const columns: Column[] = [];
  let xMin = 0;

  for (const gap of gaps) {
    const xMax = gap.start * binWidth;
    if (xMax - xMin > pageWidth * 0.1) {
      columns.push({ xMin, xMax });
    }
    xMin = (gap.end + 1) * binWidth;
  }

  if (pageWidth - xMin > pageWidth * 0.1) {
    columns.push({ xMin, xMax: pageWidth });
  }

  return columns.length >= 2 ? columns : [{ xMin: 0, xMax: pageWidth }];
}

function sortByY(items: TextItem[]): TextItem[] {
  return [...items].sort((a, b) => a.y - b.y || a.x - b.x);
}
