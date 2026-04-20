// src/renderers/markdown-renderer.ts
// 将 DocumentBlock[] 渲染为 GFM Markdown 字符串

import type { DocumentBlock } from '../domain/types.js';

export function renderMarkdown(blocks: DocumentBlock[]): string {
  const parts: string[] = [];
  const footnotes: string[] = [];

  for (const block of blocks) {
    switch (block.kind) {
      case 'heading':
        parts.push(`${'#'.repeat(block.level)} ${block.text}`);
        break;

      case 'paragraph':
        parts.push(block.text);
        break;

      case 'table':
        parts.push(renderTable(block.headers, block.rows));
        break;

      case 'image':
        parts.push(`![图片 ${block.index}]()`);
        break;

      case 'formula':
        if (block.inline) {
          // 行内公式：嵌入上下文中（此处单独成行）
          parts.push(`$${block.latex}$`);
        } else {
          parts.push(`$$\n${block.latex}\n$$`);
        }
        break;

      case 'footnote':
        // 脚注定义放到文档最末尾
        footnotes.push(`[^${block.marker}]: ${block.text}`);
        break;

      case 'pagebreak':
        // 使用 HTML 注释标记分页，不干扰 Markdown 渲染
        parts.push('\n---\n');
        break;
    }
  }

  const body = parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n\n');

  if (footnotes.length === 0) return body;

  return `${body}\n\n${footnotes.join('\n')}`;
}

// ─────────────────────────────────────────────
// GFM 表格渲染
// 确保单元格内容不含换行，| 符号转义
// ─────────────────────────────────────────────
function renderTable(headers: string[], rows: string[][]): string {
  if (headers.length === 0) return '';

  const colCount = Math.max(headers.length, ...rows.map((r) => r.length));

  const escape = (cell: string): string =>
    cell.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim() || ' ';

  const padRow = (row: string[]): string[] => {
    const padded = [...row];
    while (padded.length < colCount) padded.push('');
    return padded;
  };

  const headerRow = padRow(headers).map(escape);
  const separator = headerRow.map(() => '---');

  const lines = [
    `| ${headerRow.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...rows.map((row) => `| ${padRow(row).map(escape).join(' | ')} |`),
  ];

  return lines.join('\n');
}
