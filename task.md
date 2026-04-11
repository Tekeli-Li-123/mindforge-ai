# MindForge AI 任务追踪 (Task Tracker)

## 🟢 已完成 (Completed)

### 1. 基础架构与 UI
- [x] 基于 Vite + React + TypeScript 的项目搭建
- [x] Zustand 状态管理实现（多项目、设置、聊天状态）
- [x] Markmap 矢量导图引擎集成与 D3 布局优化
- [x] 响应式侧边栏（设置 & AI 助手）
- [x] 背景流光动效与毛玻璃 UI 设计

### 2. AI 协作与技能系统
- [x] 模块化技能注册中心 (Skill Registry)
- [x] 基础导图操作技能 (`ADD_NODE`, `DELETE_NODE`, `RENAME_NODE`)
- [x] 概念解释同步技能 (`SAVE_EXPLAIN`)
- [x] 掌握度动态更新技能 (`UPDATE_MASTERY`)
- [x] 技能分发器 (Skill Dispatcher) 自动解析正则匹配

### 3. 记忆引擎 (Memory Engine)
- [x] 对话上下文自动总结与压缩 (15 条阈值)
- [x] 核心见解深度提取 (Facts Extraction)
- [x] 长期记忆沉淀 (`MEMORY_FLUSH`)

### 4. 交互与导出
- [x] 右键上下文菜单与多选 (Marquee Selection)
- [x] 节点细化 (Refine) 与自动重组 (Reorganize)
- [x] 高清图片 (PNG)、Markdown、JSON 导出功能

### 5. 关键修复
- [x] 修复 ESM 模式下的模块导出解析错误
- [x] 修复节点细化逻辑中导致的内容丢失 ([object Object]) 问题

---

## 🟡 进行中 (In Progress)

- [ ] **认知诊断模型升级**: 细化 `UPDATE_MASTERY` 的打分算法，引入简单的贝叶斯知识追踪概念。
- [ ] **UI 细节优化**: 进一步压缩侧边栏空间占用，增强手机端适配。

---

## ⚪ 待办 (Backlog)

- [ ] **自测题自动生成**: 根据导图选中的知识点，自动生成选择题或简答题进行考核。
- [ ] **多端同步能力**: 接入云端存储或 WebRTC 实时协作。
- [ ] **主题系统**: 支持除暗黑模式外的更多专业配色方案。

---
*上次更新: 2026-04-11*
