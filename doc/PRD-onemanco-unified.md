# 统一产品 PRD + 架构：OneManCo —— 云端角色化多智能体编排平台 × 本地董事会驾驶舱

> **本文是综合产物**：整合三份既有 PRD（`doc/PRD-onemanco.md`、`doc/PRD-gbrain-integration.md`、
> `doc/DESIGN-gbrain-integration.md`）与 **六个开源仓库**（paperclip / wanman / gbrain /
> agency-agents / gstack / openhuman）的代码级调研，得出一个"不重复造轮子"的最强整合方案。
>
> **两项已决策：**
> 1. **openhuman = 本地"董事会驾驶舱"**（操作者的桌面+手机指挥台），**不**作为云端执行运行时。
> 2. 当前交付 = **统一 PRD 文档**（不写实现代码）。

---

## 0. 本文与既有 PRD 的关系

| 既有文档 | 本文如何处理 |
|----------|--------------|
| `PRD-onemanco.md`（母 PRD：paperclip+wanman+agency-agents+gstack 云端 OpenClaw 编排） | **全部继承**为执行底座主线（第 6 节接缝 A/B/C） |
| `PRD-gbrain-integration.md` + `DESIGN-gbrain-integration.md`（每公司语义记忆底座） | **全部继承**为记忆层（第 6 节接缝 D，gbrain P0–P4） |
| —（三份 PRD 均未含 openhuman） | **新增**第 6 节接缝 E：openhuman 作董事会驾驶舱 |

> 代码级调研已**逐条验证**三份 PRD 的关键论断（见第 8 节"代码事实核验"），故本文直接在其上构建，不复述论证。

---

## 1. 一句话定义与愿景

**OneManCo** = 让一个人具备一支二十人团队产出能力的"一人公司"平台：
你像 CEO/董事会一样定目标、从人才库雇佣角色化智能体组成组织架构；平台把任务派发到
**云端 sandbox 里角色化的 OpenClaw 智能体**，它们遵循被评审过的 gstack 研发 sprint 流程干活，
读写**每公司专属的 gbrain 记忆大脑**，全部成本/审计/产物在 paperclip 看板汇总；
你通过**openhuman 本地驾驶舱**（桌面+手机+语音+通知）随时随地监控、审批、介入。

**愿景：** 智能体 7×24 跑在云端、不"重启即失忆"（gbrain）、遵循工程纪律（gstack）；
人回到董事会角色：定目标、批预算、做关键决策——且这套指挥能力**装在你口袋里**（openhuman 多渠道）。

---

## 2. 七大组件职责（整合后角色映射 —— 全部复用，不造轮子）

| 组件 | 在 OneManCo 中的角色 | 复用现状 / 关键接缝（已核验） |
|------|----------------------|-------------------------------|
| **paperclip** | **控制平面 / 主干**：目标·组织·预算·治理·心跳·工单·成本·MCP 注入；自带 sandbox 运行时 + `openclaw_gateway` 适配器 | `server/src/services/sandbox-provider-runtime.ts`、`packages/adapters/openclaw-gateway/`、`packages/db/src/schema/*`、`company_secrets` |
| **OpenClaw** | **云端智能体执行运行时**，按任务注入角色 `.md`（SOUL/AGENTS/IDENTITY） | 经 paperclip 内置 `openclaw_gateway` WebSocket 网关驱动（协议 v3，`sessionKeyStrategy`） |
| **wanman** | **云 sandbox-provider 插件**：sandbox-per-agent + 矩阵协调 + db9 执行遥测 | 复用 `createAgentAdapter`、lifecycle `24/7\|on-demand\|idle_cached`、`brain-manager.ts`(db9)；**核心新增 = `WorkspaceBackend` 抽象** |
| **agency-agents** | **人才库 → 公司包 + 角色 `.md`** | `scripts/convert.sh::convert_openclaw()` 已产 SOUL/AGENTS/IDENTITY；**新增 = `agentcompanies/v1` 公司包转换器** |
| **gstack** | **方法论 + 技能层**：think→plan→build→review→test→ship sprint；**自带 gbrain 供给/同步管线**；browse CLI 供 QA | 53 skills + `hosts/*.ts`（**已含 `openclaw`/`gbrain` host**）+ `bin/gstack-gbrain-supabase-provision` + `browse/` |
| **gbrain** | **每公司语义知识/记忆底座**：双层页面+时间线+实体图谱+混合检索+符号级代码搜索+30+ MCP 工具 | `gbrain serve --http`（OAuth2.1，v0.26+）、Supabase+pgvector；**一公司一脑**（无 per-source ACL） |
| **openhuman** | **★ 本地董事会驾驶舱（本轮新角色）**：操作者的桌面+手机+语音+通知指挥台 | 复用 Tauri/React app + channels（Slack/TG/iMessage/Discord/WhatsApp）+ memory_tree（操作者个人记忆）+ 通知；**新增 = paperclip API 客户端 + 董事会视图** |

