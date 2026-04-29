/**
 * 三级降级策略模板
 * 辅助功能失败不阻塞核心流程
 */

/**
 * L1 → L2 → L3 降级链
 *
 * L1: 优先执行主流程
 * L2: 本地缓存或 fallback 配置
 * L3: 静默跳过，不抛错，不阻塞
 */

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string };

/**
 * 示例：知识库查询降级
 * @deprecated 这是示例代码，请根据实际需求实现
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function queryKnowledge(query: string): Promise<Result<string[]>> {
  // TODO: 根据实际业务实现降级逻辑
  // L1: 优先查询向量数据库
  // const results = await vectorDb.query(query);

  // L2: 降级到本地缓存
  // const cached = localCache.get(query);

  // L3: 静默兜底，返回空结果
  console.warn(`[Fallback] Knowledge query - implement with actual services`);
  return { ok: true, data: [] };
}

/**
 * 示例：Analytics 上报降级
 * @deprecated 这是示例代码，请根据实际需求实现
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function reportEvent(event: unknown): Promise<void> {
  // TODO: 根据实际业务实现降级逻辑
  // L1: 上报到分析服务
  // L2: 降级到本地队列
  // L3: 静默兜底
}

/**
 * 示例：非核心 UI 降级
 *
 * 推荐模块不可用 → 显示通用热门内容 → 隐藏模块
 *
 * 推荐模块降级 → 显示缓存内容 → 显示默认占位
 */
