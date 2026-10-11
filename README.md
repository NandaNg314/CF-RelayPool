# CF-RelayPool

> **基于 Cloudflare Workers 的多网关 API Key 智能轮换与请求级故障转移中继网关**
> 专为书生·砚、各大 OpenAI 兼容中转站、官方 API 及第三方平台打造。
> 具备高颜值 WebUI 管理控制台、请求级毫秒故障转移（Failover）、动态上游模型感知、安全脱敏显示与定时自动复活。

---

## 🌟 核心特性

1. **CF Serverless 全球边缘中继**
   - 纯原生运行在 Cloudflare Workers 上，全球边缘节点就近响应，超低延迟，零服务器运维成本。

2. **多网关独立配置与动态模型探测 (Multi-Gateway Channels)**
   - 支持同时维护多个不同的上游中转站与平台，每个网关拥有独立的 Base URL、专属 Key 池、健康统计。
   - **动态模型感知**：一键根据该网关的可用 Key 向上游自动探测并同步所有可用模型。
   - 默认极简干净，需要新平台时可在控制台从内置预设模板（书生·砚、DeepSeek 官方、硅基流动、OpenRouter、OpenAI 等）一键添加。

3. **请求级自动故障转移 (Request-Level Failover)**
   - 客户端正常请求 `/v1/chat/completions` 或 `/{gateway_id}/v1/chat/completions`。
   - 当遇到 `401`（Key 失效）、`402`（余额/点数耗尽）、`429`（并发限流）或 `insufficient_quota` 时：
     - **在同一次请求内部瞬间毫秒级自动切换下一个可用 Key 重试**，客户端完全无感，无需客户端或人工换号！
     - 自动在后台将问题 Key 标记为对应状态（`invalid` 或 `exhausted`），后续请求自动跳过。

4. **安全与隐私保护 (Security by Default)**
   - **WebUI 密码鉴权**：通过 Cloudflare 平台级 Secret 加密防护。
   - **Key 脱敏防窥**：控制台上的 API Key 默认密文脱敏（`sk-wzj••••••••0314`），支持切换显示与一键安全复制完整密钥。

5. **海量 Key 调度架构与零写开销 (High-Performance Zero-KV-Write)**
   - **纯内存打乱均匀分发**：正常转发请求纯内存毫秒直出，0 次 KV 写操作，彻底杜绝并发锁冲突、杜绝多节点旧快照覆写、0 消耗 KV 写入配额。
   - **强一致防覆写更新**：添加、测活、删除操作采用实时一致性读取合并，杜绝新加 Key 丢失。

6. **全能 Key 导入、导出与安全测活**
   - **全格式智能导入**：支持 JSON 数组、Excel/表格制表符复制、`名称----Key`、逗号/冒号/空格，智能识别无 `sk-` 前缀密钥与中文备注。
   - **安全分批批量测活**：自动按 25 个一组分批测活并展示实时进度，彻底规避 Cloudflare Workers 50 次 fetch 子请求上限。
   - **海量管理套件**：支持实时模糊搜索、分页控制（15/30/50/100/全部）、一键清理失效(401) Key、一键多格式导出备份（纯文本/CSV/JSON）。
   - **定时 Cron 触发（每天 0 点）**：自动检查并将超过配置天数的耗尽 Key 重新激活为可用候选。

---

## 🚀 客户端接入方式 (OpenAI 兼容协议)

- **通用全局入口**：`https://<你的域名>/v1` (自动调用主网关，或根据客户端请求的 model 自动路由)
- **指定网关入口**：`https://<你的域名>/{gateway_id}/v1` (直连指定网关，各网关 Key 物理隔离)
- **API Key**：控制台中设置的客户端访问 Key (Bearer Token)

---

## 🛠 本地开发与部署

```bash
# 克隆仓库
git clone https://github.com/<你的用户名>/CF-RelayPool.git
cd CF-RelayPool

# 安装依赖
npm install

# 本地调试
npm run dev

# 编译类型检查
npm run build:check

# 部署上线到 Cloudflare Workers
npm run deploy
```
