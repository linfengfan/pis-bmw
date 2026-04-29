# AI Engineering Base

> Claude Code 全局上下文，每次会话自动加载。
> 核心约束规范，Claude Code 必须遵循。

---

## 首次使用

请在 Claude Code 中运行 `/plugin` 并安装以下扩展：

| 扩展 | 用途 |
|------|------|
| superpowers | 头脑风暴、子代理驱动开发 |
| frontend-design | 生产级前端界面设计 |

---

## 核心原则

1. **先理解，再行动** — 不理解需求不写代码
2. **小步提交** — 每完成一个小功能就提交
3. **测试驱动** — 先写测试，再写实现
4. **增量验证** — 每写完一个函数就验证
5. **主动询问** — 需求不明确立即问，不猜测
6. **最小化** — 不要过度工程化

---

## 研发流程

### 大需求（完整流程）

```
需求 → /brainstorm → docs/superpowers/specs/YYYY-MM-DD-xxx-design.md
     → /write-plan  → docs/superpowers/plans/PLAN-xxx.md
     → /execute-plan → 代码 → PR
```

### 小需求（简化流程）

```
需求 → 直接执行 → 代码 → PR
```

### 何时用哪个流程

| 场景 | 流程 |
|------|------|
| 涉及多个模块 | 大需求 |
| 不确定 | 大需求 |
| 单个文件修改 / Bug 修复 | 小需求 |

---

## 每次会话开始

1. `git status` + `git log --oneline -5` — 了解当前状态
2. 如果有 `progress.json`，读取并了解当前进度
3. 明确本次会话目标再开始

---

## 代码规范

- 禁止 `any`，用 `unknown` 代替
- 禁止魔法值，用常量代替
- 错误处理：返回 `Result<T, Error>` 类型
- 公共 API 必须有类型定义

---

## 测试规范

- 测试文件与实现文件同目录：`user.test.ts` 与 `user.ts` 同级
- 命名：`it('should [expected] when [condition]')`
- 关键业务逻辑覆盖率 80%+

---

## 提交规范

```
<type>(<scope>): <subject>

feat: 新功能 | fix: Bug 修复 | docs: 文档 | refactor: 重构 | test: 测试
```

- 每完成一个小功能就提交，不要积累
- 提交前：`pnpm typecheck && pnpm lint && pnpm test`

---

## Plan 文件规范

文件：`docs/superpowers/plans/PLAN-xxx.md`

```markdown
---
plan_id: PLAN-001
title: 功能名称
scale: large  # large | small
owner: @xxx
created: 2026-04-29
status: pending
---

# 功能名称

## 规模
- [x] 大需求
- [ ] 小需求

## 需求点
1. [需求点 1]
2. [需求点 2]

## 关联的 Spec
docs/superpowers/specs/YYYY-MM-DD-xxx-design.md

## 验收标准
- [ ] 标准 1
```

---

## 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件 | kebab-case | `user-service.ts` |
| 组件 | PascalCase | `UserCard.tsx` |
| 函数 | camelCase | `getUserById()` |
| 常量 | SCREAMING_SNAKE | `MAX_RETRY` |

---

## 常用命令

```bash
pnpm dev          # 启动开发
pnpm build        # 构建
pnpm test         # 测试
pnpm typecheck    # 类型检查
pnpm lint         # 代码检查
pnpm docker:up    # 启动数据库
```

---

## 目录结构

通过 `ls` 命令按需查看，不要写死在文档里：

```bash
ls apps/ packages/          # 顶层结构
ls apps/*/src/              # 各应用源码
ls packages/*/src/          # 各包源码
```

详细结构说明见 `docs/structure/` 目录（按需阅读）。

---

## 文档索引

需要深入某个领域时，阅读对应文档：

| 文档 | 内容 |
|------|------|
| `docs/structure/` | 目录结构详细说明 |
| `docs/superpowers/` | Superpowers 规范（plans/specs 管理规则） |
| `docs/superpowers/plans/` | 所有实施计划 |
| `docs/superpowers/specs/` | 所有设计文档 |
