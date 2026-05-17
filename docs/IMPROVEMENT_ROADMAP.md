# MindForge AI — 改进路线图

> 本文档列出项目当前缺失的关键技术结构，按优先级分为三个梯队。每个条目说明"缺什么"、"为什么缺"、"补什么结构"。

---

## 第一梯队：面试必补项（1-2 周）

### 1. 单元测试体系

**完成状态：** ✅ 已覆盖 9 个核心模块（208 用例，全部通过）

| 测试文件                    | 用例数 | 测试模块                                                                                                                                                             |
| --------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bayesianEngine.test.ts`    | 16     | calculateMastery、updateCognitiveState、calculateProxyEvidence、ASSESSMENT_PRESETS                                                                                   |
| `mindmapHelpers.test.ts`    | 30     | decodeHTMLEntities、countNodes、averageMastery、generateId、getMasteryColor、getMasteryLabel、flattenNodes、flattenNodesWithPaths、findNodePath、isSemanticDuplicate |
| `settingsStore.test.ts`     | 24     | Zustand store（localStorage persist、updateAISettings、clearAISettings）                                                                                             |
| `mindmapStore.test.ts`      | 38     | 核心 Store：节点增删改查、展开折叠、代码生成状态                                                                                                                     |
| `aiService.test.ts`         | 25     | AI 服务层（API 调用、流式响应）                                                                                                                                      |
| `assessmentService.test.ts` | 14     | 考核评分服务、题目生成 JSON 解析                                                                                                                                     |
| `memoryService.test.ts`     | 16     | token 估算、对话压缩逻辑                                                                                                                                             |
| `modelCapabilities.test.ts` | 23     | 模型能力规则引擎（OpenAI/Anthropic/DeepSeek/Local）                                                                                                                  |
| `promptEvaluator.test.ts`   | 19     | Prompt 质量自动化评估                                                                                                                                                |

### 2. 持续集成 (CI)

**完成状态：** ✅ 已配置

```
.github/workflows/
└── ci.yml           # push/PR: lint → format check → test → build
```

触发条件：push 到 `main`/`develop`、PR 到 `main`

### 3. 考核页面 (Quiz) 补全

**完成状态：** ✅ 已从静态占位重写为完整考核页面

支持功能：

- 5 种题型：选择题、判断题、填空题、简答题、编程题
- 三步流程：选题 → 答题 → 查看报告
- AI 题目生成 + 智能评分
- 掌握度报告 + 错题分析
- 仅考核未掌握知识点过滤

### 4. ESLint + Prettier + Husky

**完成状态：** ✅ 已配置

```
eslint.config.js       # ESLint flat config (v10)，集成 react-hooks + TypeScript
.prettierrc            # 格式化配置（semi、singleQuote、tabWidth等）
.husky/
└── pre-commit         # lint-staged：暂存文件自动 eslint --fix + prettier --write
```

新增 npm scripts：

```json
{
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "format": "prettier --check \"src/**/*.{ts,tsx,css,json}\"",
  "format:fix": "prettier --write \"src/**/*.{ts,tsx,css,json}\"",
  "prepare": "husky"
}
```

当前 lint 结果：

- **0 errors, 86 warnings**（已完成 error 清零目标）
- 均为 `@typescript-eslint/no-explicit-any` 和 `@typescript-eslint/no-unused-vars` 类型
- 不影响代码正确性，属于代码质量优化项

### 5. 配置与文档

**完成状态：** ✅ 已创建

| 文件                | 说明                                          |
| ------------------- | --------------------------------------------- |
| `vitest.config.ts`  | 测试运行配置（jsdom 环境、路径别名）          |
| `docs/TEST_FLOW.md` | 完整测试流程文档（自动化 + 手动 + 回归 + CI） |

### 6. Prompt 工程体系化

**完成状态：** ✅ 已从硬编码重构为模块化体系

```
src/config/
├── prompts/
│   ├── system-v1.ts             # 带版本号的 system prompt 定义
│   ├── refine-v1.ts
│   ├── explain-v1.ts
│   ├── reorganize-v1.ts
│   └── assessment-v1.ts
├── promptRegistry.ts            # 版本注册 + 回退机制
├── promptEvaluator.ts           # 自动化评估 prompt 质量（基于测试集）
└── fewShotExamples.ts           # Few-shot 示例库管理
```

---

## 第二梯队：AI 岗位亮点项（2-4 周）

### 7. 轻量后端 + 持久化

**完成状态：** ✅ 已实现（Express + SQLite 自建后端）

```
server/
├── src/
│   ├── index.ts                 # Express 启动 + CORS + 路由注册
│   ├── types/index.ts           # 共享类型定义
│   ├── db/
│   │   ├── schema.sql           # SQLite 建表（users/projects/memories/chat_histories）
│   │   ├── init.ts              # 数据库初始化（自动创建 data/mindforge.db）
│   │   └── repository.ts       # ProjectRepo / MemoryRepo / ChatRepo CRUD
│   ├── middleware/
│   │   └── auth.ts              # Bearer Token 认证中间件
│   ├── routes/
│   │   ├── projects.ts          # GET/POST/PUT/DELETE 项目 CRUD
│   │   ├── memories.ts          # GET/POST/DELETE 记忆管理
│   │   ├── chat.ts              # GET/POST 对话历史持久化
│   │   └── aiProxy.ts           # AI 请求代理（隐藏 API Key，支持 OpenAI/Anthropic/DeepSeek/Local）
│   └── services/
│       └── MemoryService.ts     # 导图→记忆提取、去重合并、摘要生成
├── .env.example                 # 环境变量模板
├── .gitignore
├── package.json
└── tsconfig.json
```

**支持的 AI 供应商：** OpenAI、Anthropic (Claude)、DeepSeek、Local (Ollama/LM Studio)

**技术路线：** 方案 B（自建后端，面试加分更多）✅

### 8. Embedding + RAG

**完成状态：** ✅ 已实现完整 RAG 管线

**已创建的结构（server 端）：**

```
server/src/
├── types/rag.ts                   # RAG 类型定义（ChunkRecord、RAGResult、EmbeddingResponse 等）
├── db/
│   ├── schema.sql                 # rag_chunks 表（含 embedding 字段）
│   └── ragRepository.ts          # chunks CRUD（创建、查询、删除、按项目/来源检索）
└── services/
    ├── ChunkService.ts            # 长文本分块（支持中英文句边界 → 覆盖 50 字符）
    ├── EmbeddingService.ts        # OpenAI / Local 双供应商嵌入生成（单条 + batch）
    ├── VectorStore.ts             # 内存向量索引（余弦相似度搜索、L2 距离）
    ├── Retriever.ts               # 语义检索编排（embed → search → format context）
    └── RAGPipeline.ts             # 顶级编排：全量/增量索引、检索、context 格式化
