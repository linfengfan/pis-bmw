# 文档向量化系统 · 技术架构

> 最后更新：2026/04/23
> 项目路径：`/Users/admin/hyxl/pis-bmw/vector/`

---

## 一、系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                    前端 (Next.js)                        │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│   │  文件上传Tab  │  │  URL抓取Tab  │  │  语义检索Tab  │   │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
└──────────┼─────────────────┼─────────────────┼──────────┘
           │                 │                 │
           │  POST /upload/file    POST /crawl/url
           │  POST /query/search   GET  /query/documents
           ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────┐
│                    后端 (FastAPI)                        │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ file_upload │  │   crawl     │  │     query        │  │
│  │   Router    │  │   Router    │  │    Router        │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
│         │                │                  │            │
│  ┌──────┴────────────────┴──────────────────┴──────┐   │
│  │                   Services Layer                  │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐   │   │
│  │  │pdf_converter│  │  crawler   │  │  embedder  │   │   │
│  │  │  (PDF解析)  │  │(HTML→MD)   │  │(分块+向量) │   │   │
│  │  └────────────┘  └────────────┘  └──────┬─────┘   │   │
│  └─────────────────────────────────────┬──┴────────┘   │
│                                        │               │
│  ┌──────────────────────────────────────┴───────────┐  │
│  │              chroma_service                      │  │
│  │          (ChromaDB PersistentClient)            │  │
│  └────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│              本地向量数据库 (ChromaDB)                   │
│                  /data/chroma_db/                       │
│                  (SQLite 后端，零运维)                  │
└─────────────────────────────────────────────────────────┘
```

---

## 二、模块设计

### 2.1 文件解析层 (`services/pdf_converter.py`)

**职责**：将 PDF 字节流 → 纯文本

```
输入: bytes (PDF 文件)
    ↓
pdfminer.six extract_text()
    ↓
清理空行、合并空格
    ↓
输出: str (纯文本)
```

**关键设计点**：
- 使用 `pdfminer.six` 而非 PyPDF2 —— 中文支持更好
- 返回纯文本，不保留格式（向量库只需要语义内容）
- 异常时抛出明确错误，由 Router 层统一捕获

### 2.2 网页抓取层 (`services/crawler.py`)

**职责**：URL → HTML → Markdown → 清洗

```
URL
  ↓
┌─────────────────────────────┐
│  优先: Playwright           │  ← 支持 JS 渲染（SPA 页面）
│  降级: requests + BS4        │  ← 静态页面
└─────────────────────────────┘
  ↓
html2text.HTML2Text (body_width=0)
  ↓
clean_markdown() — 去除导航/页脚等噪音行
  ↓
输出: str (清洗后的 Markdown)
```

**关键设计点**：
- 双层降级：Playwright → requests，保证任何页面都能抓取
- `html2text.body_width=0` 防止强制换行破坏段落语义
- `clean_markdown()` 过滤 `登录|注册|Copyright|广告|导航` 等噪音行

### 2.3 分块层 (`services/embedder.py → chunk_text()`)

**职责**：长文本 → 按段落分块（带重叠）

```
原始文本
  ↓
按 "\n" 分割 → paragraphs
  ↓
贪心合并：
  当前块 + 下一段 ≤ 800字 → 合并
  当前块 + 下一段 > 800字 → 截断，开新块
  新块 = 旧块末尾 100字重叠 + 新段落
  ↓
过滤：块长 < 50字 → 丢弃
  ↓
输出: List[str] (chunks)
```

**关键设计点**：
- 按段落而非按字符数分块——保证语义完整性
- 100 字重叠——块边界不会切断上下文
- 50 字过滤——去除页眉/页脚等噪音块

### 2.4 Embedding 层 (`services/embedder.py → Embedder`)

**职责**：文本 → 向量

```
首次调用:
  SentenceTransformer("shibing624/text2vec-base-chinese")
    ↓
  加载到 CPU（单例模式，全局复用）
    ↓
后续调用:
  model.encode(texts) → List[List[float]]
    ↓
