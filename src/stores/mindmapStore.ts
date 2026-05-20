import { create } from "zustand";
import type {
  MindMapNode,
  MindMapProject,
  ChatMessage,
  ProjectAIConfig,
  CognitiveState,
  ProjectCognitiveConfig,
} from "../types";
import {
  buildParentIndex,
  updateNodeInTreeByPath,
  deleteNodeInTreeByPath,
  deleteNodesInTreeByPath,
  appendChildrenInTreeByPath,
} from "../utils/mindmapHelpers";
// ==========================================
// 示例数据
// ==========================================
const sampleProject: MindMapProject = {
  id: "demo-1",
  title: "机器学习基础",
  description: "机器学习核心概念知识导图",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  cognitiveConfig: {
    preset: "balanced",
  },
  cognitiveStates: {},
  root: {
    id: "root",
    content: "机器学习",
    depth: 0,
    mastery: 0,
    expanded: true,
    children: [
      {
        id: "n1",
        content: "监督学习",
        depth: 1,
        mastery: 0.3,
        expanded: true,
        children: [
          {
            id: "n1-1",
            content: "分类",
            depth: 2,
            mastery: 0.5,
            expanded: false,
            children: [
              {
                id: "n1-1-1",
                content: "决策树",
                depth: 3,
                mastery: 0,
                expanded: false,
                children: [],
              },
              { id: "n1-1-2", content: "SVM", depth: 3, mastery: 0, expanded: false, children: [] },
              {
                id: "n1-1-3",
                content: "随机森林",
                depth: 3,
                mastery: 0,
                expanded: false,
                children: [],
              },
            ],
          },
          {
            id: "n1-2",
            content: "回归",
            depth: 2,
            mastery: 0.2,
            expanded: false,
            children: [
              {
                id: "n1-2-1",
                content: "线性回归",
                depth: 3,
                mastery: 0,
                expanded: false,
                children: [],
              },
              {
                id: "n1-2-2",
                content: "多项式回归",
                depth: 3,
                mastery: 0,
                expanded: false,
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: "n2",
        content: "无监督学习",
        depth: 1,
        mastery: 0.1,
        expanded: true,
        children: [
          {
            id: "n2-1",
            content: "聚类",
            depth: 2,
            mastery: 0,
            expanded: false,
            children: [
              {
                id: "n2-1-1",
                content: "K-Means",
                depth: 3,
                mastery: 0,
                expanded: false,
                children: [],
              },
              {
                id: "n2-1-2",
                content: "DBSCAN",
                depth: 3,
                mastery: 0,
                expanded: false,
                children: [],
              },
            ],
          },
          {
            id: "n2-2",
            content: "降维",
            depth: 2,
            mastery: 0,
            expanded: false,
            children: [
              { id: "n2-2-1", content: "PCA", depth: 3, mastery: 0, expanded: false, children: [] },
              {
                id: "n2-2-2",
                content: "t-SNE",
                depth: 3,
                mastery: 0,
                expanded: false,
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: "n3",
        content: "强化学习",
        depth: 1,
        mastery: 0,
        expanded: true,
        children: [
          {
            id: "n3-1",
            content: "Q-Learning",
            depth: 2,
            mastery: 0,
            expanded: false,
            children: [],
          },
          { id: "n3-2", content: "策略梯度", depth: 2, mastery: 0, expanded: false, children: [] },
          {
            id: "n3-3",
            content: "Actor-Critic",
            depth: 2,
            mastery: 0,
            expanded: false,
            children: [],
          },
        ],
      },
      {
        id: "n4",
        content: "深度学习",
        depth: 1,
        mastery: 0,
        expanded: true,
        children: [
          { id: "n4-1", content: "CNN", depth: 2, mastery: 0, expanded: false, children: [] },
          {
            id: "n4-2",
            content: "RNN / LSTM",
            depth: 2,
            mastery: 0,
            expanded: false,
            children: [],
          },
          {
            id: "n4-3",
            content: "Transformer",
            depth: 2,
            mastery: 0,
            expanded: false,
            children: [],
          },
        ],
      },
    ],
  },
};

// ==========================================
// Store Types
// ==========================================
interface MindMapStore {
  // State
  projects: MindMapProject[];
  currentProject: MindMapProject | null;
  chatMessages: ChatMessage[];
  isChatOpen: boolean;
  selectedNodeId: string | null;
  /** 节点 ID → 父节点 ID 索引表，用于 O(depth) 树操作 */
  nodeIndex: Record<string, string>;

  // Actions
  setCurrentProject: (project: MindMapProject) => void;
  addProject: (project: MindMapProject) => void;
  updateProject: (id: string, updates: Partial<MindMapProject>) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  deleteNode: (nodeId: string) => void;
  deleteNodes: (nodeIds: string[]) => void;
  appendChildren: (parentId: string, children: MindMapNode[]) => void;
  updateProjectRoot: (projectId: string, newRoot: MindMapNode) => void;
  updateProjectAIConfig: (projectId: string, config: ProjectAIConfig) => void;
  selectNode: (nodeId: string | null) => void;
  toggleChat: () => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChat: () => void;
  /** 添加项目级长期记忆 */
  addProjectMemory: (projectId: string, fact: string) => void;
  /** 更新项目级长期记忆列表 */
  updateProjectMemories: (projectId: string, memories: string[]) => void;
  /** 更新认知评估配置 */
  updateProjectCognitiveConfig: (projectId: string, config: ProjectCognitiveConfig) => void;
  /** 更新节点认知状态 */
  updateNodeCognitiveState: (nodeId: string, newState: CognitiveState) => void;
}

// ==========================================
// Zustand Store
// ==========================================
import { persist } from "zustand/middleware";

export const useMindMapStore = create<MindMapStore>()(
  persist(
    (set) => ({
      projects: [sampleProject],
      currentProject: sampleProject,
      chatMessages: [],
      isChatOpen: false,
      selectedNodeId: null,
      nodeIndex: buildParentIndex(sampleProject.root),

      setCurrentProject: (project) =>
        set({
          currentProject: project,
          nodeIndex: project ? buildParentIndex(project.root) : {},
        }),

      addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),

      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
          currentProject:
            state.currentProject?.id === id
              ? { ...state.currentProject, ...updates }
              : state.currentProject,
        })),

      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          currentProject: state.currentProject?.id === id ? null : state.currentProject,
          nodeIndex: state.currentProject?.id === id ? {} : state.nodeIndex,
        })),

      duplicateProject: (id) =>
        set((state) => {
          const projectToCopy = state.projects.find((p) => p.id === id);
          if (!projectToCopy) return state;

          const newProject: MindMapProject = JSON.parse(JSON.stringify(projectToCopy));
          newProject.id = `copy-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          newProject.title = `${newProject.title} (副本)`;
          newProject.createdAt = Date.now();
          newProject.updatedAt = Date.now();

          return {
            projects: [...state.projects, newProject],
            currentProject: newProject,
            nodeIndex: buildParentIndex(newProject.root),
          };
        }),

      updateNode: (nodeId, updates) =>
        set((state) => {
          if (!state.currentProject) return state;
          const newRoot = updateNodeInTreeByPath(
            state.currentProject.root,
            nodeId,
            updates,
            state.nodeIndex,
          );
          const updatedProject = { ...state.currentProject, root: newRoot, updatedAt: Date.now() };
          return {
            currentProject: updatedProject,
            projects: state.projects.map((p) => (p.id === updatedProject.id ? updatedProject : p)),
            nodeIndex: buildParentIndex(newRoot),
          };
        }),

      deleteNode: (nodeId) =>
        set((state) => {
          if (!state.currentProject) return state;
          const newRoot = deleteNodeInTreeByPath(
            state.currentProject.root,
            nodeId,
            state.nodeIndex,
          );
          if (!newRoot) return state; // 无法删除根节点
          const updatedProject = { ...state.currentProject, root: newRoot, updatedAt: Date.now() };
          return {
            currentProject: updatedProject,
            projects: state.projects.map((p) => (p.id === updatedProject.id ? updatedProject : p)),
            nodeIndex: buildParentIndex(newRoot),
          };
        }),

      deleteNodes: (nodeIds) =>
        set((state) => {
          if (!state.currentProject || nodeIds.length === 0) return state;

          // If root is included, we can't delete it
          if (nodeIds.includes(state.currentProject.root.id)) {
            return state;
          }

          const newRoot = deleteNodesInTreeByPath(
            state.currentProject.root,
            nodeIds,
            state.nodeIndex,
          );
          if (!newRoot) return state;

          const newProject = { ...state.currentProject, root: newRoot, updatedAt: Date.now() };

          return {
            projects: state.projects.map((p) => (p.id === newProject.id ? newProject : p)),
            currentProject: newProject,
            nodeIndex: buildParentIndex(newRoot),
          };
        }),

      appendChildren: (parentId, newChildren) =>
        set((state) => {
          if (!state.currentProject) return state;
          const newRoot = appendChildrenInTreeByPath(
            state.currentProject.root,
            parentId,
            newChildren,
            state.nodeIndex,
          );
          const updatedProject = { ...state.currentProject, root: newRoot, updatedAt: Date.now() };
          return {
            currentProject: updatedProject,
            projects: state.projects.map((p) => (p.id === updatedProject.id ? updatedProject : p)),
            nodeIndex: buildParentIndex(newRoot),
          };
        }),
      updateProjectRoot: (projectId, newRoot) =>
        set((state) => {
          const updatedProjects = state.projects.map((p) => {
            if (p.id === projectId) {
              return { ...p, root: newRoot, updatedAt: Date.now() };
            }
            return p;
          });

          const updatedCurrent =
            state.currentProject?.id === projectId
              ? updatedProjects.find((p) => p.id === projectId) || null
              : state.currentProject;

          return {
            projects: updatedProjects,
            currentProject: updatedCurrent,
            nodeIndex: updatedCurrent ? buildParentIndex(updatedCurrent.root) : state.nodeIndex,
          };
        }),

      updateProjectAIConfig: (projectId, config) =>
        set((state) => {
          const updatedProjects = state.projects.map((p) => {
            if (p.id === projectId) {
              return { ...p, aiConfig: config, updatedAt: Date.now() };
            }
            return p;
          });

          const updatedCurrent =
            state.currentProject?.id === projectId
              ? updatedProjects.find((p) => p.id === projectId) || null
              : state.currentProject;

          return {
            projects: updatedProjects,
            currentProject: updatedCurrent,
          };
        }),

      selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

      toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

      addChatMessage: (message) =>
        set((state) => ({ chatMessages: [...state.chatMessages, message] })),
      clearChat: () => set({ chatMessages: [] }),

      addProjectMemory: (projectId, fact) =>
        set((state) => {
          const projects = state.projects.map((p) => {
            if (p.id === projectId) {
              const oldMemories = p.memories || [];
              return { ...p, memories: [...oldMemories, fact], updatedAt: Date.now() };
            }
            return p;
          });
          const currentProject =
            state.currentProject?.id === projectId
              ? projects.find((p) => p.id === projectId) || null
              : state.currentProject;
          return { projects, currentProject };
        }),

      updateProjectMemories: (projectId, memories) =>
        set((state) => {
          const projects = state.projects.map((p) => {
            if (p.id === projectId) {
              return { ...p, memories, updatedAt: Date.now() };
            }
            return p;
          });
          const currentProject =
            state.currentProject?.id === projectId
              ? projects.find((p) => p.id === projectId) || null
              : state.currentProject;
          return { projects, currentProject };
        }),

      updateProjectCognitiveConfig: (projectId, config) =>
        set((state) => {
          const projects = state.projects.map((p) => {
            if (p.id === projectId) {
              return { ...p, cognitiveConfig: config, updatedAt: Date.now() };
            }
            return p;
          });
          const currentProject =
            state.currentProject?.id === projectId
              ? projects.find((p) => p.id === projectId) || null
              : state.currentProject;
          return { projects, currentProject };
        }),

      updateNodeCognitiveState: (nodeId, newState) =>
        set((state) => {
          if (!state.currentProject) return state;

          const projectId = state.currentProject.id;
          const cognitiveStates = {
            ...(state.currentProject.cognitiveStates || {}),
            [nodeId]: newState,
          };

          // 计算新的掌握度 (0-1 范围)
          const newMastery = newState.alpha / (newState.alpha + newState.beta);

          // 递归更新导图树中的节点掌握度
          // 递归更新导图树中的节点掌握度
          const newRoot = updateNodeInTreeByPath(
            state.currentProject.root,
            nodeId,
            { mastery: newMastery },
            state.nodeIndex,
          );

          const projects = state.projects.map((p) => {
            if (p.id === projectId) {
              return { ...p, cognitiveStates, root: newRoot, updatedAt: Date.now() };
            }
            return p;
          });

          const currentProject = {
            ...state.currentProject,
            cognitiveStates,
            root: newRoot,
            updatedAt: Date.now(),
          };

          return { projects, currentProject, nodeIndex: buildParentIndex(newRoot) };
        }),
    }),
    {
      name: "mindforge-projects",
      partialize: ({ nodeIndex: _ni, ...rest }) => rest,
    },
  ),
);
