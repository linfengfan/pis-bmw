// src/server.ts
// POST /convert        multipart/form-data  file=<PDF>
// POST /convert-url    application/json     { url, strategy }
// GET  /               前端页面

import { createWriteStream, mkdirSync, readdirSync, unlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, basename, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import { convertPdf } from './converter.js';
import type { TableStrategy } from './domain/types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// 输出目录 - 改为与项目同级的 DB 目录
const DB_ROOT = resolve(__dirname, '../../DB');
mkdirSync(DB_ROOT, { recursive: true });

const fastify = Fastify({ logger: { level: 'warn' } });

await fastify.register(staticFiles, {
  root: resolve(__dirname, '../public'),
  prefix: '/',
});

await fastify.register(multipart, {
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
});

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────
function parseStrategy(raw: unknown): TableStrategy {
  return (['auto', 'line', 'text'] as const).includes(raw as TableStrategy)
    ? (raw as TableStrategy)
    : 'auto';
}

/** 规范化文件名（去除扩展名、过滤非法字符） */
function sanitizeFilename(raw: string): string {
  const name = basename(raw, extname(raw)) || 'output';
  return name.replace(/[^\w\u4e00-\u9fa5\-. ]/g, '_').trim() || 'output';
}

/** 转换完成后持久化到 DB/<folder>/ */
function saveToOutputDir(stem: string, markdown: string, folder: string): string {
  const folderPath = join(DB_ROOT, folder);
  mkdirSync(folderPath, { recursive: true });
  const filename = `${stem}.md`;
  const dest = join(folderPath, filename);
  writeFileSync(dest, markdown, 'utf8');
  return dest;
}

// ─────────────────────────────────────────────
// GET /folders — 获取 DB 下的文件夹列表
// ─────────────────────────────────────────────
fastify.get('/folders', async () => {
  try {
    const folders = readdirSync(DB_ROOT, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .sort((a, b) => a.localeCompare(b, 'zh-CN'));
    return { folders };
  } catch {
    return { folders: [] };
  }
});

// ─────────────────────────────────────────────
// GET /folders/:name/md-files — 获取指定文件夹中的 md 文件列表
// ─────────────────────────────────────────────
fastify.get<{ Params: { name: string } }>('/folders/:name/md-files', async (request, reply) => {
  const folderName = request.params.name;
  const folderPath = join(DB_ROOT, folderName);

  if (!existsSync(folderPath)) {
    return reply.code(404).send({ error: '文件夹不存在' });
  }

  try {
    const files = readdirSync(folderPath)
      .filter(f => f.endsWith('.md'))
      .map(f => ({ name: f, path: join(folderPath, f) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    return { files };
  } catch {
    return { files: [] };
  }
});

// ─────────────────────────────────────────────
// POST /convert — 本地文件上传
// Query: strategy, folder (可选), filename (可选)
// ─────────────────────────────────────────────
fastify.post('/convert', async (request, reply) => {
  const strategy = parseStrategy((request.query as Record<string, string>)['strategy']);
  const folder = String((request.query as Record<string, string>)['folder'] || 'default');
  const filename = String((request.query as Record<string, string>)['filename'] || '');
  const tmpPath = join(tmpdir(), `pdf2md-${randomUUID()}.pdf`);

  try {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: '请上传 PDF 文件（field: file）' });
    }
    if (!data.mimetype.includes('pdf') && !data.filename.endsWith('.pdf')) {
      return reply.code(400).send({ error: '仅支持 PDF 格式' });
    }

    const stem = filename
      ? sanitizeFilename(filename)
      : sanitizeFilename(data.filename);
    await pipeline(data.file, createWriteStream(tmpPath));

    const { markdown, meta } = await convertPdf(tmpPath, { strategy });

    const savedPath = saveToOutputDir(stem, markdown, folder);
    fastify.log.info(`已保存: ${savedPath}`);

    return reply.send({ markdown, meta, filename: `${stem}.md`, folder });
  } catch (err) {
    const message = err instanceof Error ? err.message : '转换失败';
    return reply.code(500).send({ error: message });
  } finally {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
  }
});

// ─────────────────────────────────────────────
// POST /convert-url — 远程 URL 下载并转换
// Body: { url: string, strategy?: string, folder?: string, filename?: string }
// ─────────────────────────────────────────────
fastify.post('/convert-url', async (request, reply) => {
  const body = request.body as Record<string, unknown>;
  const url = typeof body['url'] === 'string' ? body['url'].trim() : '';
  const strategy = parseStrategy(body['strategy']);
  const folder = String(body['folder'] || 'default');
  const filename = String(body['filename'] || '');

  if (!url) {
    return reply.code(400).send({ error: '请提供 PDF 的 URL' });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return reply.code(400).send({ error: 'URL 格式无效' });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return reply.code(400).send({ error: '仅支持 http/https 协议' });
  }

  // 从 URL 路径提取文件名，或使用自定义文件名
  const urlStem = filename
    ? sanitizeFilename(filename)
    : sanitizeFilename(
        basename(parsed.pathname, extname(parsed.pathname)) || 'document',
      );

  const tmpPath = join(tmpdir(), `pdf2md-${randomUUID()}.pdf`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'pdf2md/1.0' },
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      return reply.code(400).send({ error: `远程请求失败: HTTP ${response.status}` });
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('pdf') && !url.toLowerCase().endsWith('.pdf')) {
      return reply.code(400).send({ error: '远程资源不是 PDF 文件' });
    }

    if (!response.body) {
      return reply.code(400).send({ error: '远程响应无内容' });
    }

    const chunks: Buffer[] = [];
    let totalSize = 0;
    const MAX_SIZE = 100 * 1024 * 1024;

    for await (const chunk of response.body) {
      const buf = Buffer.from(chunk as Uint8Array);
      totalSize += buf.length;
      if (totalSize > MAX_SIZE) {
        return reply.code(413).send({ error: 'PDF 文件超过 100MB 限制' });
      }
      chunks.push(buf);
    }

    writeFileSync(tmpPath, Buffer.concat(chunks));

    const { markdown, meta } = await convertPdf(tmpPath, { strategy });

    const savedPath = saveToOutputDir(urlStem, markdown, folder);
    fastify.log.info(`已保存: ${savedPath}`);

    return reply.send({ markdown, meta, filename: `${urlStem}.md`, folder });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return reply.code(408).send({ error: '远程请求超时（30s）' });
    }
    const message = err instanceof Error ? err.message : '转换失败';
    return reply.code(500).send({ error: message });
  } finally {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
  }
});

const port = Number(process.env['PORT'] ?? 3001);
const host = process.env['HOST'] ?? '0.0.0.0';

try {
  await fastify.listen({ port, host });
  console.log(`\n  PDF → Markdown 转换服务`);
  console.log(`  前端页面:   http://localhost:${port}`);
  console.log(`  输出目录:   ${DB_ROOT}/<folder>/\n`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
