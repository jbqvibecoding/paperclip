# PRD：OneManCo（一人公司）—— 云端角色化 OpenClaw 多智能体编排平台

> 工作代号 **OneManCo**（暂定，可替换）。整合四个开源仓库：
> `paperclip`（控制平面/主干）、`wanman`（云 sandbox-provider 插件）、
> `agency-agents`（角色人设库）、`gstack`（工作方法论与技能）。
>
> **执行底座（本版定稿）：** 智能体运行在**云端 sandbox 中的角色化 OpenClaw 实例**，
> 每个实例按任务自动注入角色 `.md`（SOUL/AGENTS/IDENTITY）。**支持两种生命周期，由用户选择：
> 每任务临时 sandbox** 与 **常驻角色员工**。

---

## 0. 文档信息

| 项 | 内容 |
|----|------|
| 文档类型 | 产品需求文档（PRD） |
| 版本 | v0.2（草案，云端 OpenClaw 架构） |
| 状态 | 待评审 |
| 目标读者 | 产品 / 工程 / 设计 / 运营 |
| 关联文档 | `CLAUDE.md`、`AGENTS.md`、附录 A（代码级接缝结论） |

---

## 1. 产品概述

**一句话定义：** OneManCo 是面向"一人公司 / 一人团队"的多智能体编排平台——你像 CEO 一样定义公司目标、
从人设库雇佣专业智能体组成组织架构；平台把任务派发到**云端 sandbox 里角色化的 OpenClaw 智能体**，
它们遵循一套被评审过的研发 sprint 流程完成工作，全部成本、审计、产物在一个看板汇总。

**愿景：** 让一个人具备一支二十人团队的产出能力，且智能体**跑在云端、7×24、可手机运营**，
用户回到"董事会"角色：定目标、批预算、做关键决策。

**核心理念（四层）：**
- **paperclip = 公司操作系统 / 主干**（目标、组织架构、预算、治理、心跳、工单、成本、UI；
  并已自带 sandbox 运行时与 `openclaw_gateway` 适配器）。
- **OpenClaw = 云端智能体运行时**，按任务角色化（`.md`），由 paperclip 的 `openclaw_gateway` 适配器驱动。
- **wanman = 云 sandbox-provider 插件**，为每个智能体供给云工作区（sandbox-per-agent），
  叠加其矩阵协调与 db9 跨会话记忆。
- **agency-agents = 人才库**，生成 OpenClaw 角色 `.md`，并打包成 paperclip 公司模板。
- **gstack = 工作方法论**，把 think→plan→build→review→test→ship 的纪律与技能注入每个智能体。

---

## 2. 背景与动机

**痛点（无 OneManCo 时）：** 20 个终端记不清谁在做什么、重启丢上下文；手动喂上下文；重复造任务管理/通信轮子；
失控循环烧 token；智能体产出缺少评审—QA—安全—发布纪律。

**机会（且大半积木已就位）：** 经代码调研确认，paperclip **已经**具备云编排所需的核心能力——
内置 `openclaw_gateway` 适配器、`sandbox-provider` 运行时契约、e2b/cloudflare 两个 sandbox provider、
以及 `cursor_cloud` 云适配器先例。OneManCo 的主要新增是**一个 wanman sandbox-provider 插件**
+ **人设→公司包转换器** + **补齐 OpenClaw 的 gstack 技能注入**，而非从零自研。

---

## 3. 目标用户与场景

### 3.1 Personas
1. 独立开发者 / 一人创业者；2. 技术型创始人/CEO；3. 技术负责人/Staff 工程师；4. Claude Code 新用户。

### 3.2 关键场景
- **A 从目标启动公司**："做 #1 的 AI 笔记应用到 1M MRR"→ 雇佣 CEO/CTO/工程/设计/市场 → 批预算 → 运行 → 看板监控。
- **B 接管现有 repo**：指定仓库与目标，云端 OpenClaw 矩阵并行推进。
- **C 定时/事件日常**：客服、社媒、周报用 routine（cron/webhook/API）自动驱动。
- **D 手机远程运营**：在外审批、监控、临时介入。

---

## 4. 产品定位与价值主张

