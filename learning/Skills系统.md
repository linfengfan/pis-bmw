# Skills 系统（标准化 SOP 封装）

## 核心定义
将团队经验封装为可复用的技能包，供 AI 在特定场景下自动加载。

## 文件结构

```
skills/
├── SKILL.md          # AI 的施工蓝图，包含完整的分步 SOP
├── version.json      # 版本控制，支持热更新
└── skill-bundle.json # 团队标准化配置清单
```

### SKILL.md（核心）
每个 Skill 包含：
- **trigger**：触发关键词
- **steps**：分步 SOP（供 AI 直接执行）
- **constraints**：该 Skill 的边界约束
- **examples**：典型输入/输出示例

### version.json
```json
{
  "skills": {
    "auth-flow": "2.1.0",
    "ai-pipeline": "1.3.0"
  },
  "updated": "2026-04-27"
}
```

### skill-bundle.json
团队所有 Skill 的索引清单，AI 启动时加载。

## 触发关键词设计原则
`description` 字段同时承担：
1. "让人理解"：开发者读得懂
2. "让 AI 知道何时触发"：语义清晰，区分度高

❌ 差示例：`"处理 API 调用"`（太泛）
✅ 好示例：`"当用户请求第三方 API 代理且需要 token 注入时触发"`

## 为什么重要
- 避免重复解释同一类任务
- Skill 即 SOP → AI 执行一致性提升
- 版本控制 → Skill 演进有迹可循

## 触发条件
高频重复任务（如：新建组件、规范检查、发布流程）。