routes/
└── rag.ts                         # 5 个 REST 端点（reindex/query/query-formatted/stats/remove）
```

**API 端点：**

| 方法 | 路径                                  | 说明                               |
| ---- | ------------------------------------- | ---------------------------------- |
| POST | `/api/rag/reindex/:projectId`         | 全量重索引（导图+记忆+对话历史）   |
| POST | `/api/rag/query/:projectId`           | 语义检索（返回 chunks + score）    |
| POST | `/api/rag/query-formatted/:projectId` | 检索 + 格式化 system prompt 上下文 |
| GET  | `/api/rag/stats/:projectId`           | 索引统计（总量/来源分布）          |
| POST | `/api/rag/remove/:projectId`          | 删除指定来源的索引                 |

**技术路线已实现：**

- 嵌入 API：OpenAI `text-embedding-3-small`（默认）或本地模型（Ollama 兼容）
- 索引内容：导图节点 content/note/explanation、记忆 facts、对话历史
- 检索时机：`retrieveAndFormat()` 一键获取格式化上下文 → 注入 AI prompt
- 向量存储：内存索引（项目级 globalVectorStore），可通过 `ragRepo` 扩展为 LanceDB/ChromaDB
- 中英文分块：优先句边界（`。！？.!?\n`）→ 词边界 → 字符截断，默认 500 字符/块，50 字符重叠

### 9. Docker 容器化

**完成状态：** ✅ 已实现

```
Dockerfile                       # 前端：Node 22 build → Nginx 静态文件服务器
nginx.conf                       # 反向代理 /api/ → backend:3001 + SPA fallback
docker-compose.yml               # frontend (80) + backend (3001) + SQLite 持久化卷
.dockerignore                    # 排除 node_modules/dist/git 等
server/
├── Dockerfile                   # 后端：Node 22 build → production 运行
├── .dockerignore                # 排除 node_modules/dist/data
└── .env.example                 # API Key 环境变量模板
```

**启动方式：**

```bash
# 构建并启动所有服务
docker compose up --build

