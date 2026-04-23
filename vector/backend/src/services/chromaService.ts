// src/services/chromaService.ts
import { ChromaClient, Collection } from "chromadb";
import { CHROMA_DIR, COLLECTION_NAME } from "../config";
import { ChunkMetadata } from "../models";

let client: ChromaClient | null = null;
let collection: Collection | null = null;

export function getClient(): ChromaClient {
  if (!client) {
    client = new ChromaClient({ path: CHROMA_DIR });
  }
  return client;
}

export async function getCollection(): Promise<Collection> {
  if (!collection) {
    const c = getClient();
    try {
      collection = await c.getOrCreateCollection({
        name: COLLECTION_NAME,
        metadata: { description: "文档向量化知识库" },
      });
    } catch {
      // 兼容：直接传 name
      collection = await c.getOrCreateCollection({ name: COLLECTION_NAME });
    }
  }
  return collection;
}

// ============ CRUD ============

/**
 * 批量添加文本块到向量库
 * @param docId 文档 ID
 * @param chunks 文本块列表
 * @param metadatas 每个块的元数据
 * @param embeddings 预计算的 embedding 向量（ Ollama 生成）
 */
export async function addChunks(
  docId: string,
  chunks: string[],
  metadatas: ChunkMetadata[],
  embeddings: number[][]
): Promise<number> {
  const col = await getCollection();
  const ids = chunks.map((_, i) => `${docId}_${i}`);

  await col.add({
    ids,
    documents: chunks,
    metadatas: metadatas as any,
    embeddings,
  });

  return chunks.length;
}

/**
 * 语义检索
 * @param queryText 原始查询文本
 * @param queryEmbedding 预计算的查询向量（由 Ollama 生成）
 * @param nResults 返回数量
 */
export async function queryChunks(
  queryText: string,
  queryEmbedding: number[],
  nResults: number
): Promise<Array<{ content: string; metadata: Record<string, unknown> }>> {
  const col = await getCollection();
  const results = await col.query({
    queryEmbeddings: [queryEmbedding],
    nResults,
  });

  const docs = results.documents?.[0] ?? [];
  const metas = results.metadatas?.[0] ?? [];

  return docs.map((doc, i) => ({
    content: doc ?? "",
    metadata: (metas[i] as Record<string, unknown>) ?? {},
  }));
}

/**
 * 删除指定文档的所有块
 */
export async function deleteDocChunks(docId: string): Promise<void> {
  const col = await getCollection();
  const all = await col.get({});
  const ids = (all.ids ?? []).filter((id: string) => id.startsWith(`${docId}_`));
  if (ids.length > 0) {
    await col.delete({ ids });
  }
}

/**
 * 获取所有文档 ID 列表
 */
export async function getAllDocIds(): Promise<string[]> {
  const col = await getCollection();
  const all = await col.get({});
  const metadatas = all.metadatas ?? [];
  const uniqueIds = new Set<string>();
  for (const meta of metadatas) {
    if (meta && typeof meta === "object" && "doc_id" in meta) {
      uniqueIds.add((meta as any).doc_id);
    }
  }
  return Array.from(uniqueIds);
}
