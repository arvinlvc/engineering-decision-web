const STORAGE_KEYS = {
  history: "engineering-decision-history",
  context: "engineering-decision-context",
};

const state = {
  history: [],
  pending: false,
  testingModel: false,
};

const elements = {
  composer: byId("composer"),
  messages: byId("messages"),
  statusLine: byId("status-line"),
  question: byId("question"),
  submitButton: byId("submit-button"),
  fillDemo: byId("fill-demo"),
  exportHtml: byId("export-html"),
  clearHistory: byId("clear-history"),
  quickPrompts: byId("quick-prompts"),
  refreshHealth: byId("refresh-health"),
  modelTestForm: byId("model-test-form"),
  modelTestPrompt: byId("model-test-prompt"),
  runModelTest: byId("run-model-test"),
  testResult: byId("test-result"),
  healthModel: byId("health-model"),
  healthMode: byId("health-mode"),
  healthConfigured: byId("health-configured"),
  healthBaseUrl: byId("health-base-url"),
  sessionTurns: byId("session-turns"),
  sessionResponses: byId("session-responses"),
  sessionNote: byId("session-note"),
  fields: {
    torque: byId("torque"),
    speed: byId("speed"),
    noiseFrequency: byId("noiseFrequency"),
    temperatureRise: byId("temperatureRise"),
    constraints: byId("constraints"),
    materials: byId("materials"),
    standards: byId("standards"),
    deliverable: byId("deliverable"),
  },
};

const DEMO_CONTEXT = {
  torque: "180 N·m",
  speed: "8000 rpm",
  noiseFrequency: "1250 Hz / 16.7 阶",
  temperatureRise: "< 70 C",
  constraints: "一级减速器外径不可增加，轴向空间仅允许增加 4 mm，总成质量增量 < 6%",
  materials: "20CrMnTi 渗碳淬火齿轮，ADC12 壳体，6208 轴承",
  standards: "ISO 6336, ISO 281, ISO 1940",
  deliverable: "输出问题诊断、专家协同分析、风险清单与验证路径",
};

bootstrap();

function bootstrap() {
  configureMarkdown();

  if (elements.messages) {
    initWorkspacePage();
  }

  if (elements.modelTestForm) {
    initDiagnosticsPage();
  }
}

function initWorkspacePage() {
  restoreContext();
  restoreConversation();
  updateSessionSummary();

  if (!state.history.length) {
    renderEmptyState();
  }

  elements.composer.addEventListener("submit", onSubmit);
  if (elements.fillDemo) {
    elements.fillDemo.addEventListener("click", fillDemoData);
  }
  if (elements.quickPrompts) {
    elements.quickPrompts.addEventListener("click", onQuickPromptClick);
  }
  if (elements.exportHtml) {
    elements.exportHtml.addEventListener("click", exportConversationHtml);
  }
  if (elements.clearHistory) {
    elements.clearHistory.addEventListener("click", clearHistory);
  }

  Object.values(elements.fields)
    .filter(Boolean)
    .forEach((field) => field.addEventListener("input", persistContext));
}

function initDiagnosticsPage() {
  elements.refreshHealth.addEventListener("click", loadHealth);
  elements.modelTestForm.addEventListener("submit", onModelTestSubmit);
  loadHealth();
}

function configureMarkdown() {
  if (!window.marked) {
    return;
  }

  window.marked.setOptions({
    breaks: true,
    gfm: true,
  });
}

function fillDemoData() {
  Object.entries(DEMO_CONTEXT).forEach(([key, value]) => {
    if (elements.fields[key]) {
      elements.fields[key].value = value;
    }
  });

  persistContext();

  if (elements.question) {
    elements.question.value =
      "在 180 N·m / 8000 rpm 工况下，一级减速器在 1250 Hz 处出现明显啸叫，外径与总重都不能增加，请给出跨齿轮、结构和 NVH 的优化路径。";
    elements.question.focus();
  }
}

function onQuickPromptClick(event) {
  const button = event.target.closest(".chip");
  if (!button || !elements.question) {
    return;
  }

  elements.question.value = button.textContent.trim();
  elements.question.focus();
}

