<div align="center">

# Engineering Decision Web

**机电系统工程决策平台 — CTO 调度 + 四专家协同的智能工程问答系统**

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GLM Powered](https://img.shields.io/badge/Powered%20by-GLM--4.7-6366f1?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMCIgY3k9IjEwIiByPSI4IiBmaWxsPSIjNjM2NmYxIi8+PC9zdmc+)](https://open.bigmodel.cn/)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg)](https://github.com)

[English](#english) · [功能特性](#-功能特性) · [快速开始](#-快速开始) · [界面预览](#-界面预览) · [技术架构](#-技术架构) · [API 文档](#-api-文档)

</div>

---

## 设计理念

在复杂机电系统开发中，一个问题往往同时涉及电磁设计、结构强度、齿轮传动和振动噪声多个学科领域。传统做法需要分别咨询不同领域专家、反复对齐约束条件、手工整合结论。

**Engineering Decision Web** 将这一流程搬上 Web：用户输入工程问题和工况边界，系统以 **CTO 视角自动拆解**，调度四位虚拟专家（电机设计、结构、齿轮、NVH）进行协同分析，输出带公式、风险与验证路径的结构化工程报告。

---

## ✨ 功能特性

### 多专家协同决策

| 角色 | 职责范围 |
|:---|:---|
| **CTO（调度器）** | 问题拆解、跨学科约束识别、冲突协调、综合结论 |
| **Motor（电机设计工程师）** | 电磁设计、绕组拓扑、热管理、磁路与材料 |
| **Structure（结构工程师）** | 强度、刚度、有限元分析、公差链、装配与制造可行性 |
| **Gear（齿轮工程师）** | 齿形设计、接触疲劳、啮合误差、润滑与传动效率 |
| **NVH（噪声振动工程师）** | 模态、频响、振动传递、噪声机理与声品质优化 |

### 核心能力

- **结构化参数面板** — 转矩、转速、频率、温升、结构约束、材料工艺等边界条件一键输入
- **流式实时回答** — Server-Sent Events 逐字推送，工程报告即时呈现
- **Markdown + LaTeX 渲染** — 支持公式如 $f_m = \frac{nz}{60}$ 的专业排版
- **服务端 API 代理** — 密钥安全存储于服务端，浏览器零暴露
- **Mock 离线模式** — 无需真实 API 即可验证完整界面与交互
- **多轮对话上下文** — 支持连续追问，自动携带历史记录
- **模型诊断工具** — 独立页面检测 API 联通状态、延迟与返回质量
- **一键导出** — 支持将问答内容导出为独立网页存档
- **响应式布局** — 适配桌面到平板各种屏幕尺寸

---

## 📸 界面预览

### 问答工作台

<img src="image/image.png" alt="问答工作台界面" width="100%">

主问答界面，左侧为实时对话区，右侧为工程参数面板与快捷提问。CTO 自动拆解问题并调度多专家协同分析，输出带公式和验证路径的结构化报告。

### 专家协同分析

<img src="image/image2.png" alt="专家协同分析" width="100%">

系统以 CTO 视角组织电机、结构、齿轮和 NVH 四位专家进行跨学科协同分析。每个专家给出独立判断，CTO 汇总权衡后输出综合结论。

### 模型诊断页

<img src="image/image3.png" alt="模型诊断页" width="100%">

独立的 API 诊断工具，用于验证模型配置、Base URL、延迟及返回原文，将接口问题和业务问题分离排查。

---

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 18（无其他依赖）
- 智谱开放平台 [API Key](https://open.bigmodel.cn/)（可选，支持 Mock 模式）

### 安装与启动

```bash
# 1. 克隆仓库
git clone https://github.com/your-username/engineering-decision-web.git
cd engineering-decision-web

# 2. 配置环境变量
cp .env.example .env.local
```

编辑 `.env.local`，填入你的智谱 API Key：

```bash
BIGMODEL_API_KEY=your_api_key_here
BIGMODEL_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4
BIGMODEL_MODEL=GLM-4.7
PORT=3000
BIGMODEL_USE_MOCK=0
```

```bash
# 3. 启动服务
npm start

# 4. 打开浏览器访问
# http://localhost:3000
```

### macOS 一键启动

双击项目根目录下的 `start.command`，自动完成以下操作：

1. 检查并创建 `.env.local` 配置文件
2. 若未配置 API Key，自动切换到 Mock 模式
3. 启动本地 Node 服务
4. 自动打开浏览器

### 开发模式

```bash
# 使用 --watch 热重载
npm run dev
```

---

## ⚙️ 配置说明

| 环境变量 | 说明 | 默认值 |
|:---|:---|:---|
| `BIGMODEL_API_KEY` | 智谱开放平台 API Key | 空（启用 Mock） |
| `BIGMODEL_BASE_URL` | 模型 API 地址 | `https://open.bigmodel.cn/api/coding/paas/v4` |
| `BIGMODEL_MODEL` | 模型名称 | `GLM-4.7` |
| `PORT` | 本地服务端口 | `3000` |
| `BIGMODEL_USE_MOCK` | Mock 模式开关 | `0` |

### Coding Plan 配置

如果你使用的是 **GLM Coding Plan** 编码套餐，推荐使用以下配置：

```bash
BIGMODEL_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4
BIGMODEL_MODEL=GLM-4.7
```

> ⚠️ 切勿使用通用 PAAS 地址 `https://open.bigmodel.cn/api/paas/v4`，该地址走通用计费链路，不抵扣 Coding Plan 套餐额度。

### Mock 模式

无需真实 API Key 即可完整体验界面和交互：

```bash
BIGMODEL_USE_MOCK=1
```

Mock 模式下系统会返回一份包含公式、多专家分析的示例报告，用于验证页面渲染和流式输出。

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (前端)                          │
│                                                             │
│  ┌──────────────────────┐  ┌────────────────────────────┐   │
│  │   问答工作台          │  │   模型诊断                  │   │
│  │   index.html         │  │   diagnostics.html          │   │
│  │   ├─ 对话流式渲染     │  │   ├─ API 健康检查           │   │
│  │   ├─ Markdown 渲染   │  │   ├─ 连通性测试             │   │
│  │   ├─ LaTeX 公式      │  │   └─ 延迟与原文展示         │   │
│  │   └─ 参数面板        │  └────────────────────────────┘   │
│  └──────────────────────┘                                    │
│           │ SSE                                              │
│           ▼                                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │               app.js (前端逻辑)                        │   │
│  │  ├─ 流式响应处理 (EventSource)                         │   │
│  │  ├─ Markdown → HTML (marked.js)                       │   │
│  │  ├─ LaTeX 渲染 (MathJax 3)                            │   │
│  │  ├─ 多轮对话历史管理                                    │   │
│  │  └─ 工程参数收集与提交                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP / SSE
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  server.js (Node.js 服务端)                   │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ 静态资源服务 │  │  GLM API 代理 │  │  SSE 流式转发    │   │
│  │ /public/*   │  │  密钥安全存储 │  │  逐 chunk 推送   │   │
│  └─────────────┘  └──────┬───────┘  └──────────────────┘   │
│                          │                                   │
│  ┌───────────────────────┴───────────────────────────────┐  │
│  │              Prompt 构建器                              │  │
│  │  ├─ CTO + 四专家 System Prompt                         │  │
│  │  ├─ 工程参数注入 (转矩/转速/频率/温升/约束...)          │  │
│  │  └─ 多轮对话历史截断 (最近 10 轮)                       │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              智谱开放平台 (GLM-4.7 API)                       │
│           open.bigmodel.cn                                   │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术 |
|:---|:---|
| **前端** | 原生 HTML / CSS / JavaScript，零框架依赖 |
| **排版** | [Marked.js](https://marked.js.org/) + [MathJax 3](https://www.mathjax.org/) |
| **字体** | Plus Jakarta Sans + IBM Plex Mono |
| **后端** | Node.js 原生 `http` 模块，零依赖 |
| **通信** | Server-Sent Events (SSE) 流式传输 |
| **AI 模型** | 智谱 GLM-4.7 (OpenAI 兼容接口) |

---

## 📡 API 文档

### POST `/api/chat`

发起工程问答，以 SSE 流式返回专家协同分析结果。

**请求体：**

```json
{
  "message": "在 8000 rpm 下，减速器啸叫出现在 1250 Hz，如何优化？",
  "context": {
    "torque": "180 N·m",
    "speed": "8000 rpm",
    "noiseFrequency": "1250 Hz",
    "temperatureRise": "65 C",
    "constraints": "轴向空间受限，外径不可增加",
    "materials": "20CrMnTi + ADC12 壳体",
    "standards": "ISO 6336, ISO 281",
    "deliverable": "给出风险、方案与验证路径"
  },
  "history": []
}
```

**SSE 事件流：**

| 事件 | 说明 |
|:---|:---|
| `chunk` | 内容增量，`{ "content": "..." }` |
| `done` | 流结束，`{ "done": true }` |
| `error` | 错误信息，`{ "message": "...", "detail": "..." }` |

### POST `/api/model-test`

测试模型 API 联通性（非流式），返回延迟、模型回答与原始 JSON。

**请求体：**

```json
{
  "prompt": "请确认模型 API 是否联通。"
}
```

### GET `/api/health`

返回服务健康状态与配置信息。

**响应示例：**

```json
{
  "ok": true,
  "model": "GLM-4.7",
  "baseUrl": "https://open.bigmodel.cn/api/coding/paas/v4",
  "mock": false,
  "configured": true
}
```

---

## 📂 项目结构

```
engineering-decision-web/
├── server.js              # Node.js 服务端：静态资源、GLM 代理、SSE 流式转发
├── package.json           # 项目配置（零外部依赖）
├── start.command          # macOS 一键启动脚本
├── .env.example           # 环境变量模板
├── image/                 # README 截图
│   ├── image.png          # 问答工作台
│   ├── image2.png         # 专家协同分析
│   └── image3.png         # 模型诊断页
└── public/                # 前端静态资源
    ├── index.html         # 问答工作台页面
    ├── diagnostics.html   # 模型诊断页面
    ├── styles.css         # 全局视觉系统
    └── app.js             # 前端交互与渲染逻辑
```

---

## 🎯 典型使用场景

1. **减速器啸叫诊断** — 输入转速、噪声频率和结构约束，获得跨齿轮、结构和 NVH 的优化路径
2. **电机电磁设计校核** — 提供槽极配比和温升限制，获得电磁力波频率耦合判断
3. **壳体模态避频** — 输入激励频率和壳体材料，获得加强筋和壁厚分配建议
4. **传动系统综合优化** — 输入扭矩提升目标和空间约束，获得齿轮修形与轴承刚度协同方案

---

## 🔒 安全说明

- API Key 仅存储在服务端 `.env.local` 文件中，永远不会发送到浏览器
- `.env.local` 已加入 `.gitignore`，不会被提交到版本库
- 静态文件服务内置路径遍历防护
- 请求体大小限制为 2MB

---

## 📄 License

[MIT](LICENSE)

---

<div align="center">

**Built for engineers who think across disciplines.**

</div>
