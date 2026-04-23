// src/models.ts
import { z } from "zod";

// ============ 请求模型 ============

export const UploadResponseSchema = z.object({
  doc_id: z.string(),
  filename: z.string(),
  chunk_count: z.number(),
  status: z.string(),
  message: z.string(),
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;

export const CrawlRequestSchema = z.object({
  url: z.string().url("URL 格式不正确"),
});
export type CrawlRequest = z.infer<typeof CrawlRequestSchema>;

export const CrawlResponseSchema = z.object({
  doc_id: z.string(),
  url: z.string(),
  title: z.string(),
  chunk_count: z.number(),
  status: z.string(),
  message: z.string(),
});
export type CrawlResponse = z.infer<typeof CrawlResponseSchema>;

export const SearchRequestSchema = z.object({
  query: z.string().min(1, "查询内容不能为空"),
  top_k: z.number().int().min(1).max(20).default(5),
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const ChunkResultSchema = z.object({
  content: z.string(),
  metadata: z.record(z.unknown()),
});
export type ChunkResult = z.infer<typeof ChunkResultSchema>;

export const SearchResponseSchema = z.object({
  query: z.string(),
  results: z.array(ChunkResultSchema),
  total_chunks: z.number(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

export const DocumentInfoSchema = z.object({
  doc_id: z.string(),
  filename: z.string(),
  source_type: z.string(),
  chunk_count: z.number(),
  created_at: z.string(),
});
export type DocumentInfo = z.infer<typeof DocumentInfoSchema>;

export const DocumentListResponseSchema = z.object({
  documents: z.array(DocumentInfoSchema),
  total: z.number(),
});
export type DocumentListResponse = z.infer<typeof DocumentListResponseSchema>;

// ============ 内部类型 ============

export interface ChunkMetadata {
  doc_id: string;
  filename: string;
  title: string;
  source_type: "file" | "url";
  created_at: string;
  url?: string;
  chunk_index: number;
  chunk_total: number;
}
