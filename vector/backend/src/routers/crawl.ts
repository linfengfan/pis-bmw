// src/routers/crawl.ts
import { Router, Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { CrawlRequest, CrawlResponse } from "../models";
import { MD_DIR } from "../config";
import { fetchUrl } from "../services/crawler";
import { chunkText } from "../services/chunker";
import { embedTexts } from "../services/embedder";
import { addChunks } from "../services/chromaService";

const router = Router();

// ============ POST /crawl/url ============
router.post("/url", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as CrawlRequest;
    const url = body?.url?.trim();

    if (!url) {
      res.status(400).json({ detail: "URL 不能为空" });
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      res.status(400).json({ detail: "URL 必须以 http:// 或 https:// 开头" });
      return;
    }

    console.log(`[Crawl] 开始抓取: ${url}`);

    // 抓取并转换
    const { title, markdown } = await fetchUrl(url);
    console.log(`[Crawl] 抓取完成，标题: ${title}，markdown ${markdown.length} 字符`);

    if (markdown.trim().length < 100) {
      res.status(400).json({ detail: "页面内容过少，无法向量化" });
      return;
    }

    const docId = createHash("md5")
      .update(`${url}${new Date().toISOString()}${uuidv4()}`)
      .digest("hex")
      .slice(0, 12);

    // 保存 Markdown 文件
    await fs.writeFile(path.join(MD_DIR, `${docId}.md`), markdown, "utf-8");

    // 分块
    const chunks = chunkText(markdown);
    if (chunks.length === 0) {
      res.status(400).json({ detail: "文本分块为空，无法向量化" });
      return;
    }

    const now = new Date().toISOString();
    const metadatas = chunks.map((_, i) => ({
      doc_id: docId,
      filename: `${title}.md`,
      title,
      source_type: "url" as const,
      created_at: now,
      url,
      chunk_index: i,
      chunk_total: chunks.length,
    }));

    // 向量化（Ollama）→ 存入 ChromaDB
    console.log(`[Crawl] 开始向量化 ${chunks.length} 个文本块...`);
    const embeddings = await embedTexts(chunks);
    console.log(`[Crawl] 向量化完成，开始存入向量库...`);
    await addChunks(docId, chunks, metadatas, embeddings);
    console.log(`[Crawl] 存入完成，doc_id=${docId}`);

    const response: CrawlResponse = {
      doc_id: docId,
      url,
      title,
      chunk_count: chunks.length,
      status: "success",
      message: `抓取成功！标题: ${title}，切成 ${chunks.length} 个文本块`,
    };
    res.json(response);
  } catch (err: any) {
    next(err);
  }
});

export default router;
