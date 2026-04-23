// src/index.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { API_HOST, API_PORT, ensureDirs } from "./config";
import fileUploadRouter from "./routers/fileUpload";
import crawlRouter from "./routers/crawl";
import queryRouter from "./routers/query";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";

dotenv.config();

const app = express();

// ============ 中间件 ============
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ============ 健康检查 ============
app.get("/health", (_req, res) => {
  res.json({ status: "ok", message: "文档向量化服务运行中" });
});

app.get("/", (_req, res) => {
  res.json({
    name: "文档向量化 API",
    version: "1.0.0",
    endpoints: {
      上传文件: "POST /upload/file",
      抓取URL: "POST /crawl/url",
      语义检索: "POST /query/search",
      文档列表: "GET /query/documents",
      删除文档: "DELETE /query/documents/:doc_id",
    },
  });
});

// ============ 路由 ============
app.use("/upload", fileUploadRouter);
app.use("/crawl", crawlRouter);
app.use("/query", queryRouter);

// ============ 错误处理 ============
app.use(notFoundHandler);
app.use(errorHandler);

// ============ 启动 ============
async function bootstrap() {
  await ensureDirs();
  app.listen(API_PORT, API_HOST, () => {
    console.log(`🚀 服务已启动: http://localhost:${API_PORT}`);
    console.log(`   后端: http://localhost:${API_PORT}`);
    console.log(`   文档: http://localhost:${API_PORT}/`);
    console.log(`   健康: http://localhost:${API_PORT}/health`);
    console.log("");
    console.log("⚠️  注意事项:");
    console.log("   1. Ollama 必须运行: ollama serve");
    console.log("   2. Embedding 模型: ollama pull nomic-embed-text");
    console.log("   3. 如果用 Python Embedding，修改 config.ts 的 OLLAMA_BASE_URL");
  });
}

bootstrap().catch(console.error);