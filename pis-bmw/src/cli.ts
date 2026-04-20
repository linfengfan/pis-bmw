// src/cli.ts
// Commander CLI 入口

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, basename, extname, dirname } from 'node:path';
import { program } from 'commander';
import { convertPdf } from './converter.js';
import type { TableStrategy } from './domain/types.js';

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

program
  .name('pdf2md')
  .description('将 PDF 高保真还原为 Markdown（保留表格、标题、脚注、公式）')
  .version(pkg.version)
  .argument('<input>', 'PDF 文件路径')
  .option('-o, --output <path>', '输出 Markdown 文件路径（默认: output/<filename>.md）')
  .option(
    '-s, --strategy <type>',
    '表格检测策略: auto | line | text（默认: auto）',
    'auto',
  )
  .option('-d, --debug', '输出调试信息')
  .action(async (input: string, opts: { output?: string; strategy: string; debug?: boolean }) => {
    const inputPath = resolve(input);
    const strategy = (['auto', 'line', 'text'].includes(opts.strategy)
      ? opts.strategy
      : 'auto') as TableStrategy;

    let outputPath: string;
    if (opts.output) {
      outputPath = resolve(opts.output);
    } else {
      const name = basename(inputPath, extname(inputPath));
      const outputDir = resolve(dirname(inputPath), 'output');
      mkdirSync(outputDir, { recursive: true });
      outputPath = resolve(outputDir, `${name}.md`);
    }

    console.log(`转换中: ${inputPath}`);
    console.log(`策略: ${strategy}`);

    try {
      const { markdown, meta } = await convertPdf(inputPath, {
        strategy,
        debug: opts.debug,
      });

      // 确保输出目录存在
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, markdown, 'utf8');

      console.log(`\n✓ 完成！输出: ${outputPath}`);
      console.log(`  页数: ${meta.pages} | 表格: ${meta.tables} | 图片: ${meta.images} | 标题: ${meta.headings} | 脚注: ${meta.footnotes}`);
    } catch (err) {
      console.error(`\n✗ 转换失败:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program.parse();
