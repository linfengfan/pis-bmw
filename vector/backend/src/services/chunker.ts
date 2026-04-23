// src/services/chunker.ts
import { CHUNK_SIZE, CHUNK_OVERLAP, MIN_CHUNK_LENGTH } from "../config";

/**
 * 将长文本按段落分块，保留重叠区域以维持上下文
 *
 * 策略：
 * 1. 按换行分割 → paragraphs
 * 2. 贪心合并段落到块（≤ CHUNK_SIZE 字）
 * 3. 超过则截断，新块 = 旧块末尾重叠 + 新段落
 * 4. 过滤 < MIN_CHUNK_LENGTH 的噪音块（页眉/页脚等）
 */
export function chunkText(text: string): string[] {
  const paragraphs = text.split("\n").map((p) => p.trim()).filter((p) => p.length > 0);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length <= CHUNK_SIZE) {
      current += (current ? "\n" : "") + para;
    } else {
      if (current) chunks.push(current);
      // 带重叠滑动：旧块末尾 + 新段落
      current = para.slice(-CHUNK_OVERLAP) + "\n" + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // 过滤噪音块
  return chunks.filter((c) => c.length > MIN_CHUNK_LENGTH);
}
