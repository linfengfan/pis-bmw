// E2E Tests - Vitest
// Run with: npm run test:e2e

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

describe('PDF 转换系统 E2E', () => {
  const serverPath = join(process.cwd(), 'src/server.ts');
  let server: ChildProcess | undefined;

  beforeAll(() => {
    // 检查 server.ts 是否存在
    expect(existsSync(serverPath)).toBe(true);
  });

  afterAll(() => {
    if (server) {
      server.kill();
    }
  });

  it('should have test.pdf file', () => {
    const testPdf = join(process.cwd(), 'test.pdf');
    expect(existsSync(testPdf)).toBe(true);
  });
});