---

## 3. 系统架构（整合定稿）

```
                         ┌──────────────── 本地董事会驾驶舱（openhuman, 桌面+手机+语音）────────────────┐
                         │  组织图 · 任务看板 · 审批 · 预算/成本 · 实时 agent 活动流 · 多渠道远程运营      │
                         │  （Tauri/React + channels + 个人 memory_tree）                              │
                         └───────────────────────────────┬──────────────────────────────────────────┘
                              接缝 E：REST/RPC + SSE 事件流  │ （openhuman ← 读写 → paperclip API）
            ┌────────────────────────────────────────────▼───────────────────────────────────────────┐
   你 ─────▶│                       PAPERCLIP（控制平面 / 主干 / 单一事实源）                              │
            │  目标 · 组织架构 · 预算 · 治理 · 心跳 · 工单 · 成本 · company_secrets · MCP 注入 · Web UI    │
            └──┬──────────────────────────┬────────────────────────┬───────────────────────┬───────────┘
   (接缝B 导入) │           (接缝A 执行)     │          (接缝C 技能)     │      (接缝D MCP 注入)   │
 agency-agents ─┘                          │                        │                       │
 人设→ .md 三件套 + agentcompanies/v1 公司包  ▼                        ▼                       ▼
                          openclaw_gateway 适配器（已内置）       gstack 技能/方法论注入      gbrain 每公司脑（远程 HTTP MCP）
                          sessionKeyStrategy 表达生命周期：       · 物化技能到 sandbox       · put_page/search/code-def…
                            issue/fixed+reuseLease = 常驻员工      （requiresMaterialized-    · 双层页面+时间线+实体图谱
                            run + 不复用            = 临时         RuntimeSkills）            · 一公司一脑（硬隔离）
                                      │ WebSocket 驱动 sandbox 内角色化 OpenClaw
                                      ▼
                       Paperclip sandbox-provider 运行时（已内置契约）
                       acquireLease/resumeLease/destroyLease/prepareWorkspace
                         ├── e2b provider（已有）
                         ├── cloudflare provider（已有）
                         └── ★ wanman provider（核心新增：WorkspaceBackend 抽象 + 矩阵协调 + db9 遥测）
                                      │ 在 acquireLease 时注入：角色 .md + gstack 技能 + 本公司 gbrain MCP 凭据(run 级)
                                      ▼
                       云 sandbox 内角色化 OpenClaw ──→ ACP 拉起 Claude Code/Codex 会话
                         按 gstack sprint：office-hours→plan→review→qa→ship
                         读写 mcp__gbrain__*（记忆/知识/代码/技能语义发现）+ mcp__paperclip__*
                                      │ 用量/成本/日志/产物 实时回流
                                      ▼  paperclip 看板 → 经接缝 E 推送 openhuman 驾驶舱（含手机）
```

---

## 4. 价值主张（差异化）

