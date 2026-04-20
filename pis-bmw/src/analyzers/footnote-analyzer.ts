// src/analyzers/footnote-analyzer.ts
// 脚注检测：页脚区域小字体 + 数字/符号开头 → FootnoteBlock
// 正文中上标引用模式（数字/符号紧跟大字号后出现小字号）→ [^N]

import type { FootnoteBlock, TextItem } from '../domain/types.js';

export interface DetectedFootnote {
  block: FootnoteBlock;
  /** 消费的 TextItem 索引集合 */
  consumedIndexes: Set<number>;
  /** 脚注 Y 坐标（用于排序，应排在页面最后） */
  y: number;
}

/**
 * 从页面 TextItem 中提取脚注。
 * 脚注特征：
 *   1. 位于页面底部（Y > pageHeight × 0.8）
 *   2. 字体大小 < baseFontSize × 0.85
 *   3. 文本以数字、上标数字或 * † ‡ 符号开头
 */
export function detectFootnotes(
  items: TextItem[],
  pageHeight: number,
  baseFontSize: number,
  excludedIndexes: Set<number>,
): DetectedFootnote[] {
  const footnoteYThreshold = pageHeight * 0.82;
  const sizeThreshold = baseFontSize * 0.85;

  // 候选项：页脚区域且字体小
  const candidates = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item, idx }) => {
      if (excludedIndexes.has(idx)) return false;
      if (item.y < footnoteYThreshold) return false;
      if (item.fontSize >= sizeThreshold) return false;
      return true;
    });

  if (candidates.length === 0) return [];

  // 按 Y 聚类为脚注行
  const rows = clusterToRows(candidates, baseFontSize);
  const results: DetectedFootnote[] = [];

  for (const row of rows) {
    const text = row.items
      .sort((a, b) => a.item.x - b.item.x)
      .map(({ item }) => item.text)
      .join('')
      .trim();

    if (!text) continue;

    // 提取脚注标记：开头的数字、上标数字或符号
    const markerMatch = /^([0-9*†‡§¶]+|[⁰¹²³⁴⁵⁶⁷⁸⁹]+)\s*/.exec(text);
    if (!markerMatch) continue;

    const marker = markerMatch[1]!;
    const content = text.slice(markerMatch[0].length).trim();
    if (!content) continue;

    const consumed = new Set(row.items.map(({ idx }) => idx));
    results.push({
      block: { kind: 'footnote', marker, text: content },
      consumedIndexes: consumed,
      y: row.yCenter,
    });
  }

  return results;
}

// ─────────────────────────────────────────────
// 正文内联上标引用标注（不消费 item，仅标注文本）
// 将 " 1 " 类型的小字体上标替换为 [^1]
// ─────────────────────────────────────────────
export function injectFootnoteRefs(
  text: string,
  _superscriptMarkers: Set<string>,
): string {
  // 匹配孤立的上标数字（通常是非常短的文本片段且是数字）
  // 由于 PDF 解析时上标已混入正文，这里用简单模式标注
  return text.replace(/\[(\d+)\]/g, '[^$1]');
}

// ─────────────────────────────────────────────
// 辅助：按 Y 坐标聚类
// ─────────────────────────────────────────────
interface Row {
  yCenter: number;
  items: Array<{ item: TextItem; idx: number }>;
}

function clusterToRows(
  entries: Array<{ item: TextItem; idx: number }>,
  baseFontSize: number,
): Row[] {
  const rows: Row[] = [];
  const threshold = baseFontSize * 0.6;

  for (const entry of entries) {
    const existing = rows.find((r) => Math.abs(r.yCenter - entry.item.y) <= threshold);
    if (existing) {
      existing.items.push(entry);
      existing.yCenter =
        existing.items.reduce((s, e) => s + e.item.y, 0) / existing.items.length;
    } else {
      rows.push({ yCenter: entry.item.y, items: [entry] });
    }
  }

  return rows.sort((a, b) => a.yCenter - b.yCenter);
}
