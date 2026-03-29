const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

loadEnvFile(path.join(ROOT_DIR, ".env.local"));

const PORT = Number(process.env.PORT || 3000);
const BIGMODEL_API_KEY = process.env.BIGMODEL_API_KEY || "";
const BIGMODEL_BASE_URL =
  process.env.BIGMODEL_BASE_URL || "https://open.bigmodel.cn/api/coding/paas/v4";
const BIGMODEL_MODEL = process.env.BIGMODEL_MODEL || "GLM-4.7";
const BIGMODEL_USE_MOCK = process.env.BIGMODEL_USE_MOCK === "1";

const SYSTEM_PROMPT = `
你是一个面向复杂机电系统问题的“工程技术决策系统”，由 CTO 角色统一调度以下四名专家：

1. 电机设计工程师：负责电磁设计、绕组拓扑、热管理、磁路与材料。
2. 结构工程师：负责强度、刚度、有限元分析、公差链、装配与制造可行性。
3. 齿轮工程师：负责齿形设计、接触疲劳、啮合误差、润滑与传动效率。
4. NVH 工程师：负责模态、频响、振动传递、噪声机理与声品质优化。

你的工作要求：
- 以 CTO 视角先做问题拆解，再决定单专家处理还是多专家协同会诊。
- 如果是跨领域问题，必须模拟多专家对话，体现约束冲突与权衡。
- 所有建议要尽量引用物理公式、工程逻辑、经验边界、行业标准或仿真方法。
- 输出必须适配网页渲染，全部使用标准 Markdown。
- 公式必须使用 LaTeX，例如：$$f_m = \\frac{n z}{60}$$。
- 需要给出“结论背后的工程依据”，但不要输出隐式内部思维过程；请改为输出“关键假设、计算依据、推导步骤摘要、验证建议”。
- 如果信息不足，先列出缺失参数，再基于合理假设继续给出可执行方案。
- 回答尽量保持专业、清晰、结构化，适合用户在网页上连续追问。

输出结构必须优先遵循：

# 问题诊断
- 提取关键工况、约束与症状
- 明确缺失参数与当前假设

# 专家协同分析
## CTO 任务拆解
## 电机设计工程师
## 结构工程师
## 齿轮工程师
## NVH 工程师

# CTO 综合结论
- 多维度技术建议
- 关键公式与判断依据
- 潜在风险
- 验证与优化路径

# 建议下一步
- 给出用户下一轮应该补充的数据或建议做的试验/仿真
`.trim();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "POST" && url.pathname === "/api/chat") {
      await handleChat(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/model-test") {
      await handleModelTest(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, buildHealthPayload());
      return;
    }

    if (req.method === "GET") {
      await serveStatic(url.pathname, res);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed." });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, {
      error: "Server error.",
      detail: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

server.listen(PORT, () => {
  console.log(`Engineering Decision Web listening on http://localhost:${PORT}`);
});

async function handleChat(req, res) {
  const body = await readJsonBody(req);
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const history = Array.isArray(body.history) ? body.history : [];
  const context = isObject(body.context) ? body.context : {};

  if (!message) {
    sendJson(res, 400, { error: "Message is required." });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  if (BIGMODEL_USE_MOCK) {
    await streamMockAnswer(res, message, context);
    return;
  }

  if (!BIGMODEL_API_KEY) {
    writeSseEvent(res, "error", {
      message:
        "BIGMODEL_API_KEY 未配置。请在 .env.local 中设置后重试，或启用 BIGMODEL_USE_MOCK=1 进行界面联调。",
    });
    res.end();
    return;
  }

  const messages = buildMessages(history, message, context);

  const upstreamResponse = await fetch(`${BIGMODEL_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BIGMODEL_API_KEY}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: BIGMODEL_MODEL,
      temperature: 0.35,
      stream: true,
      messages,
    }),
  });

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    const errorText = await safeReadText(upstreamResponse);
    writeSseEvent(res, "error", {
      message: `模型请求失败 (${upstreamResponse.status})`,
      detail: errorText,
    });
    res.end();
    return;
  }

  await relayOpenAiStyleStream(upstreamResponse.body, res);
}

async function handleModelTest(req, res) {
  const body = await readJsonBody(req);
  const prompt =
    typeof body.prompt === "string" && body.prompt.trim()
      ? body.prompt.trim()
      : "请用一句话确认模型 API 联通正常，并给出当前测试目标是工程问答系统。";
  const startedAt = Date.now();

  if (BIGMODEL_USE_MOCK) {
    sendJson(res, 200, {
      ok: true,
      mock: true,
      latencyMs: Date.now() - startedAt,
      model: BIGMODEL_MODEL,
      baseUrl: BIGMODEL_BASE_URL,
      prompt,
      answer:
        "Mock 模式正常。当前页面、服务端代理与测试工具可用；填写真实 BIGMODEL_API_KEY 后可切换到实际 GLM-5.1 联调。",
      raw: {
        choices: [
          {
            message: {
              role: "assistant",
              content:
                "Mock 模式正常。当前页面、服务端代理与测试工具可用；填写真实 BIGMODEL_API_KEY 后可切换到实际 GLM-5.1 联调。",
            },
          },
        ],
      },
      health: buildHealthPayload(),
    });
    return;
  }

  if (!BIGMODEL_API_KEY) {
    sendJson(res, 400, {
      ok: false,
      error: "未配置 BIGMODEL_API_KEY，暂时无法发起真实模型测试。",
      health: buildHealthPayload(),
    });
    return;
  }

  try {
    const upstreamResponse = await fetch(`${BIGMODEL_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BIGMODEL_API_KEY}`,
      },
      body: JSON.stringify({
        model: BIGMODEL_MODEL,
        temperature: 0.2,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "你是一个 API 连通性测试助手。请简短确认是否工作正常，并回显用户测试目标。输出使用 Markdown。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const text = await safeReadText(upstreamResponse);
    let json = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!upstreamResponse.ok) {
      sendJson(res, upstreamResponse.status, {
        ok: false,
        error: `模型测试失败 (${upstreamResponse.status})`,
        detail: json || text,
        latencyMs: Date.now() - startedAt,
        health: buildHealthPayload(),
      });
      return;
    }

    const answer =
      json &&
      json.choices &&
      json.choices[0] &&
      json.choices[0].message &&
      typeof json.choices[0].message.content === "string"
        ? json.choices[0].message.content
        : "";

    sendJson(res, 200, {
      ok: true,
      mock: false,
      model: BIGMODEL_MODEL,
      baseUrl: BIGMODEL_BASE_URL,
      latencyMs: Date.now() - startedAt,
      prompt,
      answer,
      raw: json || text,
      health: buildHealthPayload(),
    });
  } catch (error) {
    sendJson(res, 502, {
      ok: false,
      error: "调用大模型接口时发生网络或网关错误。",
      detail: error instanceof Error ? error.message : "Unknown error",
      latencyMs: Date.now() - startedAt,
      health: buildHealthPayload(),
    });
  }
}

function buildMessages(history, message, context) {
  const normalizedHistory = history
    .filter(
      (item) =>
        isObject(item) &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
    )
    .slice(-10)
    .map((item) => ({
      role: item.role,
      content: item.content,
    }));

  const contextLines = Object.entries({
    "目标转矩": context.torque,
    "目标转速": context.speed,
    "噪声频率/阶次": context.noiseFrequency,
    "温升限制": context.temperatureRise,
    "结构约束": context.constraints,
    "材料/工艺": context.materials,
    "参考标准": context.standards,
    "期望交付": context.deliverable,
  })
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([label, value]) => `- ${label}: ${String(value).trim()}`);

  const userPayload = [
    "以下是网页用户提交的工程问题，请按 CTO + 多专家协同方式作答。",
    "",
    "## 用户原始问题",
    message,
  ];

  if (contextLines.length) {
    userPayload.push("", "## 已知工程参数", ...contextLines);
  }

  userPayload.push(
    "",
    "## 输出要求",
    "- 使用标准 Markdown。",
    "- 对关键判断写出公式、边界条件和工程含义。",
    "- 结尾给出下一步建议，便于用户继续追问。"
  );

  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...normalizedHistory,
    { role: "user", content: userPayload.join("\n") },
  ];
}

async function relayOpenAiStyleStream(stream, res) {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    for await (const chunk of stream) {
      buffer += decoder.decode(chunk, { stream: true });

      while (buffer.includes("\n\n")) {
        const boundary = buffer.indexOf("\n\n");
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        const lines = rawEvent.split("\n").filter(Boolean);
        for (const line of lines) {
          if (!line.startsWith("data:")) {
            continue;
          }

          const payload = line.slice(5).trim();
          if (!payload) {
            continue;
          }

          if (payload === "[DONE]") {
            writeSseEvent(res, "done", { done: true });
            res.end();
            return;
          }

          try {
            const json = JSON.parse(payload);
            const choice = json.choices && json.choices[0];
            const delta = choice && choice.delta ? choice.delta : {};
            const content = typeof delta.content === "string" ? delta.content : "";

            if (content) {
              writeSseEvent(res, "chunk", { content });
            }
          } catch (error) {
            writeSseEvent(res, "error", {
              message: "上游流式数据解析失败。",
              detail: error instanceof Error ? error.message : "Unknown parse error",
            });
            res.end();
            return;
          }
        }
      }
    }

    if (buffer.trim()) {
      try {
        const payload = buffer.replace(/^data:\s*/, "").trim();
        if (payload && payload !== "[DONE]") {
          const json = JSON.parse(payload);
          const choice = json.choices && json.choices[0];
          const delta = choice && choice.delta ? choice.delta : {};
          const content = typeof delta.content === "string" ? delta.content : "";
          if (content) {
            writeSseEvent(res, "chunk", { content });
          }
        }
      } catch (error) {
        writeSseEvent(res, "error", {
          message: "流尾部解析失败。",
          detail: error instanceof Error ? error.message : "Unknown parse error",
        });
      }
    }

    writeSseEvent(res, "done", { done: true });
    res.end();
  } catch (error) {
    writeSseEvent(res, "error", {
      message: "读取模型响应时中断。",
      detail: error instanceof Error ? error.message : "Unknown stream error",
    });
    res.end();
  }
}

async function streamMockAnswer(res, message, context) {
  const sample = `
# 问题诊断

- 当前问题聚焦于：${message}
- 已知边界条件包括转矩、转速、频率、温升和结构约束等输入项。
- 若要提高诊断精度，建议补充齿数、轴承布置、模态频率、壳体材料厚度与测试工况。

# 专家协同分析

## CTO 任务拆解

该问题同时涉及传动激励、结构路径和 NVH 响应，属于典型跨学科问题，需要多专家联合评估。

## 电机设计工程师

若电磁激励可能与结构模态耦合，需要校核电磁力波频率：

$$
f_e = k \\cdot f_{rot}
$$

其中 $f_{rot} = n / 60$，$k$ 为主要电磁阶次。若电磁激励与啮合频率或壳体模态相近，需通过槽极配比、PWM 策略或电流谐波抑制来降低耦合。

## 结构工程师

建议先做壳体-轴承座-支撑结构的模态分析，避免主要激励频率落在低阶模态附近。若壳体一阶弯曲模态接近激励峰值，可通过局部加强筋、壁厚重分配和连接刚度优化提升模态频率。

## 齿轮工程师

啮合频率的基础表达式为：

$$
f_m = \\frac{n z}{60}
$$

其中 $n$ 为转速，$z$ 为齿数。若存在啸叫，优先检查齿形修形、螺旋角误差、齿向载荷分布和接触斑。必要时通过微观修形降低传递误差 $TE$ 峰值。

## NVH 工程师

NVH 侧应结合阶次跟踪、瀑布图与运行模态分析识别主噪声路径。如果噪声峰值集中在固定阶次，优先排查啮合误差与结构共振；若宽频抬升，则需检查润滑、轴承和壳体辐射效率。

# CTO 综合结论

- 第一优先级：建立“激励源-传递路径-辐射响应”闭环，确认主导机制。
- 第二优先级：齿轮微观修形与轴承支撑刚度协同优化。
- 第三优先级：对壳体和安装点做模态避频设计。

## 潜在风险

- 单独加厚壳体可能导致重量上升且局部应力转移。
- 仅修改齿轮参数可能把峰值转移到其他转速区间。
- 电磁侧未同步检查时，可能出现新的耦合激励。

# 建议下一步

1. 提供实际齿数、传动比、峰值频率与阶次图。
2. 提供壳体 CAD/FEA 模态结果与轴承布置。
3. 说明是否已有台架噪声测试或接触斑数据。
`.trim();

  const segments = sample.split(/(\s+)/).filter(Boolean);
  for (const segment of segments) {
    writeSseEvent(res, "chunk", { content: segment });
    await delay(12);
  }
  writeSseEvent(res, "done", { done: true, mock: true, contextUsed: context });
  res.end();
}

async function serveStatic(pathname, res) {
  const normalizedPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const safePath = path.normalize(normalizedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden." });
    return;
  }

  let stat;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    sendJson(res, 404, { error: "Not found." });
    return;
  }

  const targetPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
  const ext = path.extname(targetPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(targetPath).pipe(res);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = stripWrappedQuotes(value);
    }
  }
}

function stripWrappedQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function writeSseEvent(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function buildHealthPayload() {
  return {
    ok: true,
    model: BIGMODEL_MODEL,
    baseUrl: BIGMODEL_BASE_URL,
    mock: BIGMODEL_USE_MOCK,
    configured: Boolean(BIGMODEL_API_KEY),
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