| 维度 | 主张 | 谁提供 |
|------|------|--------|
| 单一控制面 | 目标/组织/预算/治理/成本一处看全 | paperclip |
| 云端 7×24 | 智能体跑云 sandbox，无需本地值守 | wanman provider + OpenClaw |
| 双生命周期 | 每任务临时 / 常驻员工，用户按 agent 选 | sessionKeyStrategy + reuseLease |
| 角色即装即用 | 144+ 人设一键成公司模板 | agency-agents → 公司包 |
| 工程纪律 | 每个 agent 走评审 sprint | gstack |
| **持久记忆** | **跨会话/跨 sandbox 不失忆；计划/决策/复盘自动沉淀，语义可检索** | **gbrain（每公司脑）** |
| 成本可控 | 预算/硬停；sandbox+gbrain 用量聚合回传 | paperclip + wanman |
| **口袋里的董事会** | **桌面+手机+语音+通知随时监控/审批/介入** | **openhuman 驾驶舱（接缝 E）** |
| 可移植 | 整组织导入导出、多公司数据隔离 | paperclip + agentcompanies/v1 |

**不是什么：** 不是聊天机器人、不是 agent 框架、不是拖拽工作流、不是单 agent 工具——
它编排"由智能体组成的、有记忆、有纪律、可远程运营的公司"。

---

## 5. 目标用户与关键场景

**Personas：** 独立开发者/一人创业者、技术型 CEO、技术负责人/Staff、Claude Code 新用户。

**关键场景：**
- **A 从目标启动公司**：定目标→雇佣 CEO/CTO/工程/设计/市场→批预算→运行→驾驶舱监控。
- **B 接管现有 repo**：指定仓库+目标，云端 OpenClaw 矩阵并行推进；gbrain 服务端索引该仓库供符号级代码搜索。
- **C 定时/事件日常**：客服/社媒/周报用 routine（cron/webhook/API）自动驱动。
- **D 手机远程运营**：**openhuman 驾驶舱经其 channels（Telegram/Slack/iMessage…）+ iOS 客户端在外审批、监控、临时介入**——直接由接缝 E 满足母 PRD 的"手机运营"诉求。
- **E 记忆召回**：agent 接任务前先 `gbrain search` 命中历史计划/决策，无需用户重述背景。

---

## 6. 整合接缝（落地顺序 + 复用/新增边界）

> **原则：能复用就复用；下列每条只点名"净新增"工作量。**

### 接缝 A —— 执行底座：wanman sandbox-provider + 复用 openclaw_gateway（母 PRD）
- **新建** wanman sandbox-provider 插件，实现 paperclip provider 契约（`acquireLease/resumeLease/releaseLease/destroyLease/prepareWorkspace`，见 `sandbox-provider-runtime.ts`）；`acquireLease` 起云 sandbox + 角色化 OpenClaw，回传网关 `wss://` URL/设备密钥。
- **复用** paperclip 内置 `openclaw_gateway` 适配器驱动（无需新执行适配器）。
- **双生命周期**：常驻 = `sessionKeyStrategy:issue|fixed`+`reuseLease`；临时 = `run`+`destroyLease`。
- **核心新增（HIGH）**：把 wanman 当前**本地文件系统硬编码**的工作区供给（`agent-home-manager.ts`、`supervisor.ts::initWorkspaceGit`，已核验为 `fs.mkdir/symlink`+`execSync('git init')`、**无现成 `WorkspaceBackend`**）抽象为可对接云 sandbox 的 `WorkspaceBackend`；其 `lifecycle('24/7'/'on-demand'/'idle_cached')` 干净映射常驻/临时。
- **用量聚合**：wanman provider 必须把 sandbox 内多进程/多 OpenClaw 用量聚合成单次 `usage/costUsd`（否则预算少计）。

