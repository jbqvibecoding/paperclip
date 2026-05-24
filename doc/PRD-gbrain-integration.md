# PRD：OneManCo × Gbrain —— 个人知识底座 + Agent 记忆中枢 + 技能语义发现

> 本 PRD 是 `doc/PRD-onemanco.md` 的子模块需求文档，定义把 **Gbrain**
> （github.com/garrytan/gbrain，面向 AI agent 的持久知识库）接入 OneManCo 的产品需求。
> 设计细节见配套文档 `doc/DESIGN-gbrain-integration.md`。

---

## 0. 文档信息

| 项 | 内容 |
|----|------|
| 文档类型 | 产品需求文档（PRD，子模块） |
| 版本 | v0.1（草案） |
| 状态 | 待评审 |
| 目标读者 | 产品 / 工程 / 设计 / 运营 |
| 关联文档 | `doc/PRD-onemanco.md`（母 PRD）、`doc/DESIGN-gbrain-integration.md`（设计） |
| 依赖 | OneManCo 执行底座（wanman sandbox-provider + openclaw_gateway） |

---

## 1. 产品概述

**一句话定义：** 给 OneManCo 的每家公司配一个**持久、可语义检索的知识与记忆底座**——
云端角色化 OpenClaw 智能体通过 MCP 直接读写本公司的 Gbrain，把"知识、时间、实体、工具、执行流程"
连成一个随时间持续进化的系统。

**愿景：** 智能体不再"重启即失忆"。每一次计划、决策、复盘、执行都沉淀进公司大脑；
下一次任务开始前，智能体先"回忆"过去——团队记忆随公司一起成长。

**核心理念：** Gbrain 是**横向语义底座**，与 OneManCo 现有部件正交互补，**不替换**：
- **paperclip** = 编排（工单/心跳/run/治理）+ MCP 注入接缝 + 每公司密钥。
- **wanman db9** = 执行遥测（run_feedback/loop_events/skill_evals）+ 技能版本/激活权威。
- **gstack** = 方法论与技能内容，且已自带 Gbrain 安装/同步管线。
- **Gbrain** = 知识页面 + 时间线 + 实体图谱 + 语义/符号级代码搜索 + MCP 工具面。

---

## 2. 背景与动机

**痛点（无 Gbrain 时）：**
- 智能体跨会话/跨 sandbox 失忆，重启丢上下文，用户反复手动喂背景。
- "我们以前关于 X 怎么决定的"无处可查；知识散落在工单评论与文档（paperclip 文档仅 trigram 模糊匹配）。
- 跨 agent 无法共享学习与决策；执行历史不沉淀，无法从过去的 run 中学习。
- 业务实体（人/公司/交易/项目）无结构化、可演进的记录。

**机会（且大半积木已就位）：**
- **Gbrain 原生**提供知识页面（双层：已编译事实 + 追加式时间线）、实体图谱（含类型化边）、
  混合检索（向量+BM25+RRF+图）、符号级代码搜索、30+ MCP 工具、autopilot 夜间富化。
- **paperclip 已有** MCP 注入模式（统一注入 `PAPERCLIP_*` env）、每公司 `company_secrets`、`secret_ref`。
- **gstack 已有** `setup-gbrain`/`sync-gbrain`/`gstack-gbrain-supabase-provision`/resolver 全套管线，可直接复用。
- 主要新增 = paperclip 适配器侧 MCP 注入 + 几张 schema 的元数据字段 + 同步作业，**非从零自研**。

---

## 3. 目标用户与场景

### 3.1 Personas
沿用母 PRD：独立开发者/一人创业者、技术型 CEO、技术负责人、Claude Code 新用户。

### 3.2 关键场景
- **A 记忆召回**：智能体接任务前先 `gbrain search`，命中上次的 CEO 计划/决策/复盘，无需用户重述背景。
- **B 知识检索**：用语义而非关键词搜公司文档（"浏览器安全 canary 在哪处理"返回排序的代码区域）。
- **C 代码导航**：临时 sandbox 里也能 `code-def/refs/callers/callees` 查公司仓库（服务端已索引）。
- **D 技能发现**：智能体语义搜到一个"按名字搜不到"的相关技能，由 db9 解析激活正确版本。
- **E 实体图谱（后期）**：用户的人/公司/交易/项目随每次信号被富化，形成可遍历、随时间演进的个人知识库。

---

## 4. 产品定位与价值主张

| 维度 | 主张 |
|------|------|
| 持久记忆 | 智能体跨会话/跨 sandbox 不失忆；计划/决策/复盘自动沉淀 |
| 语义检索 | 向量+BM25+图混合检索，远胜关键词/trigram |
| 代码感知 | 符号级调用图搜索，临时 sandbox 也可用（服务端索引） |
| 多租户隔离 | 每公司一脑，天然数据隔离 |
| 即装即用 | 复用 gstack 现成 Gbrain 管线，落地快 |
| 可持续进化 | autopilot 富化 + 增量 sync，公司大脑随时间成长 |

