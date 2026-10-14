# 运行故障排查记忆

更新日期：2026-10-13（Asia/Shanghai）

## 用户现象

MimoCode 和 Deepseek Harness 都会在使用一段时间后出现不完整代码。用户最新澄清：Deepseek Harness 在约 14:40 显示正常结束、任务状态变成结束（不是暂停），但代码实际上不完整。实时 Worker 日志也捕获过上游 429、旧版本中的不完整 EOF，以及较早的 Cloudflare Worker CPU 超限事件。

## 目前结论

这是几种现象叠加，不能简单归成单一原因：

1. **HTTP 429 是上游明确返回的限流响应。** 日志证明 Worker 换 Key 后，多个候选仍接连收到 429。它可能是并发/速率限制；仅凭当前日志不能断言是额度耗尽。
2. **已观察到两类不同的流结束。** 旧版本曾在 HTTP 200 后遇到没有 `finish_reason` / `[DONE]` 的 EOF；当前版本会将这种情况作为不完整流报错。另一方面，用户确认约 14:54 Deepseek Harness 的输出内容确实被截断、任务显示结束；对应最近请求以 `finishReason=stop`、`doneMarkerSeen=true` 正常结束。协议标记只能说明上游声明完成，不能证明代码任务语义完整。当前 `incomplete_eof` 修复覆盖不到这种情况。没有响应正文或客户端侧接收日志，仍无法判断是上游给出不完整内容后正常结束，还是 Harness 展示/处理响应时丢失内容。
3. **Cloudflare 曾报告 Worker CPU 超限。** 这些事件发生在分阶段计时日志部署前，无法确定具体代码阶段。较新的 633 KB 请求解析、KV 读取和序列化都很快，因此不能把 CPU 超限简单归因于长请求体。

因此，对用户“是上游还是我的逻辑”的回答是：**429 来自上游；旧版本确实曾把缺少结束标记的 EOF 当成正常结束。新版本已修复这一传输层情况，也把全 429 映射成明确限流响应。但用户在新版本上仍报告了“带正常结束信号、代码内容不完整”的 Harness 结果；根因未定，不能说已经修好。**

## 关键日志证据

时间均为上海时间。日志只保留请求 ID 和状态元数据，不含提示词或 API Key。

| 时间 | 请求 ID | 观测 | 解释 |
|---|---|---|---|
| 13:47:45 | `81c82e8f-ef0e-4551-a8d5-2c465988ea7d` | 前两次上游 429，第三次 200；流以 `finishReason=tool_calls`、`doneMarkerSeen=true` 结束 | 有限流，但该次流正常完成 |
| 13:47:53 | `6623c9ba-2180-467a-8fb0-b20ad8171db8` | 5 次候选尝试全部 429；`relay_failed`，最后状态 429 | Worker 将上游限流包装为 503 `all_candidate_keys_failed` |
| 13:53 左右 | 多个请求 | Wrangler tail 报 `Worker exceeded CPU time limit` | 当时还没有阶段日志，无法定位；不要直接认定是大上下文或流解析导致 |
| 13:55:09 | `4b338c27-bbc4-417b-8c97-294a5e3ef258` | 上游 200，TTFB 20.6 秒；流持续 26.4 秒，最大 chunk 间隔 23.2 秒，112 chunks / 13,060 bytes；`finishReason=null`、`doneMarkerSeen=false`、`outcome=eof` | 明确捕获到未正常结束的 SSE 流。Wrangler 仍显示 invocation `Ok`，因为 Worker 看到的是正常 EOF |
| 13:57:40 | `6c285979-8cdc-4d7d-a481-ff2643c9c764` | 请求 633,025 bytes / 242 条 messages；解析 6 ms，读取 12 个 Keys 用 6 ms，序列化 0 ms；流以 `finishReason=stop`、`[DONE]` 正常结束 | 大请求体本身不必然导致 CPU 超限；这是新阶段日志部署后的正常样本 |
| 14:00:21 | `4a99b9d8-e653-4216-bdae-8e79b701675c` | 约 635 KB / 244 条 messages；首个 Key 429、第二个 200；流持续 255.7 秒、571 KB、最大间隔 1.8 秒，正常以 `tool_calls` + `[DONE]` 结束 | 长时间流式响应本身可以正常完成，未见 Worker 的固定时长中断 |
| 14:07:50 | `33887cef-d7cb-4857-9ded-709585060469` | 在行为修复部署后，5 个尝试全部 429；`relay_failed` 记录 `allAttemptsRateLimited=true` | 上游限流仍在发生；新版本已走 all-429 分类分支。Tail 不展示客户端收到的响应头，需客户端侧确认 429 / `Retry-After` |
| 14:08:00 | `6dc6889e-acc5-4f63-9dda-4ac200c8d3d6` | 前两个 Key 返回 429，第三个 200；流以 `tool_calls` + `[DONE]` 正常结束 | 部分 429 可由 Key 故障转移恢复，流完整 |
| 14:08:53 | `27f95765-eb15-49b8-9caa-8df84de00ff4` | 首个 Key 429，第二个 200；流以 `tool_calls` + `[DONE]` 正常结束 | 进一步证明 429 是间歇性的；故障转移正常 |
| 14:09:50 | `f7a706e3-708b-472a-95d7-40a585511c95` | 第一个 Key 200；流以 `tool_calls` + `[DONE]` 正常结束 | 修复部署后暂未再次观察到不完整 EOF 或 CPU 超限，但观察时间有限 |
| 14:37:35–14:39:27 | `42afd2b1-f719-4148-adad-828fdcdc0bc2` | 第一次上游 429，第二次 200；TTFB 34.3 秒，流持续 76.8 秒、2649 chunks / 301,009 bytes、最大 chunk 间隔 21.6 秒；`finishReason=stop`、`doneMarkerSeen=true`、`outcome=eof` | 用户报告约 14:40 的 Harness 任务显示正常结束但产物不完整；这条是时间上最接近的请求，不能确认绝对对应。Worker 观测到正常协议结束，日志不含正文，无法判断语义截断或 Harness 下游呈现问题 |
| 14:52:57–14:54:25 | `bb56edeb-83f8-45a7-b898-c5ea45d74777` | 连续三个 Harness 请求形成两轮 `tool_calls` 后续接，最后一次前两次上游 429、第三次 200；最终流 5.5 秒、913 chunks / 104,131 bytes、最大间隔 194 ms；`finishReason=stop`、`doneMarkerSeen=true`、`outcome=eof` | 用户确认这轮最终输出被截断、任务显示结束。Worker 没记录传输中断；语义内容仍未知。每次调用的请求 ID 分别为 `3c9f0772-01a8-49c0-8e46-22973d38d8f6`（`tool_calls`）、`d853235c-e0b3-44dc-a556-526bf6eb7c28`（`tool_calls`）和本行 ID（`stop`） |

