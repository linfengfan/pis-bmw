// src/analyzers/table-analyzer.ts
// 表格检测核心：双策略
//   策略 A（line）：从线条/矩形构建精确网格（有边框表格）
//   策略 B（text）：文本 X 坐标对齐检测（无边框表格）
// 返回值包含表格区域的 TextItem 索引集合，已消费的 item 不再参与后续段落重建

import type { ExtractedPage, PdfLine, TableBlock, TextItem } from '../domain/types.js';

// ─────────────────────────────────────────────
// 公共入口
// ─────────────────────────────────────────────
export interface DetectedTable {
  block: TableBlock;
  /** 已被此表格消费的 TextItem 在 page.items 中的索引集合 */
  consumedIndexes: Set<number>;
  /** 表格在页面上的 Y 区间（用于与段落排序） */
  yMin: number;
  yMax: number;
}

export function detectTables(
  page: ExtractedPage,
  strategy: 'auto' | 'line' | 'text',
): DetectedTable[] {
  const results: DetectedTable[] = [];

  if (strategy === 'line' || strategy === 'auto') {
    const lineTables = detectByLines(page);
    results.push(...lineTables);
  }

  if (strategy === 'text' || strategy === 'auto') {
    // 剔除已被线条策略消费的 items
    const consumed = new Set<number>();
    for (const t of results) t.consumedIndexes.forEach((i) => consumed.add(i));
    const textTables = detectByTextAlignment(page, consumed);
    results.push(...textTables);
  }

  return results;
}

// ─────────────────────────────────────────────
// 策略 A：线条/矩形网格检测
// 算法：
//   1. 合并重叠的平行线段
//   2. 找出 H×V 交叉点
//   3. 从交叉点推导单元格边界
//   4. 将 TextItem 归属到单元格
// ─────────────────────────────────────────────
function detectByLines(page: ExtractedPage): DetectedTable[] {
  const { lines, items } = page;
  if (lines.length < 4) return [];

  const hLines = mergeParallelLines(lines.filter((l) => l.horizontal), true);
  const vLines = mergeParallelLines(lines.filter((l) => !l.horizontal), false);

  if (hLines.length < 2 || vLines.length < 2) return [];

  // 找出所有可能的表格网格区域
  // 按 Y 坐标对 hLines 分组，按 X 坐标对 vLines 分组
  // 筛选：在同一 X 范围内重叠的 H 线 + 同一 Y 范围内重叠的 V 线 → 构成网格
  const tables: DetectedTable[] = [];

  // 简化策略：找到 ≥2 条平行 H 线和 ≥2 条平行 V 线共享重叠范围
  const gridCandidates = findGridCandidates(hLines, vLines);

  for (const grid of gridCandidates) {
    const table = buildTableFromGrid(grid, items);
    if (table) tables.push(table);
  }

  return tables;
}

interface GridCandidate {
  hLines: PdfLine[];
  vLines: PdfLine[];
}