### 接缝 B —— 人才库导入：agency-agents → 角色 `.md` + 公司包（母 PRD）
- **复用** `convert_openclaw()`（已产 SOUL/AGENTS/IDENTITY 三件套，sandbox 启动注入）。
- **新增**一个 `convert_<company>()` 风格转换器：把 144 人设按 12 部门打包成 `agentcompanies/v1` 公司包（复用 `.agents/skills/company-creator` + `companies-spec.md`），经 paperclip company import 成为可雇佣、带组织架构的角色模板。
- **已有可复用产物**：本仓库 `examples/companies/onemanco/`（CEO+Builder 的 agentcompanies/v1 样板）可作转换器输出的参考样例。

### 接缝 C —— 技能与方法论：gstack 注入云 OpenClaw（母 PRD）
- **复用** gstack 的 `hosts/openclaw.ts`（已支持）+ 53 skills + sprint 方法论（prose 形式）；`browse` CLI 供 `/qa`/`/canary`。
- **补齐缺口**：`openclaw_gateway` 技能同步当前 `unsupported`。**推荐①物化技能**（适配器声明 `requiresMaterializedRuntimeSkills`，由 wanman provider 在 sandbox 内写 `~/.claude/skills/gstack`）——与 wanman 供给工作区天然契合；备选②仿 `cursor_cloud` 按需 fetch、③扩展网关协议 `skill.install/list`。

### 接缝 D —— gbrain 每公司记忆底座（gbrain PRD，P0–P4）
- **D0 脑供给 + MCP 注入**：每公司一脑（**复用 gstack `bin/gstack-gbrain-supabase-provision`**）；连接信息存 `company_secrets`，per-agent 开关存 `adapterConfig`（新增 `gbrainMcpUrl`/`gbrainMode:"http"`/`gbrainTokenRef`）；适配器唤醒时注入 gbrain 远程 HTTP MCP（复用 `openclaw-gateway/.../execute.ts::buildPaperclipEnvForWake` + `execution-target.ts` env 合并）；凭据由 wanman provider 在 `acquireLease` 时注入（run 级，绝不进 argv/prompt）。**一公司一脑**做硬隔离（已核验 gbrain 无 per-source ACL）。
- **D1 记忆写回 + run 页面**：gstack `/retro`/plan/decision 经 `sync-gbrain` 写带时间线页面；paperclip run 完成写 `runs/<issue>/<run-id>` 页面。
- **D2 知识+代码同步**：`documents`→gbrain 页面（`documents.metadata.gbrainPageId` 双向关联）；服务端 `gbrain sources add` + `sync --strategy code` 索引公司仓库，供临时 sandbox 也能 `code-def/refs`。
- **D3 技能语义发现**：db9 管版本/激活，同步作业把技能镜像为 gbrain 标签页面（`skills/<name>`），agent `gbrain search` 发现→db9 解析激活。
- **D4 业务实体图谱/CRM（后置）**：用 gbrain 推荐 schema 把人/公司/交易/项目写为实体页面，随信号富化。

### 接缝 E —— ★ openhuman 董事会驾驶舱（本文新增）
- **定位**：openhuman **不作执行运行时**，而是操作者的**本地桌面+手机+语音指挥台**，是 paperclip Web UI 之外的"贴身董事会"操作面。
- **复用**：openhuman 的 Tauri/React app、channels（Telegram/Slack/iMessage/Discord/WhatsApp + iOS 客户端）、通知、语音、screen_intelligence、以及 memory_tree（**作为操作者个人工作记忆**，与每公司 gbrain 正交：gbrain=公司长期脑，memory_tree=操作者个人脑）。
- **新增（MEDIUM）**：
  1. openhuman 内一个 **paperclip API 客户端**（REST/RPC + 复用 paperclip 的 `/rpc/events` SSE 流），把 paperclip 作为公司数据后端。
  2. **董事会视图**：组织图、任务看板、审批队列、预算/成本仪表、实时 agent 活动流——读 paperclip API（不重建编排）。
  3. **多渠道远程运营桥**：把 paperclip 的审批/告警/心跳事件经 openhuman channels 推到手机；用户在 channel 内回复即触发 paperclip 审批/暂停/介入（场景 D）。
