# CF-RelayPool 运行与架构排查记忆

更新日期：2026-10-15（Asia/Shanghai）

---

## 一、 当前线上版本与部署状态

- **Worker 服务名称**：`key-pool-router`
- **线上生产 URL**：https://key-pool-router.ngzack314.workers.dev
- **当前线上版本 ID**：`78589cd3-8bb6-4868-a36f-5c1a0bdae6f7`
- **绑定资源**：`KEY_POOL_KV` (`6122127c8e6c487c9ef69678db332ae3`)
- **定时 Cron 触发器**：`0 0 * * *`（用于自动扫描恢复超过 `autoResetDays` 的 exhausted Key）
- **Cloudflare 部署凭据约定**：
  - 本项目绑定部署于**用户大号**（Account ID: `23cd5760ed73b80a647ed98bdc96fa5e`）。
  - 必须使用大号 Worker API 令牌（详见全局配置 `~/.config/opencode/CLOUDFLARE.md`），严禁将该 Token 写进代码库或提交到 GitHub。
- **GitHub 主分支同步**：已同步至最新 Commit `c917b18`（分支 `main`），工作区保持 clean。

---

## 二、 2026-10-15 核心架构演进与问题修复记录

### 1. 移动端 UI 响应式布局彻底重构（Apple HIG 规范）
- **修复顶部栏 Header 挤压变形**：
  - 强制为所有微标与按钮增加 `whitespace-nowrap shrink-0`，杜绝文字竖排与椭圆畸形折行。
  - 在移动端（`< 640px`）自适应隐藏 `CORE` 标签；“已连接”状态徽章紧凑化为单行微呼吸点；“刷新”与“退出”按钮隐藏文字收敛为 `w-7 h-7` 极简正方形图标按钮，整栏保持严格单行与充足呼吸感。
- **解决“全部网关集中总览”卡片横向溢出与截断**：
  - 卡片容器添加 `overflow-hidden max-w-full box-border`。
  - 参数项（上游、默认模型、专属路由）在 `< 768px` 窄屏下自动切换为**垂直单列堆叠**（`flex flex-col md:flex-row gap-1.5 md:gap-3`），各行左侧浅灰 Label、右侧带 `truncate break-all` 的胶囊值，彻底解决右侧路由溢出截断问题。
- **优化“网关目录”与“添加网关”层级冲突**：
  - 网关目录选中项改用 iOS 经典半透明淡蓝胶囊（`bg-[#0071E3]/10 text-[#0071E3]` / `dark:bg-[#0071E3]/18 dark:text-[#3898FF]`），避免高饱和度蓝块与操作按钮撞色。
  - 边栏底部的“+ 添加网关”与“全局设置”在移动端改为并排双列（`grid grid-cols-2 md:grid-cols-1 gap-2`），添加按钮采用次级微描边样式。
- **整体移动端间距与细节打磨**：
  - 移动端页面内边距设为 `p-3 sm:p-6`，卡片内边距设为 `p-3.5 sm:p-4`，释放有效显示宽度；
  - 模型 Tag 列表使用 `flex-wrap gap-1.5`，彻底消除横向原生滚动条；
  - 4 个 Bento 统计指标在移动端保持规整的双列网格（`grid-cols-2 lg:grid-cols-4 gap-2.5`）；
  - 实测 `375x812` 视口下 `scrollWidth: 375 === clientWidth: 375`，整体页面横向滚动彻底归零（`hasHScroll: false`）。
- **前端存储沙箱防御**：
  - 增加 `safeGetStorage` / `safeSetStorage` 安全存取包装器，避免在 sandboxed / `about:blank` / 无存储权限环境下调用 `localStorage` 抛出 `SecurityError` 导致 UI 脚本中断。

### 2. Key 额度耗尽（Quota Exhaustion）判定与高效调度链路重构
- **核心病灶排查**：
  - **病灶 1（429 盲目拦截）**：OpenAI、DeepSeek、硅基流动、书生·砚等平台在额度耗尽时上游均返回 HTTP 429。旧版先判断 `status === 429` 直接打入临时避让，阻断了后面的 quota 判定，导致无额度 Key 永远无法被标记为 `exhausted`。
  - **病灶 2（测活反向刷白）**：旧版 `probeKey` 在收到 429 时无条件返回 `status: 'active'`，用户每次点击“批量测活”都会把已耗尽的 Key 反向改回“活跃可用”。
  - **病灶 3（`loadKeys` 错误复活）**：旧版每次从 KV 读取 Key，只要失败理由包含 `'429'` 就会将其自动改成 `active`，陷入复活死循环。
  - **病灶 4（无效轮询）**：`pickCandidateKeys` 旧版在候选尾部追加了已知耗尽的 `otherExhausted`，导致主 Key 冷却时会发起多次注定失败的上游 HTTP 请求，白白浪费 10~20 秒往返延迟。
