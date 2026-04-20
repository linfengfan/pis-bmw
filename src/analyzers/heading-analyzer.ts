// src/analyzers/heading-analyzer.ts
// 基于字体大小聚类识别标题层级
// 策略：以全文字体大小中位数为正文基准，按比例分层

import type { HeadingBlock, TextItem } from '../domain/types.js';

export interface DetectedHeading {
  block: HeadingBlock;
  itemIndex: number;
  /** 标题在页面中的 Y 坐标 */
  y: number;
}

/**
 * 分析单页文本元素，标记哪些是标题。
 * @param items 页面所有 TextItem（含全文字体大小，用于推断基准）
 * @param baseFontSize 全文正文字体大小基准（由调用方传入，跨页统一）
 * @returns 识别到的标题列表（含 itemIndex，调用方需从 items 中剔除）
 */
export function detectHeadings(
  items: TextItem[],
  baseFontSize: number,
): DetectedHeading[] {
  const results: DetectedHeading[] = [];

  // 合并相邻行的同字体元素为完整标题文本
  // 先按 Y 坐标聚类为行，再在每行中识别标题
  const rows = clusterToRows(items);

  for (const row of rows) {
    const maxFontSize = Math.max(...row.items.map((e) => e.item.fontSize));
    const ratio = maxFontSize / baseFontSize;

    if (ratio < 1.04) continue; // 字体与正文无显著差异

    const level = ratio >= 1.4 ? 1 : ratio >= 1.2 ? 2 : ratio >= 1.1 ? 3 : 4;
    const text = row.items
      .sort((a, b) => a.item.x - b.item.x)
      .map(({ item }) => item.text.trim())
      .join(' ')
      .trim();

    if (!text) continue;

    // 记录行内第一个 item 的索引（用于后续排序和消费）
    results.push({
      block: { kind: 'heading', level: level as 1 | 2 | 3 | 4, text },
      itemIndex: row.items[0]!.idx,
      y: row.yCenter,
    });
  }

  return results;
}

/**
 * 计算全文正文字体大小基准（所有页面合并后取中位数）。
 * 中位数比平均值对大标题的异常值更鲁棒。
 */
export function computeBaseFontSize(allItems: TextItem[]): number {
  if (allItems.length === 0) return 12;
  const sizes = allItems.map((i) => i.fontSize).sort((a, b) => a - b);
  const mid = Math.floor(sizes.length / 2);
  return sizes[mid] ?? 12;
}

// ─────────────────────────────────────────────
// 辅助：按 Y 坐标聚类 TextItem 为行
// ─────────────────────────────────────────────
interface Row {
  yCenter: number;
  items: Array<{ item: TextItem; idx: number }>;
}

function clusterToRows(items: TextItem[]): Row[] {
  const rows: Row[] = [];
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]!;
    const threshold = item.fontSize * 0.5;
    const existing = rows.find((r) => Math.abs(r.yCenter - item.y) <= threshold);
    if (existing) {
      existing.items.push({ item, idx });
      existing.yCenter =
        existing.items.reduce((s, e) => s + e.item.y, 0) / existing.items.length;
    } else {
      rows.push({ yCenter: item.y, items: [{ item, idx }] });
    }
  }
  return rows.sort((a, b) => a.yCenter - b.yCenter);
}
