# Bridge Rule 模式（跨系统上下文桥接）

## 核心定义
当 AI 需要跨系统读取配置或规则时，使用 Bridge Rule 做"指路"而非复制内容。

## 实施方式

### 目录结构
```
.codebuddy/
└── rules/
    ├── auth-bridge.md    # 指向 auth/config.yaml
    ├── api-bridge.md     # 指向 api/rules/rest.yaml
    └── ai-bridge.md      # 指向 ai/prompt-templates/
```

### Bridge 文件内容
```markdown
# auth-bridge.md
description: "认证鉴权规则桥接"
alwaysApply: true
source: "config/auth.yaml"
memo: "所有 token 规则以 config/auth.yaml 为准，不要内联"
```

### 核心原则
- `alwaysApply: true` → 每次会话自动加载
- 保持配置源（`config.yaml` 等）作为 **single source of truth**
- Bridge 文件只存"路由信息"，不复制配置内容

## 为什么重要
- ❌ 复制配置到提示词 → 配置更新后提示词失效，产生不一致
- ✅ Bridge Rule → 始终指向最新配置源
- AI 每次读取时动态拉取配置，而非依赖过时的内联副本

## 三种常见场景

| 场景 | 路由方式 |
|------|----------|
| 认证规则 | Bridge → config/auth.yaml |
| API 规范 | Bridge → openspec/specs/api/ |
| Prompt 模板 | Bridge → ai/prompts/ |

## 触发条件
跨系统配置引用（当 AI 需要访问外部规则文件时）。
