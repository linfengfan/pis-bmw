# 提案目录 (proposals)

> 多文件或跨模块变更时，在此目录创建三层文档

## 目录结构

```
proposals/
├── README.md              # 本文件
├── <feature-name>/
│   ├── proposal.md        # 需求背景与目标（人类决策）
│   ├── design.md          # 技术方案（人类审批）
│   └── tasks.md           # 实施清单（AI 执行）
└── template/
    ├── proposal-template.md
    └── design-template.md
```

## 三层文档流程

```
1. proposal.md  → 回答"为什么做"和"做什么"
   ↓ 人类审批通过
2. design.md    → 回答"怎么做"
   ↓ 人类审批通过
3. tasks.md     → AI 的施工单
   ↓ 分步实施
4. 代码实现     → AI 执行
   ↓ 人类 Code Review
5. 上线         → 人类最终放行
```

## 触发条件

- ≥2 个文件变更
- 跨模块逻辑
- 新功能引入
- 重大重构

## 模板

参见 `proposals/template/` 目录