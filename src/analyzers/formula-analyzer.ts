// src/analyzers/formula-analyzer.ts
// 数学公式检测：基于字体族识别（LaTeX 专用字体）
// 主要特征：字体名包含 CMSY / CMMI / CMR / Symbol / MT-Extra / Math
// 策略：将连续的数学字体 TextItem 合并为 FormulaBlock

import type { FormulaBlock, TextItem } from '../domain/types.js';

export interface DetectedFormula {
  block: FormulaBlock;
  consumedIndexes: Set<number>;
  y: number;
  xMin: number;
  xMax: number;
}

// LaTeX/数学字体族特征匹配
const MATH_FONT_PATTERN = /cmsy|cmmi|cmr|cmex|msam|msbm|symbol|mt.extra|math|euex/i;

function isMathFont(fontName: string): boolean {
  return MATH_FONT_PATTERN.test(fontName);
}

/**
 * 检测数学公式区域。
 * 将相邻的数学字体文本元素合并，判断行内/独立公式。
 */
export function detectFormulas(
  items: TextItem[],
  pageWidth: number,
  excludedIndexes: Set<number>,
): DetectedFormula[] {
  const mathItems = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item, idx }) => {
      if (excludedIndexes.has(idx)) return false;
      return isMathFont(item.fontName);
    });

  if (mathItems.length === 0) return [];

  // 按 Y 聚类为公式行，再判断行内/块级
  const rows = clusterToRows(mathItems);
  const results: DetectedFormula[] = [];

  for (const row of rows) {
    const text = row.items
      .sort((a, b) => a.item.x - b.item.x)
      .map(({ item }) => item.text)
      .join('')
      .trim();

    if (!text) continue;

    const xMin = Math.min(...row.items.map(({ item }) => item.x));
    const xMax = Math.max(...row.items.map(({ item }) => item.x + item.width));

    // 判断行内 vs 块级：
    // 块级：公式占据页面宽度的主体部分（> 30%）且相对居中
    const formulaWidth = xMax - xMin;
    const isCentered =
      xMin > pageWidth * 0.1 && xMax < pageWidth * 0.9;
    const isBlock = formulaWidth > pageWidth * 0.3 || isCentered;

    const consumed = new Set(row.items.map(({ idx }) => idx));
    results.push({
      block: {
        kind: 'formula',
        latex: normalizeFormulaText(text),
        inline: !isBlock,
      },
      consumedIndexes: consumed,
      y: row.yCenter,
      xMin,
      xMax,
    });
  }

  return results;
}

// 简单的字符规范化（Symbol 字体常见字符映射）
const SYMBOL_MAP: Record<string, string> = {
  '∀': '\\forall',
  '∃': '\\exists',
  '∈': '\\in',
  '∉': '\\notin',
  '∑': '\\sum',
  '∏': '\\prod',
  '∫': '\\int',
  '√': '\\sqrt{}',
  '∞': '\\infty',
  '≤': '\\leq',
  '≥': '\\geq',
  '≠': '\\neq',
  '≈': '\\approx',
  '×': '\\times',
  '÷': '\\div',
  '±': '\\pm',
  '→': '\\rightarrow',
  '←': '\\leftarrow',
  '↔': '\\leftrightarrow',
  '∂': '\\partial',
  '∇': '\\nabla',
  'α': '\\alpha',
  'β': '\\beta',
  'γ': '\\gamma',
  'δ': '\\delta',
  'ε': '\\varepsilon',
  'θ': '\\theta',
  'λ': '\\lambda',
  'μ': '\\mu',
  'π': '\\pi',
  'σ': '\\sigma',
  'φ': '\\varphi',
  'ω': '\\omega',
  'Σ': '\\Sigma',
  'Π': '\\Pi',
  'Δ': '\\Delta',
  'Γ': '\\Gamma',
  'Ω': '\\Omega',
};

function normalizeFormulaText(text: string): string {
  let result = text;
  for (const [char, latex] of Object.entries(SYMBOL_MAP)) {
    result = result.replaceAll(char, latex);
  }
  return result;
}

// ─────────────────────────────────────────────
// 辅助：按 Y 坐标聚类
// ─────────────────────────────────────────────
interface Row {
  yCenter: number;
  items: Array<{ item: TextItem; idx: number }>;
}

function clusterToRows(entries: Array<{ item: TextItem; idx: number }>): Row[] {
  const rows: Row[] = [];
  for (const entry of entries) {
    const threshold = entry.item.fontSize * 0.6;
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
