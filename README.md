# MindForge AI 🧠

> **AI 驱动的交互式思维导图学习助手**
> 
> *不仅仅是绘图，更是你的智能学习协作者。*

![MindForge AI](https://img.shields.io/badge/Status-Development-orange?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)
![React](https://img.shields.io/badge/Built%20with-React-61DAFB?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite)

MindForge AI 是一款深度集成大语言模型（LLM）的思维导图工具。它将传统的思维导图与强大的上下文感知能力相结合，让您能以“对话”的形式构建知识图谱、深化概念理解、并自动生成结构化的学习笔记。

## ✨ 核心特性

### 1. ⚡ 全链路流式响应与动态渲染 (Streaming & Dynamic Generation)
- **SSE 流式传输**：彻底告别长连接等待，毫秒级流式接收 AI 推理与生成内容。
- **动态导图生长**：突破传统的阻塞式生成。利用节流算法，在 AI 输出的瞬间，导图节点如生命体般在画布上逐一“长出”。
- **可视化思考引擎 (Reasoning Overlay)**：针对 DeepSeek-R1 / Claude 3.7 等支持深度思考的模型，提供悬浮式“思维追踪器”，实时展现万字级别的深度推理链。

### 2. 🤖 协作式 AI 技能系统 (Modular Skill System)
- **指令分发机制**：插件化的技能架构，AI 可自动调用 `ADD_NODE`、`DELETE_NODE`、`RENAME_NODE` 等技能实时操作导图。
- **知识沉淀 (SAVE_EXPLAIN)**：AI 可将深度的概念解释直接同步到节点的元数据中，点击节点即可查看。
- **动态掌握度 (UPDATE_MASTERY)**：内置认知评估技能，根据对话表现实时计算并更新用户对每个知识点的掌握百分比。

### 2. 🧠 智能记忆引擎 (Intelligent Memory Engine)
- **对话压缩技术**：内置启发式 Token 估算与自动总结机制，有效应对长对话下的上下文窗口限制。
- **核心见解提取 (MEMORY_FLUSH)**：支持手动或自动触发的记忆整理，从杂乱的对话中提取事实 (Facts) 并转为长期记忆。

### 3. 📖 深度概念细化与重组
- **一键细化 (AI Refine)**：基于递归路径感知，自动为核心概念发散出分一层的科学分类。
- **智能重组 (Reorganize)**：一键调用 AI 重新梳理混乱的分支结构，优化知识层级。
- **个性化人设**：支持项目级 AI Persona 配置，让 AI 以特定身份辅助学习。

### 4. 🎯 自适应 AI 知识诊断系统 (Adaptive Assessment)
- **多维度测评会话**：整合“问答、单选、判断”三种题型，通过顺序化、人设化的诊断流深度剖析知识盲区。
- **自定义 AI 考官 (Persona)**：支持用户自定义诊断深度与人设（如“面试官模式”、“基础教学模式”），由 AI 动态优化指令质量。
- **自适应反馈流**：每道题后实时展示诊断解析、正确性判定以及针对性的学习建议。

#### 🔬 核心评估算法：贝叶斯认知追踪 (Bayesian Cognitive Tracking)
MindForge AI 不仅仅记录简单的对错，而是通过一套严谨的数学模型动态演化您的认知画像：
- **Beta-Bernoulli 共轭先验**：系统将每个知识点的掌握度模拟为 Beta 分布。初始状态设定为深层怀疑先验（$5\%$ Mastery），通过每一次答题行为进行后验概率更新。
- **四维认知证据模型**：AI 会从四个维度量化用户的回答：
    - **核心记忆 (Recall)**：能否准确提取定义、术语与核心事实。
    - **概念理解 (Comprehension)**：能否解释核心逻辑与原理。
    - **知识应用 (Application)**：能否在实际场景中运用该知识点。
    - **深度分析 (Analysis)**：能否进行跨知识点的对比与边界分析。
- **语义逻辑匹配**：内置语义映射层，自动识别并兼容多种表达（如 `True/正确/对/1`），确保诊断不受字面匹配限制。

### 5. 🎨 极致的交互体验 (Premium UX)
- **诊断复盘报告**：测评结束后生成详尽的“深度诊断报告”，包含四维评分条与 AI 汇总建议。
- **掌握度热力可视化**：节点背景进度条随贝叶斯期望值动态变化（红-黄-绿渐变），直观呈现“知识热力图”。
- **高性能渲染**：基于 D3.js 的矢量引擎，支持海量节点平滑缩放与毛玻璃动效切换。

## 🛠️ 技术栈

- **Frontend**: React 18 / TypeScript / Vite
- **Cognitive Engine**: Bayesian Inference Logic / Beta Distribution Modeling
- **Styling**: Vanilla CSS (Glassmorphism / Neon Gradients)
- **State**: Zustand (Atomic State Management)
- **Rendering**: Markmap / D3.js (SVG-based)
- **LLM API**: OpenAI-Compatible API Layer

## 🚀 快速上手

### 1. 克隆项目
```bash
git clone https://github.com/your-username/mindforge-ai.git
cd mindforge-ai
```

### 2. 安装依赖
```bash
npm install
```

### 3. 配置 API
1. 启动项目：`npm run dev`
2. 进入应用后，点击左侧导航栏底部的 **“设置”** 按钮。
3. 配置您的 `OpenAI API Key` 或 `Local LLM Base URL`。

### 4. 开始创作
点击 **“新建项目”**，输入主题，让 AI 为您开启知识探索之旅。

## 🗺️ 路线图 (Roadmap)

- [x] **AI 考核系统**：基于导图内容自动生成练习题与测评结果分析，采用贝叶斯更新。
- [x] **掌握度热力图**：通过节点背景颜色的智能渐变，实时反馈知识点的掌握度情况。
- [x] **导出增强**：支持无缝导出为高清图片 (.png)、标准 Markdown (.md) 及 JSON 结构数据。
- [x] **多平台大模型兼容**：深度兼容 OpenAI 格式与 Anthropic 原生 API 格式，完美支持 DeepSeek-R1、Claude 等思考型模型。
- [ ] **全局云端同步**：打通多端数据同步体验。
- [ ] **多模态学习支持**：允许导入 PDF / 文档资料作为核心概念进行导图化提取。

## 🤝 鸣谢 (Acknowledgements)

本项目深受以下开源项目的启发与支持：
- **[Markmap](https://markmap.js.org/)**: 强大的思维导图可视化引擎。
- **[Lucide](https://lucide.dev/)**: 极简风格的图标库。
- **[Zustand](https://github.com/pmndrs/zustand)**: 现代化的 React 状态管理方案。
- **[React Markdown](https://github.com/remarkjs/react-markdown)**: 灵活的 Markdown 渲染组件。

## 📄 开源协议
[MIT License](LICENSE)

---
*Created with ❤️ by MindForge Team. Explore the future of learning.*