此外多次正常流以 `finishReason=tool_calls` 和 `[DONE]` 结束。这对使用工具的 Harness 属正常协议结果，不应单独当作截断证据。另有个别请求在 429 后换 Key 成功。

## 代码行为和潜在问题

- `src/gateway.ts`：`handleChatCompletions` 对每个请求最多尝试 `min(candidates.length, maxRetries)` 个 Key；默认最多 5 次。
- 收到 429 时调用 `markKeyCooldown(candidate.id, 20_000)` 并继续轮换，不会把 Key 标记为额度耗尽。这一状态保存在当前 Worker isolate 的内存中，不是全局协调状态。
- `src/pool.ts` 的 `pickCandidateKeys` 把冷却中的 active Key 放在较低优先级，但仍保留为候选；并且不同 Worker isolate 不共享内存冷却表。因此高并发或跨 isolate 请求仍可能重复碰到限流 Key。
- 当前版本的 429 逻辑尊重上游 `Retry-After`（无效/缺失时默认 20 秒）；如果本次所有候选响应都是 429，则返回 HTTP 429、`Retry-After`、错误码 `upstream_rate_limited`。若混有其他失败，则仍走通用 503。14:07:50 出现一次部署后的全 429 请求，证明该上游问题仍在；需客户端验证新的响应状态和重试头。
- 429 冷却仍是 Worker isolate 内存状态，冷却 Key 仍作为较低优先级候选；跨 isolate 或所有 Key 均冷却时仍可能继续撞限流，这是尚未解决的设计局限。
- `observeStream` 仍逐字节转发上游 body。当前版本读到 EOF 且既无 `finish_reason` 也无 `[DONE]` 时记录 `outcome=incomplete_eof` 并使下游流报错，不再静默关闭为成功。已发送给客户端的部分内容无法撤回；不要在已发送部分内容后自动换 Key 重放。
- `finishReason=stop` 加 `[DONE]` 只证明流按协议正常结束，不证明代码/任务语义完整。对用户报告的这种情况，当前遥测只有状态、字节和时序，不保存响应正文；不能据此甩锅给 Harness 或认定上游内容本身完整。若继续定位，需结合 Harness 客户端日志/导出的最终响应，或由用户明确授权增加隐私安全的关联诊断；未经新授权不要部署。
- 已部署隐私安全诊断：记录 `max_tokens`、`max_completion_tokens`、stop 序列数量和流中上游提供的 token usage 数字，不记录 stop 内容或响应正文。用于判断是否配置了输出上限/stop 条件，以及上游报告的输出 token 数。
- 不要在已向客户端发出部分内容后自动换 Key 重放：那会把两次生成拼在同一响应里，造成重复文本/代码。

## 已部署诊断改动

