## ⚠️ 首次使用？需要安装 Claude 扩展

请在 Claude Code 中运行 `/plugin` 并安装以下扩展：

| 扩展 | 用途 |
|------|------|
| superpowers | 头脑风暴、子代理驱动开发 |
| frontend-design | 生产级前端界面设计 |
| github | GitHub PR、Issues 集成 |
| fetch | 网页抓取 |

---

# pis-bmw · 项目全景概览

> 最后更新：2026/04/29
> 项目类型：PDF 文档高保真转换工具（TypeScript + Fastify）

---

## 一、项目定位

**目标**：将 PDF 文件高保真还原为 Markdown，保留：
- 表格结构（通过表格分析器）
- 标题层级（通过标题分析器）
- 脚注内容（通过脚注分析器）
- 数学公式（通过公式分析器）
- 整体排版（通过布局分析器）

**使用场景**：
1. 将 PDF 财报/研报转换为 Markdown 进行向量化
2. 作为 RAG 系统的文档预处理管道
3. 批量转换大量 PDF 文档

---

## 二、技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| **运行框架** | Fastify | HTTP 服务（文件上传 API） |
| **PDF 解析** | pdfjs-dist | 读取 PDF 结构 |
| **命令行** | Commander | CLI 工具 |
| **类型检查** | TypeScript | 类型安全 |
| **运行时** | Node.js 18+ | 执行环境 |

---

## 三、核心模块

```
src/
├── cli.ts                 # 命令行入口 (pnpm server)
├── server.ts              # HTTP 服务入口 (pnpm dev)
├── converter.ts           # PDF → Markdown 主转换器
├── domain/
│   └── types.ts           # 类型定义（Block, BlockType, Layout 等）
├── analyzers/             # 内容分析器
│   ├── table-analyzer.ts  # 表格检测与结构化
│   ├── heading-analyzer.ts # 标题层级识别
│   ├── footnote-analyzer.ts # 脚注提取与关联
│   ├── formula-analyzer.ts  # 数学公式识别
│   └── layout-analyzer.ts   # 布局分析（分栏、段落）
├── extractors/
│   └── pdf-extractor.ts   # pdfjs-dist 封装
└── renderers/
    └── markdown-renderer.ts # 块 → Markdown 渲染
```

---

## 四、已知文件

| 文件 | 大小 | 说明 |
|------|------|------|
| `test.pdf` | ~50KB | 测试用 PDF |
| `ConvertedMarkdown/` | 目录 | 已转换的 Markdown 样例 |
| `vector/` | 目录 | 向量数据库系统（独立项目） |

---

## 五、工作流程

### 5.1 开发流程
```bash
pnpm dev          # 启动开发服务器 (localhost:3000)
pnpm convert      # 运行 CLI 转换 test.pdf
pnpm build        # 构建生产版本
```

### 5.2 代码规范
- 遵循 `.clinerules` 中的 AI 执行家法
- 使用 `zod` 进行运行时类型校验
- 错误返回统一格式：`{ error: string, code: string }`

---

## 六、上下文索引

| 文档 | 描述 |
|------|------|
| `ARCH.md` | 技术架构文档（向量库系统） |
| `REQ.md` | 需求规格文档 |
| `CLAUDE.md` | 本文件，项目概览 |

---

## 十、快速命令

```bash
# 开发
pnpm dev                    # 启动服务
pnpm convert                # 转换文件

# 构建
pnpm build                  # 构建
pnpm server                 # 运行 CLI

# 类型检查
npx tsc --noEmit            # 类型检查
```