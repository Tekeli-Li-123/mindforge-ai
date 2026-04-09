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

### 1. 🤖 协作式 AI 对话 (Collaborative Chat)
- **对话即编辑**：直接对 AI 说“在下面加个总结”或“重组这些分支”，AI 会识别指令并实时修改导图结构。
- **操作审计日志**：AI 执行的所有自动变更均会有系统记录，确保编辑过程透明、可追溯。
- **上下文感知**：AI 默认感知您当前选中的节点及其完整的知识路径，提供极具针对性的解答。

### 2. 📖 深度概念细化 (Deep Refinement)
- **一键解释**：针对任何节点，一键生成多维度的专业解释，并可自动同步至节点书签。
- **智能发散**：通过 AI 自动为一个核心概念发散出系统的子节点结构。
- **个性化风格**：支持配置“项目人设”，无论是“通俗易懂的启蒙老师”还是“严谨的数据专家”，随心切换。

### 3. 🎨 极致的交互体验 (Premium UX)
- **高性能渲染**：基于 D3.js 和 Markmap 的矢量化导图引擎，支持海量节点平滑缩放。
- **暗黑美学**：精心设计的暗色主题，配合毛玻璃（Glassmorphism）与流光动效，打造沉浸式学习心流。
- **多项目管理**：支持 LocalStorage 持久化存储，多个学习项目无缝切换。

## 🛠️ 技术栈

- **Frontend**: React 18 / TypeScript / Vite
- **Styling**: Vanilla CSS (Modern CSS Variables + Flex/Grid/Animations)
- **State**: Zustand (Atomic State Management)
- **Rendering**: Markmap / D3.js (SVG-based)
- **Markdown**: React Markdown
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