- Worker：`key-pool-router`，地址 `https://key-pool-router.ngzack314.workers.dev`。
- 当前版本：`e034d5ac-59df-4d83-904d-4e430e24c752`（包含诊断日志、429 / 不完整 SSE 行为修复，以及 token 上限、stop 序列数量和流 usage 元数据）。前一版本为 `09b5b456-897b-4559-b708-99340f2a879e`。
- `src/gateway.ts` 增加了请求 ID、请求体长度/消息数、Key 数和候选数、解析/KV 读取/候选筛选/JSON 序列化耗时，以及流 chunk 数、字节数、最大 chunk 间隔、`finish_reason`、`[DONE]` 和结束方式日志。
- 最新行为修正：全候选 429 时返回 429 + `Retry-After`；不完整 SSE EOF 记录 `incomplete_eof` 并报下游流错误。已有 post-deploy 全 429 日志；不完整 EOF 尚未在修复版复现。用户已确认修复版在 `stop` + DONE 的正常协议结束后仍出现语义截断，因此不能宣称问题已根治。
- 2026-10-13 上海时间约 14:59，用户要求取消监控自动化并部署。Heartbeat `cf-relaypool-worker` 已删除；本次 Worker 部署成功，版本 `e034d5ac-59df-4d83-904d-4e430e24c752`。Wrangler 配置中的 Worker Cron `0 0 * * *` 仍保留，用于自动恢复到期 exhausted Key；它与已删除的 5 分钟日志监控不是同一个自动化。
- 日志不记录消息正文或 API Key。
- 本次 dry-run 打包 122.83 KiB / gzip 28.10 KiB；Wrangler 因沙箱不能写用户配置目录日志而报 EPERM，但仍完成 dry-run。首次部署遇到沙箱 DNS 限制，获授权提升网络权限后部署成功。
- `wrangler tail` 是实时日志，不会回放部署前或 tail 开始前的历史记录。接手后运行：`npx wrangler tail key-pool-router --format pretty`。
- 5 分钟 heartbeat 自动监控已按用户要求删除。当前没有后台自动监控；若用户要求继续盯日志，需要重新授权创建自动化。

## 下一个 Agent 建议

1. 分开验证传输和语义问题：确认全 429 时客户端拿到 429 + `Retry-After`；确认无结束标记 EOF 会让客户端看到流错误；针对已确认的 `stop` + DONE 语义截断，用户可在新版本复现一次并查看请求 token 上限、stop 序列数量、上游 usage。若这些字段正常，需比较 Harness 客户端收到/保存的字节数或联系上游查询 requestId；Worker 当前不记录响应正文，不要把正常协议结束说成任务完成。
2. 若 CPU 超限重现，按最后一条阶段事件定位；较新的大请求体样本解析/序列化很快，之前 CPU 事件仍无阶段数据。
3. 后续若要进一步降低 429，评估隔离间共享冷却/调度，但需要考虑 Cloudflare 多 isolate 的一致性；不要简单把全部 Key 冷却状态高频写入 KV。
4. 上游侧请根据 13:55 左右的时间和请求 ID 查询 `api.enking.org` 对应请求日志；Worker 观测只能证明收到的响应形态，不能读取上游内部限流原因或服务器关闭流的根因。

## 工作区注意事项

`src/gateway.ts`、`src/index.ts`、`src/pool.ts` 在本次排查前就已有未提交修改；不要用 `git checkout`、`reset` 或整文件覆盖来清理。当前日志和代码 diff 可能包含此前项目改动以及本次诊断改动，接手时先查看 `git diff` 再编辑。

## 前端 UI 架构与规范备忘 (Apple Design & Split-View)

### 1. 架构与编译流
- 源码文件为根目录 `ui.html`，通过 `node build-ui.mjs` 自动转义打包并生成 `src/ui.ts`（输出常量 `UI_HTML`）。
- **任何修改前端样式的任务，必须先编辑 `ui.html`，然后执行 `node build-ui.mjs` 生成 `src/ui.ts`**，切勿直接手写修改庞大的 `src/ui.ts`。

### 2. Apple Design 规范与 Skill 联动
- 后续凡是遇到控制台重构、UI 调整或组件扩展，**必须优先加载 `apple-design` Skill**。
- **全屏原生 Web App**：禁止添加虚假 macOS 窗口圆点或外层厚边框阴影，必须全屏贴边撑满（`w-full min-h-screen`）。
- **Master-Detail Split-View**：左侧 `w-60` 边栏（网关列表与操作）+ 右侧自适应工作区。
- **无 Windows 丑滚动条**：水平标签严禁 `overflow-x-auto`，统一使用 `flex flex-wrap gap-1.5`。
- **Bento 指标卡片**：使用 `grid grid-cols-2 lg:grid-cols-4 gap-3`，数字必须圆润无衬线等宽（`font-sans tabular-nums text-2xl font-semibold`，严禁斜杠零）。
- **一体化数据卡片**：工具栏 + 筛选搜索 + 数据表格 + 分页栏必须收纳在同一个大圆角卡片内；表格所有单元格必须带 `whitespace-nowrap px-3.5 py-2` 彻底杜绝文字折行。
- **去彩色化**：严禁彩色 Emoji，图标统一使用 14px~16px 极简单色线性 SVG（`stroke-width="1.75"`）；次级按钮统一为黑白哑光，危险操作使用珊瑚红。
- **Dynamic HUD**：轻提示统一挂载屏幕顶部正中（`fixed top-4 left-1/2 -translate-x-1/2`）。
- **开发自检铁律**：本地 `127.0.0.1:8787` 服务由用户外部常驻热更新运行，**严禁 AI 执行 `wrangler dev`、`Start-Process` 或 `Stop-Process` 启停命令**，改完代码直接用 Playwright 访问自检。