# 后台运行
docker compose up -d --build

# 停止
docker compose down
```

**架构说明：**

- Nginx 监听 80 端口，SPA fallback + gzip + 静态资源长效缓存
- `/api/` 路径反向代理到 backend:3001（Docker 内部网络）
- 后端 SQLite 数据通过 `mindforge-data` 命名卷持久化，容器重启不丢数据
- API Key 通过宿主环境变量传入（`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY`）
- 后端健康检查：`GET /api/rag/stats/dummy`

---

## 第三梯队：锦上添花（4-8 周，可选）

### 10. API Key 安全存储

**完成状态：** ✅ 已通过后端代理方案实现

`server/src/routes/aiProxy.ts`：前端请求不带 API Key → 后端附加服务端环境变量中的 Key → 转发 AI API → 返回结果

- 前端不再暴露 API Key
- 支持 OpenAI / Anthropic / DeepSeek / Local 四种供应商

### 11. 模型能力规则引擎

**完成状态：** ✅ 已实现

```
src/config/modelCapabilities.ts   # 基于规则的模式匹配引擎
```

- 自动识别 OpenAI o 系列 / GPT-5 Thinking / Claude 4.5+ / Claude 3.7 / DeepSeek V4 Pro / R1 等推理模型
- 动态适配：temperature 移除、system→developer role 转换、reasoning_effort/budget_tokens 控制
- 可扩展：新增模型只需追加规则条目，零侵入性
- 测试覆盖 23 个用例（覆盖主流推理模型）

### 12. 多模态支持

**当前状态：** 不能处理图片/PDF

**缺少的结构：**

```
src/services/
├── imageService.ts              # base64 编码 + 压缩后发送给 vision 模型
├── pdfService.ts                # PDF.js / langchain PDF loader 解析
└── audioService.ts              # Web Speech API 语音输入 + TTS 输出
```

### 13. PWA + 离线支持

**当前状态：** 无离线能力

**缺少的结构：**

```
public/
├── manifest.json                 # 安装到桌面元数据
├── service-worker.js             # Cache First + Network Fallback
└── icons/                        # 各种尺寸 icon
```

**技术路线：**

- `vite-plugin-pwa` 自动生成 service-worker + manifest
- 缓存策略：导图数据(IndexedDB) + AI 对话历史 + 静态资源(Cache Storage)
- 离线模式：无网络时读取缓存的导图，AI 功能提示"网络恢复后可用"

### 14. Token 用量监控

**当前状态：** 无用量统计

**缺少的结构：**

```
src/services/
├── usageTracker.ts              # 记录每次 AI 请求的 input/output token 数
└── usageStore.ts                # zustand store 持久化用量数据