| 维度 | 主张 |
|------|------|
| 单一控制面 | 目标/组织/预算/治理/成本，一个看板看全 |
| 云端 7×24 | 智能体跑在云 sandbox，无需本地机器值守，可手机运营 |
| 双生命周期 | 每任务临时 sandbox 或常驻角色员工，**用户按需选择** |
| 角色即装即用 | 144+ 人设作为公司模板一键导入，自动生成 OpenClaw 角色 `.md` |
| 质量纪律 | 每个智能体遵循 gstack 评审 sprint |
| 成本可控 | 预算/硬停；sandbox 用量聚合回传 |
| 可移植 | 整组织导入导出，多公司数据隔离 |

**不是什么：** 不是聊天机器人、不是 agent 框架、不是拖拽工作流、不是单 agent 工具——它编排"由智能体组成的公司"。

---

## 5. 组件职责（整合后角色映射）

| 组件 | 在 OneManCo 中的角色 | 关键接缝 / 文件 |
|------|----------------------|------------------|
| **paperclip** | 主干：控制平面（含 sandbox 运行时 + openclaw_gateway） | `server/src/services/sandbox-provider-runtime.ts`、`packages/adapters/openclaw-gateway/` |
| **OpenClaw** | 云端智能体运行时（角色化 `.md`） | 经 `openclaw_gateway` WebSocket 网关驱动 |
| **wanman** | 云 sandbox-provider 插件（sandbox-per-agent + 矩阵协调 + db9 记忆） | 实现 paperclip provider 契约；现有 `packages/runtime`、`packages/host-sdk` |
| **agency-agents** | 人才库 → OpenClaw 角色 `.md` + 公司包 | `scripts/convert.sh` 的 `convert_openclaw()`（已产出 SOUL/AGENTS/IDENTITY） |
| **gstack** | 每智能体技能与方法论 | `HostConfig`+`setup`、`browse` CLI、`docs/OPENCLAW.md` |

---

## 6. 系统架构（云端 OpenClaw，定稿）

**paperclip 是主干；三条接缝接入，wanman 以 sandbox-provider 插件身份切入执行底座。**

```
            ┌──────────────────── PAPERCLIP（控制平面/主干）────────────────────┐
  你 ──────▶│  目标 · 组织架构 · 预算 · 治理 · 心跳 · 工单 · 成本 · React UI        │
            └────┬──────────────────────────┬───────────────────────┬──────────┘
   (接缝B 导入)   │            (接缝A 执行)    │           (接缝C 技能)  │
 agency-agents ──┘                           │                       │
 人设 → OpenClaw 三件套 .md                    │                       │
   → agentcompanies/v1 公司包                  ▼                       ▼
                            openclaw_gateway 适配器（paperclip 已内置）   gstack 技能注入
                            生命周期由 sessionKeyStrategy 表达：           · 补齐 openclaw skill-sync
                              issue/fixed + reuseLease  = 常驻员工        · 或 fetch-on-demand(仿 cursor_cloud)
                              run + 不复用              = 每任务临时       · 或物化技能(requiresMaterializedRuntimeSkills)
                                        │ WebSocket 驱动 sandbox 内的 OpenClaw
                                        ▼
                        Paperclip sandbox-provider 运行时（已内置）
                        acquireLease / resumeLease / destroyLease / prepareWorkspace
                          ├── e2b provider（已有）
                          ├── cloudflare provider（已有）
                          └── ★ wanman provider（本项目核心新增）
                              供给 sandbox-per-agent 云工作区，启动角色化 OpenClaw，
                              叠加矩阵协调 + db9 跨会话记忆
                                        │ 用量 / 成本 / 日志 / 产物
                                        ▼  回流 paperclip 看板
```

### 三条接缝

**接缝 A（执行底座，核心新增）——wanman 作 sandbox-provider + 复用 openclaw_gateway。**
- 新建 **wanman sandbox-provider 插件**，实现 paperclip 的 provider 契约
  （`acquireLease`/`resumeLease`/`releaseLease`/`destroyLease`/`prepareWorkspace`，见
  `server/src/services/sandbox-provider-runtime.ts`）。`acquireLease` 启动一个云 sandbox 并在其中
  拉起一个角色化 OpenClaw 实例，返回 lease 元数据（含网关 `wss://` URL、设备密钥等）。
