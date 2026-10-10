# KeyPool Router (通用多账号智能故障转移网关)

> 运行在 Cloudflare Workers 上的 **通用多账号 API Key 池与负载均衡/故障转移网关**。
> 支持**任意 OpenAI 兼容端点**（书生·砚、DeepSeek 官方、硅基流动、OpenRouter、OpenAI 官方及各大中转站）。
> 内置现代深色 WebUI 管理面板、请求级毫秒故障转移、全量极速测活、平台预设与密码保护。

---

## 🌟 核心特性

1. **通用多平台适配 (Any OpenAI-Compatible Gateway)**
   - 上游 Base URL 自由配置：支持填写任何兼容平台地址（如 `https://api.deepseek.com/v1`、`https://api.siliconflow.cn/v1`、`https://discovery-api.intern-ai.org.cn/v1`、`https://api.openai.com/v1` 等）。
   - 内置主流平台一键预设，也可随心切换自建/第三方中转站。
   - 模型透传与动态目录：客户端请求的模型直接透传上游；提供 `/v1/models` 端点供客户端动态获取支持的模型列表。

2. **请求级自动故障转移 (Request-Level Failover)**
   - 客户端正常请求 `/v1/chat/completions`，网关自动调度池中健康的 Key。
   - 若上游遇到 `401`（Key 失效）、`402`（余额/点数耗尽）、`429`（并发限流）或 `insufficient_quota` 等错误：
     - **在同一次请求内部瞬间毫秒级自动切换下一个可用 Key 重试**，客户端完全无感，无需人工换号或重试！
     - 自动在后台将问题 Key 标记为对应状态（`invalid` 或 `exhausted`），后续请求自动跳过。

3. **现代 WebUI 控制台**
   - 密码身份验证（支持通过 Cloudflare Secret 加密保护）。
   - **多格式批量导入**：支持多行直接粘贴，智能解析 `Key`、`备注----Key`、`Key,备注` 等格式，自动去重。
   - **一键极速测活**：采用 1-token 极小请求探针，瞬间检测所有 Key 的健康与额度状态。
   - **一键全量复活**：针对每月/每周重置点数的平台，支持一键将全部耗尽状态的 Key 批量恢复为活跃。
   - **在线对话测试**：内置多模型测试窗口，可自由输入任何模型名称进行流式测试并查看命中的 Key 与耗时。

4. **智能调度与自动复活机制**
   - **最久未用优先（LRU 调度）**：优先使用距离上次调用时间最长的 Key，避免单号高频触发并发限制。
   - **定时 Cron 触发（每天 0 点）**：自动检查并将超过配置天数的 `exhausted` Key 重新激活为可用候选。

---

## 🚀 线上访问与接入

- **WebUI 控制台**：[https://api.enking.ccwu.cc](https://api.enking.ccwu.cc)
- **OpenAI 兼容 API 接入地址 (Base URL)**：`https://api.enking.ccwu.cc/v1`
- **备用地址**：`https://key-pool-router.ngzack314.workers.dev`

### 客户端接入配置示例 (如 NextChat / Cherry Studio / 沉浸式翻译)

- **API 接口地址 (Base URL)**: `https://api.enking.ccwu.cc/v1`
- **API Key**: 填写在面板中配置的客户端访问 Key（或您设置的密码）
- **模型名称**: 填写目标模型名称（如 `deepseek-v4-flash-0731`、`deepseek-chat` 或其他上游模型）

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
