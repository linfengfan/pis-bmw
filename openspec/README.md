# 规范即文档 (Specs as Living Docs)

> 代码变更时自动同步规范。规范永远与代码保持一致。

## 目录结构

```
openspec/
├── specs/                  # 与代码同步的活体规范
│   ├── api/
│   │   └── rest-conventions.md   # API 规范
│   └── ai-pipeline/
│       └── agent-orchestration.md # AI 协作规范
├── README.md              # 本文件
└── CHANGE_LOG.md          # 规范变更记录
```

## 同步机制

| 触发事件 | 动作 |
|----------|------|
| 新功能上线 | 将 design.md 摘要合并至对应 spec |
| 重大重构 | 更新 spec 架构图 + 决策记录 |
| BUG 修复 | 在 spec 中补充"已知约束"章节 |
| 废弃 API | 删除 spec 中对应条目，注明废弃时间 |

## 同步原则

- **代码即事实**：spec 落后于代码时，以代码为准，删除或更新 spec
- **禁止绕过**：核心业务逻辑必须先有 spec，再写代码
- **变更原子化**：每次规范变更是独立条目，便于追溯

## 示例：规范变更流程

```
1. proposal.md 审批通过
2. design.md 确定技术方案
3. 代码实现完成
4. 将 design.md 核心内容合并到 openspec/specs/ 对应文件
5. 在 CHANGE_LOG.md 记录变更
```

## 触发条件

任何涉及跨模块/跨团队的系统性变更。