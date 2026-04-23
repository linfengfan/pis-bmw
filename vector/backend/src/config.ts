// src/config.ts
import path from "path";
import { promises as fs } from "fs";

const BASE_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(BASE_DIR, "data");

export const RAW_DIR = path.join(DATA_DIR, "raw");
export const MD_DIR = path.join(DATA_DIR, "md");
export const CHROMA_DIR = path.join(DATA_DIR, "chroma_db");

// Ollama 配置（Embedding 模型）
export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
export const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

// 向量化参数
export const CHUNK_SIZE = 800;       // 每块目标字数
export const CHUNK_OVERLAP = 100;     // 块间重叠字数
export const MIN_CHUNK_LENGTH = 50;  // 最小块字数

export const COLLECTION_NAME = "docs";

// 服务器配置
export const API_HOST = process.env.API_HOST || "0.0.0.0";
export const API_PORT = Number(process.env.API_PORT) || 8000;

// 确保目录存在
export async function ensureDirs(): Promise<void> {
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.mkdir(MD_DIR, { recursive: true });
  await fs.mkdir(CHROMA_DIR, { recursive: true });
}