- **复用 paperclip 内置的 `openclaw_gateway` 适配器**连接该 OpenClaw（WebSocket）。无需新建执行适配器。
- **双生命周期**：常驻员工 = `sessionKeyStrategy: issue|fixed` + `reuseLease=true`（`resumeLease` 复用同一 sandbox）；
  每任务临时 = `sessionKeyStrategy: run` + `reuseLease=false`（用完 `destroyLease`）。在 UI 暴露为按智能体的选择。
- wanman 侧改造重点：把当前**本地文件系统硬编码的 workspace 供给**（`supervisor.ts`、`agent-home-manager.ts`）
  抽象为可对接云 sandbox 的 `WorkspaceBackend`；其 `lifecycle`（`24/7`/`on-demand`/`idle_cached`）正好映射常驻/临时。

**接缝 B（人才库导入）——agency-agents → OpenClaw 角色 `.md` + 公司包。**
- `convert_openclaw()` **已**把人设拆成 `SOUL.md`(人设) + `AGENTS.md`(职责) + `IDENTITY.md`(名字/emoji/vibe)——
  正是 OpenClaw 需要的角色文件，sandbox 启动时注入。
- 再新增一个转换器把人设按 12 部门打包成 `agentcompanies/v1` 公司包（见 `.agents/skills/company-creator`
  + `references/companies-spec.md`），经 company import 让 144 人设成为可雇佣、带组织架构的角色模板。

**接缝 C（技能与方法论）——gstack 注入云 OpenClaw。**
- 现状缺口：paperclip 的 `openclaw_gateway` 技能同步标记为 `unsupported`（受网关协议限制）。
- 三选一补齐：① 物化技能（`requiresMaterializedRuntimeSkills`，由 wanman provider 在 sandbox 内
  写入 `~/.claude/skills/gstack`）；② 按需 fetch（仿 `cursor_cloud`：prompt 给技能索引，OpenClaw 经回调桥
  `GET /api/skills/{name}` 拉取）；③ 扩展网关协议加 `skill.install/list`。**推荐 ①**，与 wanman 供给工作区天然契合。

---

## 7. 核心功能需求

> **[M]** V1 必须；**[S]** V1 应该；**[C]** 可后续。

### 7.1 公司与目标（paperclip 原生，复用）
- **[M]** 创建公司、定义目标（带祖先链回溯"为什么"）；多公司单部署、数据隔离。
- **[S]** 公司模板导入/导出（密钥擦除 + 冲突处理）。

### 7.2 组织架构与雇佣
- **[M]** 智能体具角色/职级/汇报线/权限/预算；从人才库雇佣人设（接缝 B）。
- **[S]** 一键导入整支部门作为公司模板。

### 7.3 云执行底座（接缝 A，核心新增）
- **[M]** wanman sandbox-provider 插件：实现 provider 契约，`acquireLease` 启动 sandbox + 角色化 OpenClaw。
- **[M]** 复用 `openclaw_gateway` 适配器驱动 OpenClaw；日志/状态/产卵实时流式回传 UI。
- **[M]** **双生命周期**用户可选：每任务临时（`run`/`destroyLease`）与常驻员工（`issue|fixed`/`reuseLease`+`resumeLease`）。
- **[M]** 运行结束回传用量/成本；通过 `sessionParams`/lease 元数据跨心跳续跑。
- **[S]** `testEnvironment()` 预检（sandbox 配置、网关可达、鉴权）在 UI 显示诊断。
- **[S]** wanman `WorkspaceBackend` 抽象，使同一供给逻辑兼容本地与云 sandbox。
- **[C]** wanman transcript 的 UI 解析器。

### 7.4 技能层（接缝 C，新增/补齐）
- **[M]** gstack 角色 `.md` + 技能注入云 OpenClaw（推荐物化方式，由 wanman provider 在 sandbox 内落盘）。
- **[S]** 适配器声明 `requiresMaterializedRuntimeSkills`/`supportsInstructionsBundle`，点亮 UI 技能页与 AGENTS.md 编辑器。
- **[C]** 网关协议层 `skill.install/list` 扩展（更优雅的持久技能同步）。

