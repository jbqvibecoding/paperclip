# 集成设计：OneManCo × Gbrain —— 个人知识底座 + Agent 记忆中枢 + 技能语义发现

> 本文档是 `doc/PRD-onemanco.md` 的配套设计，定义如何把 **Gbrain**
> （github.com/garrytan/gbrain，面向 AI agent 的持久知识库）有机接入 OneManCo。
> 基于代码级调研（paperclip 接缝 / wanman db9 / gstack 现成管线 / Gbrain 数据模型）与三项已定决策。

---

## 0. Context（为什么做、要解决什么）

OneManCo 的 agent 跑在云端 sandbox 的角色化 OpenClaw 里，但**没有持久、可语义检索的知识与记忆**：
重启丢上下文、跨任务/跨 agent 无法共享"我们以前决定过什么"、知识散落在工单评论与文档（仅 trigram 搜索）。
Gbrain 正好补这块——它原生提供**知识页面（双层：已编译事实 + 追加式时间线）、实体图谱
（Person/Company/Deal/Project/Idea/Concept + 类型化边）、混合语义检索（向量+BM25+RRF+图）、
符号级代码搜索、30+ MCP 工具、Minions 任务队列 + autopilot 富化**。

关键判断：Gbrain 与 OneManCo 现有部件**正交互补，不替换**——
- **执行流程**已由 paperclip（编排：工单/心跳/run/治理）+ wanman **db9**（执行遥测：run_feedback/
  loop_events/skill_evals）承担；
- **技能版本/激活**已由 db9（shared_skills/skill_bundles/skill_activation_snapshots）承担。

因此 Gbrain 定位为**横向的知识+记忆+实体图谱语义底座**，通过 paperclip 已有的 **MCP 注入**接缝接进来。
目标：把"知识、时间、实体、工具、执行流程"连成一个可持续进化的系统。

---

## 1. 已定决策

| 维度 | 决策 |
|------|------|
| 脑拓扑/接入 | **每公司一脑 · 远程 HTTP MCP**（Supabase 后端，OAuth2.1 read/write）。天然多租户隔离；适配临时 sandbox。 |
| 知识范围 | **记忆底座 + 业务实体图谱（两者，分期）**：先 agent 记忆+代码搜索，后 CRM 式实体图谱。 |
| 技能分工 | **db9 管版本/激活 + Gbrain 做语义发现 + gstack 提供内容**。 |

---

## 2. 映射：用户愿景 → 落地部件

| 愿景要素 | 由谁承担 | 接缝 |
|----------|----------|------|
| **知识** | Gbrain 页面 ← paperclip `documents` 同步进来 | 接缝 C |
| **时间** | Gbrain 时间线（追加式证据）← paperclip run 历史写为时间线条目 | 接缝 B |
| **实体** | Gbrain 实体图谱（人/公司/交易/项目/想法） | 接缝 E（P4） |
| **工具/技能** | db9 为权威，镜像为 Gbrain 带标签页面供语义发现 | 接缝 D |
| **执行流程** | paperclip 编排 + db9 遥测，**run 页面写进脑**让脑从每次执行学习 | 接缝 B |
| **可持续进化** | autopilot 夜间富化 + sync 增量；每公司脑随时间积累 | 全局 |

---

## 3. 系统位置

```
        ┌──────────── PAPERCLIP（控制平面）────────────┐
  用户 ▶│ 工单·心跳·run·治理·成本 + company_secrets    │
        └──┬───────────────────────┬───────────────────┘
      MCP 注入(接缝A)│        knowledge/skill 同步(接缝C/D)
           │ openclaw_gateway 适配器把 gbrain MCP
           │ 作为 env/MCP 配置注入 agent 会话
           ▼
   云 sandbox 内角色化 OpenClaw（gstack 方法论）
     mcp__gbrain__*  ──远程 HTTP MCP(OAuth2.1)──▶  ┌─────────────────────────┐
     mcp__paperclip__*                              │ 每公司一脑 Gbrain        │
     读写(接缝B): 学习/决策/复盘/run 页面 ───────▶  │ (Supabase + pgvector)   │
                                                    │ 页面·时间线·实体图谱·   │
   wanman db9（执行遥测 + 技能版本/激活）            │ 代码符号·联邦源         │
     └─ 技能镜像为 gbrain 页面(接缝D) ───────────▶  └─────────────────────────┘
```