- **明确取舍（开放问题 12.1）**：paperclip 已有 React Web UI；openhuman 驾驶舱定位为**桌面/移动/语音原生的操作者超集**，不替换 Web UI。两者是否长期并存或收敛，需产品决策。

---

## 7. 核心功能需求（[M]必须 / [S]应该 / [C]可后续）

### 7.1 公司/目标/组织/雇佣（paperclip + agency-agents，复用）
- **[M]** 创建公司、定义目标（带祖先链）；多公司单部署数据隔离。
- **[M]** 智能体具角色/职级/汇报线/权限/预算；从人才库雇佣（接缝 B）。
- **[S]** 一键导入整支部门作公司模板；公司导入/导出（密钥擦除 + 冲突处理）。

### 7.2 云执行底座（接缝 A，核心新增）
- **[M]** wanman sandbox-provider：实现 provider 契约，`acquireLease` 起 sandbox + 角色化 OpenClaw。
- **[M]** 复用 `openclaw_gateway` 驱动；日志/状态/产卵实时流式回传。
- **[M]** 双生命周期用户可选；运行结束回传用量/成本；跨心跳续跑。
- **[M]** sandbox 内多进程用量**聚合**成单次 usage/costUsd。
- **[S]** `WorkspaceBackend` 抽象使同一供给逻辑兼容本地与云；`testEnvironment()` 预检。

### 7.3 技能层（接缝 C）
- **[M]** gstack 角色 `.md` + 技能注入云 OpenClaw（推荐物化方式）。
- **[S]** 适配器声明 `requiresMaterializedRuntimeSkills`/`supportsInstructionsBundle`。

### 7.4 记忆底座（接缝 D，gbrain）
- **[M]** 每公司脑供给 + 远程 HTTP MCP 注入；一公司一脑硬隔离；凭据 run 级。
- **[M]** 记忆写回（学习/决策/复盘）+ run 页面；agent 接任务先 `gbrain search`。
- **[S]** documents→gbrain 同步；服务端仓库代码索引。
- **[C]** 技能语义发现（db9 权威+gbrain 发现）；业务实体图谱/CRM。

### 7.5 治理/预算/可观测（paperclip，复用 + 适配）
- **[M]** 按公司/agent/项目/目标/工单/provider/model 成本与 token 追踪；阈值告警+硬停+自动暂停。
- **[M]** 审批门、暂停/恢复/终止、不可变审计；**gbrain 嵌入/存储开销纳入 paperclip 成本核算**。
- **[S]** Routine（cron/webhook/API）每次执行创建工单并唤醒 agent。

### 7.6 董事会驾驶舱（接缝 E，openhuman，新增）
- **[M]** openhuman 经 paperclip API 呈现组织图/任务看板/审批/成本/实时活动流（只读 + 关键写操作：批/停/介入）。
- **[M]** 经 openhuman channels 把审批/告警推到手机，channel 内回复触发 paperclip 动作（场景 D）。
- **[S]** memory_tree 作操作者个人记忆层（与公司 gbrain 正交）；语音/通知。
- **[C]** 驾驶舱与 paperclip Web UI 的收敛/统一设计。

### 7.7 入门模板
- **[S]** "一人公司"启动模板（组织+预算+routine+默认 sandbox 策略+默认 gbrain），供 `npx paperclipai onboard`。

---

## 8. 代码事实核验（调研结论，支撑"不造轮子"）