输出: List[embedding] (768维向量)
```

**关键设计点**：
- **单例模式**：模型只加载一次，后续调用复用
- **批量编码**：多条文本一起 encode，GPU 利用率更高
- **模型选择**：中文语义模型，支持中文财报、公告的精确检索

### 2.5 向量库层 (`services/chroma_service.py`)

**职责**：向量 CRUD

```
add_chunks(doc_id, chunks, metadata):
  embed_texts(chunks) → embeddings
    ↓
  collection.add(ids, documents, embeddings, metadatas)
    ↓
  返回 chunk_count

query_chunks(query, n_results):
  embed_query(query) → query_embedding
    ↓
  collection.query(query_embeddings=[...], n_results=k)
    ↓
  返回 List[ChunkResult]

delete_doc_chunks(doc_id):
  获取 doc_id 前缀的所有 id
    ↓
  collection.delete(ids=[...])
```

**关键设计点**：
- `PersistentClient(path=...)` — 数据存本地磁盘，重启不丢失
- ChromaDB 内部自动做向量索引（近似最近邻）
- 单 Collection 多文档隔离（通过 metadata.doc_id 过滤）

---

## 三、数据流

### 3.1 文件上传流程

```
用户拖拽 PDF
    ↓
前端: POST /upload/file (FormData)
    ↓
后端: 1. 校验后缀 (.pdf/.md/.txt)
     2. 读取 bytes
     3. PDF → pdf_to_text() 或直接 decode
     4. 生成 doc_id (MD5 hash)
     5. chunk_text() → chunks
     6. embed_texts() → embeddings
     7. collection.add() → 存入 ChromaDB
     8. 保存原始文件到 /data/raw/{doc_id}.pdf
    ↓
前端: 显示 "成功！切成 N 块，已存入向量库"
```

### 3.2 URL 抓取流程

```
用户粘贴 URL
    ↓
前端: POST /crawl/url { url }
    ↓
后端: 1. 校验 http/https
     2. fetch_url() → 优先 Playwright，失败则 requests
     3. html_to_markdown() → 纯 Markdown
     4. clean_markdown() → 去除噪音
     5. 生成 doc_id
     6. chunk_text() → chunks
     7. embed_texts() → embeddings
     8. collection.add()
     9. 保存 MD 文件到 /data/md/{doc_id}.md
    ↓
前端: 显示抓取成功 + 标题
```

### 3.3 语义检索流程

```
用户输入查询
    ↓
前端: POST /query/search { query, top_k }
    ↓
后端: 1. embed_query(query) → 768维向量
     2. collection.query(query_embeddings=[...], n_results=top_k)
     3. 提取 documents + metadatas
     4. 组装 ChunkResult[]
    ↓
前端: 渲染结果列表（可展开/折叠全文）
```

---

## 四、API 详细设计

### POST /upload/file
```
Request:
  Content-Type: multipart/form-data
  Body: file (binary)

Response 200:
  {
    "doc_id": "a1b2c3d4e5f6",
    "filename": "年报.pdf",
    "chunk_count": 47,
    "status": "success",
    "message": "成功！共切成 47 个文本块，已存入向量库"
  }

Error 400: "不支持的文件类型 .exe"
Error 413: "文件为空"
Error 500: "PDF 解析失败" | "向量化失败"
```

### POST /crawl/url
```
Request:
  { "url": "https://example.com/report" }

Response 200:
  {
    "doc_id": "x9y8z7w6v5u4",
    "url": "https://example.com/report",
    "title": "2025年度报告",
    "chunk_count": 32,
    "status": "success",
    "message": "抓取成功！标题: 2025年度报告，切成 32 个文本块"
  }

Error 400: "URL 必须以 http:// 或 https:// 开头"
Error 502: "网页抓取失败" | "页面内容过少"
Error 500: "向量化失败"
```

### POST /query/search
```
Request:
  { "query": "光伏银需求2025预测", "top_k": 5 }

Response 200:
  {
    "query": "光伏银需求2025预测",
    "results": [
      {
        "content": "光伏用银需求在2025年出现首次下降...",
        "metadata": {
          "doc_id": "a1b2c3d4",
          "title": "World Silver Survey 2026",
          "chunk_index": 15,
          "source_type": "file"
        }
      },
      ...
    ],
    "total_chunks": 5
  }