**不是什么：** 不是替代 paperclip 编排、不是替代 db9 执行遥测/技能版本管理、不是新的编排器——
它只做**知识+记忆+实体的语义底座**。

---

## 5. 组件职责（接入后角色映射）

| 组件 | 在本模块中的角色 | 关键接缝 / 文件 |
|------|------------------|------------------|
| **Gbrain** | 每公司语义知识底座（页面/时间线/实体/代码/MCP） | 远程 HTTP MCP（`gbrain serve --http`，OAuth2.1） |
| **paperclip** | MCP 注入 + 每公司密钥 + 文档/run 源 | `openclaw-gateway/.../execute.ts`、`company_secrets`、`documents` |
| **wanman** | sandbox-provider 在供给时注入脑凭据；db9 技能版本权威 | `acquireLease` 注入；`brain-manager.ts` |
| **gstack** | Gbrain 供给/同步管线 + 方法论写回 | `bin/gstack-gbrain-supabase-provision`、`sync-gbrain`、`scripts/resolvers/gbrain.ts` |

---

## 6. 系统架构

```
        ┌──────────── PAPERCLIP（控制平面）────────────┐
  用户 ▶│ 工单·心跳·run·治理·成本 + company_secrets    │
        └──┬───────────────────────┬───────────────────┘
      MCP 注入(需求7.1)│      knowledge/skill 同步(需求7.3/7.4)
           │ openclaw_gateway 适配器把 gbrain MCP
           │ 作为 env/MCP 配置注入 agent 会话
           ▼
   云 sandbox 内角色化 OpenClaw（gstack 方法论）
     mcp__gbrain__*  ──远程 HTTP MCP(OAuth2.1)──▶  ┌─────────────────────────┐
     mcp__paperclip__*                              │ 每公司一脑 Gbrain        │
     读写(需求7.2): 学习/决策/复盘/run 页面 ─────▶  │ (Supabase + pgvector)   │
                                                    │ 页面·时间线·实体图谱·   │
   wanman db9（执行遥测 + 技能版本/激活）            │ 代码符号·联邦源         │
     └─ 技能镜像为 gbrain 页面(需求7.4) ─────────▶  └─────────────────────────┘
```

---

## 7. 核心功能需求

> **[M]** 必须；**[S]** 应该；**[C]** 可后续。

### 7.1 每公司脑供给 + MCP 注入（核心）
- **[M]** 每公司一个 Gbrain（Supabase 后端 + 远程 HTTP MCP 端点）；供给复用 `gstack-gbrain-supabase-provision`。
- **[M]** 连接信息（HTTP MCP URL + bearer）存 `company_secrets`；per-agent 开关存 `adapterConfig`
  （新增 `gbrainMcpUrl`/`gbrainMode:"http"`/`gbrainTokenRef`）。
- **[M]** `openclaw_gateway`（及其他适配器）唤醒 agent 时注入 gbrain MCP；云 sandbox 用**远程 HTTP MCP**。
- **[M]** 凭据由 wanman sandbox-provider 在 `acquireLease` 时注入，run 级作用域，绝不进 argv/prompt。
- **[S]** UI 配置每公司脑 + 每 agent 开关；连接预检诊断。

### 7.2 记忆写回 + run 页面（记忆中枢）
- **[M]** 智能体跑 gstack，`/retro`/plan/decision 经 `sync-gbrain` 写为带时间线的页面（远程 MCP 模式走 `put_page`）。
- **[M]** paperclip 在 run 完成时把 run/决策摘要写为页面（slug `runs/<issue>/<run-id>`，标签 `[run,status,agent]`）。
- **[S]** CLAUDE.md 注入 `## GBrain Search Guidance` 块（复用 `scripts/resolvers/gbrain.ts`），引导智能体优先用 gbrain。

### 7.3 知识库与代码同步
- **[M]** 公司 `documents` + issue 文档同步为 gbrain 页面；`documents.metadata` 存 `gbrainPageId` 双向关联。
- **[S]** 服务端把公司仓库 `gbrain sources add` + `sync --strategy code` 索引进公司脑，供云 agent 符号级代码搜索。
- **[C]** autopilot/夜间富化在服务端定时跑（实体清扫、引用修复、合并）。

### 7.4 技能语义发现（db9 权威 + gbrain 发现）
- **[M]** db9 保持权威（版本/激活/打包）；同步作业把技能元数据镜像为 gbrain 带标签页面（slug `skills/<name>`）。
- **[M]** 智能体 `gbrain search` 语义发现技能，再由 db9 解析版本内容 + 激活快照。
- **[S]** 镜像新鲜度保障（增量 + 一致性校验）。

### 7.5 业务实体图谱 / CRM（分期，后置）
- **[C]** 用 gbrain 推荐 schema 把人/公司/交易/项目/想法写为实体页面，每次信号富化并追加时间线。
- **[C]** 图遍历（backlinks/traverse_graph）在 UI 暴露为关系视图。

