// src/services/embedder.ts
import axios from "axios";
import { OLLAMA_BASE_URL, OLLAMA_EMBED_MODEL } from "../config";

/**
 * Ollama Embedding 服务
 * 使用 nomic-embed-text 模型生成 768 维向量
 * 需要本地运行 Ollama：ollama serve
 *
 * 安装模型：ollama pull nomic-embed-text
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    const embedding = await embedQuery(text);
    results.push(embedding);
  }
  return results;
}

/**
 * 单条查询向量化
 */
export async function embedQuery(query: string): Promise<number[]> {
  try {
    const res = await axios.post(`${OLLAMA_BASE_URL}/api/embeddings`, {
      model: OLLAMA_EMBED_MODEL,
      prompt: query,
    });
    return res.data.embedding;
  } catch (err: any) {
    throw new Error(
      `Ollama embedding 失败: ${err.message}。请确保 Ollama 已启动 (ollama serve) 且模型已安装 (ollama pull ${OLLAMA_EMBED_MODEL})`
    );
  }
}

/**
 * 检查 Ollama 是否可用
 */
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}
