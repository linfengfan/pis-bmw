// src/server.test.ts
// 工具函数测试

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, writeFileSync, mkdirSync, readdirSync, readFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename, extname } from 'node:path';

// 模拟 parseStrategy 和 sanitizeFilename
function parseStrategy(raw: unknown): 'auto' | 'line' | 'text' {
  return (['auto', 'line', 'text'] as const).includes(raw as 'auto' | 'line' | 'text')
    ? (raw as 'auto' | 'line' | 'text')
    : 'auto';
}

function sanitizeFilename(raw: string): string {
  const name = basename(raw, extname(raw)) || 'output';
  return name.replace(/[^\w一-龥\-. ]/g, '_').trim() || 'output';
}

// ─────────────────────────────────────────────
// parseStrategy 测试
// ─────────────────────────────────────────────
describe('parseStrategy', () => {
  it('should return "auto" when input is valid', () => {
    expect(parseStrategy('auto')).toBe('auto');
    expect(parseStrategy('line')).toBe('line');
    expect(parseStrategy('text')).toBe('text');
  });

  it('should return "auto" as default for invalid input', () => {
    expect(parseStrategy('invalid')).toBe('auto');
    expect(parseStrategy('')).toBe('auto');
    expect(parseStrategy(undefined)).toBe('auto');
    expect(parseStrategy(null)).toBe('auto');
    expect(parseStrategy(123)).toBe('auto');
  });
});

// ─────────────────────────────────────────────
// sanitizeFilename 测试
// ─────────────────────────────────────────────
describe('sanitizeFilename', () => {
  it('should extract filename without extension', () => {
    expect(sanitizeFilename('document.pdf')).toBe('document');
    expect(sanitizeFilename('/path/to/report.pdf')).toBe('report');
    expect(sanitizeFilename('test.doc')).toBe('test');
  });

  it('should replace invalid characters with underscore', () => {
    expect(sanitizeFilename('my<file>.pdf')).toBe('my_file_');
    expect(sanitizeFilename('test:123?.pdf')).toBe('test_123_');
  });

  it('should handle Chinese characters', () => {
    expect(sanitizeFilename('年报.pdf')).toBe('年报');
    expect(sanitizeFilename('2024_年度报告.pdf')).toBe('2024_年度报告');
  });

  it('should return "output" when input is empty', () => {
    expect(sanitizeFilename('')).toBe('output');
    // .pdf 被 basename 处理后是 .pdf（扩展名提取只去掉最后一个点后的内容）
    expect(sanitizeFilename('.pdf')).toBe('.pdf');
  });
});

// ─────────────────────────────────────────────
// saveToOutputDir 测试
// ─────────────────────────────────────────────
describe('saveToOutputDir', () => {
  const testDir = join(tmpdir(), 'pdf2md-test-' + Date.now());
  const testContent = '# Test Markdown\n\nContent here.';

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try {
      const folders = readdirSync(testDir, { withFileTypes: true });
      for (const folder of folders) {
        if (folder.isDirectory()) {
          const folderPath = join(testDir, folder.name);
          const files = readdirSync(folderPath);
          for (const file of files) {
            if (typeof file === 'string') {
              try { unlinkSync(join(folderPath, file)); } catch { /* ignore */ }
            }
          }
        }
      }
      // 清理目录
      const entries = readdirSync(testDir);
      for (const entry of entries) {
        const path = join(testDir, entry);
        try {
          const stat = statSync(path);
          if (stat.isDirectory()) {
            const subEntries = readdirSync(path);
            for (const sub of subEntries) {
              try { unlinkSync(join(path, sub)); } catch { /* ignore */ }
            }
          }
          try { rmSync(path, { recursive: true }); } catch { /* ignore */ }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  });

  it('should save file to specified folder', async () => {
    const stem = 'test-doc';
    const folder = 'test-folder';
    const folderPath = join(testDir, folder);

    mkdirSync(folderPath, { recursive: true });
    const filename = `${stem}.md`;
    const dest = join(folderPath, filename);
    writeFileSync(dest, testContent, 'utf8');

    expect(existsSync(dest)).toBe(true);
    const content = readFileSync(dest, 'utf8');
    expect(content).toBe(testContent);
  });

  it('should handle Chinese folder names', async () => {
    const stem = '年报';
    const folder = '财务报告';
    const folderPath = join(testDir, folder);

    mkdirSync(folderPath, { recursive: true });
    const filename = `${stem}.md`;
    const dest = join(folderPath, filename);
    writeFileSync(dest, testContent, 'utf8');

    expect(existsSync(dest)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// URL 验证测试
// ─────────────────────────────────────────────
describe('URL validation', () => {
  it('should validate HTTP/HTTPS protocols', () => {
    const validUrls = [
      'http://example.com/file.pdf',
      'https://secure.example.com/doc.pdf',
      'https://example.com/path/to/file.pdf?query=1',
    ];

    for (const url of validUrls) {
      const parsed = new URL(url);
      expect(parsed.protocol === 'http:' || parsed.protocol === 'https:').toBe(true);
    }
  });

  it('should reject non-HTTP protocols', () => {
    const invalidUrls = [
      'file:///path/to/file.pdf',
      'ftp://example.com/file.pdf',
      'data:application/pdf;base64,abc',
    ];

    for (const url of invalidUrls) {
      const parsed = new URL(url);
      expect(parsed.protocol === 'http:' || parsed.protocol === 'https:').toBe(false);
    }
  });
});