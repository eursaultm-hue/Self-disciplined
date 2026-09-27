# Personal Learning OS — V0.5

一个以 **AI 学习管家** 为核心的个人学习操作系统。

## 产品原则

> **用户输入越少，AI 完成的管理越多。**

用户不需要每天维护完整任务表，而是直接告诉管家现实发生了什么。系统负责把现实信息转换成任务状态、可用时间、学习风险、计划调整和长期记忆。

## V0.5：主动监督 + 应用更新基础设施

V0.5 在 V0.4 Agent 基础上增加 Android 原生本地通知、安静时间、每日提醒上限，以及应用内更新检查入口。

V0.3 已经把“理解”和“执行”拆成 Action Contract。V0.4 在这个契约上增加了真正的 **LLM Gateway + Agent Decision Layer**：

`现实输入 → LLM Gateway → Agent Decision(JSON) → 本地 Action 校验 → Store → Planner`

关键原则：

- APK **不保存任何模型 API Key**。
- LLM 不能直接修改本地 Store。
- LLM 只能返回结构化 Action。
- APK 会再次校验任务 ID、课程 ID、目标 ID、状态和时间范围。
- Gateway 不可用时，自动降级到 V0.3 本地确定性管家，不让整个系统因为网络或模型故障瘫痪。
- 用户可以看到当前消息究竟来自“远程 LLM Agent”还是“本地离线管家”。

## V0.5 已实现

- Android 原生 Local Notifications
- 每天最多 3 次主动提醒
- 23:00–08:00 安静时间
- 早间计划提醒与晚间复盘提醒
- 应用内检查更新
- 从 V0.4/V0.3/V0.2/V0.1 自动迁移数据

## V0.4 已实现

### 1. Agent Decision Contract

新增 `lib/agent.ts`：

- 校验 LLM 返回的 JSON。
- 只接受已有 task/course/goal ID。
- 限制任务时长与今日可用时间范围。
- 丢弃未知 Action。
- 将 LLM 结果统一转换成现有 `StewardAction[]`。

### 2. AI Gateway Client

新增 `lib/gateway.ts`：

- APK 只保存 Gateway URL。
- 12 秒超时。
- 请求失败自动 fallback 到本地 Steward。
- 不把 provider API Key 放进客户端。

### 3. Server-side Gateway 模板

新增 `gateway/src/index.ts`：

- OpenAI-compatible provider 接口。
- Provider API Key 只存在服务器环境变量。
- JSON-only Agent 输出。
- CORS 支持。
- 基础输入长度限制。

需要的服务器环境变量：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

### 4. Android UI

首页新增：

- AI Gateway 地址配置。
- 保存并启用 / 离线模式。
- Agent 来源显示。
- LLM 请求中的处理中状态。
- Gateway 故障自动降级提示。

### 5. 测试

新增 Agent Contract 测试：

- 合法 Action 可以通过。
- 虚构 taskId 会被拒绝。
- 超出安全范围的时间会被拒绝。

## 数据迁移

V0.4 会优先读取：

1. V0.4
2. V0.3
3. V0.2
4. V0.1

因此安装新版 APK 不要求重新录入已有学习数据。

## 当前真实边界

V0.4 **已经具备真正 LLM Agent 的客户端和服务器契约，但默认仍是离线模式**。原因很简单：把 API Key 硬塞进 APK 是一种非常有创意的安全事故。

要让远程 LLM 真正工作，需要把 `gateway/src/index.ts` 部署到 HTTPS 服务，并在服务端配置模型密钥，然后把 Gateway URL 填入 APK。

## 下一阶段

V0.5 不再优先增加花哨页面，而是补上“主动监督”：

1. Android 原生通知调度
2. 安静时间与提醒上限
3. 早晨自动生成今日计划
4. 到点提醒 / 延迟提醒 / 未执行追踪
5. 晚间自动复盘
6. 任务开始 / 暂停 / 完成的真实执行记录
7. 基础行为数据：计划时间 vs 实际时间、延期次数、完成率
8. 为后续日历、文件、屏幕使用时间权限预留 Tool 接口

之后再进入 V0.6：课程 PDF → 知识点 → 学习任务 → 法语数学/电子学学习系统。

## 核心循环

`现实信息 → AI 理解 → Action → 计划 → 主动提醒 → 执行 → 记录 → 复盘 → 自适应调整`