async function onSubmit(event) {
  event.preventDefault();
  if (state.pending) {
    return;
  }

  const message = elements.question.value.trim();
  if (!message) {
    return;
  }

  clearEmptyState();
  const context = getContext();
  const historySnapshot = state.history.slice();
  const userTimestamp = Date.now();

  appendMessage("user", message, userTimestamp);
  const assistantMessage = appendMessage("assistant", "", Date.now());

  setPending(true, "CTO 正在拆解问题并召集专家…");
  elements.question.value = "";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        context,
        history: historySnapshot,
      }),
    });

    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "请求失败，请稍后重试。");
    }

    await consumeEventStream(response.body, (eventName, payload) => {
      if (eventName === "chunk" && typeof payload.content === "string") {
        assistantMessage.raw += payload.content;
        renderMessageContent(assistantMessage);
        elements.statusLine.textContent = "多专家正在协同论证…";
      }

      if (eventName === "error") {
        throw new Error(payload.message || "模型请求失败。");
      }
    });

    state.history.push({ role: "user", content: message, ts: userTimestamp });
    state.history.push({ role: "assistant", content: assistantMessage.raw, ts: assistantMessage.ts });
    persistHistory();
    updateSessionSummary();
    elements.statusLine.textContent = "已生成 CTO 综合方案，可继续追问";
  } catch (error) {
    assistantMessage.raw =
      `### 请求失败\n\n${error instanceof Error ? error.message : "未知错误"}\n\n请检查服务端配置后重试。`;
    assistantMessage.element.classList.add("error-banner");
    renderMessageContent(assistantMessage);
    elements.statusLine.textContent = "本次会诊失败";
  } finally {
    setPending(false);
    scrollMessagesToBottom();
  }
}

async function onModelTestSubmit(event) {
  event.preventDefault();
  if (state.testingModel) {
    return;
  }

  const prompt = elements.modelTestPrompt.value.trim();
  setTestingState(true);
  renderModelTestLoading();

  try {
    const response = await fetch("/api/model-test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    const payload = await response.json().catch(() => ({}));
    renderModelTestResult(payload, response.ok);
    if (payload.health) {
      applyHealth(payload.health);
    } else {
      await loadHealth();
    }
  } catch (error) {
    renderModelTestResult(
      {
        ok: false,
        error: error instanceof Error ? error.message : "未知错误",
      },
      false
    );
  } finally {
    setTestingState(false);
  }
}

function getContext() {
  return Object.fromEntries(
    Object.entries(elements.fields).map(([key, element]) => [key, element ? element.value.trim() : ""])
  );
}

function persistContext() {
  sessionStorage.setItem(STORAGE_KEYS.context, JSON.stringify(getContext()));
}

function restoreContext() {
  const raw = sessionStorage.getItem(STORAGE_KEYS.context);
  if (!raw) {
    return;
  }

  try {
    const context = JSON.parse(raw);
    Object.entries(context).forEach(([key, value]) => {
      if (elements.fields[key] && typeof value === "string") {
        elements.fields[key].value = value;
      }
    });
  } catch {
    sessionStorage.removeItem(STORAGE_KEYS.context);
  }
}

function persistHistory() {
  sessionStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.history));
}

function restoreConversation() {
  const raw = sessionStorage.getItem(STORAGE_KEYS.history);
  if (!raw) {
    return;
  }

  try {
    const items = JSON.parse(raw);
    if (!Array.isArray(items) || !items.length) {
      return;
    }

    state.history = items.filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
    );

    elements.messages.innerHTML = "";
    state.history.forEach((item) => appendMessage(item.role, item.content, item.ts));
    elements.statusLine.textContent = "已恢复上一轮会话";
  } catch {
    sessionStorage.removeItem(STORAGE_KEYS.history);
  }
}

function clearHistory() {
  state.history = [];
  sessionStorage.removeItem(STORAGE_KEYS.history);
  elements.messages.innerHTML = "";
  renderEmptyState();
  updateSessionSummary();
  elements.statusLine.textContent = "历史已清除，可以重新开始问答";
  if (elements.question) {
    elements.question.focus();
  }
}

function updateSessionSummary() {
  if (!elements.sessionTurns || !elements.sessionResponses || !elements.sessionNote) {
    return;
  }

  const turns = state.history.filter((item) => item.role === "user").length;
  const responses = state.history.filter((item) => item.role === "assistant").length;

  elements.sessionTurns.textContent = String(turns);
  elements.sessionResponses.textContent = String(responses);
  elements.sessionNote.textContent =
    turns === 0
      ? "当前没有历史问答，适合从一个新的工程问题开始。"
      : `当前会话已累积 ${turns} 轮提问。清除历史后会以全新会话重新开始。`;
}

