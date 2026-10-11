export const UI_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CF-RelayPool - 多网关多账号故障转移中继控制台</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(23, 32, 54, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --purple: #8b5cf6;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at top, #1a233a 0%, var(--bg) 100%);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      padding: 24px;
      line-height: 1.5;
    }
    .container { max-width: 1280px; margin: 0 auto; }

    /* Header */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--card-border);
      flex-wrap: wrap;
      gap: 16px;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon {
      width: 42px; height: 42px; border-radius: 12px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; font-weight: bold;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }
    .brand-title { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .brand-subtitle { font-size: 12px; color: var(--text-muted); }
    .header-actions { display: flex; align-items: center; gap: 10px; }

    /* Login View */
    #loginView {
      display: none;
      min-height: 70vh;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .login-card {
      background: rgba(23, 32, 54, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 36px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .login-header { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .login-icon {
      width: 56px; height: 56px; border-radius: 16px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; margin-bottom: 6px;
      box-shadow: 0 8px 16px rgba(59, 130, 246, 0.4);
    }

    /* Gateway Nav Tabs */
    .gateway-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 18px;
      flex-wrap: wrap;
    }
    .gateway-tabs {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
      max-width: 100%;
    }
    .gw-tab {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
      transition: all 0.2s ease;
    }
    .gw-tab:hover { background: rgba(255, 255, 255, 0.1); color: var(--text); }
    .gw-tab.active {
      background: rgba(59, 130, 246, 0.2);
      border-color: rgba(59, 130, 246, 0.5);
      color: #93c5fd;
      font-weight: 600;
    }
    .gw-badge {
      background: rgba(0, 0, 0, 0.3);
      padding: 2px 7px;
      border-radius: 9999px;
      font-size: 11px;
    }

    /* Current Gateway Info Banner */
    .gw-banner {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(12px);
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 14px;
    }
    .gw-banner-left { display: flex; flex-direction: column; gap: 4px; }
    .gw-banner-title { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .gw-banner-sub { font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .gw-banner-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

    /* Model Tags Container */
    .models-bar {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 12px;
    }
    .model-tag {
      background: rgba(139, 92, 246, 0.15);
      border: 1px solid rgba(139, 92, 246, 0.3);
      color: #c4b5fd;
      padding: 3px 8px;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 11px;
      cursor: pointer;
    }
    .model-tag:hover { background: rgba(139, 92, 246, 0.25); }

    /* Cards */
    .grid-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(12px);
      border-radius: 12px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .stat-title { font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 28px; font-weight: 700; }
    .stat-desc { font-size: 12px; color: var(--text-muted); }

    /* Action Toolbar */
    .toolbar {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(12px);
      border-radius: 12px;
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 20px;
    }
    .toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s ease;
      background: rgba(255, 255, 255, 0.08);
      color: var(--text);
    }
    .btn:hover { background: rgba(255, 255, 255, 0.14); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-success { background: rgba(16, 185, 129, 0.2); color: #34d399; border-color: rgba(16, 185, 129, 0.3); }
    .btn-success:hover { background: rgba(16, 185, 129, 0.3); }
    .btn-purple { background: rgba(139, 92, 246, 0.2); color: #c4b5fd; border-color: rgba(139, 92, 246, 0.3); }
    .btn-purple:hover { background: rgba(139, 92, 246, 0.3); }
    .btn-warning { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border-color: rgba(245, 158, 11, 0.3); }
    .btn-warning:hover { background: rgba(245, 158, 11, 0.3); }
    .btn-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; border-color: rgba(239, 68, 68, 0.3); }
    .btn-danger:hover { background: rgba(239, 68, 68, 0.3); }
    .btn-sm { padding: 4px 8px; font-size: 11px; border-radius: 6px; }

    /* Filter Tabs */
    .tabs { display: flex; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 3px; gap: 2px; }
    .tab {
      padding: 6px 12px;
      font-size: 12px;
      border-radius: 6px;
      cursor: pointer;
      color: var(--text-muted);
      border: none;
      background: transparent;
    }
    .tab.active { background: rgba(255,255,255,0.1); color: var(--text); font-weight: 600; }

    /* Table */
    .table-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(12px);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 24px;
    }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    th {
      background: rgba(0, 0, 0, 0.25);
      padding: 12px 16px;
      color: var(--text-muted);
      font-weight: 600;
      font-size: 12px;
      border-bottom: 1px solid var(--card-border);
    }
    td { padding: 12px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.04); vertical-align: middle; }
    tr:hover td { background: rgba(255, 255, 255, 0.02); }

    /* Pagination Bar */
    .pagination-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: rgba(0, 0, 0, 0.2);
      border-top: 1px solid var(--card-border);
      font-size: 12px;
      color: var(--text-muted);
      flex-wrap: wrap;
      gap: 10px;
    }
    .pagination-controls { display: flex; align-items: center; gap: 6px; }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-active { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25); }
    .badge-exhausted { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.25); }
    .badge-invalid { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25); }
    .badge-disabled { background: rgba(156, 163, 175, 0.15); color: #9ca3af; border: 1px solid rgba(156, 163, 175, 0.25); }
    .badge-active-gw { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); }
    .badge-gw-tag { background: rgba(139, 92, 246, 0.2); color: #c4b5fd; border: 1px solid rgba(139, 92, 246, 0.35); font-size: 11px; padding: 2px 6px; border-radius: 4px; }

    .key-mono {
      font-family: var(--font-mono);
      background: rgba(0,0,0,0.3);
      padding: 3px 6px;
      border-radius: 4px;
      cursor: pointer;
      user-select: all;
    }

    /* Modal */
    .modal-backdrop {
      display: none;
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      z-index: 100;
      justify-content: center;
      align-items: center;
      padding: 16px;
    }
    .modal-backdrop.active { display: flex; }
    .modal {
      background: #151d30;
      border: 1px solid var(--card-border);
      border-radius: 16px;
      max-width: 660px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--card-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-title { font-size: 16px; font-weight: 600; }
    .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; max-height: 70vh; overflow-y: auto; }
    .modal-footer {
      padding: 14px 20px;
      border-top: 1px solid var(--card-border);
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    /* Form Controls */
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-label { font-size: 13px; color: var(--text-muted); }
    .form-input, .form-textarea, .form-select {
      background: rgba(0,0,0,0.3);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      color: var(--text);
      padding: 10px 12px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
    }
    .form-input:focus, .form-textarea:focus, .form-select:focus { border-color: var(--primary); }
    .form-textarea { resize: vertical; min-height: 120px; font-family: var(--font-mono); font-size: 12px; }
    .form-select { cursor: pointer; }
    .form-select option { background: #151d30; color: #fff; }

    /* Test Box */
    .chat-box {
      background: rgba(0,0,0,0.3);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 12px;
      min-height: 150px;
      max-height: 240px;
      overflow-y: auto;
      font-size: 13px;
      white-space: pre-wrap;
    }

    /* Toast */
    #toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      background: #1f2937;
      color: #fff;
      box-shadow: 0 10px 20px rgba(0,0,0,0.4);
      border: 1px solid var(--card-border);
      z-index: 200;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.25s ease;
      pointer-events: none;
    }
    #toast.show { opacity: 1; transform: translateY(0); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="brand-icon">⚡</div>
        <div>
          <div class="brand-title">CF-RelayPool</div>
          <div class="brand-subtitle">多网关多平台额度池 · 请求级毫秒故障转移中继网关</div>
        </div>
      </div>
      <div class="header-actions" id="headerAuthActions" style="display: none;">
        <span class="badge badge-active" style="padding: 4px 10px;">🟢 已连接</span>
        <button class="btn btn-sm" onclick="fetchData()">🔄 刷新</button>
        <button class="btn btn-sm btn-danger" onclick="logout()">🔒 退出登录</button>
      </div>
    </header>

    <!-- 1. 登录视图 -->
    <div id="loginView">
      <div class="login-card">
        <div class="login-header">
          <div class="login-icon">🔐</div>
          <div style="font-size: 18px; font-weight: 700;">控制台身份验证</div>
          <div style="font-size: 13px; color: var(--text-muted);">请输入管理密钥 (Admin Password) 进入</div>
        </div>
        <div class="form-group">
          <input type="password" id="loginPwdInput" class="form-input" style="padding: 12px; font-size: 14px;" placeholder="请输入管理密码 (sk-...)" autofocus onkeydown="if(event.key==='Enter')doLogin()">
        </div>
        <button class="btn btn-primary" style="padding: 12px; font-size: 14px; font-weight: 600;" onclick="doLogin()">🚀 验证并进入控制台</button>
        <div id="loginError" style="font-size: 12px; color: var(--danger); text-align: center; display: none;"></div>
      </div>
    </div>

    <!-- 2. 主控制台视图 -->
    <div id="appView" style="display: none;">
      <!-- 网关切换标签栏 -->
      <div class="gateway-bar">
        <div class="gateway-tabs" id="gatewayTabs">
          <!-- 动态渲染网关选项卡 (包含全部网关选项) -->
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-sm btn-primary" onclick="openNewGatewayModal()">➕ 添加网关</button>
          <button class="btn btn-sm" onclick="openModal('globalConfigModal')">⚙️ 全局设置</button>
        </div>
      </div>

      <!-- 当前选中网关的详情与模型展示条 -->
      <div class="gw-banner">
        <div class="gw-banner-left">
          <div class="gw-banner-title">
            <span id="curGwName">网关名称</span>
            <span id="curGwDefaultBadge"></span>
          </div>
          <div class="gw-banner-sub">
            <span>上游 Base: <code class="key-mono" id="curGwBase">...</code></span>
            <span>默认模型: <b id="curGwModel">...</b></span>
            <span>专属路由: <code class="key-mono" id="curGwRoute">...</code></span>
          </div>
          <!-- 探测到的可用模型列表 -->
          <div class="models-bar">
            <span style="color: var(--text-muted); font-weight: 600;">🎯 可用模型 (点击测试):</span>
            <div id="curGwModelTags" style="display: inline-flex; gap: 6px; flex-wrap: wrap;"></div>
          </div>
        </div>
        <div class="gw-banner-actions">
          <button class="btn btn-sm btn-purple" id="btnFetchModels" onclick="fetchCurrentGatewayModels()">🔄 重新获取上游模型</button>
          <button class="btn btn-sm" id="btnSetAsDefault" onclick="setCurrentAsDefault()">⭐ 设为主网关</button>
          <button class="btn btn-sm" id="btnEditGw" onclick="openEditGatewayModal()">✏️ 编辑网关</button>
          <button class="btn btn-sm btn-danger" id="btnDeleteGw" onclick="deleteCurrentGateway()">🗑️ 删除</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid-stats">
        <div class="stat-card">
          <div class="stat-title">🟢 活跃可用 Key</div>
          <div class="stat-value" id="statActive">0</div>
          <div class="stat-desc">可立即提供服务的 Key 数量</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">🟡 额度耗尽 / 限流</div>
          <div class="stat-value" id="statExhausted">0</div>
          <div class="stat-desc">点数或额度耗尽，可一键复活</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">🔴 失效 / 认证错误</div>
          <div class="stat-value" id="statInvalid">0</div>
          <div class="stat-desc">上游返回 401，可一键清理</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">📊 当前视图 Key 总数</div>
          <div class="stat-value" id="statTotalKeys">0</div>
          <div class="stat-desc" id="statDesc">所有状态汇总</div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="toolbar">
        <div class="toolbar-left">
          <button class="btn btn-primary" onclick="openImportModal()">➕ 导入 Key</button>
          <button class="btn btn-success" id="btnProbeAll" onclick="probeAllKeys()">⚡ 安全批量测活</button>
          <button class="btn btn-warning" onclick="reviveAllKeys()">🔄 一键复活已耗尽</button>
          <button class="btn btn-danger" onclick="cleanInvalidKeys()">🧹 清理失效(401)</button>
          <button class="btn btn-purple" onclick="openExportModal()">📋 导出备份</button>
          <button class="btn" onclick="openTestModal()">💬 在线对话测试</button>
        </div>
        <div class="toolbar-right">
          <input type="text" id="searchKeyInput" class="form-input" placeholder="🔍 搜索 Key 或备注..." style="padding: 6px 12px; font-size: 12px; width: 180px;" oninput="handleSearch(this.value)">
          <div class="tabs">
            <button class="tab active" onclick="setFilter('all', this)">全部 (<span id="countAll">0</span>)</button>
            <button class="tab" onclick="setFilter('active', this)">活跃 (<span id="countActive">0</span>)</button>
            <button class="tab" onclick="setFilter('exhausted', this)">耗尽 (<span id="countExhausted">0</span>)</button>
            <button class="tab" onclick="setFilter('invalid', this)">失效 (<span id="countInvalid">0</span>)</button>
            <button class="tab" onclick="setFilter('disabled', this)">已停用 (<span id="countDisabled">0</span>)</button>
          </div>
        </div>
      </div>

      <!-- Key Table -->
      <div class="table-card">
        <table>
          <thead>
            <tr>
              <th style="width: 100px;">状态</th>
              <th id="thGatewayCol" style="width: 120px; display: none;">归属网关</th>
              <th>名称 / 备注</th>
              <th>Key 凭证 (点击复制)</th>
              <th style="width: 110px;">成功 / 失败</th>
              <th style="width: 140px;">最后调度</th>
              <th>健康检查说明</th>
              <th style="width: 200px; text-align: right;">操作</th>
            </tr>
          </thead>
          <tbody id="keysTableBody">
            <tr>
              <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 36px;">加载数据中...</td>
            </tr>
          </tbody>
        </table>

        <!-- 分页控制栏 -->
        <div class="pagination-bar">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>每页展示:</span>
            <select id="pageSizeSelect" class="form-select" style="padding: 3px 8px; font-size: 12px;" onchange="changePageSize(this.value)">
              <option value="15">15 条</option>
              <option value="30">30 条</option>
              <option value="50">50 条</option>
              <option value="100">100 条</option>
              <option value="99999">全部展示</option>
            </select>
            <span id="pageTotalInfo">共 0 条</span>
          </div>
          <div class="pagination-controls">
            <button class="btn btn-sm" id="btnFirstPage" onclick="goToPage(1)">⏮ 首页</button>
            <button class="btn btn-sm" id="btnPrevPage" onclick="prevPage()">◀ 上一页</button>
            <span style="margin: 0 4px;">第 <strong id="curPageNum">1</strong> / <strong id="totalPageNum">1</strong> 页</span>
            <button class="btn btn-sm" id="btnNextPage" onclick="nextPage()">下一页 ▶</button>
            <button class="btn btn-sm" id="btnLastPage" onclick="goToLastPage()">末页 ⏭</button>
          </div>
        </div>
      </div>

      <!-- Integration Hint -->
      <div class="stat-card" style="margin-top: 16px;">
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px;">💡 客户端多网关接入方式 (OpenAI 兼容协议)</div>
        <div style="font-size: 13px; color: var(--text-muted); line-height: 2.0;">
          • <strong>通用全局入口</strong>: <code class="key-mono" id="apiEndpointBase">https://.../v1</code> (自动调用主网关，或根据客户端请求的 model 自动路由！)<br>
          • <strong>指定网关入口</strong>: <code class="key-mono" id="apiEndpointSpecific">https://.../{id}/v1</code> (直连当前指定网关，各网关 Key 互不影响)<br>
          • <strong>API Key (Bearer)</strong>: 
            <code class="key-mono" id="hintClientApiKey">••••••••••••</code>
            <button class="btn btn-sm" id="btnToggleKeyMask" onclick="toggleApiKeyMask()" style="padding: 2px 8px; margin-left: 6px; font-size: 11px;">👁️ 显示</button>
            <button class="btn btn-sm btn-primary" onclick="copyFullClientApiKey()" style="padding: 2px 8px; margin-left: 4px; font-size: 11px;">📋 复制完整密钥</button><br>
          • <strong>海量 Key 调度架构</strong>: 采用纯内存打乱均匀分发，正常请求 0 次 KV 覆写，无并发锁冲突，毫秒级故障转移。
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: 批量导入 -->
  <div class="modal-backdrop" id="importModal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" id="importModalTitle">➕ 批量导入 API Key</div>
        <button class="btn btn-sm" onclick="closeModal('importModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">🎯 选择导入归属的网关</label>
          <select id="importGwSelect" class="form-select"></select>
        </div>
        <div class="form-group">
          <label class="form-label">粘贴 Key 列表 (每行一个，或直接粘贴 Excel/表格/JSON)</label>
          <textarea id="importTextarea" class="form-textarea" placeholder="支持多种格式，智能识别：&#10;sk-bd0bd5ccb31e...&#10;账号2----sk-778899aa...&#10;sk-11223344...,测试账号3&#10;账号4:sk-99887766...&#10;纯token密钥 (无sk前缀也可以)&#10;Excel表格复制 (名称 制表符 Key)&#10;[&quot;sk-111&quot;, &quot;sk-222&quot;]"></textarea>
        </div>
        <div style="font-size: 12px; color: var(--text-muted); line-height: 1.6;">
          * 系统采用防覆写强一致存储：自动排重已有 Key、自动智能纠错并分离备注与密钥，导入后默认状态为【活跃】。
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeModal('importModal')">取消</button>
        <button class="btn btn-primary" onclick="submitImport()">确认导入</button>
      </div>
    </div>
  </div>

  <!-- Modal: 导出备份 -->
  <div class="modal-backdrop" id="exportModal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">📋 导出备份 Key 列表</div>
        <button class="btn btn-sm" onclick="closeModal('exportModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">选择导出格式</label>
          <select id="exportFormatSelect" class="form-select" onchange="generateExportContent()">
            <option value="line_pair">备注----Key (标准文本)</option>
            <option value="pure_key">仅纯 Key (每行一个)</option>
            <option value="csv">CSV 格式 (名称,Key,状态,网关)</option>
            <option value="json">JSON 完整备份</option>
          </select>
        </div>
        <div class="form-group">
          <textarea id="exportTextarea" class="form-textarea" style="min-height: 180px;" readonly></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="copyText(document.getElementById('exportTextarea').value)">📋 一键复制全部</button>
        <button class="btn btn-primary" onclick="downloadExportFile()">💾 下载为文件</button>
        <button class="btn" onclick="closeModal('exportModal')">关闭</button>
      </div>
    </div>
  </div>

  <!-- Modal: 网关编辑/新建 -->
  <div class="modal-backdrop" id="gatewayModal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" id="gatewayModalTitle">⚙️ 网关配置</div>
        <button class="btn btn-sm" onclick="closeModal('gatewayModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group" id="gwPresetGroup">
          <label class="form-label">🚀 常见平台快速预设 (可选)</label>
          <select id="presetSelect" class="form-select" onchange="applyPreset(this.value)">
            <option value="">-- 选择预设以自动填充，或自行输入任意地址 --</option>
            <option value="intern">🌟 书生·砚 (https://discovery-api.intern-ai.org.cn/v1)</option>
            <option value="deepseek">🐳 DeepSeek 官方 (https://api.deepseek.com/v1)</option>
            <option value="silicon">⚡ 硅基流动 SiliconFlow (https://api.siliconflow.cn/v1)</option>
            <option value="openrouter">🌐 OpenRouter (https://openrouter.ai/api/v1)</option>
            <option value="openai">🤖 OpenAI 官方 (https://api.openai.com/v1)</option>
            <option value="custom">🛠️ 自定义第三方中转站 / 其它兼容平台</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">网关英文标识 ID (不可与已有重复，URL 路由使用)</label>
          <input type="text" id="gwIdInput" class="form-input" placeholder="例如: intern, deepseek, myproxy">
        </div>
        <div class="form-group">
          <label class="form-label">网关显示名称</label>
          <input type="text" id="gwNameInput" class="form-input" placeholder="例如: 🌟 书生·砚 (PJLab)">
        </div>
        <div class="form-group">
          <label class="form-label">上游目标 Base URL</label>
          <input type="text" id="gwBaseInput" class="form-input" placeholder="https://api.deepseek.com/v1">
        </div>
        <div class="form-group">
          <label class="form-label">默认测活 / 兜底测试模型名称</label>
          <input type="text" id="gwModelInput" class="form-input" placeholder="例如: deepseek-chat, deepseek-v4-flash-0731">
        </div>
        <div class="form-group">
          <label class="form-label">自定义模型列表 (逗号分隔，可选备用)</label>
          <input type="text" id="gwCustomModelsInput" class="form-input" placeholder="例如: deepseek-chat,deepseek-reasoner">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeModal('gatewayModal')">取消</button>
        <button class="btn btn-primary" onclick="submitSaveGateway()">保存网关</button>
      </div>
    </div>
  </div>

  <!-- Modal: 全局设置 -->
  <div class="modal-backdrop" id="globalConfigModal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">⚙️ 全局系统参数</div>
        <button class="btn btn-sm" onclick="closeModal('globalConfigModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">单次请求最大故障转移换号次数</label>
          <input type="number" id="cfgMaxRetries" class="form-input" min="1" max="20" placeholder="5">
        </div>
        <div class="form-group">
          <label class="form-label">自动复活候选周期 (天)</label>
          <input type="number" id="cfgAutoResetDays" class="form-input" min="1" max="365" placeholder="7">
        </div>
        <div class="form-group">
          <label class="form-label">管理面板密码 (留空则不修改)</label>
          <input type="password" id="cfgAdminPassword" class="form-input" placeholder="留空不修改，输入新密码覆盖">
        </div>
        <div class="form-group">
          <label class="form-label">客户端访问 Key (留空则对外免密公开访问)</label>
          <input type="text" id="cfgClientApiKey" class="form-input" placeholder="留空则任何人可调用 /v1/*">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeModal('globalConfigModal')">取消</button>
        <button class="btn btn-primary" onclick="submitGlobalConfig()">保存全局设置</button>
      </div>
    </div>
  </div>

  <!-- Modal: 在线测试 (多模型动态选择) -->
  <div class="modal-backdrop" id="testModal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">💬 在线流式对话与故障转移测试</div>
        <button class="btn btn-sm" onclick="closeModal('testModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">选择或输入测试模型</label>
          <div style="display: flex; gap: 8px;">
            <select id="testModelSelect" class="form-select" style="flex: 1;" onchange="document.getElementById('testModelName').value=this.value">
            </select>
            <input type="text" id="testModelName" class="form-input" style="flex: 1;" placeholder="或直接输入自定义模型">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">测试提示词</label>
          <input type="text" id="testPrompt" class="form-input" value="你好！请输出一句简短的中文问候。">
        </div>
        <div class="form-group">
          <label class="form-label">实时输出结果</label>
          <div id="testOutput" class="chat-box">等待发送测试...</div>
        </div>
        <div id="testMeta" style="font-size: 12px; color: var(--text-muted);"></div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeModal('testModal')">关闭</button>
        <button class="btn btn-primary" id="btnSendTest" onclick="runChatTest()">⚡ 发送测试请求</button>
      </div>
    </div>
  </div>

  <div id="toast"></div>

  <script>
    let poolData = { keys: [], config: { gateways: [], activeGatewayId: 'intern' } };
    let viewingGatewayId = 'all'; // 默认进入【全部网关】视图，总览所有 Key
    let currentFilter = 'all';
    let currentSearch = '';
    let currentPage = 1;
    let pageSize = 15;
    const TOKEN_STORAGE_KEY = 'keypool_admin_key';

    const PRESETS = {
      intern: { id: 'intern', name: '🌟 书生·砚 (PJLab)', base: 'https://discovery-api.intern-ai.org.cn/v1', model: 'deepseek-v4-flash-0731', list: 'deepseek-v4-flash-0731,Agents-A1,Atria-Dawn-Preview' },
      deepseek: { id: 'deepseek', name: '🐳 DeepSeek 官方', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', list: 'deepseek-chat,deepseek-reasoner' },
      silicon: { id: 'silicon', name: '⚡ 硅基流动 SiliconFlow', base: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3', list: 'deepseek-ai/DeepSeek-V3,deepseek-ai/DeepSeek-R1' },
      openrouter: { id: 'openrouter', name: '🌐 OpenRouter', base: 'https://openrouter.ai/api/v1', model: 'deepseek/deepseek-r1', list: 'deepseek/deepseek-r1,anthropic/claude-3.5-sonnet' },
      openai: { id: 'openai', name: '🤖 OpenAI 官方', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', list: 'gpt-4o,gpt-4o-mini' },
      custom: { id: 'custom', name: '🛠️ 自定义中转站', base: '', model: '', list: '' }
    };

    function applyPreset(val) {
      if (!val || !PRESETS[val]) return;
      const p = PRESETS[val];
      const idInput = document.getElementById('gwIdInput');
      if (!idInput.disabled) idInput.value = p.id;
      document.getElementById('gwNameInput').value = p.name;
      if (p.base) document.getElementById('gwBaseInput').value = p.base;
      if (p.model) document.getElementById('gwModelInput').value = p.model;
      if (p.list) document.getElementById('gwCustomModelsInput').value = p.list;
    }

    function getAdminKey() { return localStorage.getItem(TOKEN_STORAGE_KEY) || ''; }
    function setAdminKey(key) {
      if (key) localStorage.setItem(TOKEN_STORAGE_KEY, key);
      else localStorage.removeItem(TOKEN_STORAGE_KEY);
    }

    let isApiKeyRevealed = false;

    function renderApiKeyHint() {
      const rawKey = poolData.config?.clientApiKey || '';
      const el = document.getElementById('hintClientApiKey');
      const btn = document.getElementById('btnToggleKeyMask');
      if (!el) return;
      if (!rawKey) {
        el.textContent = '未设置 (免密公开访问)';
        if (btn) btn.style.display = 'none';
        return;
      }
      if (btn) btn.style.display = 'inline-flex';
      if (isApiKeyRevealed) {
        el.textContent = rawKey;
        if (btn) btn.textContent = '🙈 隐藏';
      } else {
        const masked = rawKey.length > 10
          ? (rawKey.slice(0, 6) + '••••••••' + rawKey.slice(-4))
          : '••••••••••••';
        el.textContent = masked;
        if (btn) btn.textContent = '👁️ 显示';
      }
    }

    function toggleApiKeyMask() {
      isApiKeyRevealed = !isApiKeyRevealed;
      renderApiKeyHint();
    }

    function copyFullClientApiKey() {
      const rawKey = poolData.config?.clientApiKey || '';
      if (!rawKey) return showToast('未配置客户端 API Key', true);
      copyText(rawKey);
    }

    function showToast(msg, isError = false) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.style.borderColor = isError ? 'var(--danger)' : 'var(--card-border)';
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 3500);
    }

    function openModal(id) { document.getElementById(id).classList.add('active'); }
    function closeModal(id) { document.getElementById(id).classList.remove('active'); }

    async function apiReq(path, method = 'GET', body = null) {
      const headers = { 'content-type': 'application/json' };
      const key = getAdminKey();
      if (key) headers['x-admin-key'] = key;
      const res = await fetch('/admin/api' + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        showLoginView();
        throw new Error('认证失败，请重新登录');
      }
      if (!res.ok) {
        throw new Error(data.error || ('HTTP ' + res.status));
      }
      return data;
    }

    function showLoginView(errorMsg = '') {
      document.getElementById('loginView').style.display = 'flex';
      document.getElementById('appView').style.display = 'none';
      document.getElementById('headerAuthActions').style.display = 'none';
      const errEl = document.getElementById('loginError');
      if (errorMsg) {
        errEl.textContent = errorMsg;
        errEl.style.display = 'block';
      } else {
        errEl.style.display = 'none';
      }
    }

    function showAppView() {
      document.getElementById('loginView').style.display = 'none';
      document.getElementById('appView').style.display = 'block';
      document.getElementById('headerAuthActions').style.display = 'flex';
    }

    async function doLogin() {
      const pwd = document.getElementById('loginPwdInput').value.trim();
      if (!pwd) return showLoginView('请输入管理密钥');
      setAdminKey(pwd);
      try {
        await fetchData();
        showAppView();
      } catch (e) {
        setAdminKey('');
        showLoginView('登录失败：' + e.message);
      }
    }

    function logout() {
      setAdminKey('');
      document.getElementById('loginPwdInput').value = '';
      showLoginView();
      showToast('已安全退出登录');
    }

    async function fetchData() {
      try {
        const data = await apiReq('/status');
        poolData = data;
        const gws = poolData.config?.gateways || [];
        if (viewingGatewayId !== 'all' && !gws.some(g => g.id === viewingGatewayId)) {
          viewingGatewayId = 'all';
        }
        showAppView();
        render();
      } catch (e) {
        if (!getAdminKey()) showLoginView();
        else showLoginView('认证过期或密码错误');
      }
    }

    function switchGateway(gid) {
      viewingGatewayId = gid;
      currentPage = 1;
      render();
    }

    function getCurrentGateway() {
      const gws = poolData.config?.gateways || [];
      if (viewingGatewayId === 'all') {
        const activeGw = gws.find(g => g.id === poolData.config?.activeGatewayId) || gws[0];
        return {
          id: 'all',
          name: '🌐 全部网关集中总览',
          targetBase: '多网关动态路由 (匹配请求 model)',
          defaultModel: activeGw ? activeGw.defaultModel : '自动调度',
        };
      }
      return gws.find(g => g.id === viewingGatewayId) || gws[0] || { id: 'default', name: '默认网关', targetBase: '', defaultModel: '' };
    }

    function handleSearch(val) {
      currentSearch = (val || '').trim().toLowerCase();
      currentPage = 1;
      renderTableOnly();
    }

    function render() {
      const config = poolData.config || {};
      const gateways = config.gateways || [];
      const keys = poolData.keys || [];
      const curGw = getCurrentGateway();
      const isAll = viewingGatewayId === 'all';

      // 1. 渲染网关切换 Tabs (首位加入 "全部网关" 标签)
      const tabsEl = document.getElementById('gatewayTabs');
      const allTabHtml = \`<button class="gw-tab \${isAll ? 'active' : ''}" onclick="switchGateway('all')">
        <span>🌐 全部网关</span>
        <span class="gw-badge">\${keys.length}</span>
      </button>\`;

      const gwsHtml = gateways.map(g => {
        const count = keys.filter(k => (k.gatewayId || 'intern') === g.id).length;
        const isDefault = g.id === config.activeGatewayId;
        const isActive = g.id === curGw.id;
        return \`<button class="gw-tab \${isActive ? 'active' : ''}" onclick="switchGateway('\${g.id}')">
          <span>\${escapeHtml(g.name)}</span>
          \${isDefault ? '<span style="font-size: 10px; color: #60a5fa;" title="全局主网关">⭐</span>' : ''}
          <span class="gw-badge">\${count}</span>
        </button>\`;
      }).join('');

      tabsEl.innerHTML = allTabHtml + gwsHtml;

      // 2. 当前网关 Banner 信息
      document.getElementById('curGwName').textContent = curGw.name;
      document.getElementById('curGwBase').textContent = curGw.targetBase;
      document.getElementById('curGwModel').textContent = curGw.defaultModel;
      document.getElementById('curGwRoute').textContent = isAll ? '/v1 (全局自适应)' : ('/' + curGw.id + '/v1');

      const isDefault = !isAll && curGw.id === config.activeGatewayId;
      document.getElementById('curGwDefaultBadge').innerHTML = isDefault
        ? '<span class="badge badge-active-gw">⭐ 全局主网关</span>'
        : (isAll ? '<span class="badge" style="background: rgba(139,92,246,0.2); color: #c4b5fd;">已汇聚 ' + gateways.length + ' 个网关</span>' : '');

      document.getElementById('btnSetAsDefault').style.display = isAll || isDefault ? 'none' : 'inline-flex';
      document.getElementById('btnDeleteGw').style.display = isAll || gateways.length <= 1 ? 'none' : 'inline-flex';
      document.getElementById('btnEditGw').style.display = isAll ? 'none' : 'inline-flex';
      document.getElementById('btnFetchModels').style.display = isAll ? 'none' : 'inline-flex';

      // 3. 渲染当前网关已探测到的模型列表
      let allModels = [];
      if (isAll) {
        const set = new Set();
        for (const g of gateways) {
          (g.fetchedModels || []).forEach(m => set.add(m));
          if (g.customModels) g.customModels.split(',').map(m => m.trim()).forEach(m => set.add(m));
          if (g.defaultModel) set.add(g.defaultModel);
        }
        allModels = Array.from(set).filter(Boolean);
      } else {
        allModels = Array.from(new Set([
          ...(curGw.fetchedModels || []),
          ...(curGw.customModels ? curGw.customModels.split(',').map(m => m.trim()) : []),
          curGw.defaultModel
        ].filter(Boolean)));
      }

      const tagsEl = document.getElementById('curGwModelTags');
      if (allModels.length === 0) {
        tagsEl.innerHTML = '<span style="color: var(--text-muted);">暂无探测模型</span>';
      } else {
        tagsEl.innerHTML = allModels.slice(0, 15).map(m =>
          \`<span class="model-tag" onclick="quickTestModel('\${escapeHtml(m)}')">\${escapeHtml(m)}</span>\`
        ).join('') + (allModels.length > 15 ? \`<span style="font-size: 11px; color: var(--text-muted);">+等共\${allModels.length}个</span>\` : '');
      }

      // 4. Key 统计 (当前视图)
      const visibleKeys = isAll ? keys : keys.filter(k => (k.gatewayId || 'intern') === curGw.id);
      let activeCount = 0, exhaustedCount = 0, invalidCount = 0, disabledCount = 0;

      for (const k of visibleKeys) {
        if (k.disabled) disabledCount++;
        else if (k.status === 'active') activeCount++;
        else if (k.status === 'exhausted') exhaustedCount++;
        else if (k.status === 'invalid') invalidCount++;
      }

      document.getElementById('statActive').textContent = activeCount;
      document.getElementById('statExhausted').textContent = exhaustedCount;
      document.getElementById('statInvalid').textContent = invalidCount;
      document.getElementById('statTotalKeys').textContent = visibleKeys.length;
      document.getElementById('statDesc').textContent = isAll ? '全部网关 Key 总汇' : (\`归属于 [\${curGw.name}]\`);

      document.getElementById('countAll').textContent = visibleKeys.length;
      document.getElementById('countActive').textContent = activeCount;
      document.getElementById('countExhausted').textContent = exhaustedCount;
      document.getElementById('countInvalid').textContent = invalidCount;
      document.getElementById('countDisabled').textContent = disabledCount;

      document.getElementById('apiEndpointBase').textContent = window.location.origin + '/v1';
      document.getElementById('apiEndpointSpecific').textContent = isAll
        ? (window.location.origin + '/:gatewayId/v1')
        : (window.location.origin + '/' + curGw.id + '/v1');
      renderApiKeyHint();

      // 全局配置字段
      document.getElementById('cfgMaxRetries').value = config.maxRetries || 5;
      document.getElementById('cfgAutoResetDays').value = config.autoResetDays || 7;
      document.getElementById('cfgClientApiKey').value = config.clientApiKey || '';

      renderTableOnly();
    }

    function getFilteredKeys() {
      const isAll = viewingGatewayId === 'all';
      const allKeys = poolData.keys || [];
      const baseKeys = isAll ? allKeys : allKeys.filter(k => (k.gatewayId || 'intern') === viewingGatewayId);

      return baseKeys.filter(k => {
        // 状态过滤
        if (currentFilter === 'active' && (k.disabled || k.status !== 'active')) return false;
        if (currentFilter === 'exhausted' && (k.disabled || k.status !== 'exhausted')) return false;
        if (currentFilter === 'invalid' && (k.disabled || k.status !== 'invalid')) return false;
        if (currentFilter === 'disabled' && !k.disabled) return false;

        // 搜索过滤 (匹配名称或 Key)
        if (currentSearch) {
          const matchName = (k.name || '').toLowerCase().includes(currentSearch);
          const matchKey = (k.key || '').toLowerCase().includes(currentSearch);
          if (!matchName && !matchKey) return false;
        }

        return true;
      });
    }

    function renderTableOnly() {
      const isAll = viewingGatewayId === 'all';
      const thGateway = document.getElementById('thGatewayCol');
      if (thGateway) thGateway.style.display = isAll ? '' : 'none';

      const filtered = getFilteredKeys();
      const tbody = document.getElementById('keysTableBody');
      const totalCount = filtered.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      // 分页信息更新
      document.getElementById('curPageNum').textContent = currentPage;
      document.getElementById('totalPageNum').textContent = totalPages;
      document.getElementById('pageTotalInfo').textContent = \`共 \${totalCount} 条结果\`;
      document.getElementById('btnPrevPage').disabled = currentPage <= 1;
      document.getElementById('btnFirstPage').disabled = currentPage <= 1;
      document.getElementById('btnNextPage').disabled = currentPage >= totalPages;
      document.getElementById('btnLastPage').disabled = currentPage >= totalPages;

      if (totalCount === 0) {
        tbody.innerHTML = \`<tr><td colspan="\${isAll ? 8 : 7}" style="text-align: center; color: var(--text-muted); padding: 36px;">暂无匹配的 Key，可点击上方导入或调整筛选</td></tr>\`;
        return;
      }

      const startIndex = (currentPage - 1) * pageSize;
      const pageSlice = filtered.slice(startIndex, startIndex + pageSize);
      const gateways = poolData.config?.gateways || [];

      tbody.innerHTML = pageSlice.map(k => {
        let badgeHtml = '';
        if (k.disabled) badgeHtml = '<span class="badge badge-disabled">⚪ 已停用</span>';
        else if (k.status === 'active') badgeHtml = '<span class="badge badge-active">🟢 活跃可用</span>';
        else if (k.status === 'exhausted') badgeHtml = '<span class="badge badge-exhausted">🟡 额度耗尽</span>';
        else badgeHtml = '<span class="badge badge-invalid">🔴 认证失败</span>';

        const masked = k.key.length > 14 ? (k.key.slice(0, 8) + '...' + k.key.slice(-4)) : k.key;
        const lastUsed = k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString('zh-CN', { hour12: false }) : '从未';
        const msg = k.checkMessage || k.failReason || '-';
        const gwItem = gateways.find(g => g.id === (k.gatewayId || 'intern'));
        const gwName = gwItem ? gwItem.name : (k.gatewayId || 'intern');

        return \`<tr>
          <td>\${badgeHtml}</td>
          \${isAll ? \`<td><span class="badge-gw-tag" style="cursor: pointer;" onclick="switchGateway('\${k.gatewayId || 'intern'}')" title="点击直达该网关">\${escapeHtml(gwName)}</span></td>\` : ''}
          <td style="font-weight: 500;">\${escapeHtml(k.name || '未命名')}</td>
          <td><span class="key-mono" title="点击复制完整 Key" onclick="copyText('\${k.key}')">\${masked}</span></td>
          <td><span style="color: #34d399;">\${k.successCount || 0}</span> / <span style="color: #f87171;">\${k.failCount || 0}</span></td>
          <td style="color: var(--text-muted); font-size: 12px;">\${lastUsed}</td>
          <td style="font-size: 12px; color: var(--text-muted);" title="\${escapeHtml(msg)}">\${escapeHtml(msg)}</td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <button class="btn btn-sm btn-primary" onclick="probeSingle('\${k.id}')">测活</button>
              <button class="btn btn-sm" onclick="toggleKey('\${k.id}')">\${k.disabled ? '启用' : '禁用'}</button>
              \${k.status !== 'active' ? \`<button class="btn btn-sm btn-warning" onclick="reviveSingle('\${k.id}')">设活跃</button>\` : ''}
              <button class="btn btn-sm btn-danger" onclick="deleteKey('\${k.id}')">删除</button>
            </div>
          </td>
        </tr>\`;
      }).join('');
    }

    function setFilter(filter, el) {
      currentFilter = filter;
      document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
      if (el) el.classList.add('active');
      currentPage = 1;
      renderTableOnly();
    }

    function changePageSize(val) {
      pageSize = parseInt(val, 10) || 15;
      currentPage = 1;
      renderTableOnly();
    }

    function prevPage() {
      if (currentPage > 1) {
        currentPage--;
        renderTableOnly();
      }
    }

    function nextPage() {
      const filtered = getFilteredKeys();
      const totalPages = Math.ceil(filtered.length / pageSize);
      if (currentPage < totalPages) {
        currentPage++;
        renderTableOnly();
      }
    }

    function goToPage(page) {
      currentPage = page;
      renderTableOnly();
    }

    function goToLastPage() {
      const filtered = getFilteredKeys();
      currentPage = Math.max(1, Math.ceil(filtered.length / pageSize));
      renderTableOnly();
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function copyText(txt) {
      if (!txt || txt.includes('未设置')) return;
      navigator.clipboard.writeText(txt).then(() => showToast('已复制到剪贴板！'));
    }

    /* ── 网关操作 ── */
    async function setCurrentAsDefault() {
      const curGw = getCurrentGateway();
      if (curGw.id === 'all') return;
      try {
        await apiReq('/gateways/active', 'POST', { id: curGw.id });
        showToast(\`已将 [\${curGw.name}] 设为全局主网关！\`);
        fetchData();
      } catch (e) {
        showToast('设置失败: ' + e.message, true);
      }
    }

    async function fetchCurrentGatewayModels() {
      const curGw = getCurrentGateway();
      if (curGw.id === 'all') return;
      const btn = document.getElementById('btnFetchModels');
      btn.disabled = true;
      btn.textContent = '探测中...';
      showToast(\`正在向上游探测 [\${curGw.name}] 模型列表...\`);

      try {
        const res = await apiReq('/gateways/fetch-models', 'POST', { id: curGw.id });
        if (res.ok) {
          showToast(\`成功获取 \${res.count} 个上游模型！\`);
        } else {
          showToast(res.message || '探测完成');
        }
        fetchData();
      } catch (e) {
        showToast('获取模型失败: ' + e.message, true);
      } finally {
        btn.disabled = false;
        btn.textContent = '🔄 重新获取上游模型';
      }
    }

    function openNewGatewayModal() {
      document.getElementById('gatewayModalTitle').textContent = '➕ 添加新网关配置';
      document.getElementById('gwIdInput').disabled = false;
      document.getElementById('gwIdInput').value = '';
      document.getElementById('gwNameInput').value = '';
      document.getElementById('gwBaseInput').value = '';
      document.getElementById('gwModelInput').value = '';
      document.getElementById('gwCustomModelsInput').value = '';
      document.getElementById('presetSelect').value = '';
      openModal('gatewayModal');
    }

    function openEditGatewayModal() {
      const curGw = getCurrentGateway();
      if (curGw.id === 'all') return;
      document.getElementById('gatewayModalTitle').textContent = '✏️ 编辑网关: ' + curGw.name;
      document.getElementById('gwIdInput').disabled = true;
      document.getElementById('gwIdInput').value = curGw.id;
      document.getElementById('gwNameInput').value = curGw.name;
      document.getElementById('gwBaseInput').value = curGw.targetBase;
      document.getElementById('gwModelInput').value = curGw.defaultModel;
      document.getElementById('gwCustomModelsInput').value = curGw.customModels || '';
      document.getElementById('presetSelect').value = '';
      openModal('gatewayModal');
    }

    async function submitSaveGateway() {
      const id = document.getElementById('gwIdInput').value.trim();
      const name = document.getElementById('gwNameInput').value.trim();
      const targetBase = document.getElementById('gwBaseInput').value.trim();
      const defaultModel = document.getElementById('gwModelInput').value.trim();
      const customModels = document.getElementById('gwCustomModelsInput').value.trim();

      if (!id || !targetBase) return showToast('网关 ID 与 Base URL 为必填项', true);

      try {
        await apiReq('/gateways/save', 'POST', {
          gateway: { id, name: name || id, targetBase, defaultModel: defaultModel || 'deepseek-chat', customModels }
        });
        showToast('网关已保存！');
        closeModal('gatewayModal');
        viewingGatewayId = id;
        fetchData();
      } catch (e) {
        showToast('保存失败: ' + e.message, true);
      }
    }

    async function deleteCurrentGateway() {
      const curGw = getCurrentGateway();
      if (curGw.id === 'all') return;
      if (!confirm(\`确定要删除网关 [\${curGw.name}] 吗？\`)) return;
      try {
        await apiReq('/gateways/delete', 'POST', { id: curGw.id });
        showToast('已删除网关');
        viewingGatewayId = 'all';
        fetchData();
      } catch (e) {
        showToast('删除失败: ' + e.message, true);
      }
    }

    /* ── Key 导入与导出操作 ── */
    function openImportModal() {
      const gws = poolData.config?.gateways || [];
      const selectEl = document.getElementById('importGwSelect');
      selectEl.innerHTML = gws.map(g => \`<option value="\${g.id}">\${escapeHtml(g.name)} (\${g.id})</option>\`).join('');

      if (viewingGatewayId !== 'all') {
        selectEl.value = viewingGatewayId;
      } else {
        selectEl.value = poolData.config?.activeGatewayId || gws[0]?.id || 'intern';
      }

      openModal('importModal');
    }

    async function submitImport() {
      const text = document.getElementById('importTextarea').value.trim();
      const targetGid = document.getElementById('importGwSelect').value;
      if (!text) return showToast('请输入要导入的内容', true);

      try {
        const res = await apiReq('/keys/import', 'POST', { text, gatewayId: targetGid });
        showToast(\`成功导入 \${res.importedCount} 个 Key，排重 \${res.ignoredCount} 个！\`);
        closeModal('importModal');
        document.getElementById('importTextarea').value = '';
        fetchData();
      } catch (e) {
        showToast('导入失败: ' + e.message, true);
      }
    }

    function openExportModal() {
      generateExportContent();
      openModal('exportModal');
    }

    function generateExportContent() {
      const format = document.getElementById('exportFormatSelect').value;
      const keys = getFilteredKeys();
      const textarea = document.getElementById('exportTextarea');

      if (format === 'pure_key') {
        textarea.value = keys.map(k => k.key).join('\\n');
      } else if (format === 'csv') {
        textarea.value = '名称,Key,状态,归属网关\\n' + keys.map(k => \`"\${(k.name||'').replace(/"/g, '""')}",\${k.key},\${k.status},\${k.gatewayId||'intern'}\`).join('\\n');
      } else if (format === 'json') {
        textarea.value = JSON.stringify(keys, null, 2);
      } else {
        // 标准 line_pair
        textarea.value = keys.map(k => \`\${k.name || 'Key'}----\${k.key}\`).join('\\n');
      }
    }

    function downloadExportFile() {
      const content = document.getElementById('exportTextarea').value;
      const format = document.getElementById('exportFormatSelect').value;
      const ext = format === 'csv' ? 'csv' : (format === 'json' ? 'json' : 'txt');
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`keypool-export-\${Date.now()}.\${ext}\`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('导出文件已下载！');
    }

    /* ── 测活与清理操作 ── */
    async function probeSingle(id) {
      showToast('正在测试连通性...');
      try {
        const res = await apiReq('/keys/probe', 'POST', { id });
        showToast(res.message || '测活完成');
        fetchData();
      } catch (e) {
        showToast('测活失败: ' + e.message, true);
      }
    }

    async function probeAllKeys() {
      const btn = document.getElementById('btnProbeAll');
      btn.disabled = true;
      btn.textContent = '测活中...';
      const targetGid = viewingGatewayId;
      showToast('正在启动安全分批测活 (规避 CF Workers 配额限制)...');

      let offset = 0;
      const limit = 25;
      let hasMore = true;
      let totalActive = 0, totalExhausted = 0, totalInvalid = 0;
      let probedCount = 0;

      try {
        while (hasMore) {
          const res = await apiReq('/keys/probe', 'POST', {
            all: true,
            gatewayId: targetGid,
            offset,
            limit
          });

          probedCount += (res.probedInBatch || 0);
          totalActive += (res.activeCount || 0);
          totalExhausted += (res.exhaustedCount || 0);
          totalInvalid += (res.invalidCount || 0);

          const percent = res.totalKeys > 0 ? Math.round((probedCount / res.totalKeys) * 100) : 100;
          showToast(\`测活进度: \${probedCount}/\${res.totalKeys} (\${percent}%)... 活跃:\${totalActive} 耗尽:\${totalExhausted}\`);

          hasMore = res.hasMore;
          offset = res.nextOffset;

          if (!hasMore || (res.probedInBatch || 0) === 0) break;
        }

        showToast(\`全量测活完成！活跃: \${totalActive}, 耗尽: \${totalExhausted}, 失效: \${totalInvalid}\`);
      } catch (e) {
        showToast('测活中断: ' + e.message, true);
      } finally {
        btn.disabled = false;
        btn.textContent = '⚡ 安全批量测活';
        fetchData();
      }
    }

    async function cleanInvalidKeys() {
      const keys = getFilteredKeys();
      const invalidCount = keys.filter(k => k.status === 'invalid').length;
      if (invalidCount === 0) {
        return showToast('当前视图下没有失效 (401) 的 Key，无需清理');
      }

      if (!confirm(\`确定要一键永久删除当前视图下的 \${invalidCount} 个【认证失效/401】的 Key 吗？\`)) return;

      try {
        const res = await apiReq('/keys/clean-invalid', 'POST', { gatewayId: viewingGatewayId });
        showToast(\`已清理 \${res.deletedCount} 个失效 Key！\`);
        fetchData();
      } catch (e) {
        showToast('清理失败: ' + e.message, true);
      }
    }

    async function reviveAllKeys() {
      if (!confirm('确定将当前视图所有【额度耗尽/限流】的 Key 设为【活跃】状态吗？')) return;
      try {
        const res = await apiReq('/keys/revive', 'POST', { all: true, gatewayId: viewingGatewayId });
        showToast(\`已一键复活 \${res.revivedCount} 个 Key 为活跃状态！\`);
        fetchData();
      } catch (e) {
        showToast('复活失败: ' + e.message, true);
      }
    }

    async function reviveSingle(id) {
      try {
        await apiReq('/keys/revive', 'POST', { id });
        showToast('已设为活跃');
        fetchData();
      } catch (e) {
        showToast('操作失败: ' + e.message, true);
      }
    }

    async function toggleKey(id) {
      try {
        await apiReq('/keys/toggle', 'POST', { id });
        fetchData();
      } catch (e) {
        showToast('操作失败: ' + e.message, true);
      }
    }

    async function deleteKey(id) {
      if (!confirm('确定要删除该 Key 吗？')) return;
      try {
        await apiReq('/keys/delete', 'POST', { id });
        showToast('已删除');
        fetchData();
      } catch (e) {
        showToast('删除失败: ' + e.message, true);
      }
    }

    async function submitGlobalConfig() {
      const body = {
        maxRetries: parseInt(document.getElementById('cfgMaxRetries').value, 10) || 5,
        autoResetDays: parseInt(document.getElementById('cfgAutoResetDays').value, 10) || 7,
        clientApiKey: document.getElementById('cfgClientApiKey').value.trim(),
      };
      const pwd = document.getElementById('cfgAdminPassword').value.trim();
      if (pwd) body.adminPassword = pwd;

      try {
        await apiReq('/config', 'POST', body);
        showToast('全局配置已保存！');
        closeModal('globalConfigModal');
        fetchData();
      } catch (e) {
        showToast('保存失败: ' + e.message, true);
      }
    }

    /* ── 在线测试 ── */
    function openTestModal() {
      const curGw = getCurrentGateway();
      let allModels = [];
      const gateways = poolData.config?.gateways || [];

      if (viewingGatewayId === 'all') {
        const set = new Set();
        for (const g of gateways) {
          (g.fetchedModels || []).forEach(m => set.add(m));
          if (g.customModels) g.customModels.split(',').map(m => m.trim()).forEach(m => set.add(m));
          if (g.defaultModel) set.add(g.defaultModel);
        }
        allModels = Array.from(set).filter(Boolean);
      } else {
        allModels = Array.from(new Set([
          ...(curGw.fetchedModels || []),
          ...(curGw.customModels ? curGw.customModels.split(',').map(m => m.trim()) : []),
          curGw.defaultModel
        ].filter(Boolean)));
      }

      const selectEl = document.getElementById('testModelSelect');
      selectEl.innerHTML = allModels.map(m => \`<option value="\${escapeHtml(m)}">\${escapeHtml(m)}</option>\`).join('');

      document.getElementById('testModelName').value = allModels[0] || curGw.defaultModel || 'deepseek-chat';
      openModal('testModal');
    }

    function quickTestModel(modelName) {
      openTestModal();
      document.getElementById('testModelName').value = modelName;
    }

    async function runChatTest() {
      const prompt = document.getElementById('testPrompt').value.trim();
      if (!prompt) return showToast('请输入测试提示词', true);

      const curGw = getCurrentGateway();
      const chosenModel = document.getElementById('testModelName').value.trim() || curGw.defaultModel;
      const out = document.getElementById('testOutput');
      const meta = document.getElementById('testMeta');
      const btn = document.getElementById('btnSendTest');

      out.textContent = '🚀 发起请求中...';
      meta.textContent = '';
      btn.disabled = true;

      const startTime = Date.now();
      try {
        const headers = { 'content-type': 'application/json' };
        const clientKey = poolData.config?.clientApiKey || getAdminKey();
        if (clientKey) headers['authorization'] = 'Bearer ' + clientKey;

        const reqPath = (viewingGatewayId && viewingGatewayId !== 'all')
          ? \`/\${viewingGatewayId}/v1/chat/completions\`
          : '/v1/chat/completions';

        const res = await fetch(reqPath, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: chosenModel,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
          }),
        });

        const usedKey = res.headers.get('x-used-key') || '自动分配';
        const usedGw = res.headers.get('x-gateway-id') || (viewingGatewayId !== 'all' ? viewingGatewayId : 'auto');

        if (!res.ok) {
          const err = await res.text();
          out.textContent = '❌ 调用失败 (HTTP ' + res.status + '):\\n' + err;
          meta.textContent = \`网关: \${usedGw} | 模型: \${chosenModel} | 耗时: \${Date.now() - startTime}ms\`;
          btn.disabled = false;
          return;
        }

        out.textContent = '';
        meta.textContent = \`网关: \${usedGw} | 模型: \${chosenModel} | Key: \${usedKey} | 接收流式中...\`;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              out.textContent += delta;
            } catch {}
          }
        }
        meta.textContent = \`网关: \${usedGw} | 模型: \${chosenModel} | Key: \${usedKey} | 耗时: \${Date.now() - startTime}ms | 完成\`;
      } catch (e) {
        out.textContent = '❌ 网络异常: ' + e.message;
      } finally {
        btn.disabled = false;
        fetchData();
      }
    }

    if (!getAdminKey()) showLoginView();
    else fetchData();
  </script>
</body>
</html>
`
