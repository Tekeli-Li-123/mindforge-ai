<div align="center">

# MindForge AI 🧠

**AI-powered interactive mind map learning assistant**

_Not just a diagram tool — your intelligent learning collaborator._

<br />

[![Status](https://img.shields.io/badge/Status-Development-orange?style=flat-square)]()
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/Frontend-React_18-61DAFB?style=flat-square&logo=react)]()
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript)]()
[![Node](https://img.shields.io/badge/Backend-Node_22-339933?style=flat-square&logo=nodedotjs)]()
[![Tests](https://img.shields.io/badge/Tests-208_passing-brightgreen?style=flat-square)]()
[![Code Style](https://img.shields.io/badge/Code_Style-Prettier-FF69B4?style=flat-square)]()

</div>

**English** · [中文](README.zh-CN.md)

---

## Table of Contents

- [Overview](#-overview)
- [Why MindForge AI?](#-why-mindforge-ai)
- [Features](#-features)
  - [Streaming & Dynamic Rendering](#-streaming--dynamic-rendering)
  - [Collaborative AI Skill System](#-collaborative-ai-skill-system)
  - [Intelligent Memory Engine](#-intelligent-memory-engine)
  - [Bayesian Cognitive Tracking](#-bayesian-cognitive-tracking)
  - [Adaptive Assessment](#-adaptive-assessment)
- [Project Architecture](#-project-architecture)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
  - [Frontend Only](#frontend-only)
  - [Full Stack (Local)](#full-stack-local)
  - [Docker (Production)](#docker-production)
- [API Endpoints](#-api-endpoints)
- [Testing](#-testing)
- [Project Structure](#-project-structure)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 💡 Overview

**MindForge AI** reimagines mind mapping by fusing it with large language models (LLMs). Instead of manually dragging and typing nodes, you **converse with your mind map** — AI listens, understands, and acts on your intent in real time.

**The core idea**: Traditional mind map tools are _passive canvases_ — you draw, they store. MindForge AI is an _active collaborator_ — it participates in structuring your knowledge, identifying gaps in your understanding, and helping you learn more effectively.

### What makes it different?

| Aspect            | Traditional Mind Maps         | MindForge AI                                            |
| ----------------- | ----------------------------- | ------------------------------------------------------- |
| **Creation**      | Manually add nodes one by one | Describe what you want → AI generates the tree          |
| **Understanding** | You review static content     | AI quizzes you and tracks mastery per concept           |
| **Memory**        | Saved as a file               | RAG pipeline retrieves relevant context across sessions |
| **Assessment**    | None (just a diagram)         | Bayesian cognitive model updates after each answer      |
| **Interaction**   | Click + type                  | Chat naturally with the map                             |

**Real-world use cases**:

- 🎓 **Students & self-learners**: Build a knowledge map of any subject → let AI quiz you on weak areas → track mastery over time
- 📚 **Researchers**: Import papers as mind maps → refine branches with AI → assess your understanding of complex topics
- 🏢 **Teams**: Collaborate on project knowledge bases → AI summarizes decisions and extracts key facts → persist insights across meetings
- 🧑‍🏫 **Educators**: Create interactive learning materials → students explore concepts conversationally → get automatic assessment reports

---

## 🤔 Why MindForge AI?

Most AI-powered learning tools fall into two categories:

1. **Chatbots** (ChatGPT, Claude) — Great for answering questions, but the knowledge is ephemeral. There's no structure, no persistence, no way to visualize what you know and don't know.
2. **Flashcard / Spaced Repetition apps** (Anki, Quizlet) — Great for memorization, but they don't _understand_ the content. They test recall, not comprehension.

**MindForge AI bridges the gap**: It combines the conversational depth of LLMs with the structural clarity of mind maps, powered by cognitive science (Bayesian inference) and information retrieval (RAG). The result is a learning system that:

- **Organizes** knowledge hierarchically (mind map structure)
- **Evaluates** understanding continuously (Bayesian mastery model)
- **Persists** insights across sessions (RAG memory)
- **Adapts** to each learner's pace and gaps (AI-driven assessment)

---

## ✨ Features

### ⚡ Streaming & Dynamic Rendering

| Capability              | Description                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **SSE Streaming**       | Millisecond-latency streaming of AI reasoning via Server-Sent Events. No more blocking waits — responses appear character by character.  |
| **Dynamic Node Growth** | AI-generated nodes appear on the canvas one-by-one as they are streamed, using a throttle algorithm for smooth, animated expansion.      |
| **Reasoning Overlay**   | For DeepSeek-R1 / Claude 3.7 thinking models, a floating "thought tracker" transparently shows the model's reasoning chain in real time. |

### 🤖 Collaborative AI Skill System

| Capability                | Description                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Instruction Dispatch**  | Plugin-based skill architecture — AI autonomously calls `ADD_NODE`, `DELETE_NODE`, `RENAME_NODE`, etc. to manipulate the map on your behalf. |
| **Knowledge Persistence** | `SAVE_EXPLAIN` skill writes deep concept explanations directly into node metadata. Tap any node to view them.                                |
| **Dynamic Mastery**       | `UPDATE_MASTERY` skill evaluates dialogue interactions and updates per-concept mastery percentages in real time using Bayesian inference.    |

### 🧠 Intelligent Memory Engine

| Capability                   | Description                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Conversation Compression** | Heuristic token estimation + automatic summarization to overcome context window limits in long dialogues.                           |
| **Core Insight Extraction**  | `MEMORY_FLUSH` extracts facts from chaotic conversations and promotes them to long-term memory.                                     |
| **RAG Semantic Retrieval**   | Full RAG pipeline (chunk → embed → index → retrieve → inject) surfaces relevant historical context into AI prompts across sessions. |

### 🔬 Bayesian Cognitive Tracking

MindForge AI models knowledge mastery as a **Beta-Bernoulli conjugate prior**:

- **Initial state**: Deep skepticism prior (~5% mastery per concept). The system _assumes_ you don't know, and requires evidence to become confident.
- **Evidence model**: After each answer (quiz, dialogue, or task), AI evaluates across **4 cognitive dimensions**:
  - **Recall** — Can you accurately retrieve definitions and core facts?
  - **Comprehension** — Can you explain the underlying logic and principles?
  - **Application** — Can you apply the knowledge in practical scenarios?
  - **Analysis** — Can you compare, contrast, and reason across knowledge boundaries?
- **Update mechanism**: Each dimension generates evidence that updates the Beta distribution's α/β parameters. After enough evidence, the expected value converges to the true mastery level.
- **Semantic matching layer**: Normalizes diverse expressions (`True` / `正确` / `对` / `1`) to avoid literal-matching bias.
- **Result**: A dynamically updating "knowledge heatmap" — node background colors shift from 🔴 red (low mastery) → 🟡 yellow (medium) → 🟢 green (high), giving you an instant visual of your strengths and blind spots.

### 🎯 Adaptive Assessment

| Capability                   | Description                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Multi-format Quiz**        | Multiple choice, true/false, fill-in-the-blank, short answer, and coding questions — all generated from your mind map content. |
| **Custom AI Examiner**       | Choose a persona ("Interviewer", "Tutor", "Professor") — the AI dynamically tailors question difficulty, style, and depth.     |
| **Post-Quiz Report**         | After each session, a detailed diagnostic report with 4-dimensional score bars and AI-synthesized learning recommendations.    |
| **Untested Concepts Filter** | Automatically filter to quiz only the concepts with low or no mastery data — efficient spaced learning.                        |

---

## 🏗 Project Architecture

```
┌──────────────────────────────────────────────────┐
│                   Browser                         │
│  ┌────────────────────────────────────────────┐   │
│  │  React SPA (Vite)                          │   │
│  │  ┌──────┐ ┌──────────┐ ┌───────────────┐  │   │
│  │  │ Chat │ │ Mind Map │ │ Assessment    │  │   │
│  │  └──┬───┘ └────┬─────┘ └───────┬───────┘  │   │
│  │     │           │               │           │   │
│  │  ┌──┴───────────┴───────────────┴───────┐  │   │
│  │  │      Zustand Stores                  │  │   │
│  │  │  (settings, mindmap, memory)          │  │   │
│  │  └──────────────────────────────────────┘  │   │
│  └─────────────────────┬──────────────────────┘   │
└────────────────────────┼──────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────┼──────────────────────────┐
│              Nginx Reverse Proxy                   │
│              (port 80 → /api → backend)            │
└────────────────────────┼──────────────────────────┘
                         │
┌────────────────────────┼──────────────────────────┐
│  Express Server (port 3001)                        │
│  ┌───────────┐ ┌────────────┐ ┌────────────────┐  │
│  │ REST API  │ │ AI Proxy   │ │ RAG Pipeline   │  │
│  │ (CRUD)    │ │ (4 vendors)│ │ (5 services)   │  │
│  └─────┬─────┘ └────────────┘ └───────┬────────┘  │
│        │                               │           │
│  ┌─────┴───────────────────────────────┴──────┐   │
│  │         SQLite (via better-sqlite3)        │   │
│  │         Persistent Volume (Docker)         │   │
│  └────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘


### Data Flow

1. **User creates/edits a mind map** → changes are synced to Zustand stores → persisted via REST API to SQLite
2. **User chats with AI** → message sent to AI proxy → streaming response → AI calls skills (`ADD_NODE`, etc.) → map updates in real time
3. **User takes a quiz** → questions generated from map nodes → answers evaluated → Bayesian mastery updated → heatmap re-renders
4. **Across sessions** → RAG pipeline embeds map nodes + memories + chat history → semantic search retrieves relevant context on next interaction
```

---

## 🛠 Tech Stack

| Layer                  | Technology                                                    |
| ---------------------- | ------------------------------------------------------------- |
| **Frontend Framework** | React 18, TypeScript, Vite                                    |
| **State Management**   | Zustand (persisted to localStorage)                           |
| **Mind Map Rendering** | Markmap (D3.js / SVG-based)                                   |
| **Styling**            | Vanilla CSS (Glassmorphism + Neon Gradients)                  |
| **Backend Runtime**    | Node.js 22, Express                                           |
| **Database**           | SQLite via better-sqlite3                                     |
| **Authentication**     | Bearer Token (middleware)                                     |
| **LLM Integration**    | OpenAI SDK, Anthropic SDK, DeepSeek API, Ollama/LM Studio     |
| **AI Proxy**           | Server-side proxy hides API keys from client                  |
| **Embeddings**         | OpenAI `text-embedding-3-small`, Local (Ollama)               |
| **Vector Search**      | In-memory cosine similarity + L2 distance                     |
| **Text Chunking**      | Sentence-aware splitting (Chinese + English)                  |
| **Testing**            | Vitest, jsdom (208 test cases, zero failures)                 |
| **Code Quality**       | ESLint v10 flat config, Prettier, Husky, lint-staged          |
| **CI/CD**              | GitHub Actions (push/PR → lint → format check → test → build) |
| **Containerization**   | Docker, Docker Compose                                        |

---

## 🚀 Quick Start

### Frontend Only

```bash
# 1. Clone
git clone https://github.com/your-username/mindforge-ai.git
cd mindforge-ai

# 2. Install
npm install

# 3. Start dev server (port 5173)
npm run dev
```

Open `http://localhost:5173`. Configure an API Key in **Settings** → the app will use it to call LLMs directly from your browser.

### Full Stack (Local)

```bash
# Terminal 1 — Frontend
npm install && npm run dev

# Terminal 2 — Backend
cd server
npm install
cp .env.example .env   # Fill in your API keys
npm run dev            # Starts on port 3001
```

The backend provides AI proxy (so the frontend never sees API keys), persistent storage, and the RAG pipeline. The frontend dev server proxies `/api/*` to `localhost:3001`.

### Docker (Production)

```bash
# Build & start all services
docker compose up --build

# Or run in background
docker compose up -d --build

# Access at http://localhost:80
```

**What's included**:
| Component | Port | Role |
|-----------|------|------|
| **Nginx** | 80 | Serves the built SPA, gzip, static caching, proxies `/api/*` |
| **Express** | 3001 | REST API + AI proxy + RAG pipeline |
| **SQLite** | — | Persisted via Docker named volume (`mindforge-data`) |

**Environment variables** (pass via `-e` or `.env`):

```bash
OPENAI_API_KEY=sk-...       # Optional (only if using OpenAI)
ANTHROPIC_API_KEY=sk-ant-... # Optional (only if using Anthropic)
DEEPSEEK_API_KEY=sk-...     # Optional (only if using DeepSeek)
```

The backend health check runs every 30s: `GET /api/rag/stats/dummy`.

---

## 📡 API Endpoints

### Project Management

| Method   | Path                | Description          |
| -------- | ------------------- | -------------------- |
| `GET`    | `/api/projects`     | List all projects    |
| `POST`   | `/api/projects`     | Create a new project |
| `PUT`    | `/api/projects/:id` | Update a project     |
| `DELETE` | `/api/projects/:id` | Delete a project     |

### Memory & Chat

| Method   | Path                       | Description                 |
| -------- | -------------------------- | --------------------------- |
| `GET`    | `/api/memories/:projectId` | List memories for a project |
| `POST`   | `/api/memories/:projectId` | Create a memory             |
| `DELETE` | `/api/memories/:id`        | Delete a memory             |
| `GET`    | `/api/chat/:projectId`     | Get chat history            |
| `POST`   | `/api/chat/:projectId`     | Append to chat history      |

### AI Proxy

| Method | Path                | Description                           |
| ------ | ------------------- | ------------------------------------- |
| `POST` | `/api/ai/openai`    | Proxy to OpenAI API                   |
| `POST` | `/api/ai/anthropic` | Proxy to Anthropic API                |
| `POST` | `/api/ai/deepseek`  | Proxy to DeepSeek API                 |
| `POST` | `/api/ai/local`     | Proxy to local LLM (Ollama/LM Studio) |

### RAG

| Method | Path                                  | Description                                          |
| ------ | ------------------------------------- | ---------------------------------------------------- |
| `POST` | `/api/rag/reindex/:projectId`         | Full reindex (mind map + memories + chat)            |
| `POST` | `/api/rag/query/:projectId`           | Semantic search (returns chunks + relevance scores)  |
| `POST` | `/api/rag/query-formatted/:projectId` | Search + format as system prompt context             |
| `GET`  | `/api/rag/stats/:projectId`           | Index statistics (total chunks, source distribution) |
| `POST` | `/api/rag/remove/:projectId`          | Delete index for a specific source                   |

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# With coverage
npx vitest run --coverage
open coverage/index.html
```

**Current status**: 9 test files · **208 test cases · 100% passing**.

| Test File                   | Cases | Module                                             |
| --------------------------- | ----- | -------------------------------------------------- |
| `bayesianEngine.test.ts`    | 16    | Cognitive engine (Beta-Bernoulli inference)        |
| `mindmapHelpers.test.ts`    | 30    | Node operations, path finding, duplicate detection |
| `settingsStore.test.ts`     | 24    | Zustand store with localStorage persistence        |
| `mindmapStore.test.ts`      | 38    | Full CRUD, expand/collapse, code generation        |
| `aiService.test.ts`         | 25    | AI service (streaming, error handling)             |
| `assessmentService.test.ts` | 14    | Question generation, JSON parsing                  |
| `memoryService.test.ts`     | 16    | Token estimation, conversation compression         |
| `modelCapabilities.test.ts` | 23    | Model rules engine (reasoning model detection)     |
| `promptEvaluator.test.ts`   | 19    | Prompt quality evaluation                          |

---

## 📁 Project Structure

```
mindforge-ai/
├── .github/workflows/
│   └── ci.yml                     # CI pipeline (lint → format → test → build)
├── docs/
│   ├── IMPROVEMENT_ROADMAP.md     # Detailed improvement roadmap
│   └── TEST_FLOW.md               # Testing guide & manual test procedures
├── server/                        # Express + SQLite backend
│   ├── src/
│   │   ├── db/                    # Schema, init, repository, RAG repository
│   │   ├── middleware/            # Bearer token auth
│   │   ├── routes/                # Projects, memories, chat, AI proxy, RAG
│   │   └── services/              # Memory service, RAG pipeline (5 services)
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
├── src/                           # Frontend source
│   ├── __tests__/                 # 9 test files (208 cases)
│   ├── components/                # React components
│   │   ├── Chat/                  # ChatPanel (streaming UI)
│   │   ├── MindMap/               # MindMapView (D3.js canvas)
│   │   └── Assessment/            # AssessmentModal (quiz UI)
│   ├── config/
│   │   ├── prompts/               # Modular prompt engineering (6 files)
│   │   ├── modelCapabilities.ts   # Model capability rules engine
│   │   └── promptEvaluator.ts     # Prompt quality evaluation
│   ├── pages/                     # Dashboard, MapEditor, Quiz, Settings
│   ├── services/                  # AI, assessment, memory services
│   ├── stores/                    # Zustand stores (settings, mindmap, memory)
│   ├── types/                     # TypeScript type definitions
│   └── utils/                     # Mind map helpers, Bayesian engine
├── Dockerfile                     # Frontend multi-stage build
├── docker-compose.yml             # Full-stack Docker orchestration
├── nginx.conf                     # Reverse proxy config
├── eslint.config.js               # ESLint v10 flat config
├── .prettierrc                    # Formatter config
├── .husky/pre-commit              # lint-staged hook
├── vitest.config.ts               # Test runner config
└── package.json
```

---

## 🗺 Roadmap

See the full [improvement roadmap](docs/IMPROVEMENT_ROADMAP.md) for details.

### Completed ✅

**Frontend Infrastructure**

- [x] Unit test suite (208 cases across 9 files, 100% passing)
- [x] ESLint + Prettier + Husky + lint-staged (zero errors)
- [x] CI (GitHub Actions — lint → format check → test → build)
- [x] Quiz page rewrite (5 question types + AI scoring + mastery report)

**AI & Prompt Engineering**

- [x] Model capabilities rules engine (auto-adapts to reasoning models)
- [x] Modular prompt engineering system (versioned prompts + evaluator)
- [x] Bayesian cognitive tracking (Beta-Bernoulli mastery model)

**Backend & Data**

- [x] Express + SQLite persistence (projects, memories, chat)
- [x] AI proxy (API key safety, 4 vendor support)
- [x] RAG pipeline (chunk → embed → vector search → context injection)
- [x] Docker containerization (frontend + backend + nginx + compose)

### Upcoming 📋

- [ ] Multimodal support (image / PDF / audio)
- [ ] PWA + offline support (Service Worker + IndexedDB)
- [ ] Token usage monitoring dashboard
- [ ] Additional test coverage (edge cases, integration, E2E)

---

## 📄 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for more information.

---

<p align="center">
  <sub>Built with ❤️ by the MindForge Team.</sub>
  <br />
  <sub>Explore the future of learning.</sub>
  <br />
  <sub><a href="README.zh-CN.md">🇨🇳 中文版本</a></sub>
</p>