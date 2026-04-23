// src/routers/query.ts
import { Router, Request, Response, NextFunction } from "express";
import {
  SearchRequest,
  SearchResponse,
  DocumentListResponse,
  ChunkResult,
} from "../models";
import { queryChunks, getAllDocIds, deleteDocChunks } from "../services/chromaService";
import { embedQuery } from "../services/embedder";

const router = Router();

// ============ POST /query/search ============
router.post("/search", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as SearchRequest;
    const { query, top_k = 5 } = body;

    if (!query?.trim()) {
      res.status(400).json({ detail: "查询内容不能为空" });
      return;
    }
    if (top_k < 1 || top_k > 20) {
      res.status(400).json({ detail: "top_k 必须在 1-20 之间" });
      return;
    }

    console.log(`[Search] 检索: "${query}" (top_k=${top_k})`);

    // 1. Ollama 向量化查询
    const queryEmbedding = await embedQuery(query);
    console.log(`[Search] 查询向量化完成，维度: ${queryEmbedding.length}`);

    // 2. ChromaDB 语义检索
    const rawResults = await queryChunks(query, queryEmbedding, top_k);
    console.log(`[Search] 检索到 ${rawResults.length} 条结果`);

    const results: ChunkResult[] = rawResults.map((r) => ({
      content: r.content,
      metadata: r.metadata,
    }));

    const response: SearchResponse = {
      query,
      results,
      total_chunks: results.length,
    };
    res.json(response);
  } catch (err: any) {
    next(err);
  }
});

// ============ GET /query/documents ============
router.get("/documents", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const docIds = await getAllDocIds();
    const documents = docIds.map((doc_id) => ({
      doc_id,
      filename: "",
      source_type: "unknown",
      chunk_count: 0,
      created_at: "",
    }));

    const response: DocumentListResponse = {
      documents,
      total: documents.length,
    };
    res.json(response);
  } catch (err: any) {
    next(err);
  }
});

// ============ DELETE /query/documents/:doc_id ============
router.delete("/documents/:doc_id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { doc_id } = req.params;
    if (!doc_id) {
      res.status(400).json({ detail: "doc_id 不能为空" });
      return;
    }
    await deleteDocChunks(doc_id);
    res.json({ status: "success", message: `文档 ${doc_id} 已从向量库删除` });
  } catch (err: any) {
    next(err);
  }
});

export default router;