---

## 4. 集成接缝（按落地顺序）

**接缝 A（核心）—— 每公司脑供给 + MCP 注入。**
- 每公司一个 Gbrain（Supabase 后端 + 远程 HTTP MCP 端点）。供给复用 gstack 现成
  `bin/gstack-gbrain-supabase-provision`（list-orgs/create/wait/pooler-url）。
- 连接信息（HTTP MCP URL + bearer）存 paperclip `company_secrets`；per-agent 开关存 `adapterConfig`
  （新增 `gbrainMcpUrl`/`gbrainMode:"http"`/`gbrainTokenRef`）。
- 适配器在唤醒 agent 时把 gbrain MCP 注入会话——复用 `openclaw-gateway/src/server/execute.ts` 的
  `buildPaperclipEnvForWake()`（~340–362）与 `workspaceServices`（~469–523）、`adapter-utils/src/
  execution-target.ts` 的 env 合并（~421–436）。云 sandbox 用**远程 HTTP MCP**（临时 sandbox 无法托管本地 PGLite）。
- 凭据由 wanman sandbox-provider 在 `acquireLease` 时注入（仅当前公司的脑凭据，run 级作用域），
  绝不进 argv/prompt——沿用 gstack env-only 纪律 + paperclip `secret_ref`。
- **验收**：云 agent 会话中出现 `mcp__gbrain__search/query/put_page/...`，对本公司脑可读写。

**接缝 B —— 记忆写回 + run 页面（记忆中枢）。**
- agent 跑 gstack 方法论，`/retro`、plan/decision 经 `sync-gbrain` 写为带时间线的页面（复用现成管线；
  远程 MCP 模式下 memory stage 走 HTTP `put_page`）。
- paperclip 在 run 完成时把 run/决策摘要写为页面（slug 约定 `runs/<issue>/<run-id>`，标签
  `[run,status:...,agent:...]`）——这是"把执行流程连进脑"的薄约定，**不是新编排器**（编排已存在）。
- **验收**："我们上次关于 X 怎么决定的"能命中历史计划；run 历史可语义检索。

**接缝 C —— 知识库同步（paperclip 文档 → gbrain）。**
- 把公司 `documents` + issue 文档同步为 gbrain 页面（语义+图检索 >> 现有 trigram）。
  在 `documents.metadata` 存 `gbrainPageId` 做双向关联。
- **联邦代码源**：服务端把公司仓库 `gbrain sources add` + `gbrain sync --strategy code` 索引进公司脑，
  使云 agent 在临时 sandbox 也能用 `code-def/refs/callers/callees`（本地 PGLite 不可用时的替代）。
- **验收**：云 agent 语义文档搜索 + 符号级代码搜索可用。

**接缝 D —— 技能语义发现（db9 权威 + gbrain 发现）。**
- db9 仍是权威：`shared_skills`/`skill_bundles`/`skill_activation_snapshots`（版本/激活/打包）。
- 一个同步作业把技能元数据镜像为 gbrain 带标签页面（slug `skills/<name>`，标签
  `[skill,category,stability,status,version]`）。agent 先 `gbrain search` 语义发现相关技能，
  再由 db9 解析版本内容 + 激活快照。gstack 提供技能正文。
- **验收**：agent 通过语义搜索找到一个"按名字搜不到"的相关技能并正确激活。

**接缝 E —— 业务实体图谱 / CRM（P4，分期）。**
- 用 gbrain `GBRAIN_RECOMMENDED_SCHEMA` 实体类型 + 类型化边，把用户的人/公司/交易/项目/想法写为
  实体页面，agent 在每次信号（会议/邮件/工单）后富化、追加时间线。这就是"个人知识底座"+"可持续进化"。
- **验收**：实体页面随时间累积证据；图遍历（backlinks/traverse_graph）可用。

---

## 5. 多租户与安全
- **一公司一脑**做硬隔离（Gbrain 共享脑无 per-source ACL，故不跨公司联邦）。
- agent 只在本公司 sandbox 拿到本公司脑凭据，run 级注入、尽量短期。OAuth2.1：agent 得 read/write，
  `sync_brain`/`file_upload` 等 admin 仅服务端。
- 公司脑凭据=该公司知识的完整读写权，注意爆炸半径：优先 run-scoped/短时令牌。

---

