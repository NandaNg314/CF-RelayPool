export const UI_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KeyPool Router - 智能多账号故障转移网关</title>
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
    .container { max-width: 1200px; margin: 0 auto; }

    /* Header */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
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

    /* Cards */
    .grid-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
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
    .toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

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
      max-width: 640px;
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
    .form-input, .form-textarea {
      background: rgba(0,0,0,0.3);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      color: var(--text);
      padding: 10px 12px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
    }
    .form-input:focus, .form-textarea:focus { border-color: var(--primary); }
    .form-textarea { resize: vertical; min-height: 120px; font-family: var(--font-mono); font-size: 12px; }

    /* Test Box */
    .chat-box {
      background: rgba(0,0,0,0.3);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 12px;
      min-height: 160px;
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
          <div class="brand-title">KeyPool Router</div>
          <div class="brand-subtitle">请求级自动故障转移 · 多账号额度池网关</div>
        </div>
      </div>
      <div class="header-actions" id="headerAuthActions" style="display: none;">
        <span class="badge badge-active" style="padding: 4px 10px;">🟢 已授权登录</span>
        <button class="btn btn-sm" onclick="fetchData()">🔄 刷新</button>
        <button class="btn btn-sm btn-danger" onclick="logout()">🔒 退出</button>
      </div>
    </header>

    <!-- 1. 登录视图 -->
    <div id="loginView">
      <div class="login-card">
        <div class="login-header">
          <div class="login-icon">🔐</div>
          <div style="font-size: 18px; font-weight: 700;">管理控制台身份验证</div>
          <div style="font-size: 13px; color: var(--text-muted);">请输入管理密钥 (Admin Password)</div>
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
      <!-- Stats -->
      <div class="grid-stats">
        <div class="stat-card">
          <div class="stat-title">🟢 活跃可用 Key</div>
          <div class="stat-value" id="statActive">0</div>
          <div class="stat-desc">可立即提供服务的 Key 数量</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">🟡 额度耗尽 / 待恢复</div>
          <div class="stat-value" id="statExhausted">0</div>
          <div class="stat-desc">点数或额度耗尽，可一键复活</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">🔴 失效 / 认证错误</div>
          <div class="stat-value" id="statInvalid">0</div>
          <div class="stat-desc">上游返回 401 或格式异常</div>
        </div>
        <div class="stat-card">
          <div class="stat-title">📊 历史调度次数</div>
          <div class="stat-value" id="statCalls">0</div>
          <div class="stat-desc">成功 / 自动换号重试汇总</div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="toolbar">
        <div class="toolbar-left">
          <button class="btn btn-primary" onclick="openModal('importModal')">➕ 批量导入 Key</button>
          <button class="btn btn-success" id="btnProbeAll" onclick="probeAllKeys()">⚡ 一键测活全量</button>
          <button class="btn btn-warning" onclick="reviveAllKeys()">🔄 一键复活已耗尽</button>
          <button class="btn" onclick="openModal('testModal')">💬 在线连通性测试</button>
          <button class="btn" onclick="openModal('configModal')">⚙️ 网关配置</button>
        </div>
        <div class="toolbar-right">
          <div class="tabs">
            <button class="tab active" onclick="setFilter('all', this)">全部 (<span id="countAll">0</span>)</button>
            <button class="tab" onclick="setFilter('active', this)">活跃 (<span id="countActive">0</span>)</button>
            <button class="tab" onclick="setFilter('exhausted', this)">耗尽 (<span id="countExhausted">0</span>)</button>
            <button class="tab" onclick="setFilter('invalid', this)">失效 (<span id="countInvalid">0</span>)</button>
          </div>
        </div>
      </div>

      <!-- Key Table -->
      <div class="table-card">
        <table>
          <thead>
            <tr>
              <th style="width: 100px;">状态</th>
              <th>名称 / 备注</th>
              <th>Key 凭证 (点击复制)</th>
              <th style="width: 120px;">成功 / 失败</th>
              <th style="width: 140px;">最后调度</th>
              <th>健康检查说明</th>
              <th style="width: 180px; text-align: right;">操作</th>
            </tr>
          </thead>
          <tbody id="keysTableBody">
            <tr>
              <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 36px;">加载数据中...</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Integration Hint -->
      <div class="stat-card" style="margin-top: 16px;">
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px;">💡 客户端接入指引 (OpenAI 兼容协议)</div>
        <div style="font-size: 13px; color: var(--text-muted); line-height: 1.9;">
          • <strong>API Base URL</strong>: <code class="key-mono" id="apiEndpointBase">https://.../v1</code><br>
          • <strong>API Key (Bearer)</strong>: <code class="key-mono" id="hintClientApiKey" onclick="copyText(this.textContent)">...</code> (点击复制)<br>
          • <strong>请求级故障转移</strong>: 发送对话时，网关会自动挑选健康的 Key 请求上游。若返回 402/429/点数不足，将在<b>同一次请求内瞬间换号重试</b>，直到成功返回！<br>
          • <strong>当前配置的上游目标</strong>: <span id="hintTargetBase">...</span> | 默认测试模型: <span id="hintModel">...</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: 批量导入 -->
  <div class="modal-backdrop" id="importModal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">➕ 批量导入 API Key</div>
        <button class="btn btn-sm" onclick="closeModal('importModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">粘贴 Key 列表 (每行一个，支持直接粘贴或 <code>备注----key</code> / <code>key,备注</code>)</label>
          <textarea id="importTextarea" class="form-textarea" placeholder="sk-bd0bd5ccb31e...&#10;账号2----sk-778899aa...&#10;sk-11223344...,书生账号3"></textarea>
        </div>
        <div style="font-size: 12px; color: var(--text-muted);">
          * 重复 Key 会自动跳过或更新备注；导入后默认状态为【活跃】。
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeModal('importModal')">取消</button>
        <button class="btn btn-primary" onclick="submitImport()">确认导入</button>
      </div>
    </div>
  </div>

  <!-- Modal: 网关配置 -->
  <div class="modal-backdrop" id="configModal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">⚙️ 网关系统配置</div>
        <button class="btn btn-sm" onclick="closeModal('configModal')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">上游目标 Base URL</label>
          <input type="text" id="cfgTargetBase" class="form-input" placeholder="https://discovery-api.intern-ai.org.cn/v1">
        </div>
        <div class="form-group">
          <label class="form-label">默认探测与测试模型</label>
          <input type="text" id="cfgDefaultModel" class="form-input" placeholder="deepseek-v4-flash-0731">
        </div>
        <div class="form-group">
          <label class="form-label">单次请求最大故障转移换号次数</label>
          <input type="number" id="cfgMaxRetries" class="form-input" min="1" max="20" placeholder="5">
        </div>
        <div class="form-group">
          <label class="form-label">自动复活候选周期 (天)</label>
          <input type="number" id="cfgAutoResetDays" class="form-input" min="1" max="365" placeholder="7">
          <div style="font-size: 11px; color: var(--text-muted);">超过该天数未使用的耗尽 Key 将在轮询时重新作为候选尝试或恢复</div>
        </div>
        <div class="form-group">
          <label class="form-label">管理面板密码</label>
          <input type="password" id="cfgAdminPassword" class="form-input" placeholder="留空不修改，输入新密码覆盖">
        </div>
        <div class="form-group">
          <label class="form-label">客户端访问 Key (留空则对外免密公开访问)</label>
          <input type="text" id="cfgClientApiKey" class="form-input" placeholder="留空则任何人可调用 /v1/*">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn" onclick="closeModal('configModal')">取消</button>
        <button class="btn btn-primary" onclick="submitConfig()">保存配置</button>
      </div>
    </div>
  </div>

  <!-- Modal: 在线测试 -->
  <div class="modal-backdrop" id="testModal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">💬 在线连通性与故障转移测试</div>
        <button class="btn btn-sm" onclick="closeModal('testModal')">✕</button>
      </div>
      <div class="modal-body">
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
        <button class="btn btn-primary" id="btnSendTest" onclick="runChatTest()">⚡ 发送流式对话测试</button>
      </div>
    </div>
  </div>

  <div id="toast"></div>

  <script>
    let poolData = { keys: [], config: {} };
    let currentFilter = 'all';
    const TOKEN_STORAGE_KEY = 'keypool_admin_key';

    function getAdminKey() {
      return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
    }

    function setAdminKey(key) {
      if (key) localStorage.setItem(TOKEN_STORAGE_KEY, key);
      else localStorage.removeItem(TOKEN_STORAGE_KEY);
    }

    function showToast(msg, isError = false) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.style.borderColor = isError ? 'var(--danger)' : 'var(--card-border)';
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 3000);
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
      if (!pwd) {
        showLoginView('请输入管理密钥');
        return;
      }
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
        showAppView();
        render();
      } catch (e) {
        if (!getAdminKey()) {
          showLoginView();
        } else {
          showLoginView('认证过期或密码错误');
        }
      }
    }

    function setFilter(filter, el) {
      currentFilter = filter;
      document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
      if (el) el.classList.add('active');
      renderTable();
    }

    function render() {
      const keys = poolData.keys || [];
      const config = poolData.config || {};

      let activeCount = 0;
      let exhaustedCount = 0;
      let invalidCount = 0;
      let totalSuccess = 0;
      let totalFail = 0;

      for (const k of keys) {
        if (k.disabled) continue;
        if (k.status === 'active') activeCount++;
        else if (k.status === 'exhausted') exhaustedCount++;
        else if (k.status === 'invalid') invalidCount++;
        totalSuccess += (k.successCount || 0);
        totalFail += (k.failCount || 0);
      }

      document.getElementById('statActive').textContent = activeCount;
      document.getElementById('statExhausted').textContent = exhaustedCount;
      document.getElementById('statInvalid').textContent = invalidCount;
      document.getElementById('statCalls').textContent = totalSuccess + ' / 失败 ' + totalFail;

      document.getElementById('countAll').textContent = keys.length;
      document.getElementById('countActive').textContent = activeCount;
      document.getElementById('countExhausted').textContent = exhaustedCount;
      document.getElementById('countInvalid').textContent = invalidCount;

      document.getElementById('hintTargetBase').textContent = config.targetBase || 'https://discovery-api.intern-ai.org.cn/v1';
      document.getElementById('hintModel').textContent = config.defaultModel || 'deepseek-v4-flash-0731';
      document.getElementById('apiEndpointBase').textContent = window.location.origin + '/v1';
      document.getElementById('hintClientApiKey').textContent = config.clientApiKey || '未设置 (免密访问)';

      // fill config fields
      document.getElementById('cfgTargetBase').value = config.targetBase || '';
      document.getElementById('cfgDefaultModel').value = config.defaultModel || '';
      document.getElementById('cfgMaxRetries').value = config.maxRetries || 5;
      document.getElementById('cfgAutoResetDays').value = config.autoResetDays || 7;
      document.getElementById('cfgClientApiKey').value = config.clientApiKey || '';

      renderTable();
    }

    function renderTable() {
      const tbody = document.getElementById('keysTableBody');
      const keys = poolData.keys || [];
      const filtered = keys.filter(k => {
        if (currentFilter === 'all') return true;
        return k.status === currentFilter;
      });

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 36px;">暂无匹配的 Key</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map(k => {
        let badgeHtml = '';
        if (k.disabled) {
          badgeHtml = '<span class="badge badge-disabled">⚪ 已停用</span>';
        } else if (k.status === 'active') {
          badgeHtml = '<span class="badge badge-active">🟢 活跃可用</span>';
        } else if (k.status === 'exhausted') {
          badgeHtml = '<span class="badge badge-exhausted">🟡 额度耗尽</span>';
        } else {
          badgeHtml = '<span class="badge badge-invalid">🔴 认证失败</span>';
        }

        const masked = k.key.length > 12 ? (k.key.slice(0, 7) + '...' + k.key.slice(-4)) : k.key;
        const lastUsed = k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString('zh-CN', { hour12: false }) : '从未';
        const msg = k.checkMessage || k.failReason || '-';

        return \`<tr>
          <td>\${badgeHtml}</td>
          <td style="font-weight: 500;">\${escapeHtml(k.name || '未命名')}</td>
          <td><span class="key-mono" title="点击复制完整 Key" onclick="copyText('\${k.key}')">\${masked}</span></td>
          <td><span style="color: #34d399;">\${k.successCount || 0}</span> / <span style="color: #f87171;">\${k.failCount || 0}</span></td>
          <td style="color: var(--text-muted); font-size: 12px;">\${lastUsed}</td>
          <td style="font-size: 12px; color: var(--text-muted);" title="\${escapeHtml(msg)}">\${escapeHtml(msg)}</td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <button class="btn btn-sm btn-primary" onclick="probeSingle('\${k.id}')">测活</button>
              <button class="btn btn-sm" onclick="toggleKey('\${k.id}')">\${k.disabled ? '启用' : '禁用'}</button>
              \${k.status !== 'active' ? \`<button class="btn btn-sm btn-warning" onclick="reviveSingle('\${k.id}')">设为活跃</button>\` : ''}
              <button class="btn btn-sm btn-danger" onclick="deleteKey('\${k.id}')">删除</button>
            </div>
          </td>
        </tr>\`;
      }).join('');
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function copyText(txt) {
      if (!txt || txt.includes('未设置')) return;
      navigator.clipboard.writeText(txt).then(() => showToast('已复制到剪贴板！'));
    }

    async function submitImport() {
      const text = document.getElementById('importTextarea').value.trim();
      if (!text) return showToast('请输入要导入的内容', true);
      try {
        const res = await apiReq('/keys/import', 'POST', { text });
        showToast(\`成功导入 \${res.importedCount} 个 Key (忽略 \${res.ignoredCount} 个重复)\`);
        closeModal('importModal');
        document.getElementById('importTextarea').value = '';
        fetchData();
      } catch (e) {
        showToast('导入失败: ' + e.message, true);
      }
    }

    async function probeSingle(id) {
      showToast('正在测试 Key 连通性...');
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
      showToast('正在全量测活，请稍候...');
      try {
        const res = await apiReq('/keys/probe', 'POST', { all: true });
        showToast(\`全量测活完成: \${res.activeCount} 活跃, \${res.exhaustedCount} 耗尽, \${res.invalidCount} 错误\`);
        fetchData();
      } catch (e) {
        showToast('全量测活失败: ' + e.message, true);
      } finally {
        btn.disabled = false;
        btn.textContent = '⚡ 一键测活全量';
      }
    }

    async function reviveAllKeys() {
      if (!confirm('确定将所有【额度耗尽】状态的 Key 复活为【活跃】状态吗？')) return;
      try {
        const res = await apiReq('/keys/revive', 'POST', { all: true });
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

    async function submitConfig() {
      const body = {
        targetBase: document.getElementById('cfgTargetBase').value.trim(),
        defaultModel: document.getElementById('cfgDefaultModel').value.trim(),
        maxRetries: parseInt(document.getElementById('cfgMaxRetries').value, 10) || 5,
        autoResetDays: parseInt(document.getElementById('cfgAutoResetDays').value, 10) || 7,
        clientApiKey: document.getElementById('cfgClientApiKey').value.trim(),
      };
      const pwd = document.getElementById('cfgAdminPassword').value.trim();
      if (pwd) body.adminPassword = pwd;

      try {
        await apiReq('/config', 'POST', body);
        showToast('配置已保存！');
        closeModal('configModal');
        fetchData();
      } catch (e) {
        showToast('保存配置失败: ' + e.message, true);
      }
    }

    async function runChatTest() {
      const prompt = document.getElementById('testPrompt').value.trim();
      if (!prompt) return showToast('请输入测试提示词', true);

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
        if (clientKey) {
          headers['authorization'] = 'Bearer ' + clientKey;
        }

        const res = await fetch('/v1/chat/completions', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: poolData.config?.defaultModel || 'deepseek-v4-flash-0731',
            messages: [{ role: 'user', content: prompt }],
            stream: true,
          }),
        });

        const usedKey = res.headers.get('x-used-key') || '未知';
        if (!res.ok) {
          const err = await res.text();
          out.textContent = '❌ 调用失败 (HTTP ' + res.status + '):\\n' + err;
          meta.textContent = \`耗时: \${Date.now() - startTime}ms\`;
          btn.disabled = false;
          return;
        }

        out.textContent = '';
        meta.textContent = \`调度命中的 Key: \${usedKey} | 状态: 接收流式数据中...\`;

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
        meta.textContent = \`调度命中的 Key: \${usedKey} | 耗时: \${Date.now() - startTime}ms | 完成\`;
      } catch (e) {
        out.textContent = '❌ 网络异常: ' + e.message;
      } finally {
        btn.disabled = false;
        fetchData();
      }
    }

    // 页面启动检查
    if (!getAdminKey()) {
      showLoginView();
    } else {
      fetchData();
    }
  </script>
</body>
</html>
`
