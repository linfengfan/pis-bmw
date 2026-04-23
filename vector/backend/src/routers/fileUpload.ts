// src/routers/fileUpload.ts
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import { v4 as uuidv4 } from "uuid";
import { UploadResponse } from "../models";
import { RAW_DIR } from "../config";
import { pdfToText, extractPdfMetadata } from "../services/pdfParser";
import { chunkText } from "../services/chunker";
import { embedTexts } from "../services/embedder";
import { addChunks } from "../services/chromaService";

const router = Router();

// ============ 文件上传配置 ============
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".md", ".markdown", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型 ${ext}，支持: ${allowed.join(", ")}`));
    }
  },
});

// ============ POST /upload/file ============
router.post("/file", upload.single("file"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ detail: "未上传文件" });
      return;
    }

    const suffix = path.extname(file.originalname).toLowerCase();
    const docId = createHash("md5")
      .update(`${file.originalname}${new Date().toISOString()}${uuidv4()}`)
      .digest("hex")
      .slice(0, 12);

    let text: string;
    let title = file.originalname;

    if (suffix === ".pdf") {
      text = await pdfToText(file.buffer);
      const meta = await extractPdfMetadata(file.buffer);
      if (meta.title) title = meta.title;
    } else {
      text = file.buffer.toString("utf-8");
    }

    if (text.trim().length < 100) {
      res.status(400).json({ detail: "文件内容过少，无法向量化" });
      return;
    }

    // 保存原始文件
    await fs.writeFile(path.join(RAW_DIR, `${docId}${suffix}`), file.buffer);

    // 分块
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      res.status(400).json({ detail: "文本分块为空，无法向量化" });
      return;
    }

    const now = new Date().toISOString();
    const metadatas = chunks.map((_, i) => ({
      doc_id: docId,
      filename: file.originalname,
      title,
      source_type: "file" as const,
      created_at: now,
      chunk_index: i,
      chunk_total: chunks.length,
    }));

    // 向量化（Ollama）→ 存入 ChromaDB
    console.log(`[FileUpload] 开始向量化 ${chunks.length} 个文本块...`);
    const embeddings = await embedTexts(chunks);
    console.log(`[FileUpload] 向量化完成，开始存入向量库...`);
    await addChunks(docId, chunks, metadatas, embeddings);
    console.log(`[FileUpload] 存入完成，doc_id=${docId}`);

    const response: UploadResponse = {
      doc_id: docId,
      filename: file.originalname,
      chunk_count: chunks.length,
      status: "success",
      message: `成功！共切成 ${chunks.length} 个文本块，已存入向量库`,
    };
    res.json(response);
  } catch (err: any) {
    next(err);
  }
});

export default router;
