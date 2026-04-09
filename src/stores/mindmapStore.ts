import { create } from 'zustand';
import type { MindMapNode, MindMapProject, ChatMessage } from '../types';

// ==========================================
// 示例数据
// ==========================================
const sampleProject: MindMapProject = {
  id: 'demo-1',
  title: '机器学习基础',
  description: '机器学习核心概念知识导图',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  root: {
    id: 'root',
    content: '机器学习',
    depth: 0,
    mastery: 0,
    expanded: true,
    children: [
      {
        id: 'n1',
        content: '监督学习',
        depth: 1,
        mastery: 0.3,
        expanded: true,
        children: [
          { id: 'n1-1', content: '分类', depth: 2, mastery: 0.5, expanded: false, children: [
            { id: 'n1-1-1', content: '决策树', depth: 3, mastery: 0, expanded: false, children: [] },
            { id: 'n1-1-2', content: 'SVM', depth: 3, mastery: 0, expanded: false, children: [] },
            { id: 'n1-1-3', content: '随机森林', depth: 3, mastery: 0, expanded: false, children: [] },
          ]},
          { id: 'n1-2', content: '回归', depth: 2, mastery: 0.2, expanded: false, children: [
            { id: 'n1-2-1', content: '线性回归', depth: 3, mastery: 0, expanded: false, children: [] },
            { id: 'n1-2-2', content: '多项式回归', depth: 3, mastery: 0, expanded: false, children: [] },
          ]},
        ],
      },
      {
        id: 'n2',
        content: '无监督学习',
        depth: 1,
        mastery: 0.1,
        expanded: true,
        children: [
          { id: 'n2-1', content: '聚类', depth: 2, mastery: 0, expanded: false, children: [
            { id: 'n2-1-1', content: 'K-Means', depth: 3, mastery: 0, expanded: false, children: [] },
            { id: 'n2-1-2', content: 'DBSCAN', depth: 3, mastery: 0, expanded: false, children: [] },
          ]},
          { id: 'n2-2', content: '降维', depth: 2, mastery: 0, expanded: false, children: [
            { id: 'n2-2-1', content: 'PCA', depth: 3, mastery: 0, expanded: false, children: [] },
            { id: 'n2-2-2', content: 't-SNE', depth: 3, mastery: 0, expanded: false, children: [] },
          ]},
        ],
      },
      {
        id: 'n3',
        content: '强化学习',
        depth: 1,
        mastery: 0,
        expanded: true,
        children: [
          { id: 'n3-1', content: 'Q-Learning', depth: 2, mastery: 0, expanded: false, children: [] },
          { id: 'n3-2', content: '策略梯度', depth: 2, mastery: 0, expanded: false, children: [] },
          { id: 'n3-3', content: 'Actor-Critic', depth: 2, mastery: 0, expanded: false, children: [] },
        ],
      },
      {
        id: 'n4',
        content: '深度学习',
        depth: 1,
        mastery: 0,
        expanded: true,
        children: [
          { id: 'n4-1', content: 'CNN', depth: 2, mastery: 0, expanded: false, children: [] },
          { id: 'n4-2', content: 'RNN / LSTM', depth: 2, mastery: 0, expanded: false, children: [] },
          { id: 'n4-3', content: 'Transformer', depth: 2, mastery: 0, expanded: false, children: [] },
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

  // Actions
  setCurrentProject: (project: MindMapProject) => void;
  addProject: (project: MindMapProject) => void;
  updateProject: (id: string, updates: Partial<MindMapProject>) => void;
  deleteProject: (id: string) => void;
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
}

// ==========================================
// Helper: 递归操作导图树
// ==========================================
function updateNodeInTree(node: MindMapNode, nodeId: string, updates: Partial<MindMapNode>): MindMapNode {
  if (node.id === nodeId) {
    return { ...node, ...updates };
  }
  return {
    ...node,
    children: node.children.map((child) => updateNodeInTree(child, nodeId, updates)),
  };
}

function deleteNodeInTree(node: MindMapNode, nodeId: string): MindMapNode | null {
  if (node.id === nodeId) return null; // 删除自身
  return {
    ...node,
    children: node.children
      .map((child) => deleteNodeInTree(child, nodeId))
      .filter((child): child is MindMapNode => child !== null),
  };
}

function appendChildrenInTree(node: MindMapNode, parentId: string, newChildren: MindMapNode[]): MindMapNode {
  if (node.id === parentId) {
    return {
      ...node,
      children: [...node.children, ...newChildren],
      expanded: true, // 确保父节点自动展开以显示新增的子节点
    };
  }
  return {
    ...node,
    children: node.children.map((child) => appendChildrenInTree(child, parentId, newChildren)),
  };
}

// ==========================================
// Zustand Store
// ==========================================
import { persist } from 'zustand/middleware';

export const useMindMapStore = create<MindMapStore>()(
  persist(
    (set) => ({
      projects: [sampleProject],
      currentProject: sampleProject,
      chatMessages: [],
      isChatOpen: false,
      selectedNodeId: null,

      setCurrentProject: (project) => set({ currentProject: project }),

      addProject: (project) =>
        set((state) => ({ projects: [...state.projects, project] })),

      updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p),
        currentProject: state.currentProject?.id === id ? { ...state.currentProject, ...updates } : state.currentProject
      })),

      deleteProject: (id) => set((state) => ({
        projects: state.projects.filter(p => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject
      })),

      updateNode: (nodeId, updates) =>
        set((state) => {
          if (!state.currentProject) return state;
          const newRoot = updateNodeInTree(state.currentProject.root, nodeId, updates);
          const updatedProject = { ...state.currentProject, root: newRoot, updatedAt: Date.now() };
          return {
            currentProject: updatedProject,
            projects: state.projects.map((p) => p.id === updatedProject.id ? updatedProject : p),
          };
        }),

      deleteNode: (nodeId) =>
        set((state) => {
          if (!state.currentProject) return state;
          const newRoot = deleteNodeInTree(state.currentProject.root, nodeId);
          if (!newRoot) return state; // 无法删除根节点
          const updatedProject = { ...state.currentProject, root: newRoot, updatedAt: Date.now() };
          return {
            currentProject: updatedProject,
            projects: state.projects.map((p) => p.id === updatedProject.id ? updatedProject : p),
          };
        }),

      deleteNodes: (nodeIds) =>
        set((state) => {
          if (!state.currentProject || nodeIds.length === 0) return state;

          const newRoot = { ...state.currentProject.root };
          
          // If root is included, we can't delete it
          if (nodeIds.includes(newRoot.id)) {
            return state;
          }

          function traverseAndDelete(node: MindMapNode) {
            // Filter out children that are in the deletion array
            node.children = node.children.filter(c => !nodeIds.includes(c.id));
            
            // Traverse remaining children
            node.children.forEach(traverseAndDelete);
          }

          traverseAndDelete(newRoot);
          const newProject = { ...state.currentProject, root: newRoot, updatedAt: Date.now() };

          return {
            projects: state.projects.map(p => p.id === newProject.id ? newProject : p),
            currentProject: newProject
          };
        }),

      appendChildren: (parentId, newChildren) =>
        set((state) => {
          if (!state.currentProject) return state;
          const newRoot = appendChildrenInTree(state.currentProject.root, parentId, newChildren);
          const updatedProject = { ...state.currentProject, root: newRoot, updatedAt: Date.now() };
          return {
            currentProject: updatedProject,
            projects: state.projects.map((p) => p.id === updatedProject.id ? updatedProject : p),
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
          
          const updatedCurrent = state.currentProject?.id === projectId 
            ? updatedProjects.find(p => p.id === projectId) || null 
            : state.currentProject;

          return {
            projects: updatedProjects,
            currentProject: updatedCurrent,
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

          const updatedCurrent = state.currentProject?.id === projectId
            ? updatedProjects.find(p => p.id === projectId) || null
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
    }),
    {
      name: 'mindforge-projects',
    }
  )
);