| 论断 | 核验结果 | 证据 |
|------|----------|------|
| paperclip 已自带 sandbox 运行时 + openclaw_gateway + e2b/cloudflare provider | ✅ | `sandbox-provider-runtime.ts`、`packages/adapters/openclaw-gateway/`、`packages/plugins/sandbox-providers/{e2b,cloudflare}/` |
| wanman 执行抽象易扩展、workspace 供给本地硬编码、无 WorkspaceBackend | ✅ | `createAgentAdapter`（claude/codex）；`agent-home-manager.ts`/`supervisor.ts` 全 `fs.*`+`execSync`；`runtime-contracts.ts` 仅 MessageTransport/ContextBackend |
| wanman lifecycle 映射常驻/临时；db9 仅记忆/遥测、可选 | ✅ | `core/types.ts` `AgentLifecycle`；`brain-manager.ts`（@sandbank.dev/db9，`--no-brain`） |
| wanman OSS 无 openclaw/e2b/云 sandbox（净新增） | ✅ | 全仓 grep 无 openclaw/e2b；cloud 仅 README 提及 wanman.ai（不在 OSS） |
| gbrain `serve --http` OAuth2.1、30+ MCP、双层页面、实体图谱、混合检索、代码搜索、autopilot | ✅ | `commands/serve-http.ts`、`core/oauth-provider.ts`、`mcp/tool-defs.ts`、`core/types.ts`、`schema-pack/`、`search/hybrid.ts`、`chunkers/code.ts`、`minions/` |
| gbrain 无 per-source ACL → 一公司一脑 | ✅ | OAuth source-scope 为 all-or-nothing；`source-isolation-pglite.test.ts` |
| gstack 含 openclaw/gbrain host + gbrain 供给管线 + browse CLI + sprint 方法论 | ✅ | `hosts/{openclaw,gbrain}.ts`、`bin/gstack-gbrain-supabase-provision`、`scripts/resolvers/gbrain.ts`、`browse/`、53×`SKILL.md.tmpl` |
| agency-agents `convert_openclaw()` 已产三件套 | ✅ | `scripts/convert.sh` |
| openhuman 有 Tauri/React app + 多 channels + iOS + memory_tree（适合驾驶舱） | ✅ | `app/`、`src/openhuman/channels/providers/*`、`app/src/pages/ios/`、`src/openhuman/memory_tree/` |

---

## 9. 非功能需求（NFR）

- **安全**：视 agent 输出不可信；公司脑/网关凭据经 env + run 级短时 token（仿 cursor_cloud bootstrap token），不进 prompt；每 agent 独占 sandbox 隔离；回调桥白名单（`sandbox-callback-bridge.ts`）。**一公司一脑**做知识硬隔离（A 不可读 B）。
- **成本准确性**：sandbox 内用量 + gbrain 嵌入/存储**全部聚合**进 paperclip 预算，否则失真。
- **冷启动/池化**：每任务临时 sandbox 需池化/预热（V 后期）。
- **延迟**：临时 sandbox + 远程脑检索延迟需可接受；代码搜索靠服务端预索引（本地 PGLite 在临时 sandbox 不可用）。
- **可观测**：变更/心跳/成本/审批/评论/产物落持久活动流；`gbrain doctor` 健康分纳入 `/health`。
- **跨仓库工程**：六仓独立 git；wanman provider 包归属、gbrain 注入归属（可做成 paperclip plugin SDK"知识提供方"）、版本锁定、跨仓 CI 待定。

---

## 10. 统一版本规划（融合三份 PRD 路线）