function setPending(pending, statusText) {
  state.pending = pending;
  if (elements.submitButton) {
    elements.submitButton.disabled = pending;
    elements.submitButton.textContent = pending ? "会诊中…" : "发起会诊";
  }
  if (elements.exportHtml) {
    elements.exportHtml.disabled = pending;
  }
  if (elements.clearHistory) {
    elements.clearHistory.disabled = pending;
  }
  if (statusText && elements.statusLine) {
    elements.statusLine.textContent = statusText;
  }
}

function setTestingState(testing) {
  state.testingModel = testing;
  if (elements.runModelTest) {
    elements.runModelTest.disabled = testing;
    elements.runModelTest.textContent = testing ? "测试中…" : "测试模型 API";
  }
  if (elements.refreshHealth) {
    elements.refreshHealth.disabled = testing;
  }
}

function appendMessage(role, raw, timestamp = Date.now()) {
  const wrapper = document.createElement("article");
  wrapper.className = `message ${role}`;

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.innerHTML = `
    <span class="message-role">${role === "user" ? "User" : "CTO / Experts"}</span>
    <span>${formatMessageTimestamp(new Date(timestamp))}</span>
  `;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  wrapper.append(meta, bubble);
  elements.messages.appendChild(wrapper);

  const message = {
    role,
    raw,
    ts: timestamp,
    bubble,
    element: wrapper,
  };

  renderMessageContent(message);
  scrollMessagesToBottom();
  return message;
}

function exportConversationHtml() {
  if (!state.history.length) {
    window.alert("当前没有可导出的对话记录。请先完成至少一轮问答。");
    return;
  }

  const context = getContext();
  const exportedAt = new Date();
  const fileName = `engineering-session-${formatFileTimestamp(exportedAt)}.html`;
  const html = buildExportHtmlDocument({
    context,
    history: state.history,
    exportedAt,
  });

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  if (elements.statusLine) {
    elements.statusLine.textContent = "已导出网页会诊记录";
  }
}

function renderMessageContent(message) {
  const html = renderMarkdown(message.raw || (message.role === "assistant" ? "_等待模型输出…_" : ""));
  message.bubble.innerHTML = html;
  typesetMath(message.bubble);
}

function renderMarkdown(content) {
  if (!content) {
    return "<p></p>";
  }

  if (window.marked) {
    return window.marked.parse(content);
  }

  return escapeHtml(content).replace(/\n/g, "<br />");
}

function typesetMath(container) {
  if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
    window.MathJax.typesetPromise([container]).catch(() => {});
  }
}

async function consumeEventStream(stream, onEvent) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (buffer.includes("\n\n")) {
      const boundary = buffer.indexOf("\n\n");
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const eventName = getEventName(block);
      const data = getEventData(block);
      if (!eventName || !data) {
        continue;
      }

      const payload = JSON.parse(data);
      if (eventName === "done") {
        return;
      }
      onEvent(eventName, payload);
    }
  }
}

function getEventName(block) {
  const line = block
    .split("\n")
    .find((item) => item.startsWith("event:"));
  return line ? line.slice(6).trim() : "";
}

function getEventData(block) {
  const line = block
    .split("\n")
    .find((item) => item.startsWith("data:"));
  return line ? line.slice(5).trim() : "";
}

function renderEmptyState() {
  if (!elements.messages) {
    return;
  }

  elements.messages.innerHTML = `
    <div class="empty-state">
      <strong>等待首个工程问题</strong>
      在右侧补充工况与约束后，从下方输入你的问题。系统会输出包含问题诊断、专家协同分析、风险与验证路径的工程报告。
    </div>
  `;
}

function renderModelTestLoading() {
  if (!elements.testResult) {
    return;
  }

  elements.testResult.innerHTML = `
    <div class="empty-state compact-empty">
      <strong>正在测试模型 API</strong>
      正在从当前服务端配置发起探测，请稍候…
    </div>
  `;
}