Error 400: "查询内容不能为空" | "top_k 必须在 1-20 之间"
Error 500: "检索失败"
```

### GET /query/documents
```
Response 200:
  {
    "documents": [
      {
        "doc_id": "a1b2c3d4",
        "filename": "年报.pdf",
        "source_type": "file",
        "chunk_count": 47,
        "created_at": "2026-04-23T10:00:00"
      },
      ...
    ],
    "total": 8
  }
```

### DELETE /query/documents/{doc_id}
```
Response 200:
  { "status": "success", "message": "文档 a1b2c3d4 已从向量库删除" }
```

---

## 五、技术选型理由

| 组件 | 选型 | 替代方案 | 选择理由 |
|------|------|---------|---------|
| **后端框架** | FastAPI | Flask / Django | 类型安全、自动文档、异步支持，财报数据处理需要高可靠性 |
| **向量数据库** | ChromaDB | Qdrant / pgvector / Pinecone | 本地 SQLite 后端，零运维，单用户场景性能足够 |
| **Embedding** | shibing624/text2vec-base-chinese | OpenAI text-embedding-3 / bge | 免费离线，中文语义优先，无需 API Key |
| **PDF 解析** | pdfminer.six | PyPDF2 / pdfplumber | 中文 OCR 兼容性好，纯 Python 无 C 依赖 |
| **前端框架** | Next.js 14 | React + Vite | 服务端渲染、API 路由、部署简单，单用户场景性能足够 |
| **CSS** | Tailwind CSS | styled-components | Utility-first，开发速度快 |
| **网页爬取** | Playwright + requests 降级 | 仅 requests | 支持 SPA/JS 渲染页面，兼容性最强 |
| **HTML→MD** | html2text | markdownify | 可控制换行策略，不破坏段落结构 |

---

## 六、已知限制与降级方案

| 限制 | 影响 | 降级方案 |
|------|------|---------|
| ChromaDB 不支持精确过滤（只能近似检索） | 无法按 doc_id 精确查询所有块 | 通过 metadata.doc_id 批量查 id，再过滤 |
| pdfminer.six 对扫描版 PDF（图片型）无法提取文字 | 无法处理扫描件 | 未来接入 OCR（PaddleOCR / Tesseract） |
| SentenceTransformer 模型约 400MB，首次下载慢 | 冷启动耗时 | 模型一次性下载后缓存，后续启动 < 5s |
| 中文 Embedding 模型不擅长英文语义 | 英文年报检索精度下降 | Phase 2 增加英文模型（bge-large-en） |
| URL 抓取可能被反爬 | 部分页面抓取失败 | Playwright 伪装 + 请求间隔，未来可加代理池 |

---

## 七、目录结构（最终版）

```
/Users/admin/hyxl/pis-bmw/vector/
├── backend/
│   ├── main.py                    # FastAPI 入口，路由注册，跨域配置
│   ├── config.py                  # 集中配置（路径、模型、分块参数）
│   ├── models.py                  # Pydantic 请求/响应模型
│   ├── requirements.txt            # pip 依赖清单
│   ├── routers/                    # API 路由层
│   │   ├── file_upload.py         # POST /upload/file
│   │   ├── crawl.py               # POST /crawl/url
│   │   └── query.py               # POST /query/search, GET/DELETE /query/documents
│   └── services/                  # 业务逻辑层
│       ├── chroma_service.py       # 向量库 CRUD（单例 PersistentClient）
│       ├── embedder.py            # Embedding 单例 + chunk_text 分块
│       ├── pdf_converter.py       # PDF → 纯文本
│       └── crawler.py             # URL → HTML → Markdown
│
├── frontend/                      # Next.js 14
│   ├── src/app/
│   │   ├── layout.tsx             # 根布局
│   │   ├── page.tsx              # 主页面（上传 / 检索 Tab）
│   │   └── globals.css            # 全局样式（深色主题）
│   ├── .env.local                 # NEXT_PUBLIC_API_URL=http://localhost:8000
│   └── [config files]             # next.config.js, tailwind.config.js, tsconfig.json...
│
└── data/                          # 数据目录（gitignore 排除）
    ├── raw/                       # 原始上传文件
    ├── md/                        # URL 转换后的 Markdown
    └── chroma_db/                 # ChromaDB SQLite 数据库
```