- **链路重构与优化措施**：
  1. **特征前置分流（`isQuotaExhausted`）**：
     - 在判定纯并发 429 之前优先执行深度文本匹配。无论上游返回 429、402、400 还是 403，只要命中中英文额度特征词库（`insufficient_quota`、`quota_exceeded`、`exceeded your current quota`、`out of credit`、`balance is insufficient`、`insufficient_balance`、`zero balance`、`余额不足`、`额度已用尽`、`墨点不足`、`点数已用完` 等），**100% 立即标记为 `exhausted` 并持久化**。
  2. **纯并发限流保护**：
     - 只有排除掉额度耗尽之后的纯 429，才属于真正的 RPM/TPM 临时限流，进入内存 15~20 秒避让冷却，绝不污染 Key 的额度状态。
  3. **严格跳过耗尽 Key（高效候选链）**：
     - `pickCandidateKeys` 彻底剔除非复活周期的 `exhausted` Key。未到复活期的无额度 Key 物理跳过，不再发出任何浪费的 HTTP 请求。
  4. **同实例毫秒级内存同步（`syncMemoryKeyStatus`）**：
     - 一旦某次请求确认 Key 耗尽或失效，除了异步写入 KV，立即同步刷新当前 Worker 实例的内存缓存。同实例并发请求 0 延迟秒级跳过，杜绝并发重复踩坑。
  5. **成功即时解除冷却**：
     - 在 `recordKeySuccess` 记录成功调用时，第一时间从 `keyCooldownMap` 释放该 Key，恢复主力高优先级调度。
  6. **路由传参一致性**：
     - 在 `src/index.ts` 中修正 `x-gateway` 请求头传参，下游统一直传校验后的 `requestedGatewayId`。

---

## 三、 前端 UI 架构与编译开发规范备忘

1. **编译工作流**：
   - 源码文件为根目录 `ui.html`，通过 `node build-ui.mjs` 自动转义打包并生成 `src/ui.ts`（输出常量 `UI_HTML`）。
   - **严禁直接手写修改庞大的 `src/ui.ts`**，任何前端修改必须先改 `ui.html` 然后执行 `node build-ui.mjs`。
2. **样式设计语言**：
   - 严格遵循 Apple HIG & Linear 设计规范：禁止彩色 Emoji，全屏原生 Web App（拒绝假桌面窗口外壳），单色线性 SVG 图标（14~16px, `stroke-width="1.75"`），圆润无衬线等宽数字（`font-sans tabular-nums font-semibold`，严禁斜杠零）。
3. **Windows 终端常驻进程禁令（防死锁铁律）**：
   - Windows 环境下**严禁**执行 `Start-Process`、`npx wrangler dev`、`Stop-Process`、`taskkill` 等操作常驻进程命令（会造成句柄继承死锁）。
   - 部署只执行单次退出的 `npx wrangler deploy`，测试使用 Playwright 或 curl 探测。
4. **Git 隐私与防泄密铁律**：
   - 严禁将任何私钥（`*.key`、`*.pem`）、API 令牌（Cloudflare Token、大模型 API Key）提交到 Git。
   - 每次提交必须核验 `git status` 与 `git diff`，确保仅提交业务代码。

---

## 四、 下一个接手 Agent 的关键检查点

1. **观察 429 与额度耗尽日志**：
   - 运行 `npx wrangler tail key-pool-router --format pretty` 监控实时请求。
   - 验证无额度 Key 在上游拒绝后是否即刻被打上 `exhausted` 状态，并且后续同网关请求是否直接跳过该 Key 而不产生额外重试开销。
2. **多网关隔离调度**：
   - 在添加新网关或客户端接入时，可通过 URL 前缀（如 `/:gatewayId/v1/chat/completions`）或请求头 `x-gateway: <gatewayId>` 路由到特定渠道池。