function renderModelTestResult(payload, requestOk) {
  if (!elements.testResult) {
    return;
  }

  const isOk = Boolean(payload && payload.ok && requestOk);
  const summaryStatus = isOk ? "正常" : "失败";
  const latency = payload && typeof payload.latencyMs === "number" ? `${payload.latencyMs} ms` : "无";
  const mode =
    payload && payload.mock !== undefined
      ? payload.mock
        ? "Mock"
        : "Real API"
      : "未知";
  const answer = payload && typeof payload.answer === "string" ? payload.answer : payload.error || "无返回内容";
  const rawText = safeJson(payload && payload.raw !== undefined ? payload.raw : payload);

  elements.testResult.innerHTML = `
    <div class="result-summary">
      <div class="result-card">
        <span>状态</span>
        <strong class="${isOk ? "status-ok" : "status-error"}">${summaryStatus}</strong>
      </div>
      <div class="result-card">
        <span>模式</span>
        <strong>${escapeHtml(mode)}</strong>
      </div>
      <div class="result-card">
        <span>耗时</span>
        <strong>${escapeHtml(latency)}</strong>
      </div>
    </div>
    <div class="result-markdown">
      ${renderMarkdown(answer)}
    </div>
    <div class="result-raw">
      <pre>${escapeHtml(rawText)}</pre>
    </div>
  `;

  typesetMath(elements.testResult);
}

async function loadHealth() {
  try {
    const response = await fetch("/api/health");
    const payload = await response.json();
    applyHealth(payload);
  } catch (error) {
    applyHealth({
      model: "读取失败",
      mock: false,
      configured: false,
      baseUrl: error instanceof Error ? error.message : "读取失败",
    });
  }
}

function applyHealth(payload) {
  if (elements.healthModel) {
    elements.healthModel.textContent = payload.model || "未知";
  }
  if (elements.healthMode) {
    elements.healthMode.textContent = payload.mock ? "Mock 模式" : "真实接口";
  }
  if (elements.healthConfigured) {
    elements.healthConfigured.textContent = payload.configured ? "已配置" : "未配置";
  }
  if (elements.healthBaseUrl) {
    elements.healthBaseUrl.textContent = payload.baseUrl || "未知";
  }
}

function clearEmptyState() {
  if (!elements.messages) {
    return;
  }

  const empty = elements.messages.querySelector(".empty-state");
  if (empty) {
    empty.remove();
  }
}

