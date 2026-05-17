<div align="center">

# MindForge AI 🧠

**AI 驱动的交互式思维导图学习助手**

_不止是绘图工具——更是你的智能学习协作者。_

<br />

[![Status](https://img.shields.io/badge/状态-开发中-orange?style=flat-square)]()
[![License](https://img.shields.io/badge/许可-MIT-blue?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/前端-React_18-61DAFB?style=flat-square&logo=react)]()
[![TypeScript](https://img.shields.io/badge/语言-TypeScript-3178C6?style=flat-square&logo=typescript)]()
[![Node](https://img.shields.io/badge/后端-Node_22-339933?style=flat-square&logo=nodedotjs)]()
[![Tests](https://img.shields.io/badge/测试-208_通过-brightgreen?style=flat-square)]()
[![Code Style](https://img.shields.io/badge/代码风格-Prettier-FF69B4?style=flat-square)]()

[English](README.md) · **中文**

</div>

---

## 目录

- [项目介绍](#-项目介绍)
- [为什么选择 MindForge AI？](#-为什么选择-mindforge-ai)
- [核心特性](#-核心特性)
  - [流式响应与动态渲染](#-流式响应与动态渲染)
  - [协作式 AI 技能系统](#-协作式-ai-技能系统)
  - [智能记忆引擎](#-智能记忆引擎)
  - [贝叶斯认知追踪](#-贝叶斯认知追踪)
  - [自适应考核系统](#-自适应考核系统)
- [项目架构](#-项目架构)
- [技术栈](#-技术栈)
- [快速开始](#-快速开始)
  - [仅前端模式](#仅前端模式)
  - [完整本地部署](#完整本地部署)
  - [Docker 生产部署](#docker-生产部署)
- [API 端点](#-api-端点)
- [测试](#-测试)
- [项目结构](#-项目结构)
- [路线图](#-路线图)
- [许可证](#-许可证)

---

## 💡 项目介绍

**MindForge AI** 将传统思维导图与大语言模型（LLM）深度融合，重新定义了知识管理的方式。不同于市面上任何一款思维导图工具，MindForge AI 不仅仅是一个"画布"，而是一个**能与您对话、主动评估您的理解、并跨会话记住上下文**的智能学习协作者。

### 核心理念

传统的思维导图工具是**被动的画布**——您画，它存。MindForge AI 是**主动的协作者**——它参与知识结构的搭建，发现你理解中的薄弱环节，并帮助你更高效地学习。

| 维度         | 传统思维导图       | MindForge AI                          |
| ------------ | ------------------ | ------------------------------------- |
| **创建方式** | 手动逐个添加节点   | 描述你想要的内容 → AI 自动生成知识树  |
| **理解评估** | 你自己回顾静态内容 | AI 主动出题测试，追踪每个概念的掌握度 |
| **记忆持久** | 保存为一个文件     | RAG 管线跨会话检索相关上下文          |
| **考核评估** | 无（只是一个图表） | 贝叶斯认知模型在每次回答后更新        |
| **交互方式** | 点击 + 打字        | 和思维导图自然对话                    |

### 适用场景

- 🎓 **学生与自学者**：构建任何学科的知识地图 → 让 AI 针对薄弱环节出题 → 追踪掌握度随时间的变化
- 📚 **研究人员**：将论文导入为思维导图 → 用 AI 细化分支 → 评估对复杂主题的理解程度
- 🏢 **团队协作**：共建项目知识库 → AI 总结决策并提取关键事实 → 跨会议持久化洞察
- 🧑‍🏫 **教育工作者**：创建互动式学习材料 → 学生以对话方式探索概念 → 自动生成考核报告

---

## 🤔 为什么选择 MindForge AI？

目前市面上的 AI 学习工具大多属于两类：

1. **聊天机器人**（ChatGPT、Claude）—— 回答问题的能力很强，但知识是短暂的。没有结构、没有持久化、无法可视化你知道什么和不知道什么。
2. **抽认卡/间隔重复应用**（Anki、Quizlet）—— 记忆效果不错，但它们不*理解*内容。它们测试的是回忆，而不是理解。

**MindForge AI 填补了这个空白**：它将 LLM 的对话深度与思维导图的结构清晰性相结合，并由认知科学（贝叶斯推断）和信息检索（RAG）驱动。结果是这样一个学习系统：

- **组织**知识层次化（思维导图结构）
- **评估**理解持续化（贝叶斯掌握度模型）
- **持久化**洞察跨会话（RAG 记忆）
- **自适应**每个学习者的节奏和薄弱点（AI 驱动的考核）

---

## ✨ 核心特性

### ⚡ 流式响应与动态渲染

| 能力               | 描述                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------- |
| **SSE 流式传输**   | 通过 Server-Sent Events 实现毫秒级延迟的 AI 推理流式传输。不再有阻塞等待——响应逐字出现。 |
| **动态节点生长**   | AI 生成的节点在画布上逐个"生长"出来，使用节流算法实现平滑的动画展开效果。                |
| **推理过程可视化** | 对于 DeepSeek-R1 / Claude 3.7 等思考模型，浮动"思维追踪器"实时透明展示模型的推理链。     |

### 🤖 协作式 AI 技能系统

| 能力             | 描述                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------- |
| **指令分发机制** | 基于插件的技能架构——AI 自动调用 `ADD_NODE`、`DELETE_NODE`、`RENAME_NODE` 等技能来操作导图。 |
| **知识持久化**   | `SAVE_EXPLAIN` 技能将深入的概念解释直接写入节点元数据。点击任意节点即可查看。               |
| **动态掌握度**   | `UPDATE_MASTERY` 技能评估对话交互，并实时更新每个概念的掌握度百分比（基于贝叶斯推断）。     |

### 🧠 智能记忆引擎

| 能力             | 描述                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------- |
| **对话压缩**     | 启发式 Token 估算 + 自动总结，克服长对话中的上下文窗口限制。                              |
| **核心见解提取** | `MEMORY_FLUSH` 从杂乱的对话中提取事实并将其提升为长期记忆。                               |
| **RAG 语义检索** | 完整的 RAG 管线（分块 → 嵌入 → 索引 → 检索 → 注入）跨会话向 AI 提示词注入相关历史上下文。 |

### 🔬 贝叶斯认知追踪

MindForge AI 将知识掌握度建模为 **Beta-Bernoulli 共轭先验**：

- **初始状态**：深度怀疑先验（每个概念约 5% 掌握度）。系统*假设*你不知道，需要证据才能变得自信。
- **证据模型**：每次回答（测验、对话或任务）后，AI 从 **4 个认知维度** 进行评估：
  - **记忆 (Recall)** — 能否准确提取定义和核心事实？
  - **理解 (Comprehension)** — 能否解释底层逻辑和原理？
  - **应用 (Application)** — 能否在实际场景中运用知识？
  - **分析 (Analysis)** — 能否进行跨知识的比较、对比和推理？

- **更新机制**：每个维度产生证据，更新 Beta 分布的 α/β 参数。积累足够证据后，期望值收敛到真实的掌握度水平。

- **语义匹配层**：标准化多样化的表达（`True` / `正确` / `对` / `1`），避免字面匹配偏差。

- **结果**：动态更新的"知识热力图"——节点背景颜色从 🔴 红色（低掌握度）→ 🟡 黄色（中等）→ 🟢 绿色（高掌握度），让你瞬间了解自己的优势和盲点。

### 🎯 自适应考核系统

| 能力               | 描述                                                                    |
| ------------------ | ----------------------------------------------------------------------- |
| **多格式测验**     | 选择题、判断题、填空题、简答题、编程题——全部基于思维导图内容自动生成。  |
| **自定义 AI 考官** | 选择人设（"面试官"、"导师"、"教授"）——AI 动态调整题目难度、风格和深度。 |
| **考核后报告**     | 每次考核后生成详细的诊断报告，包含四维评分条和 AI 综合学习建议。        |
| **未测概念过滤**   | 自动筛选仅考核掌握度低或无数据的知识点——高效间隔学习。                  |

---

## 🏗 项目架构

```
┌──────────────────────────────────────────────────┐
│                   浏览器                           │
│  ┌────────────────────────────────────────────┐   │
│  │  React SPA (Vite)                          │   │
│  │  ┌──────┐ ┌──────────┐ ┌───────────────┐  │   │
│  │  │ 对话  │ │ 思维导图  │ │   考核系统    │  │   │
│  │  └──┬───┘ └────┬─────┘ └───────┬───────┘  │   │
│  │     │           │               │           │   │
│  │  ┌──┴───────────┴───────────────┴───────┐  │   │
│  │  │      Zustand 状态管理                 │  │   │
│  │  │  (设置、思维导图、记忆)                  │  │   │
│  │  └──────────────────────────────────────┘  │   │
│  └─────────────────────┬──────────────────────┘   │
└────────────────────────┼──────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────┼──────────────────────────┐
│              Nginx 反向代理                        │
│              (端口 80 → /api → 后端)               │
└────────────────────────┼──────────────────────────┘
                         │
┌────────────────────────┼──────────────────────────┐
│  Express 服务器 (端口 3001)                         │
│  ┌───────────┐ ┌────────────┐ ┌────────────────┐  │
│  │ REST API  │ │ AI 代理    │ │ RAG 管线       │  │
│  │ (CRUD)    │ │ (4 供应商) │ │ (5 个服务)     │  │
│  └─────┬─────┘ └────────────┘ └───────┬────────┘  │
│        │                               │           │
│  ┌─────┴───────────────────────────────┴──────┐   │
│  │         SQLite (via better-sqlite3)        │   │
│  │         Docker 持久化卷                     │   │
│  └────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘


### 数据流

1. **用户创建/编辑思维导图** → 变更同步到 Zustand 状态 → 通过 REST API 持久化到 SQLite
2. **用户与 AI 对话** → 消息发送到 AI 代理 → 流式响应 → AI 调用技能（`ADD_NODE` 等）→ 导图实时更新
3. **用户参加考核** → 从导图节点生成题目 → 评估答案 → 贝叶斯掌握度更新 → 热力图重新渲染
4. **跨会话** → RAG 管线嵌入导图节点 + 记忆 + 对话历史 → 下次交互时语义检索相关上下文
```

---

## 🛠 技术栈

| 层级             | 技术                                                      |
| ---------------- | --------------------------------------------------------- |
| **前端框架**     | React 18, TypeScript, Vite                                |
| **状态管理**     | Zustand（持久化到 localStorage）                          |
| **思维导图渲染** | Markmap（基于 D3.js / SVG）                               |
| **样式**         | 纯 CSS（毛玻璃 + 霓虹渐变）                               |
| **后端运行时**   | Node.js 22, Express                                       |
| **数据库**       | 基于 better-sqlite3 的 SQLite                             |
| **认证**         | Bearer Token（中间件）                                    |
| **LLM 集成**     | OpenAI SDK, Anthropic SDK, DeepSeek API, Ollama/LM Studio |
| **AI 代理**      | 服务端代理隐藏客户端的 API Key                            |
| **嵌入向量**     | OpenAI `text-embedding-3-small`, 本地 (Ollama)            |
| **向量搜索**     | 内存余弦相似度 + L2 距离                                  |
| **文本分块**     | 句子感知切分（中文 + 英文）                               |
| **测试**         | Vitest, jsdom（208 个测试用例，零失败）                   |
| **代码质量**     | ESLint v10 flat config, Prettier, Husky, lint-staged      |
| **CI/CD**        | GitHub Actions（push/PR → lint → format → test → build）  |
| **容器化**       | Docker, Docker Compose                                    |

---

## 🚀 快速开始

### 仅前端模式

```bash
# 1. 克隆
git clone https://github.com/your-username/mindforge-ai.git
cd mindforge-ai

# 2. 安装依赖
npm install

# 3. 启动开发服务器（端口 5173）
npm run dev
```

打开 `http://localhost:5173`。在 **设置** 中配置 API Key → 应用将直接使用它从浏览器调用 LLM。

### 完整本地部署

```bash
# 终端 1 — 前端
npm install && npm run dev

# 终端 2 — 后端
cd server
npm install
cp .env.example .env   # 填入你的 API Key
npm run dev            # 启动在端口 3001
```

后端提供 AI 代理（前端永远不会看到 API Key）、持久化存储和 RAG 管线。前端开发服务器代理 `/api/*` 到 `localhost:3001`。

### Docker 生产部署

```bash
# 构建并启动所有服务
docker compose up --build

# 或后台运行
docker compose up -d --build

# 访问 http://localhost:80
```

**包含的组件**：
| 组件 | 端口 | 角色 |
|------|------|------|
| **Nginx** | 80 | 提供构建后的 SPA，gzip，静态缓存，代理 `/api/*` |
| **Express** | 3001 | REST API + AI 代理 + RAG 管线 |
| **SQLite** | — | 通过 Docker 命名卷持久化（`mindforge-data`） |

**环境变量**（通过 `-e` 或 `.env` 传入）：

```bash
OPENAI_API_KEY=sk-...       # 可选（仅使用 OpenAI 时需要）
ANTHROPIC_API_KEY=sk-ant-... # 可选（仅使用 Anthropic 时需要）
DEEPSEEK_API_KEY=sk-...     # 可选（仅使用 DeepSeek 时需要）
```

后端健康检查每 30 秒运行一次：`GET /api/rag/stats/dummy`。

---

## 📡 API 端点

### 项目管理

| 方法     | 路径                | 描述         |
| -------- | ------------------- | ------------ |
| `GET`    | `/api/projects`     | 列出所有项目 |
| `POST`   | `/api/projects`     | 创建新项目   |
| `PUT`    | `/api/projects/:id` | 更新项目     |
| `DELETE` | `/api/projects/:id` | 删除项目     |

### 记忆与对话

| 方法     | 路径                       | 描述           |
| -------- | -------------------------- | -------------- |
| `GET`    | `/api/memories/:projectId` | 列出项目记忆   |
| `POST`   | `/api/memories/:projectId` | 创建记忆       |
| `DELETE` | `/api/memories/:id`        | 删除记忆       |
| `GET`    | `/api/chat/:projectId`     | 获取对话历史   |
| `POST`   | `/api/chat/:projectId`     | 追加到对话历史 |

### AI 代理

| 方法   | 路径                | 描述                               |
| ------ | ------------------- | ---------------------------------- |
| `POST` | `/api/ai/openai`    | 代理到 OpenAI API                  |
| `POST` | `/api/ai/anthropic` | 代理到 Anthropic API               |
| `POST` | `/api/ai/deepseek`  | 代理到 DeepSeek API                |
| `POST` | `/api/ai/local`     | 代理到本地 LLM（Ollama/LM Studio） |

### RAG

| 方法   | 路径                                  | 描述                             |
| ------ | ------------------------------------- | -------------------------------- |
| `POST` | `/api/rag/reindex/:projectId`         | 全量重索引（导图 + 记忆 + 对话） |
| `POST` | `/api/rag/query/:projectId`           | 语义搜索（返回块 + 相关性分数）  |
| `POST` | `/api/rag/query-formatted/:projectId` | 搜索并格式化为系统提示上下文     |
| `GET`  | `/api/rag/stats/:projectId`           | 索引统计（总块数、来源分布）     |
| `POST` | `/api/rag/remove/:projectId`          | 删除指定来源的索引               |

---

## 🧪 测试

```bash
# 运行所有测试
npm test

# 监听模式
npm test -- --watch

# 查看覆盖率
npx vitest run --coverage
open coverage/index.html
```

**当前状态**：9 个测试文件 · **208 个测试用例 · 100% 通过**。

| 测试文件                    | 用例数 | 测试模块                           |
| --------------------------- | ------ | ---------------------------------- |
| `bayesianEngine.test.ts`    | 16     | 认知引擎（Beta-Bernoulli 推断）    |
| `mindmapHelpers.test.ts`    | 30     | 节点操作、路径查找、重复检测       |
| `settingsStore.test.ts`     | 24     | Zustand 状态持久化（localStorage） |
| `mindmapStore.test.ts`      | 38     | 完整 CRUD、展开/折叠、代码生成     |
| `aiService.test.ts`         | 25     | AI 服务（流式传输、错误处理）      |
| `assessmentService.test.ts` | 14     | 题目生成、JSON 解析                |
| `memoryService.test.ts`     | 16     | Token 估算、对话压缩               |
| `modelCapabilities.test.ts` | 23     | 模型规则引擎（推理模型检测）       |
| `promptEvaluator.test.ts`   | 19     | Prompt 质量评估                    |

---

## 📁 项目结构

```
mindforge-ai/
├── .github/workflows/
│   └── ci.yml                     # CI 管线（lint → format → test → build）
├── docs/
│   ├── IMPROVEMENT_ROADMAP.md     # 详细改进路线图
│   └── TEST_FLOW.md               # 测试指南与手动测试流程
├── server/                        # Express + SQLite 后端
│   ├── src/
│   │   ├── db/                    # Schema、init、repository、RAG repository
│   │   ├── middleware/            # Bearer Token 认证
│   │   ├── routes/                # 项目、记忆、对话、AI 代理、RAG
│   │   └── services/              # 记忆服务、RAG 管线（5 个服务）
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
├── src/                           # 前端源码
│   ├── __tests__/                 # 9 个测试文件（208 用例）
│   ├── components/                # React 组件
│   │   ├── Chat/                  # 对话面板（流式 UI）
│   │   ├── MindMap/               # 思维导图视图（D3.js 画布）
│   │   └── Assessment/            # 考核弹窗（测验 UI）
│   ├── config/
│   │   ├── prompts/               # 模块化 Prompt 工程（6 个文件）
│   │   ├── modelCapabilities.ts   # 模型能力规则引擎
│   │   └── promptEvaluator.ts     # Prompt 质量评估
│   ├── pages/                     # 仪表盘、导图编辑器、考核、设置
│   ├── services/                  # AI、考核、记忆服务
│   ├── stores/                    # Zustand 状态（设置、导图、记忆）
│   ├── types/                     # TypeScript 类型定义
│   └── utils/                     # 导图辅助函数、贝叶斯引擎
├── Dockerfile                     # 前端多阶段构建
├── docker-compose.yml             # 全栈 Docker 编排
├── nginx.conf                     # 反向代理配置
├── eslint.config.js               # ESLint v10 flat 配置
├── .prettierrc                    # 格式化配置
├── .husky/pre-commit              # lint-staged 钩子
├── vitest.config.ts               # 测试运行器配置
└── package.json
```

---

## 🗺 路线图

详细改进路线图请见 [docs/IMPROVEMENT_ROADMAP.md](docs/IMPROVEMENT_ROADMAP.md)（英文）。

### 已完成 ✅

**前端基础设施**

- [x] 单元测试套件（9 个文件，208 用例，100% 通过）
- [x] ESLint + Prettier + Husky + lint-staged（零错误）
- [x] CI（GitHub Actions — lint → format → test → build）
- [x] 考核页面完整重写（5 种题型 + AI 评分 + 掌握度报告）

**AI 与 Prompt 工程**

- [x] 模型能力规则引擎（自动适配推理模型参数）
- [x] 模块化 Prompt 工程系统（版本化 Prompt + 评估器）
- [x] 贝叶斯认知追踪（Beta-Bernoulli 掌握度模型）

**后端与数据**

- [x] Express + SQLite 持久化（项目、记忆、对话）
- [x] AI 代理（API Key 安全，4 种供应商支持）
- [x] RAG 管线（分块 → 嵌入 → 向量搜索 → 上下文注入）
- [x] Docker 容器化（前端 + 后端 + Nginx + Compose）

### 规划中 📋

- [ ] 多模态支持（图片 / PDF / 音频）
- [ ] PWA + 离线支持（Service Worker + IndexedDB）
- [ ] Token 用量监控仪表盘
- [ ] 额外测试覆盖（边界用例、集成测试、E2E）

---

## 📄 许可证

基于 **MIT 许可证** 分发。详见 [LICENSE](LICENSE) 文件。

---

<p align="center">
  <sub>由 MindForge Team 用 ❤️ 构建。</sub>
  <br />
  <sub>探索学习的未来。</sub>
  <br />
  <sub><a href="README.md">🇬🇧 English Version</a></sub>
</p>
