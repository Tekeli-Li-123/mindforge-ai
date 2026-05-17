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
[![Tests](https://img.shields.io/badge/Tests-236_passing-brightgreen?style=flat-square)]()
[![Code Style](https://img.shields.io/badge/Code_Style-Prettier-FF69B4?style=flat-square)]()

</div>

**English** · [中文](README.zh-CN.md)

---

## Table of Contents

- [Overview](#-overview)
- [Why MindForge AI?](#-why-mindforge-ai)
- [Features](#-features)
- [How to Use](#-how-to-use)
  - [1. Setup: Configure AI Provider](#1-setup-configure-ai-provider)
  - [2. Dashboard: Manage Your Projects](#2-dashboard-manage-your-projects)
  - [3. Mind Map Editor: Visual Learning Canvas](#3-mind-map-editor-visual-learning-canvas)
  - [4. AI Chat: Talk to Your Mind Map](#4-ai-chat-talk-to-your-mind-map)
  - [5. Assessment: Quiz & Track Mastery](#5-assessment-quiz--track-mastery)
  - [6. Settings: Advanced Configuration](#6-settings-advanced-configuration)
- [Project Architecture](#-project-architecture)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
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
- **Forgetting curve**: The engine applies time decay (`effectiveAlpha = alpha * exp(-t/halflife)`) so mastery naturally degrades over time unless refreshed — reflecting real human memory.
- **Confidence interval**: Each mastery estimate is displayed with a 95% Bayesian credible interval (CI95%), so you see not just "80%" but "80% ± 15%".
- **Result**: A dynamically updating "knowledge heatmap" — node background colors shift from 🔴 red (low mastery) → 🟡 yellow (medium) → 🟢 green (high).

### 🎯 Adaptive Assessment

| Capability                   | Description                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Multi-format Quiz**        | Multiple choice, true/false, fill-in-the-blank, short answer, and coding questions — all generated from your mind map content. |
| **Custom AI Examiner**       | Choose a persona ("Interviewer", "Tutor", "Professor") — the AI dynamically tailors question difficulty, style, and depth.     |
| **Post-Quiz Report**         | After each session, a detailed diagnostic report with 4-dimensional score bars and AI-synthesized learning recommendations.    |
| **Untested Concepts Filter** | Automatically filter to quiz only the concepts with low or no mastery data — efficient spaced learning.                        |

---

## 🎮 How to Use

This section walks you through every feature, step by step. The app is designed for a **three-panel workflow**: Dashboard → Mind Map → Quiz, with AI chat available throughout.

---

### 1. Setup: Configure AI Provider

Before using any AI features, you need to configure an LLM backend.

**Steps**:

1. Click **Settings** in the sidebar.
2. Choose a **Provider**:
   - **OpenAI** — Use GPT-4o, o3, or GPT-5 models.
   - **Anthropic** — Use Claude 4.6 Sonnet/Opus.
   - **DeepSeek** — Use DeepSeek V4 Pro / V4 Flash / R1.
   - **Local** — Use a local model via Ollama or LM Studio (`http://localhost:11434/v1`).
3. Enter your **API Key** (not needed for local provider).
4. Enter your **Model name** (e.g., `gpt-4o`, `claude-4-6-sonnet`, `deepseek-chat`).
5. (Optional) Adjust **Reasoning Effort** — controls how much "thinking" the model does before answering. Higher = deeper but slower.
6. (Optional) Adjust **Temperature** and **Max Tokens**.
7. Click **Save Settings**.

> 💡 **Tip**: The app auto-detects model capabilities (reasoning mode, temperature support) and adapts the request format accordingly.

---

### 2. Dashboard: Manage Your Projects

The **Dashboard** is the home screen. It lists all your mind map projects.

**Steps**:

1. **Create a project**: Click **New Project**, enter a title and optional description. You can optionally provide an AI generation prompt to auto-create the initial mind map.
2. **Open a project**: Click any project card to open its mind map editor.
3. **Edit / Delete**: Hover over a project card to see edit and delete actions.
4. **Duplicate**: Click the duplicate icon to clone an existing project — useful for creating variations of a knowledge map.

> 💡 **Tip**: The dashboard shows a summary of each project's node count and last modified time.

---

### 3. Mind Map Editor: Visual Learning Canvas

The **Map Editor** is the core working area. It renders your knowledge as an interactive mind map.

**Layout**:

```
┌──────────────────────────────────────────┐
│  [Toolbar]  [Zoom Controls]              │
│                                          │
│              Mind Map Canvas             │
│         (Interactive, Zoomable)          │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│  [Chat Panel] (opens when you click 💬) │
└──────────────────────────────────────────┘
```

**Interactive actions**:

| Action              | How to Do It                                                           |
| ------------------- | ---------------------------------------------------------------------- |
| **Pan**             | Click and drag the canvas background                                   |
| **Zoom in/out**     | Use mouse wheel or the zoom buttons (+/-) in the toolbar               |
| **Select a node**   | Click any node — it becomes highlighted with info shown in chat        |
| **Toggle children** | Click the expand/collapse icon on a node to show/hide its sub-concepts |
| **Edit node text**  | Double-click a node to edit its label                                  |

**AI-assisted mind map generation**:

1. When creating a new project, check **"Generate with AI"** and describe the topic in natural language.
   > Example: _"Generate a mind map about machine learning covering supervised learning, unsupervised learning, and reinforcement learning with key algorithms for each."_
2. The AI will generate a full tree structure and populate nodes one by one with smooth animation.

---

### 4. AI Chat: Talk to Your Mind Map

Open the chat panel by clicking the **Chat icon (💬)** in the editor toolbar. This is the most powerful feature — you can converse with the AI _about_ your mind map, and the AI can manipulate the map directly.

**Basic Chat**:

```text
You:  Explain the concept of "Neural Networks" in simple terms.
AI:   [Markdown explanation with examples]
      [Also saves the explanation as node metadata via SAVE_EXPLAIN skill]
```

**AI Skills** (the AI can autonomously act on your map):

| Skill            | What It Does                                                                  | Example Command                                     |
| ---------------- | ----------------------------------------------------------------------------- | --------------------------------------------------- |
| `ADD_NODE`       | Adds a child node to the currently selected concept                           | "Add 'Backpropagation' under 'Neural Networks'"     |
| `DELETE_NODE`    | Removes a node and its children                                               | "Delete the 'Old Topic' branch"                     |
| `RENAME_NODE`    | Renames a node                                                                | "Rename 'ML' to 'Machine Learning Basics'"          |
| `SAVE_EXPLAIN`   | Saves an explanation to node metadata                                         | "Save an explanation of gradient descent"           |
| `UPDATE_MASTERY` | Estimates your understanding based on the conversation, updates the heatmap   | "Based on our discussion, how well do I know CNNs?" |
| `MEMORY_FLUSH`   | Extracts key facts from this conversation and stores them as long-term memory | — (triggered automatically on long conversations)   |

**Suggested prompts** (click any to send):

- "详细解释当前选中的节点" — Explain the selected node in detail
- "为当前选中的节点发散子节点" — Generate sub-concepts for the selected node
- "基于当前上下文生成 3 道练习题" — Generate 3 practice questions
- "总结当前导图的整体学习路线" — Summarize the learning path of the entire map
- "帮我润色导图中的文字描述" — Polish the text descriptions in the map

> 💡 **Tip**: The chat supports streaming responses — text appears character by character as the AI thinks. For reasoning models (DeepSeek-R1, Claude 3.7 thinking), a translucent "thought tracker" shows the model's internal reasoning chain in real time.

---

### 5. Assessment: Quiz & Track Mastery

The **Quiz** page is where you test your knowledge. It uses a three-step workflow.

#### Step 1: Select Topics

1. Go to the **Quiz** page from the sidebar.
2. You'll see a list of concepts from your current mind map.
3. Check the boxes for topics you want to be tested on.
4. Use **"Select All"** to quickly choose everything, or **"Untested Concepts"** to filter only concepts with low mastery (great for spaced repetition).
5. Click **"Start Assessment"**.

#### Step 2: Answer Questions

1. AI generates questions in real time — one per concept you selected.
2. Question types include:
   - **Multiple Choice** — Pick the correct answer from options.
   - **True/False** — Tap ✓ or ✗.
   - **Fill in the Blank** — Type your answer into the input field. The system uses fuzzy matching (tolerates minor spelling errors).
   - **Short Answer** — Write a brief explanation.
   - **Coding** — Write or analyze code snippets.
3. After each answer, the AI evaluates it across 4 dimensions: **Recall**, **Comprehension**, **Application**, **Analysis**.
4. Click **"Next"** to advance. The progress bar shows your position.

#### Step 3: Review Report

After the last question, the **Summary Report** displays:

```
📊 Overall Score: 78%

📈 Per-Question Breakdown:
   ✓ Neural Networks (Multiple Choice)    Score: 85%   CI: [75%, 95%]
   ✗ Backpropagation (Fill in Blank)      Score: 30%   CI: [10%, 50%]  ← Weak spot
   ✓ CNNs (Short Answer)                  Score: 92%   CI: [85%, 99%]
```

- Each score includes a **95% confidence interval** (CI95%) — for example, "80% ± 15%" — so you know how reliable the estimate is.
- Expand any question to see the **AI's detailed analysis** and learning recommendations.
- Click **"Retake"** to quiz again on the same topics (your previous mastery data is preserved and updated).
- Click **"Done"** to exit. The mind map's node colors update automatically to reflect your new mastery levels.

#### Bonus: 🔬 Confidence Interval Display

When viewing mastery data, you'll see a visual bar:

```
[======●==========]     78% ± 15%
 ← 0.63      0.78      0.93 →
```

The bar shows:

- **Width** = how much evidence has been collected (narrow = confident, wide = uncertain)
- **Dot** = current mastery estimate
- **Labels** = lower bound, estimate, upper bound

This prevents overconfidence from limited evidence — you know exactly how reliable each measurement is.

#### Bonus: 🕰️ Forgetting Curve

Mastery naturally decays over time. If you scored 80% on a topic but haven't reviewed it in 30 days, the system will show a lower effective mastery. This reflects real human memory decay and encourages spaced repetition — the most effective learning technique.

---

### 6. Settings: Advanced Configuration

The **Settings** page offers full control over the application.

**AI Settings tab**:

| Setting          | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| Provider         | OpenAI, Anthropic, DeepSeek, or Local (Ollama / LM Studio)               |
| API Key          | Your API key (stored in browser localStorage; never sent to any server)  |
| Base URL         | Custom API endpoint (useful for proxies or self-hosted LLMs)             |
| Model            | Model name (auto-detects capabilities like reasoning mode)               |
| Temperature      | Controls randomness (0 = deterministic, 2 = creative)                    |
| Max Tokens       | Maximum response length                                                  |
| Reasoning Effort | Off / Low / Medium / High — controls thinking depth for reasoning models |
| Custom Payload   | Add arbitrary JSON fields to the API request body (advanced users only)  |

**Prompt Engineering tab**:

Each AI function (generate, refine, explain, reorganize, assessment) uses a dedicated prompt template. You can view and customize them here. Changes take effect immediately.

**Data Management**:

- **Export**: Download your settings as a JSON file (useful for sharing configs across devices).
- **Import**: Load settings from a previously exported JSON file.
- **Reset to Defaults**: Clear all customizations and restart fresh.

---

### Quick Reference: Workflow Scenarios

#### 📖 Learning a New Subject

```
1. Settings → Configure AI provider (e.g., GPT-4o)
2. Dashboard → Create a new project → AI-generate a mind map on "Quantum Computing"
3. Open the editor → Chat with AI to dive deeper into specific nodes
4. Quiz → Select topics → Take the assessment → Review report
5. Repeat step 3-4 weekly → Watch your mastery heatmap turn green!
```

#### 📝 Preparing for an Exam

```
1. Open your existing study mind map
2. Quiz → Click "Untested Concepts" to focus on weak spots
3. Take the assessment → Note the CI95% ranges (wide = need more practice)
4. Review the confidence interval bars → focus on topics with low + uncertain mastery
5. Chat with AI for detailed explanations on items you got wrong
```

#### 🧪 Research & Brainstorming

```
1. Create a new project with a central research question
2. Chat → "Generate 10 branches exploring different aspects of this topic"
3. Review the auto-generated tree → Delete irrelevant branches
4. Chat → "Summarize key insights from our discussion so far"
5. The RAG pipeline automatically indexes everything for future reference
```

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
| **Testing**            | Vitest, jsdom (236 test cases, zero failures)                 |
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

**Current status**: 10 test files · **236 test cases · 100% passing**.

| Test File                   | Cases | Module                                                |
| --------------------------- | ----- | ----------------------------------------------------- |
| `bayesianEngine.test.ts`    | 16    | Cognitive engine (Beta-Bernoulli inference)           |
| `jsonExtractor.test.ts`     | 19    | JSON fuzzy parser (Unicode, bracket repair, fallback) |
| `mindmapHelpers.test.ts`    | 30    | Node operations, path finding, duplicate detection    |
| `settingsStore.test.ts`     | 24    | Zustand store with localStorage persistence           |
| `mindmapStore.test.ts`      | 38    | Full CRUD, expand/collapse, code generation           |
| `aiService.test.ts`         | 25    | AI service (streaming, error handling)                |
| `assessmentService.test.ts` | 14    | Question generation, JSON parsing                     |
| `memoryService.test.ts`     | 16    | Token estimation, conversation compression            |
| `modelCapabilities.test.ts` | 23    | Model rules engine (reasoning model detection)        |
| `promptEvaluator.test.ts`   | 19    | Prompt quality evaluation                             |

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
│   ├── __tests__/                 # 10 test files (236 cases)
│   ├── components/                # React components
│   │   ├── Chat/                  # ChatPanel (streaming UI)
│   │   ├── MindMap/               # MindMapView (D3.js canvas)
│   │   └── Assessment/            # AssessmentModal (quiz UI)
│   ├── config/
│   │   ├── prompts/               # Modular prompt engineering (7 files)
│   │   ├── modelCapabilities.ts   # Model capability rules engine
│   │   └── promptEvaluator.ts     # Prompt quality evaluation
│   ├── pages/                     # Dashboard, MapEditor, Quiz, Settings
│   ├── services/                  # AI, assessment, memory services
│   ├── stores/                    # Zustand stores (settings, mindmap, memory)
│   ├── types/                     # TypeScript type definitions
│   └── utils/                     # Mind map helpers, Bayesian engine, JSON extractor
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

- [x] Unit test suite (236 cases across 10 files, 100% passing)
- [x] ESLint + Prettier + Husky + lint-staged (zero errors)
- [x] CI (GitHub Actions — lint → format check → test → build)
- [x] Quiz page rewrite (5 question types + AI scoring + mastery report)

**AI & Prompt Engineering**

- [x] Model capabilities rules engine (auto-adapts to reasoning models)
- [x] Modular prompt engineering system (versioned prompts + evaluator)
- [x] Bayesian cognitive tracking (Beta-Bernoulli mastery model)
- [x] Dual-prompt assessment (separate generate vs. evaluate prompts)
- [x] JSON fuzzy parser (unicode decode, bracket repair, fallback chain)

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