function scrollMessagesToBottom() {
  if (!elements.messages) {
    return;
  }

  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function formatTimestamp(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMessageTimestamp(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFileTimestamp(date) {
  const parts = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ];
  return parts.join("");
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function byId(id) {
  return document.getElementById(id);
}

function buildExportHtmlDocument({ context, history, exportedAt }) {
  const contextEntries = Object.entries(context).filter(([, value]) => value);
  const renderedMessages = history
    .map((item, index) => {
      const title = item.role === "user" ? "用户问题" : "CTO / Experts";
      const content = renderMarkdown(item.content);
      const timestamp = item.ts ? formatTimestamp(new Date(item.ts)) : "未记录时间";
      return `
        <article class="export-message ${item.role}">
          <div class="export-meta">
            <span class="export-role">${escapeHtml(title)}</span>
            <span>第 ${index + 1} 条</span>
            <span>${escapeHtml(timestamp)}</span>
          </div>
          <div class="export-bubble">
            ${content}
          </div>
        </article>
      `;
    })
    .join("\n");

  const renderedContext = contextEntries.length
    ? contextEntries
        .map(
          ([key, value]) => `
            <div class="export-context-item">
              <span>${escapeHtml(contextLabel(key))}</span>
              <strong>${escapeHtml(value)}</strong>
            </div>
          `
        )
        .join("\n")
    : `
      <div class="export-context-item empty">
        <span>参数说明</span>
        <strong>本次导出时未填写工程边界条件。</strong>
      </div>
    `;

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Engineering Decision Session Export</title>
    <style>
      :root {
        --bg: #0a111c;
        --surface: #101a29;
        --surface-2: #152338;
        --line: rgba(148, 163, 184, 0.16);
        --text: #edf2fb;
        --muted: #9fb0c9;
        --accent: #a16207;
        --accent-soft: #dec393;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(41, 94, 168, 0.16), transparent 24%),
          linear-gradient(180deg, #0a111c 0%, #060b13 100%);
      }
      .export-shell {
        max-width: 1180px;
        margin: 0 auto;
        padding: 40px 24px 72px;
      }
      .export-header,
      .export-section {
        border: 1px solid var(--line);
        border-radius: 24px;
        background: linear-gradient(180deg, rgba(16, 26, 41, 0.96), rgba(10, 16, 27, 0.98));
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
      }
      .export-header {
        padding: 28px;
      }
      .export-header h1 {
        margin: 10px 0 0;
        font-size: 2rem;
        line-height: 1.05;
      }
      .export-eyebrow {
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 0.75rem;
        font-weight: 700;
      }
      .export-subtitle {
        margin: 14px 0 0;
        color: var(--muted);
        line-height: 1.7;
      }
      .export-meta-line {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 18px;
      }
      .export-pill {
        min-height: 38px;
        padding: 0 14px;
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        border: 1px solid rgba(161, 98, 7, 0.2);
        color: var(--accent-soft);
        background: rgba(255,255,255,0.03);
        font-size: 0.92rem;
      }
      .export-grid {
        display: grid;
        grid-template-columns: 340px minmax(0, 1fr);
        gap: 24px;
        margin-top: 24px;
      }
      .export-section {
        padding: 24px;
      }
      .export-section h2 {
        margin: 0 0 18px;
        font-size: 1.15rem;
      }
      .export-context-grid {
        display: grid;
        gap: 12px;
      }
      .export-context-item {
        display: grid;
        gap: 8px;
        padding: 14px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.03);
      }
      .export-context-item span {
        color: var(--muted);
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .export-context-item strong {
        font-size: 0.96rem;
        line-height: 1.55;
      }
      .export-messages {
        display: grid;
        gap: 18px;
      }
      .export-message {
        display: grid;
        gap: 10px;
      }
      .export-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        color: var(--muted);
        font-size: 0.82rem;
      }
      .export-role {
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.03);
        color: var(--text);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .export-bubble {
        padding: 20px;
        border-radius: 22px;
        border: 1px solid var(--line);
        background: var(--surface);
        overflow-wrap: anywhere;
      }
      .export-message.user .export-bubble {
        background: linear-gradient(145deg, #223e6a, #142744);
      }
      .export-message.assistant .export-bubble {
        background: linear-gradient(180deg, var(--surface-2), var(--surface));
      }
      .export-bubble h1,
      .export-bubble h2,
      .export-bubble h3,
      .export-bubble h4 {
        margin-top: 0;
        line-height: 1.18;
      }
      .export-bubble p,
      .export-bubble ul,
      .export-bubble ol,
      .export-bubble pre,
      .export-bubble table,
      .export-bubble blockquote {
        margin-top: 0;
      }
      .export-bubble pre,
      .export-bubble code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      .export-bubble pre {
        padding: 14px;
        border-radius: 14px;
        border: 1px solid var(--line);
        background: rgba(0,0,0,0.22);
        overflow: auto;
      }
      .export-bubble blockquote {
        margin-left: 0;
        padding-left: 14px;
        border-left: 3px solid rgba(161, 98, 7, 0.6);
      }
      .export-bubble table {
        width: 100%;
        border-collapse: collapse;
      }
      .export-bubble th,
      .export-bubble td {
        padding: 10px 12px;
        border: 1px solid var(--line);
        text-align: left;
      }
      @media (max-width: 900px) {
        .export-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
    <script>
      window.MathJax = {
        tex: {
          inlineMath: [["$", "$"], ["\\\\(", "\\\\)"]],
          displayMath: [["$$", "$$"], ["\\\\[", "\\\\]"]]
        }
      };
    </script>
    <script async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
  </head>
  <body>
    <div class="export-shell">
      <section class="export-header">
        <div class="export-eyebrow">Engineering Decision Web Export</div>
        <h1>工程会诊记录导出</h1>
        <p class="export-subtitle">
          导出内容包含当前工程边界条件与完整问答记录，适合存档、分享或作为后续技术评审输入。
        </p>
        <div class="export-meta-line">
          <span class="export-pill">导出时间：${escapeHtml(formatTimestamp(exportedAt))}</span>
          <span class="export-pill">问答轮次：${history.filter((item) => item.role === "user").length}</span>
          <span class="export-pill">专家答复：${history.filter((item) => item.role === "assistant").length}</span>
        </div>
      </section>

      <div class="export-grid">
        <section class="export-section">
          <h2>工程参数摘要</h2>
          <div class="export-context-grid">
            ${renderedContext}
          </div>
        </section>

        <section class="export-section">
          <h2>完整会诊记录</h2>
          <div class="export-messages">
            ${renderedMessages}
          </div>
        </section>
      </div>
    </div>
  </body>
</html>`;
}

function contextLabel(key) {
  const labels = {
    torque: "目标转矩",
    speed: "目标转速",
    noiseFrequency: "噪声频率/阶次",
    temperatureRise: "温升限制",
    constraints: "结构约束",
    materials: "材料/工艺",
    standards: "参考标准",
    deliverable: "期望交付",
  };
  return labels[key] || key;
}
