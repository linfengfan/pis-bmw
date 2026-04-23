# 文档向量化项目

## 技术栈

- **后端**: Node.js + Express + TypeScript
- **前端**: Next.js 14 + Tailwind CSS
- **向量数据库**: ChromaDB（本地 SQLite，零运维）
- **Embedding**: Ollama API（`nomic-embed-text` 模型）
- **PDF 解析**: pdfjs-dist（纯 JS）
- **网页爬取**: cheerio + turndown（HTML → Markdown）

## 项目结构

```
vector/
├── backend/               # Node.js 后端
│   ├── src/
│   │   ├── index.ts       # Express 入口
│   │   ├── config.ts      # 配置（路径、Ollama、分块参数）
│   │   ├── models.ts      # Zod 类型定义
│   │   ├── middlewares/
│   │   │   └── errorHandler.ts
│   │   ├── routers/
│   │   │   ├── fileUpload.ts   # POST /upload/file
│   │   │   ├── crawl.ts       # POST /crawl/url
│   │   │   └── query.ts       # POST /query/search, GET/DELETE /query/documents
│   │   └── services/
│   │       ├── chromaService.ts  # ChromaDB CRUD
│   │       ├── embedder.ts      # Ollama API 调用
│   │       ├── chunker.ts       # 文本分块（800字/块，100字重叠）
│   │       ├── pdfParser.ts     # PDF → 纯文本
│   │       └── crawler.ts       # URL → HTML → Markdown
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/              # Next.js 前端
│   └── src/app/
│       ├── page.tsx      # 主页面（上传 / 检索双 Tab）
│       └── globals.css   # 深色主题
│
└── data/                  # 数据目录
    ├── raw/              # 原始上传文件
    ├── md/               # 转换后的 Markdown
    └── chroma_db/        # ChromaDB SQLite 数据库
```

## 快速启动

### 1. 安装 Ollama（Embedding 模型）

```bash
# macOS
brew install ollama

# 启动 Ollama 服务
ollama serve

# 下载中文 Embedding 模型（首次运行只需一次）
ollama pull nomic-embed-text
```

### 2. 启动后端

```bash
cd backend
npm install
npm run dev
# 服务运行在 http://localhost:8000
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
# 服务运行在 http://localhost:3000
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/upload/file` | 上传 PDF/MD/TXT 文件 |
| POST | `/crawl/url` | 抓取网页 URL |
| POST | `/query/search` | 语义检索 |
| GET | `/query/documents` | 已入库文档列表 |
| DELETE | `/query/documents/:doc_id` | 删除文档 |

## 使用流程

1. 打开 http://localhost:3000
2. **上传文档**：拖拽 PDF/Markdown → 自动解析 → 向量化存储
3. **抓取 URL**：粘贴网页地址 → 爬取 → 转 Markdown → 向量化
4. **语义检索**：输入问题 → 返回最相关的文本块

## Ollama 配置

环境变量（在 `.env` 或终端设置）：

```bash
OLLAMA_BASE_URL=http://localhost:11434  # 默认值
OLLAMA_EMBED_MODEL=nomic-embed-text    # 默认值

# 如果需要中文更好的支持，可以换成其他模型：
# ollama pull mxbai-embed-large
# OLLAMA_EMBED_MODEL=mxbai-embed-large
```
