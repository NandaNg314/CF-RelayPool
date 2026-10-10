# KeyPool Router

> **智能多账号故障转移网关（专为书生·砚、中转站及各大 OpenAI 兼容平台打造）**
> 运行在 Cloudflare Workers 上，自带现代深色 WebUI 管理面板、请求级自动故障转移（Failover）、定期自动复活、1-token 极低成本测活。

---

## 🌟 核心特性

1. **请求级自动故障转移 (Request-Level Failover)**
   - 客户端只需调用 `/v1/chat/completions`，网关会自动挑选健康的 Key 进行调度。
   - 若遇到 `401`（Key 失效）、`402`（余额/墨点/点数耗尽）、`429`（并发限流）或 `insufficient_quota` 等错误，**在同一次客户端请求内瞬间毫秒级自动切换下一个 Key 重试**，客户端完全无感知！
   - 自动在后台将故障 Key 标记为对应状态（`invalid` 或 `exhausted`），后续请求自动跳过，不浪费重试开销。

2. **现代深色 WebUI 管理面板**
   - 访问根路径直接打开管理面板。
   - **核心仪表盘**：实时展示当前活跃可用 Key、已耗尽 Key、失效 Key、累计成功/失败调用次数。
   - **批量导入**：支持多行直接粘贴，自动识别 `Key`、`备注----Key`、`Key,备注` 等格式，自动去重。
   - **一键全量测活**：通过发送 1-token 极小请求（每次仅消耗约 0.00000004 墨点，成本近乎为 0），瞬间检测所有 Key 的健康与额度状态。
   - **一键复活**：针对每月或每周重置点数的平台，支持一键将全部已耗尽状态的 Key 批量复活为活跃。
   - **在线测试**：内置对话测试窗口，可实时查看流式输出以及命中的具体 Key。

3. **智能调度与自动复活机制**
   - **最久未用优先（LRU 负载均衡）**：优先使用距离上次调用时间最长的 Key，避免单号高频受限。
   - **自动过期复活（Cron Trigger）**：配置自动恢复周期（默认 7 天），每天自动检查并将超过设定天数的耗尽 Key 重新唤醒为候选。

4. **安全与权限控制**
   - **管理面板密码**：支持通过环境变量 `ADMIN_PASSWORD` 或面板设置密码，保护管理接口。
   - **客户端访问密钥**：支持通过环境变量 `CLIENT_API_KEY` 或面板设置 Key，限制仅允许受信任的客户端调用 `/v1/*`。

---

## 🚀 线上访问与接入

- **WebUI 管理面板**：[https://key-pool-router.ngzack314.workers.dev](https://key-pool-router.ngzack314.workers.dev)
- **OpenAI 兼容 Base URL**：`https://key-pool-router.ngzack314.workers.dev/v1`

### 客户端接入配置示例 (如 NextChat / OneAPI / 沉浸式翻译 / 各类 Agent)

- **API 接口地址 (Base URL)**: `https://key-pool-router.ngzack314.workers.dev/v1`
- **API Key**: 留空（若未在面板开启客户端密钥），或填写你在面板中配置的客户端访问 Key。
- **模型名称**: 填写目标模型名称（如 `deepseek-v4-flash-0731` 或其他支持的模型）。

---

## 🛠 本地开发与部署

```bash
# 进入项目目录
cd D:\ai\key-pool-router

# 安装依赖
npm install

# 本地调试
npm run dev

# 编译类型检查
npm run build:check

# 部署上线到 Cloudflare Workers
npm run deploy
```

---

## 📂 项目结构

```
src/
├── types.ts       # 核心数据结构与配置接口 (KeyItem, PoolConfig, Env)
├── pool.ts        # Key 池加载/保存、智能轮询调度、1-token 极速探针
├── gateway.ts     # OpenAI 兼容请求级自动故障转移核心实现
├── ui.ts          # 单页面响应式 WebUI 管理面板 (HTML / CSS / JS)
└── index.ts       # Worker 入口路由 (WebUI, 管理 API, 网关, Cron)
```