function findGridCandidates(hLines: PdfLine[], vLines: PdfLine[]): GridCandidate[] {
  // 对 H 线按 X 范围聚类，V 线按 Y 范围聚类
  // 使用简单的矩形包围盒方式：找到相互重叠形成封闭矩形的线组
  const candidates: GridCandidate[] = [];

  // 按 Y 坐标排序 H 线
  const sortedH = [...hLines].sort((a, b) => a.y0 - b.y0);
  // 按 X 坐标排序 V 线
  const sortedV = [...vLines].sort((a, b) => a.x0 - b.x0);

  // 找所有 H 线对（yTop, yBottom）
  for (let hi = 0; hi < sortedH.length - 1; hi++) {
    for (let hj = hi + 1; hj < sortedH.length; hj++) {
      const h1 = sortedH[hi]!;
      const h2 = sortedH[hj]!;

      // H 线需要有 X 重叠
      const hxMin = Math.max(Math.min(h1.x0, h1.x1), Math.min(h2.x0, h2.x1));
      const hxMax = Math.min(Math.max(h1.x0, h1.x1), Math.max(h2.x0, h2.x1));
      if (hxMax - hxMin < 20) continue;

      const yTop = Math.min(h1.y0, h1.y1);
      const yBot = Math.max(h2.y0, h2.y1);
      if (yBot - yTop < 5) continue;

      // 在此 Y 范围内找 V 线，要求 V 线在 X 重叠范围内
      const matchV = sortedV.filter((v) => {
        const vx = Math.min(v.x0, v.x1);
        const vyMin = Math.min(v.y0, v.y1);
        const vyMax = Math.max(v.y0, v.y1);
        return (
          vx >= hxMin - 5 &&
          vx <= hxMax + 5 &&
          vyMin <= yTop + 5 &&
          vyMax >= yBot - 5
        );
      });

      if (matchV.length < 2) continue;

      // 收集此 Y 范围内所有 H 线
      const innerH = sortedH.filter((h) => {
        const hy = h.y0;
        const hxl = Math.min(h.x0, h.x1);
        const hxr = Math.max(h.x0, h.x1);
        return (
          hy >= yTop - 3 &&
          hy <= yBot + 3 &&
          hxl <= hxMax &&
          hxr >= hxMin
        );
      });

      candidates.push({ hLines: innerH, vLines: matchV });
      // 跳过 hj 后面同范围的重复
      break;
    }
  }

  // 去重（按 Y 范围）
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key = `${Math.round(c.hLines[0]!.y0)}-${Math.round(c.hLines[c.hLines.length - 1]!.y0)}-${c.vLines.length}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildTableFromGrid(
  grid: GridCandidate,
  items: TextItem[],
): DetectedTable | null {
  const { hLines, vLines } = grid;
  if (hLines.length < 2 || vLines.length < 2) return null;

  // 获取行边界（Y）和列边界（X）
  const ys = [...new Set(hLines.map((l) => Math.round(l.y0)))].sort((a, b) => a - b);
  const xs = [...new Set(vLines.map((l) => Math.round(Math.min(l.x0, l.x1))))].sort(
    (a, b) => a - b,
  );

  if (ys.length < 2 || xs.length < 2) return null;

  const rowCount = ys.length - 1;
  const colCount = xs.length - 1;

  // 构建单元格矩阵
  const grid2d: string[][] = Array.from({ length: rowCount }, () =>
    Array<string>(colCount).fill(''),
  );
  const consumed = new Set<number>();

  for (let r = 0; r < rowCount; r++) {
    const y0 = ys[r]!;
    const y1 = ys[r + 1]!;
    for (let c = 0; c < colCount; c++) {
      const x0 = xs[c]!;
      const x1 = xs[c + 1]!;

      // 找落入此单元格的 items
      const cellItems = items
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => {
          return (
            item.x >= x0 - 3 &&
            item.x < x1 + 3 &&
            item.y >= y0 - 3 &&
            item.y < y1 + 3
          );
        });

      cellItems.forEach(({ idx }) => consumed.add(idx));
      // 按 X 排序后拼接文本
      const cellText = cellItems
        .sort((a, b) => a.item.x - b.item.x)
        .map(({ item }) => item.text.trim())
        .join(' ');
      if (grid2d[r]) grid2d[r]![c] = cellText;
    }
  }

  if (consumed.size === 0) return null;

  // 第一行作为表头
  const [headerRow, ...dataRows] = grid2d;
  if (!headerRow) return null;

  return {
    block: { kind: 'table', headers: headerRow, rows: dataRows },
    consumedIndexes: consumed,
    yMin: Math.min(...ys),
    yMax: Math.max(...ys),
  };
}

// ─────────────────────────────────────────────
// 合并同方向的平行线段（容差 ±2pt）
// ─────────────────────────────────────────────
function mergeParallelLines(lines: PdfLine[], horizontal: boolean): PdfLine[] {
  if (lines.length === 0) return [];

  // 按主坐标（H→Y，V→X）分组
  const groups = new Map<number, PdfLine[]>();

  for (const line of lines) {
    const key = Math.round(horizontal ? line.y0 : line.x0);
    // 找最近的已有 key（±3）
    let matched: number | undefined;
    for (const k of groups.keys()) {
      if (Math.abs(k - key) <= 3) {
        matched = k;
        break;
      }
    }
    const groupKey = matched ?? key;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push(line);
  }

  const merged: PdfLine[] = [];
  for (const [, group] of groups) {
    if (horizontal) {
      const xMin = Math.min(...group.map((l) => Math.min(l.x0, l.x1)));
      const xMax = Math.max(...group.map((l) => Math.max(l.x0, l.x1)));
      const y = group[0]!.y0;
      merged.push({ x0: xMin, y0: y, x1: xMax, y1: y, horizontal: true });
    } else {
      const yMin = Math.min(...group.map((l) => Math.min(l.y0, l.y1)));
      const yMax = Math.max(...group.map((l) => Math.max(l.y0, l.y1)));
      const x = group[0]!.x0;
      merged.push({ x0: x, y0: yMin, x1: x, y1: yMax, horizontal: false });
    }
  }

  return merged;
}

// ─────────────────────────────────────────────
// 策略 B：文本 X 坐标对齐检测（无边框表格）
// 算法：
//   1. 按 Y 坐标聚类 TextItem → 行
//   2. 直方图分箱找列 X 锚点
//   3. 连续 ≥3 行共享 ≥2 列锚点 → 候选表格
// ─────────────────────────────────────────────
function detectByTextAlignment(
  page: ExtractedPage,
  alreadyConsumed: Set<number>,
): DetectedTable[] {
  const { items, width } = page;

  // 过滤已消费的 items
  const available = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ idx }) => !alreadyConsumed.has(idx));

  if (available.length < 6) return [];

  // Step 1: 按 Y 聚类为行（阈值 = 平均 fontSize * 0.6）
  const avgFontSize =
    available.reduce((s, { item }) => s + item.fontSize, 0) / available.length;
  const rowThreshold = Math.max(avgFontSize * 0.6, 3);

  const rows: Array<{ yCenter: number; items: Array<{ item: TextItem; idx: number }> }> =
    [];
  for (const entry of available) {
    const y = entry.item.y;
    const existing = rows.find((r) => Math.abs(r.yCenter - y) <= rowThreshold);
    if (existing) {
      existing.items.push(entry);
      existing.yCenter =
        existing.items.reduce((s, e) => s + e.item.y, 0) / existing.items.length;
    } else {
      rows.push({ yCenter: y, items: [entry] });
    }
  }

  rows.sort((a, b) => a.yCenter - b.yCenter);

  // Step 2: 找列锚点（直方图分箱）
  const binWidth = Math.max(width / 60, 8);

  // Step 3: 滑动窗口找连续行构成的表格
  const tables: DetectedTable[] = [];
  let i = 0;

  while (i < rows.length) {
    // 尝试从 i 开始扩展表格
    const tableRows: typeof rows = [];
    let j = i;

    while (j < rows.length) {
      const candidateRows = [...tableRows, rows[j]!];
      if (candidateRows.length < 2) {
        tableRows.push(rows[j]!);
        j++;
        continue;
      }

      // 检查所有候选行是否共享列结构
      const colAnchors = findColumnAnchors(candidateRows, binWidth);
      if (colAnchors.length >= 2) {
        tableRows.push(rows[j]!);
        j++;
      } else {
        break;
      }
    }

    if (tableRows.length >= 3) {
      const colAnchors = findColumnAnchors(tableRows, binWidth);
      if (colAnchors.length >= 2) {
        const table = buildTableFromTextRows(tableRows, colAnchors);
        if (table) tables.push(table);
        i = j; // 跳过已处理的行
        continue;
      }
    }

    i++;
  }

  return tables;
}

function findColumnAnchors(
  rows: Array<{ items: Array<{ item: TextItem }> }>,
  binWidth: number,
): number[] {
  // 统计所有 item 的 X 坐标直方图
  const hist = new Map<number, number>();
  for (const row of rows) {
    // 每行每个 item 只贡献一次（避免长文本污染）
    const rowXs = new Set(row.items.map(({ item }) => Math.floor(item.x / binWidth)));
    for (const bin of rowXs) {
      hist.set(bin, (hist.get(bin) ?? 0) + 1);
    }
  }

  // 找出在 ≥ 50% 行中出现的 X bin（即列锚点）
  const minRows = Math.max(2, Math.floor(rows.length * 0.5));
  const anchors: number[] = [];
  for (const [bin, count] of hist) {
    if (count >= minRows) anchors.push(bin * binWidth + binWidth / 2);
  }

  return anchors.sort((a, b) => a - b);
}

function buildTableFromTextRows(
  rows: Array<{ yCenter: number; items: Array<{ item: TextItem; idx: number }> }>,
  colAnchors: number[],
): DetectedTable | null {
  if (colAnchors.length < 2) return null;

  const colCount = colAnchors.length;
  // 为每列定义 X 区间
  const colBounds: Array<[number, number]> = colAnchors.map((anchor, ci) => {
    const prev = ci > 0 ? colAnchors[ci - 1]! : anchor - 9999;
    const next = ci < colAnchors.length - 1 ? colAnchors[ci + 1]! : anchor + 9999;
    return [(anchor + prev) / 2, (anchor + next) / 2];
  });

  const matrix: string[][] = [];
  const consumed = new Set<number>();

  for (const row of rows) {
    const cells = Array<string>(colCount).fill('');
    for (const { item, idx } of row.items) {
      // 找归属列
      const col = colBounds.findIndex(
        ([lo, hi]) => item.x >= lo! && item.x < hi!,
      );
      if (col >= 0) {
        cells[col] = cells[col] ? `${cells[col]} ${item.text.trim()}` : item.text.trim();
        consumed.add(idx);
      }
    }
    matrix.push(cells);
  }

  if (consumed.size === 0) return null;

  const [headerRow, ...dataRows] = matrix;
  if (!headerRow) return null;

  const yMin = rows[0]!.yCenter;
  const yMax = rows[rows.length - 1]!.yCenter;

  return {
    block: { kind: 'table', headers: headerRow, rows: dataRows },
    consumedIndexes: consumed,
    yMin,
    yMax,
  };
}