| 阶段 | 目标 | 验收（最小证明） |
|------|------|------------------|
| **V1.0 OpenClaw 直连探针** | 现成 `openclaw_gateway` + 手工云 OpenClaw 跑通一次心跳→执行→日志/用量回 UI（暂不接 wanman provider/gbrain） | 心跳驱动云 OpenClaw 完成简单工单，成本/日志可见 |
| **V1.1 wanman sandbox-provider** | 实现 provider 契约 + `WorkspaceBackend` 抽象；`acquireLease` 自动起 sandbox+OpenClaw | 雇一个 agent 即自动供给 sandbox 跑 OpenClaw |
| **V1.2 双生命周期 + gstack 技能** | 常驻/临时选择；物化 gstack 技能到 sandbox | 常驻跨心跳续跑；临时用完销毁；agent 能 `/review` |
| **V1.3 gbrain P0–P1** | 每公司脑供给 + MCP 注入；记忆写回 + run 页面 | 云 agent put_page→search 往返；A 读不到 B；"上次怎么决定的"命中 |
| **V1.4 人设导入 + 打磨** | agency-agents→`agentcompanies/v1` 转换器，导入一个部门；sandbox 池化；onboard 模板 | 人设成可雇佣角色并经 wanman provider 运行 |
| **V1.5 驾驶舱 MVP（接缝 E）** | openhuman 接 paperclip API：组织图/看板/审批/成本只读 + 手机审批桥 | 在手机 channel 内审批一次雇佣/暂停，paperclip 状态随之变更 |
| **V2 gbrain P2–P4 + 矩阵深化** | 知识/代码同步、技能语义发现、实体图谱；wanman 矩阵内多 agent 协作；驾驶舱与 Web UI 收敛 | 语义代码搜索可用；矩阵自组织；驾驶舱体验统一 |

---

## 11. 成功指标（KPIs）

- **激活**：完成 onboard 且跑通一次端到端工单的用户占比。
- **并发**：单用户稳定并行 sprint 数。
- **质量**：sprint 产出 PR 过 review/QA/安全门比例。
- **记忆**：任务前 gbrain 检索命中历史比例；用户重述背景次数下降。
- **成本**：预算硬停后无超支占比；用量聚合误差 <X%；sandbox 冷启动时延。
- **隔离**：跨公司越权访问 = 0。
- **远程运营**：经手机驾驶舱完成的审批/介入占比；周活公司数；routine 成功率。

---

## 12. 风险与开放问题

1. **双 UI 取舍**：paperclip Web UI vs openhuman 驾驶舱的边界/收敛（接缝 E）。
2. **wanman `WorkspaceBackend` 抽象**是最大工作量（HIGH）。
3. **OpenClaw 技能同步缺口**（接缝 C 三选一，推荐物化）。
4. **成本/用量聚合保真**（sandbox 多进程 + gbrain 嵌入）。
5. **临时 sandbox 冷启动/成本** → 池化/预热。
6. **gbrain 并发写同一脑**的去重/合并语义（canonical/alias）。
7. **凭据爆炸半径**（公司脑凭据=全量读写）→ 优先短时令牌。
8. **人设映射保真**（144 长正文 → 三件套 + paperclip 角色字段不丢交付物模板）。
9. **跨仓库依赖/发布**（wanman provider 包归属、版本锁定、跨仓 CI）。
10. **openhuman memory_tree（个人脑）与 gbrain（公司脑）的边界**：何时写哪个、是否需要个人脑→公司脑的提升通道。

---

## 13. 范围外（本阶段）

- 自研 agent 框架（沿用 OpenClaw + Claude/Codex）。
- 拖拽式可视化工作流编排。
- 把 wanman 改造成"独立云编排服务"（已否决，改为 sandbox-provider 插件）。
- gbrain 内自建执行编排器/DAG（编排归 paperclip）。
- 跨公司联邦检索（与一公司一脑隔离冲突）。
- **openhuman 作为云端执行运行时**（本轮已定为驾驶舱；`openhuman_local` 适配器/`run-turn` 留作未来"本地运行时"可选项，不在本路线关键路径）。

---

## 14. 关于本仓库已完成工作的说明

此前在分支 `claude/openhuman-multi-agent-onemanco-y6MnS` 已完成并推送：
- paperclip `openhuman_local` 适配器 + `examples/companies/onemanco/` 样板公司（6 测试通过）；
- openhuman `run-turn` 一次性执行入口（cargo check + 5 单测通过）。

**与本统一 PRD 的关系**：openhuman 已定为驾驶舱，故 `openhuman_local`/`run-turn`（把 openhuman 当**运行时**）**不在统一产品关键路径**上——降级为"未来可选的本地运行时"。
**仍可复用的部分**：`examples/companies/onemanco/`（agentcompanies/v1 样板）可作接缝 B 转换器的参考样例。