### 7.5 治理、预算、可观测（paperclip 原生，复用 + 适配）
- **[M]** 按公司/智能体/项目/目标/工单/provider/model 的成本与 token 追踪；预算阈值告警 + 硬停 + 自动暂停。
- **[M]** 审批门、暂停/恢复/终止智能体、不可变审计日志。
- **[M]** wanman provider 须把 sandbox 内**多子进程/多 OpenClaw 的用量聚合**成单次 `usage/costUsd`（否则预算少计）。

### 7.6 调度与日常（paperclip 原生，复用）
- **[S]** Routine（cron/webhook/API 触发），每次执行创建工单并唤醒智能体（常驻或临时按配置）。

### 7.7 工单与协作（paperclip 原生，复用）
- **[M]** 工单携带公司/项目/目标/父子链；原子签出 + 执行锁；评论/文档/附件/产物/标签/收件箱。

### 7.8 入门与模板
- **[S]** "一人公司"启动模板（组织架构 + 预算 + routine + 默认 sandbox 策略），供 `npx paperclipai onboard`。

---

## 8. 端到端用户旅程（验收主线）

1. 新建公司，写下目标。
2. 从 agency-agents 雇佣人设组成组织架构；为每个角色选生命周期（常驻/临时）（接缝 B）。
3. 设预算与治理策略，点运行。
4. 心跳派发工单 → `openclaw_gateway` 适配器；适配器经 **wanman sandbox-provider** 取得/复用 lease。
5. wanman 在云 sandbox 内拉起角色化 OpenClaw（注入 SOUL/AGENTS/IDENTITY + gstack 技能）（接缝 A/C）。
6. OpenClaw 经 ACP 拉起 Claude Code 会话，按 sprint 推进：office-hours→plan→review→qa→ship。
7. 用量/成本/日志/产物实时回流 paperclip 看板；临时 sandbox 用完销毁，常驻 sandbox 保留续跑。
8. 用户在董事会角色审阅关键决策、批预算、必要时介入。

**这条主线跑通 = 整合成功的最小证明。**

---

## 9. 非功能需求（NFR）

- **安全：** 视智能体输出不可信；密钥经环境变量/短期 run-scoped token 注入（仿 `cursor_cloud` bootstrap token），不进 prompt；
  每个智能体独占云 sandbox 隔离；回调桥（`sandbox-callback-bridge.ts`）走白名单路由。
- **成本准确性：** wanman provider 必须聚合 sandbox 内全部用量，预算才不失真。
- **冷启动/成本：** 每任务临时 sandbox 有冷启动延迟与起停成本——需 sandbox 池化/预热策略（V1.3）。
- **可观测性：** 变更/心跳/成本/审批/评论/产物落持久活动流。
- **可移植与多租户：** 组织导入导出含密钥擦除；每实体公司维度隔离。
- **跨仓库工程：** 四仓为**独立** git 仓库；wanman provider 插件归属（独立包 vs paperclip `packages/plugins/sandbox-providers/wanman/`）、版本锁定、跨仓 CI 待定。

---

## 10. 版本规划与里程碑

| 阶段 | 目标 | 验收 |
|------|------|------|
| **V1.0 OpenClaw 直连探针** | 用 paperclip 现成 `openclaw_gateway` + 一个**手工起好的**云 OpenClaw，跑通一次心跳→执行→日志/用量回 UI（先不接 wanman provider） | 心跳驱动云 OpenClaw 完成一个简单工单，成本/日志在 UI 可见 |
| **V1.1 wanman sandbox-provider** | 实现 wanman provider 契约（`acquireLease`/`resumeLease`/`destroyLease`），`acquireLease` 自动起 sandbox+OpenClaw 并回传网关 URL；抽象 `WorkspaceBackend` | 雇一个智能体即自动供给 sandbox 跑 OpenClaw，无需手工起实例 |
| **V1.2 双生命周期 + 技能** | 暴露常驻/临时选择（sessionKeyStrategy + reuseLease）；物化 gstack 技能到 sandbox | 同一工单常驻模式跨心跳续跑；临时模式用完销毁；智能体能调用 `/review` |
| **V1.3 人设导入 + 打磨** | agency-agents → `agentcompanies/v1` 转换器，导入一个部门；sandbox 池化/预热；transcript UI 解析；onboard 启动模板 | 人设成为可雇佣角色出现在组织架构并经 wanman provider 运行 |
| **V2（探索）** | wanman 矩阵协调深度暴露（一个"角色"内部多 agent 协作）、db9 记忆跨公司、更多 provider | 复杂目标下矩阵自组织 |