## 6. 与 db9 的关系（再次明确）
- **共存**：db9 = 执行遥测 + 技能版本/激活（喂 CEO 决策的指标面）；Gbrain = 知识/记忆/实体 + 语义/代码搜索。
- 二者数据模型正交（db9 关系型 SQL 指标 vs gbrain 文档+向量）。db9 是 wanman 可选依赖（`--no-brain` 可关），
  不必抽象统一后端。可选增强（P4+）：薄作业把 db9 `hypotheses/loop_events` 镜像成 gbrain 页面做执行史语义召回。

---

## 7. 分期路线
| 阶段 | 目标 | 验收 |
|------|------|------|
| **P0 脑供给 + MCP 注入** | 每公司脑供给（Supabase）；凭据入 company_secrets；openclaw_gateway 注入 gbrain HTTP MCP | 云 agent 对本公司脑 put_page→search 往返；A 公司读不到 B 公司页面 |
| **P1 记忆写回 + run 页面** | gstack 写学习/复盘；paperclip 写 run/决策页面 | "上次怎么决定的"命中历史；run 历史可检索 |
| **P2 知识 + 代码同步** | documents→gbrain 页面；服务端索引公司仓库 | 语义文档搜索 + `code-def` 对云 agent 可用 |
| **P3 技能语义发现** | db9 技能镜像为 gbrain 标签页面；search 发现 + db9 激活 | 语义搜到按名搜不到的技能并激活 |
| **P4 业务实体图谱/CRM** | 实体页面 + 富化 + 时间线 | 实体随时间累积证据；图遍历可用 |

---

## 8. 关键文件（执行用）
- **MCP 注入**：`paperclip/packages/adapters/openclaw-gateway/src/server/execute.ts`（~340–362、469–523）、
  `paperclip/packages/adapter-utils/src/execution-target.ts`（~421–436）、`packages/mcp-server/src/config.ts`（env 配置范式）。
- **配置/密钥**：`paperclip/packages/db/src/schema/company_secrets.ts`、`.../agents.ts`（adapterConfig）、`company_secret_bindings.ts`（secret_ref）。
- **知识/技能同步**：`paperclip/packages/db/src/schema/documents.ts`（加 `gbrainPageId`）、`company_skills.ts`。
- **插件化（可选）**：`paperclip/packages/plugins/sdk/src/types.ts`、`define-plugin.ts`（把脑供给/同步包成"知识提供方"插件，与 sandbox-providers 并列）。
- **供给注入点**：wanman sandbox-provider（OneManCo PRD 的新插件）在 `acquireLease` 时注入 gbrain MCP env。
- **gstack 复用**：`bin/gstack-gbrain-supabase-provision`（供给公司脑）、`bin/gstack-gbrain-source-wireup`、
  `scripts/resolvers/gbrain.ts`（CLAUDE.md 搜索指引块）、`hosts/gbrain.ts`、`lib/gbrain-exec.ts`。
- **db9 技能镜像**：`wanman/packages/runtime/src/brain-manager.ts`（shared_skills/bundle/activation schema 来源）。

---

## 9. 风险与开放问题
- **临时 sandbox + 远程脑延迟**；代码搜索须服务端索引（本地 PGLite 在临时 sandbox 不可用）。
- **成本**：每公司 Supabase + 嵌入（voyage-code-3/OpenAI）开销在 gbrain 侧，paperclip 预算需把这部分纳入核算。
- **gbrain HTTP MCP 为 v0.26+**：确认版本/谁运营每公司脑服务（纯 Supabase vs 托管 gbrain serve --http）。
- **并发写入**：多 agent 同写一个公司脑的去重/合并（gbrain 有 canonical/alias + 合并，需确认并发 put 语义）。
- **密钥爆炸半径**：公司脑凭据=全量读写，优先短时令牌。
- **db9↔gbrain 技能镜像新鲜度**：同步作业延迟与一致性。

---

## 10. 验证方法（端到端）
- P0：为测试公司供给脑→唤醒云 OpenClaw→确认 `mcp__gbrain__*` 存在且 put_page→search 往返；
  切到 B 公司 agent 确认读不到 A 公司页面（隔离）。
- P2：对样例仓库跑服务端代码同步；agent `gbrain code-def <symbol>` 返回正确位置。
- P3：写两个语义相近但命名不同的技能，验证 search 命中后 db9 正确解析激活版本。
