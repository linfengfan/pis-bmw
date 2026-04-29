# Bridge Rule 模式（跨系统上下文桥接）

> 当 AI 需要访问外部配置时，通过 Bridge 文件做"指路"而非复制内容

## 目录结构

```
.codebuddy/
├── rules/                  # Bridge 规则文件
│   ├── ai-bridge.md       # AI 协作规范桥接
│   ├── api-bridge.md       # API 规范桥接
│   └── skill-bridge.md     # Skills 索引桥接
└── README.md              # 本文件
```

## Bridge 文件格式

```markdown
# ai-bridge.md
description: "AI 协作规范桥接"
alwaysApply: true
source: "openspec/specs/ai-pipeline/agent-orchestration.md"
memo: "所有 AI 执行规则以此文件为准，不要内联"
```

## 核心原则

- `alwaysApply: true` → 每次会话自动加载
- 配置源（`openspec/specs/`）作为 **single source of truth**
- Bridge 文件只存"路由信息"，不复制配置内容

## 常见 Bridge 路由

| 场景 | 路由方式 |
|------|---------|
| AI 协作规则 | Bridge → `openspec/specs/ai-pipeline/` |
| API 规范 | Bridge → `openspec/specs/api/` |
| Skills 索引 | Bridge → `skills/bundle.json` |
| 项目概览 | Bridge → `CLAUDE.md` |
| 执行家法 | Bridge → `.clinerules` |

## 为什么重要

- ❌ 复制配置到提示词 → 配置更新后提示词失效，产生不一致
- ✅ Bridge Rule → 始终指向最新配置源
- AI 每次读取时动态访问配置，而非依赖过时的内联副本

## 触发条件

跨系统配置引用（当 AI 需要访问外部规则文件时）。