---

## 11. 成功指标（KPIs）

- **激活：** 完成 onboard 且跑通一次端到端工单的用户占比。
- **并发：** 单用户稳定并行运行的 sprint 数。
- **质量：** sprint 产出 PR 通过 review/QA/安全门比例；回归测试覆盖增长。
- **成本可控：** 预算硬停命中后无超支占比；用量聚合误差 < X%；sandbox 平均冷启动时延。
- **留存：** 周活公司数、routine 自动执行成功率。

---

## 12. 风险与开放问题

- **wanman workspace 抽象是主要工作量。** wanman 当前 workspace/`$HOME` 供给是本地文件系统硬编码
  （`supervisor.ts`、`agent-home-manager.ts`），抽象 `WorkspaceBackend` 以对接云 sandbox 属 HIGH 工作量；
  生命周期与适配器工厂改动则很小。
- **OpenClaw 技能同步缺口。** `openclaw_gateway` 目前 `listSkills/syncSkills=unsupported`；需按接缝 C 三选一补齐。
- **成本/用量聚合保真。** sandbox 内多进程用量须聚合进单次 `usage/costUsd`。
- **每任务临时 sandbox 的冷启动与成本。** 需池化/预热，否则高频小任务成本与延迟偏高。
- **wanman 与 e2b/cloudflare 的定位。** wanman provider 的差异化价值是矩阵协调 + db9 记忆；与现成 provider
  的取舍/共存策略需明确（用户可按公司/项目选 provider）。
- **人设映射保真。** 144 人设正文很长，须确认能干净映射到 OpenClaw 三件套 + paperclip 角色字段而不丢交付物模板。
- **跨仓库依赖与发布。** wanman provider 包归属、版本锁定、跨仓 CI 待定。

---

## 13. 范围外（本阶段）

- 自研 agent 框架（沿用 OpenClaw + Claude/Codex）。
- 拖拽式可视化工作流编排。
- 桌面 App（paperclip 路线图后续）。
- wanman 矩阵内部多 agent 深度自组织（列入 V2）。
- 把 wanman 改造成"独立云编排服务"（已否决，改为 sandbox-provider 插件）。

---

## 附录 A：组件接缝技术结论（代码调研，供工程落地）

### A.1 paperclip（主干，已自带云能力）
- **sandbox-provider 契约**：`server/src/services/sandbox-provider-runtime.ts`（约 77–92 行）：
  `validateConfig/probe/acquireLease/resumeLease/releaseLease/destroyLease`，可选 `prepareWorkspace/execute`；
  lease 以 `providerLeaseId` 标识生命周期，`reuseLease=true` 时走 `resumeLease`。
  适配器侧远程执行规格：`packages/adapter-utils/src/sandbox-managed-runtime.ts`（`SandboxRemoteExecutionSpec`）。
  现有 provider 参考：`packages/plugins/sandbox-providers/e2b/`、`.../cloudflare/`。
- **openclaw_gateway 适配器**：`packages/adapters/openclaw-gateway/`（`src/server/execute.ts`、`src/index.ts`）。
  WebSocket 网关（`wss://`），协议版本 3；`sessionKeyStrategy: issue|fixed|run` + `resolveSessionKey()`
  支持跨心跳会话复用；onboarding 见 `doc/OPENCLAW_ONBOARDING.md`、`docs/guides/openclaw-docker-setup.md`；
  配置含 `url/headers/clientId/role/scopes/payloadTemplate/sessionKeyStrategy/devicePrivateKeyPem` 等。