### 7.6 多租户、成本、安全
- **[M]** 一公司一脑硬隔离；agent 仅拿本公司脑凭据；OAuth2.1：agent read/write，admin 仅服务端。
- **[M]** Gbrain 侧嵌入/存储开销纳入 paperclip 成本核算（按公司）。
- **[S]** 公司脑凭据优先 run-scoped 短时令牌，降低爆炸半径。

---

## 8. 端到端用户旅程（验收主线）

1. 新建公司时（或首次启用），系统为该公司供给一个 Gbrain（Supabase）。
2. 凭据写入 `company_secrets`；为智能体开启 gbrain（`adapterConfig`）。
3. 心跳派发工单 → openclaw_gateway 唤醒云 OpenClaw；wanman provider 供给 sandbox 并注入本公司脑的 HTTP MCP 凭据。
4. 智能体接任务先 `mcp__gbrain__search`，召回历史计划/决策（需求 7.2）。
5. 智能体按 gstack sprint 工作；产出的学习/复盘/决策与 run 摘要写回公司脑（带时间线）。
6. 需要时语义搜公司文档/代码（需求 7.3），或语义发现技能并由 db9 激活（需求 7.4）。
7. 下一次任务，公司脑已更"懂"这家公司——记忆持续进化。

**主线跑通 + 跨公司隔离验证 = 本模块成功的最小证明。**

---

## 9. 非功能需求（NFR）

- **安全：** 公司脑凭据 env-only、run 级、尽量短时；agent 只能 read/write，admin 操作仅服务端。
- **隔离：** 一公司一脑；A 公司 agent 不可读 B 公司任何页面。
- **延迟：** 远程脑 + 临时 sandbox 的检索延迟需可接受；代码搜索靠服务端预索引而非 sandbox 内本地 PGLite。
- **成本：** 每公司 Supabase + 嵌入开销计入预算；与母 PRD 成本看板打通。
- **一致性：** 多 agent 并发写同一公司脑的去重/合并语义需确认（gbrain canonical/alias + 合并）。
- **可观测：** 写回/同步/检索可在活动流追踪；`gbrain doctor` 健康分纳入 `/health`。

---

## 10. 版本规划与里程碑

| 阶段 | 目标 | 验收 |
|------|------|------|
| **P0 脑供给 + MCP 注入** | 每公司脑供给；凭据入 company_secrets；openclaw_gateway 注入 gbrain HTTP MCP | 云 agent 对本公司脑 put_page→search 往返；A 读不到 B |
| **P1 记忆写回 + run 页面** | gstack 写学习/复盘；paperclip 写 run/决策页面 | "上次怎么决定的"命中历史；run 历史可检索 |
| **P2 知识 + 代码同步** | documents→gbrain 页面；服务端索引公司仓库 | 语义文档搜索 + `code-def` 对云 agent 可用 |
| **P3 技能语义发现** | db9 技能镜像为 gbrain 标签页面；search 发现 + db9 激活 | 语义搜到按名搜不到的技能并激活 |
| **P4 业务实体图谱/CRM** | 实体页面 + 富化 + 时间线 | 实体随时间累积证据；图遍历可用 |

---

## 11. 成功指标（KPIs）

- **记忆召回率：** 任务开始前 gbrain 检索命中相关历史的比例。
- **重述减少：** 用户手动重述背景的次数下降幅度。
- **检索质量：** 语义搜索 top-k 命中率 vs 旧 trigram 基线。
- **隔离零事故：** 跨公司数据越权访问 = 0。
- **成本可控：** 每公司脑嵌入/存储成本在预算内；检索延迟 P95 达标。
- **进化度：** 公司脑页面/实体数随时间增长；复用历史决策的任务占比上升。

---

## 12. 风险与开放问题

- **临时 sandbox + 远程脑延迟**；代码搜索须服务端索引（本地 PGLite 在临时 sandbox 不可用）。
- **成本归集**：嵌入/存储开销在 gbrain 侧，需接入 paperclip 预算核算。
- **gbrain HTTP MCP 为 v0.26+**：确认版本，并明确每公司脑服务谁运营（纯 Supabase vs 托管 `gbrain serve --http`）。
- **并发写入**：多 agent 同写一脑的去重/合并语义需验证。
- **密钥爆炸半径**：公司脑凭据=全量读写，优先短时令牌。
- **db9↔gbrain 技能镜像新鲜度**：同步延迟与一致性。

---

## 13. 范围外（本模块）

- 替换 paperclip 编排或 db9 执行遥测/技能版本管理（明确不做）。
- 在 Gbrain 内自建执行编排器/DAG（执行编排归 paperclip）。
- 跨公司联邦检索（与一公司一脑隔离冲突，明确不做）。
- 业务实体图谱/CRM 的完整 UI（P4 起步，本期不做完整产品化）。