src/pages/
└── UsageDashboard.tsx           # 用量可视化（日报/周报/月报、费用估算）
```

### 15. 代码质量修复

**当前状态：** 已有 ESLint 配置，但代码中有大量历史遗留问题

| 问题类型                                   | 数量        | 修复方向                                   |
| ------------------------------------------ | ----------- | ------------------------------------------ |
| `@typescript-eslint/no-explicit-any`       | 42 warnings | 补充类型定义                               |
| `react-hooks/purity`（Date.now in render） | 8 errors    | 迁移到 `useRef`/`useEffect`                |
| `@typescript-eslint/no-unused-vars`        | 10 warnings | 删除无用 import/变量                       |
| `react-hooks/set-state-in-effect`          | 2 errors    | 使用 `useEffect` cleanup 替代同步 setState |
| `prefer-const`                             | 2 errors    | `--fix` 自动修复                           |
| `no-useless-escape`                        | 3 errors    | 移除多余转义字符                           |
| `no-useless-assignment`                    | 1 error     | 删除无用赋值                               |
| `preserve-caught-error`                    | 2 errors    | catch 中添加 `cause` 或直接使用 `cause`    |

---

## 当前项目结构总览

```
mindforge-ai/
├── .github/workflows/
│   └── ci.yml                   # ✅ CI/CD 已配置
├── docs/
│   ├── IMPROVEMENT_ROADMAP.md   # 本文档
│   └── TEST_FLOW.md             # ✅ 测试流程文档
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── server/                      # ✅ Express + SQLite 后端
│   ├── src/
│   │   ├── index.ts             #    路由注册 + CORS
│   │   ├── types/
│   │   ├── db/                  #    schema, init, repository, ragRepository
│   │   ├── middleware/          #    auth.ts (Bearer Token)
│   │   ├── routes/              #    projects, memories, chat, aiProxy, rag
│   │   └── services/            #    MemoryService, RAG Pipeline (4 services)
│   ├── .env.example
│   └── package.json
├── src/
│   ├── __tests__/               # ✅ 9 个测试文件（208 用例）
│   │   ├── bayesianEngine.test.ts   # 16 ✅
│   │   ├── mindmapHelpers.test.ts   # 30 ✅
│   │   ├── settingsStore.test.ts    # 24 ✅
│   │   ├── mindmapStore.test.ts     # 38 ✅
│   │   ├── memoryService.test.ts    # 16 ✅
│   │   ├── assessmentService.test.ts# 14 ✅
│   │   ├── modelCapabilities.test.ts# 23 ✅
│   │   ├── promptEvaluator.test.ts  # 19 ✅
│   │   └── aiService.test.ts        # 25 ✅
│   ├── components/
│   │   ├── Assessment/          #    AssessmentModal.tsx
│   │   ├── Chat/                #    ChatPanel.tsx
│   │   └── MindMap/             #    MindMapView.tsx
│   ├── config/
│   │   ├── prompts/             # ✅ 模块化 Prompt 工程（6 文件）
│   │   ├── modelCapabilities.ts # ✅ 模型能力规则引擎
│   │   └── prompts.ts           # （旧文件，待迁移）
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── MapEditor.tsx
│   │   ├── Quiz.tsx                # ✅ 已重写为完整考核页面
│   │   ├── Quiz.css               # ✅ 新增样式
│   │   └── Settings.tsx
│   ├── services/
│   │   ├── aiService.ts         # ✅ AI 服务层
│   │   ├── assessmentService.ts # ✅ 考核服务
│   │   └── memoryService.ts     # ✅ 记忆服务
│   ├── stores/
│   │   ├── settingsStore.ts     # ✅ 设置 Store
│   │   ├── mindmapStore.ts      # ✅ 导图状态 Store
│   │   └── memoryStore.ts
│   ├── types/
│   ├── utils/
│   │   └── mindmapHelpers.ts    # ✅ 导图工具函数
│   └── ...
├── eslint.config.js             # ✅ ESLint v10 flat config
├── .prettierrc                  # ✅ Prettier 配置
├── .husky/pre-commit            # ✅ lint-staged
├── vitest.config.ts             # ✅ 测试配置
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 执行建议

```
第一梯队（已完成 ✅）：
  ✅ 单元测试体系（9 个测试文件，208 用例）
  ✅ ESLint + Prettier + Husky + lint-staged
  ✅ CI (GitHub Actions)
  ✅ 考核页面完整重写
  ✅ 配置文档（vitest + TEST_FLOW）
  ✅ Prompt 工程体系化（模块化体系）

第一梯队待补（必须做）：
  ✅ 修复 7 个失败测试用例（modelCapabilities 5 + aiService 2）
  ✅ 修复 ESLint errors（21 个 error 降为 0）

第二梯队（已完成 ✅）：
  ✅ 后端持久化 (Express + SQLite)
  ✅ API Key 安全存储（后端代理 aiProxy.ts）
  ✅ RAG 向量检索管线 (ChunkService → Embedding → VectorStore → Retriever → RAGPipeline)
  ✅ 模型能力规则引擎
  ✅ Docker 容器化 (Dockerfile + nginx + docker-compose)

第三梯队（锦上添花，时间充裕再做）：
  - 多模态支持 (图片/PDF/语音)
  - PWA + 离线支持
  - Token 用量监控仪表盘
```