- **云适配器先例 cursor_cloud**：`doc/plans/2026-02-23-cursor-cloud-adapter.md` + `packages/adapters/cursor-cloud/`。
  bootstrap token 交换、webhook+轮询、`sessionParams` 复用、技能按需 fetch、HTTP abort/stop 取消。
- **生命周期模型**：无显式 enum；常驻 = `sessionCodec` + `reuseLease=true` + 规律心跳；
  临时 = `forceFreshSession=true`/`sessionKeyStrategy=run`。schema 见 `packages/db/src/schema/agents.ts`、
  `heartbeat_runs.ts`；`sessionParams`/`AdapterSessionCodec` 见 `packages/adapter-utils/src/types.ts`。
- **技能注入远程**：能力标志 `requiresMaterializedRuntimeSkills`、`listSkills/syncSkills`
  （`adapter-utils/src/types.ts` 约 407–432 行）；回调桥白名单 `sandbox-callback-bridge.ts`；
  rollout 现状见 `doc/plans/2026-03-14-adapter-skill-sync-rollout.md`（openclaw_gateway 当前 `unsupported`）。
- **栈/布局**：Node 20+/pnpm workspaces；`packages/` = `adapters`/`adapter-utils`/`shared`/`db`/`mcp-server`/`plugins`；
  `server/`、`ui/`(React)、`cli/`。

### A.2 wanman（→ sandbox-provider 插件）
- **执行抽象**：`packages/runtime/src/agent-adapter.ts` 的 `AgentAdapter.startRun()`；工厂
  `createAgentAdapter(runtime)`（约 123–128 行，if/else，`claude` 默认/`codex`），扩展**很简单**。
- **workspace 供给（主要改造点）**：`supervisor.ts`（约 700–747、554–562）与 `agent-home-manager.ts`
  （约 22–55）**纯本地文件系统硬编码**（mkdir/copy/symlink、`git init` execSync），需抽象 `WorkspaceBackend`
  以对接云 sandbox——**HIGH**。
- **生命周期（几乎零改）**：`packages/core/src/types.ts`（约 2–19）`AgentLifecycle = '24/7'|'on-demand'|'idle_cached'`；
  `agent-process.ts` 的 `start()/runLoop()` 驱动何时 spawn、与执行后端无关；`idle_cached` 走 Claude `--resume`。
  干净映射常驻/临时。
- **host-sdk**：`packages/host-sdk/src/`（`run/takeover/RunOptions`），无云字段（`workerUrl` 系 LM Studio 本地备用 LLM）；
  `brain`(db9) 仅记忆非计算。云字段为 LOW-MEDIUM 新增。
- **云引用现状**：OSS 内**无** openclaw/e2b/sandbank 运行时，仅 `@sandbank.dev/db9` 记忆（`brain-manager.ts`）；
  README 提及的 hosted "sandbox per group" **不在** OSS。OpenClaw/云供给为净新增。

### A.3 agency-agents（人才库）
- 规范人设：每个 `.md`，frontmatter（`name/description/color/emoji/vibe`）+ 结构化正文。
- `scripts/convert.sh` 的 `convert_openclaw()`（约 251–336 行）**已**输出 `SOUL.md`+`AGENTS.md`+`IDENTITY.md`
  到 `integrations/openclaw/<slug>/`——即 OpenClaw 角色三件套。`install.sh` 负责落地。
  **新增"公司包"目标 = 一个 `convert_<tool>()` 风格转换器 + 安装步骤。**

### A.4 gstack（方法论 + 技能）
- 安装：`scripts/host-config.ts` 的 `HostConfig` + `hosts/*.ts` + `setup` 符号链接到 `~/.<host>/skills/gstack/`。
- 技能：`SKILL.md.tmpl`→`SKILL.md`（`scripts/gen-skill-docs.ts`），`discover-skills.ts` 发现；sprint 串联为模板内声明式 prose。
- `browse` CLI 独立可用（`$B <cmd>`，~68 命令，`find-browse` 发现）。
- OpenClaw 对接：`docs/OPENCLAW.md`——经 ACP 在 OpenClaw 拉起的 Claude Code 会话里装 gstack；亦有 ClawHub 原生方法论技能。
