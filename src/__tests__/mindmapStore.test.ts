import { describe, it, expect, beforeEach } from "vitest";
import { useMindMapStore } from "../stores/mindmapStore";
import type { MindMapNode, MindMapProject } from "../types";

function createSampleProject(): MindMapProject {
  return {
    id: "test-proj-1",
    title: "测试项目",
    description: "用于测试的项目",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    root: {
      id: "root",
      content: "根节点",
      depth: 0,
      mastery: 0,
      expanded: true,
      children: [
        {
          id: "child-1",
          content: "子节点1",
          depth: 1,
          mastery: 0.5,
          expanded: true,
          children: [
            {
              id: "grandchild-1",
              content: "孙子节点1",
              depth: 2,
              mastery: 0,
              expanded: false,
              children: [],
            },
          ],
        },
        { id: "child-2", content: "子节点2", depth: 1, mastery: 0, expanded: true, children: [] },
      ],
    },
    cognitiveStates: {},
  };
}

function resetStore() {
  // clear persisted state
  localStorage.clear();
  // initialize with empty state
  useMindMapStore.setState({
    projects: [],
    currentProject: null,
    chatMessages: [],
    isChatOpen: false,
    selectedNodeId: null,
  });
}

beforeEach(() => {
  resetStore();
});

describe("mindmapStore", () => {
  describe("initial state", () => {
    it("should have empty projects array", () => {
      const { projects } = useMindMapStore.getState();
      expect(projects).toEqual([]);
    });

    it("should have null currentProject", () => {
      const { currentProject } = useMindMapStore.getState();
      expect(currentProject).toBeNull();
    });

    it("should have empty chatMessages", () => {
      const { chatMessages } = useMindMapStore.getState();
      expect(chatMessages).toEqual([]);
    });

    it("should have isChatOpen false", () => {
      const { isChatOpen } = useMindMapStore.getState();
      expect(isChatOpen).toBe(false);
    });

    it("should have null selectedNodeId", () => {
      const { selectedNodeId } = useMindMapStore.getState();
      expect(selectedNodeId).toBeNull();
    });
  });

  describe("addProject", () => {
    it("should add a project to the list", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      const { projects } = useMindMapStore.getState();
      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe("test-proj-1");
    });

    it("should add multiple projects", () => {
      const p1 = createSampleProject();
      const p2 = { ...createSampleProject(), id: "test-proj-2", title: "第二个项目" };

      useMindMapStore.getState().addProject(p1);
      useMindMapStore.getState().addProject(p2);

      const { projects } = useMindMapStore.getState();
      expect(projects).toHaveLength(2);
    });
  });

  describe("setCurrentProject", () => {
    it("should set current project", () => {
      const project = createSampleProject();
      useMindMapStore.getState().setCurrentProject(project);
      const { currentProject } = useMindMapStore.getState();
      expect(currentProject?.id).toBe("test-proj-1");
      expect(currentProject?.title).toBe("测试项目");
    });

    it("should allow setting to null", () => {
      const project = createSampleProject();
      useMindMapStore.getState().setCurrentProject(project);
      useMindMapStore.getState().setCurrentProject(null as any);
      const { currentProject } = useMindMapStore.getState();
      expect(currentProject).toBeNull();
    });
  });

  describe("updateProject", () => {
    it("should update project title", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      useMindMapStore.getState().updateProject("test-proj-1", { title: "更新后的标题" });

      const { projects, currentProject } = useMindMapStore.getState();
      expect(projects[0].title).toBe("更新后的标题");
      expect(currentProject?.title).toBe("更新后的标题");
    });

    it("should update project description", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      useMindMapStore.getState().updateProject("test-proj-1", { description: "新描述" });

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject?.description).toBe("新描述");
    });

    it("should not affect other projects", () => {
      const p1 = createSampleProject();
      const p2 = { ...createSampleProject(), id: "test-proj-2", title: "其他项目" };

      useMindMapStore.getState().addProject(p1);
      useMindMapStore.getState().addProject(p2);

      useMindMapStore.getState().updateProject("test-proj-1", { title: "仅更新项目1" });

      const { projects } = useMindMapStore.getState();
      expect(projects[0].title).toBe("仅更新项目1");
      expect(projects[1].title).toBe("其他项目");
    });
  });

  describe("deleteProject", () => {
    it("should remove a project by id", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);

      useMindMapStore.getState().deleteProject("test-proj-1");

      const { projects } = useMindMapStore.getState();
      expect(projects).toHaveLength(0);
    });

    it("should clear currentProject if it matches deleted project", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      useMindMapStore.getState().deleteProject("test-proj-1");

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject).toBeNull();
    });

    it("should keep currentProject if different project is deleted", () => {
      const p1 = createSampleProject();
      const p2 = { ...createSampleProject(), id: "test-proj-2" };

      useMindMapStore.getState().addProject(p1);
      useMindMapStore.getState().addProject(p2);
      useMindMapStore.getState().setCurrentProject(p1);

      useMindMapStore.getState().deleteProject("test-proj-2");

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject?.id).toBe("test-proj-1");
    });
  });

  describe("duplicateProject", () => {
    it("should create a copy with a new id", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);

      useMindMapStore.getState().duplicateProject("test-proj-1");

      const { projects } = useMindMapStore.getState();
      expect(projects).toHaveLength(2);
      expect(projects[0].id).toBe("test-proj-1");
      expect(projects[1].id).not.toBe("test-proj-1");
      expect(projects[1].title).toBe("测试项目 (副本)");
    });

    it("should set the duplicate as currentProject", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      useMindMapStore.getState().duplicateProject("test-proj-1");

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject?.id).not.toBe("test-proj-1");
      expect(currentProject?.title).toBe("测试项目 (副本)");
    });
  });

  describe("updateNode", () => {
    it("should update node content", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      useMindMapStore.getState().updateNode("child-1", { content: "更新后的子节点" });

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject?.root.children[0].content).toBe("更新后的子节点");
    });

    it("should update grandchild node", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      useMindMapStore
        .getState()
        .updateNode("grandchild-1", { content: "更新后的孙子节点", mastery: 0.8 });

      const { currentProject } = useMindMapStore.getState();
      const grandchild = currentProject?.root.children[0].children[0];
      expect(grandchild?.content).toBe("更新后的孙子节点");
      expect(grandchild?.mastery).toBe(0.8);
    });

    it("should update root node", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      useMindMapStore.getState().updateNode("root", { content: "新根节点" });

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject?.root.content).toBe("新根节点");
    });
  });

  describe("deleteNode", () => {
    it("should delete a child node", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      useMindMapStore.getState().deleteNode("child-2");

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject?.root.children).toHaveLength(1);
      expect(currentProject?.root.children[0].id).toBe("child-1");
    });

    it("should delete grandchildren", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      useMindMapStore.getState().deleteNode("grandchild-1");

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject?.root.children[0].children).toHaveLength(0);
    });

    it("should not delete root node", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      useMindMapStore.getState().deleteNode("root");

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject).not.toBeNull();
      expect(currentProject?.root.id).toBe("root");
    });
  });

  describe("deleteNodes (bulk)", () => {
    it("should delete multiple nodes", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      useMindMapStore.getState().deleteNodes(["child-1", "child-2"]);

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject?.root.children).toHaveLength(0);
    });

    it("should not delete if root is included", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      useMindMapStore.getState().deleteNodes(["root", "child-1"]);

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject?.root.children).toHaveLength(2); // unchanged
    });
  });

  describe("appendChildren", () => {
    it("should add child to existing node", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      const newNode: MindMapNode = {
        id: "new-child-1",
        content: "新添加的节点",
        depth: 2,
        mastery: 0,
        expanded: true,
        children: [],
      };

      useMindMapStore.getState().appendChildren("child-1", [newNode]);

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject?.root.children[0].children).toHaveLength(2);
      expect(currentProject?.root.children[0].children[1].content).toBe("新添加的节点");
    });

    it("should add child to root", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      const newNode: MindMapNode = {
        id: "new-root-child",
        content: "新根子节点",
        depth: 1,
        mastery: 0,
        expanded: true,
        children: [],
      };

      useMindMapStore.getState().appendChildren("root", [newNode]);

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject?.root.children).toHaveLength(3);
    });

    it("should set parent expanded to true when adding children", () => {
      const project = createSampleProject();
      // Set child-2 as collapsed
      project.root.children[1].expanded = false;
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      const newNode: MindMapNode = {
        id: "new-to-collapsed",
        content: "添加到折叠节点",
        depth: 2,
        mastery: 0,
        expanded: true,
        children: [],
      };

      useMindMapStore.getState().appendChildren("child-2", [newNode]);

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject?.root.children[1].expanded).toBe(true);
    });
  });

  describe("updateProjectRoot", () => {
    it("should replace the root of a project", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      const newRoot: MindMapNode = {
        id: "new-root",
        content: "全新根节点",
        depth: 0,
        mastery: 0,
        expanded: true,
        children: [],
      };

      useMindMapStore.getState().updateProjectRoot("test-proj-1", newRoot);

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject?.root.content).toBe("全新根节点");
      expect(currentProject?.root.children).toHaveLength(0);
    });
  });

  describe("updateProjectAIConfig", () => {
    it("should set AI config", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      useMindMapStore.getState().updateProjectAIConfig("test-proj-1", {
        persona: "测试导师",
        explainStyle: "expert",
      });

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject?.aiConfig?.persona).toBe("测试导师");
      expect(currentProject?.aiConfig?.explainStyle).toBe("expert");
    });
  });

  describe("chat", () => {
    it("should toggle chat open/close", () => {
      const { isChatOpen } = useMindMapStore.getState();
      expect(isChatOpen).toBe(false);

      useMindMapStore.getState().toggleChat();
      expect(useMindMapStore.getState().isChatOpen).toBe(true);

      useMindMapStore.getState().toggleChat();
      expect(useMindMapStore.getState().isChatOpen).toBe(false);
    });

    it("should add chat messages", () => {
      useMindMapStore.getState().addChatMessage({
        id: "msg-1",
        role: "user",
        content: "你好",
        timestamp: Date.now(),
      });

      const { chatMessages } = useMindMapStore.getState();
      expect(chatMessages).toHaveLength(1);
      expect(chatMessages[0].content).toBe("你好");
    });

    it("should clear chat messages", () => {
      useMindMapStore.getState().addChatMessage({
        id: "msg-1",
        role: "user",
        content: "你好",
        timestamp: Date.now(),
      });

      useMindMapStore.getState().clearChat();
      const { chatMessages } = useMindMapStore.getState();
      expect(chatMessages).toHaveLength(0);
    });
  });

  describe("selectNode", () => {
    it("should set selectedNodeId", () => {
      useMindMapStore.getState().selectNode("child-1");
      expect(useMindMapStore.getState().selectedNodeId).toBe("child-1");
    });

    it("should clear selectedNodeId with null", () => {
      useMindMapStore.getState().selectNode("child-1");
      useMindMapStore.getState().selectNode(null);
      expect(useMindMapStore.getState().selectedNodeId).toBeNull();
    });
  });

  describe("addProjectMemory", () => {
    it("should add a memory to project", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      useMindMapStore.getState().addProjectMemory("test-proj-1", "这是一个重要的知识点");

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject?.memories).toHaveLength(1);
      expect(currentProject?.memories[0]).toBe("这是一个重要的知识点");
    });
  });

  describe("updateProjectMemories", () => {
    it("should replace all memories", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      const newMemories = ["记忆1", "记忆2", "记忆3"];
      useMindMapStore.getState().updateProjectMemories("test-proj-1", newMemories);

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject?.memories).toHaveLength(3);
      expect(currentProject?.memories).toEqual(newMemories);
    });
  });

  describe("updateProjectCognitiveConfig", () => {
    it("should set cognitive config", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      useMindMapStore.getState().updateProjectCognitiveConfig("test-proj-1", {
        preset: "exam",
        customWeights: { recall: 0.4, comprehension: 0.3, application: 0.2, analysis: 0.1 },
      });

      const { currentProject } = useMindMapStore.getState();
      expect(currentProject?.cognitiveConfig?.preset).toBe("exam");
      expect(currentProject?.cognitiveConfig?.customWeights?.recall).toBe(0.4);
    });
  });

  describe("updateNodeCognitiveState", () => {
    it("should update cognitive state for a node", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      useMindMapStore.getState().updateNodeCognitiveState("child-1", {
        alpha: 10,
        beta: 2,
        lastUpdate: Date.now(),
        evidenceHistory: [],
      });

      const { currentProject } = useMindMapStore.getState();
      // cognitive state should exist
      expect(currentProject?.cognitiveStates?.["child-1"]).toBeDefined();
      // mastery should be recalculated: 10/(10+2) = 0.833...
      expect(currentProject?.root.children[0].mastery).toBeCloseTo(0.833, 1);
    });

    it("should update mastery for nested nodes", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);
      useMindMapStore.getState().setCurrentProject(project);

      useMindMapStore.getState().updateNodeCognitiveState("grandchild-1", {
        alpha: 3,
        beta: 1,
        lastUpdate: Date.now(),
        evidenceHistory: [],
      });

      const { currentProject } = useMindMapStore.getState();
      // 3/(3+1) = 0.75
      expect(currentProject?.root.children[0].children[0].mastery).toBeCloseTo(0.75, 1);
    });
  });

  describe("persistence", () => {
    it("should persist to localStorage", () => {
      const project = createSampleProject();
      useMindMapStore.getState().addProject(project);

      const saved = localStorage.getItem("mindforge-projects");
      expect(saved).not.toBeNull();

      if (saved) {
        const parsed = JSON.parse(saved);
        expect(parsed.state.projects).toHaveLength(1);
        expect(parsed.state.projects[0].title).toBe("测试项目");
      }
    });
  });
});
