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

### 1. 🤖 协作式 AI 技能系统 (Modular Skill System)
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
- **多维度测评会话**：支持“问答、单选、判断”三种题型组合，通过顺序会话模式全方位检验知识点掌握情况。
- **自定义 AI 考官 (Persona Input)**：支持通过 AI 指令定义考官人设（如：面试官模式、通俗易懂模式），并提供 AI 指令优化（Magic Sparkle）。
- **贝叶斯认知更新**：集成贝叶斯推理引擎，根据测验表现精确演算并更新知识点的掌握度分布。
- **资源消费透明度**：内置 Token 消耗预警与 AI 注意力衰减提示，确保高质量、高效率的评估。

### 5. 🎨 极致的交互体验 (Premium UX)
- **高性能渲染**：基于 D3.js 和 Markmap 的矢量化导图引擎，支持海量节点平滑缩放与热力图配色。
- **节点掌握度可视化**：节点背景进度条从红色（0%）平滑过渡到绿色（100%），即时反馈学习进度。
- **暗黑美学**：精心设计的暗色主题，配合毛玻璃（Glassmorphism）与流光动效，打造沉浸式学习心流。

## 🛠️ 技术栈

- **Frontend**: React 18 / TypeScript / Vite
- **LLM Logic**: Bayesian Inference Engine / Custom Prompt Engineering
- **Styling**: Vanilla CSS (Modern CSS Variables + Flex/Grid/Animations)
- **State**: Zustand (Atomic State Management)
- **Rendering**: Markmap / D3.js (SVG-based)
- **Icons**: Lucide React
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

- [ ] **AI 考核系统**：基于导图内容自动生成练习题与测评结果分析。
- [ ] **掌握度热力图**：通过节点颜色实时反馈知识点的学习进度与掌握度。
- [ ] **导出增强**：支持导出为高清图片、标准 Markdown 及 PDF。
- [ ] **多模型切换**：内置 DeepSeek、智谱 AI 等更多常用模型预设。

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
