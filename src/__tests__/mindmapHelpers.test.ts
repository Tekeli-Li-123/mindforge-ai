import { describe, it, expect } from "vitest";
import {
  decodeHTMLEntities,
  countNodes,
  averageMastery,
  generateId,
  getMasteryColor,
  getMasteryLabel,
  flattenNodes,
  flattenNodesWithPaths,
  findNodePath,
  isSemanticDuplicate,
} from "../utils/mindmapHelpers";
import type { MindMapNode } from "../types";

function createMockNode(overrides: Partial<MindMapNode> = {}): MindMapNode {
  return {
    id: "node-test",
    content: "Test Node",
    depth: 1,
    mastery: 0.5,
    expanded: true,
    children: [],
    ...overrides,
  };
}

function makeEntity(name: string): string {
  return String.fromCharCode(38) + name + String.fromCharCode(59);
}

function hexEntity(code: string): string {
  return (
    String.fromCharCode(38) +
    String.fromCharCode(35) +
    String.fromCharCode(120) +
    code +
    String.fromCharCode(59)
  );
}

describe("decodeHTMLEntities", () => {
  it("should return empty string for falsy input", () => {
    expect(decodeHTMLEntities("")).toBe("");
    expect(decodeHTMLEntities(null as unknown as string)).toBe("");
    expect(decodeHTMLEntities(undefined as unknown as string)).toBe("");
  });

  it("should decode common HTML entities", () => {
    expect(decodeHTMLEntities(makeEntity("amp"))).toBe("&");
    expect(decodeHTMLEntities(makeEntity("lt"))).toBe("<");
    expect(decodeHTMLEntities(makeEntity("gt"))).toBe(">");
  });

  it("should decode hex HTML entities", () => {
    expect(decodeHTMLEntities(hexEntity("786c") + String.fromCharCode(30424))).toBe(
      String.fromCharCode(30828, 30424),
    );
  });

  it("should process text without entities unchanged", () => {
    expect(decodeHTMLEntities("Hello World")).toBe("Hello World");
  });
});

describe("countNodes", () => {
  it("should return 1 for a leaf node", () => {
    expect(countNodes(createMockNode())).toBe(1);
  });

  it("should count nested children", () => {
    const node = createMockNode({
      children: [
        createMockNode({
          id: "child1",
          children: [createMockNode({ id: "grandchild" })],
        }),
        createMockNode({ id: "child2" }),
      ],
    });
    expect(countNodes(node)).toBe(4);
  });
});

describe("averageMastery", () => {
  it("should return 0.5 for a single node", () => {
    expect(averageMastery(createMockNode({ mastery: 0.5 }))).toBe(0.5);
  });

  it("should compute average across all nodes", () => {
    const node = createMockNode({
      mastery: 1.0,
      children: [
        createMockNode({ id: "c1", mastery: 0.5 }),
        createMockNode({ id: "c2", mastery: 0.0 }),
      ],
    });
    expect(averageMastery(node)).toBeCloseTo(0.5, 5);
  });
});

describe("generateId", () => {
  it("should generate unique IDs", () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it("should start with node- prefix", () => {
    expect(generateId()).toMatch(/^node-/);
  });
});

describe("getMasteryColor", () => {
  it("should return red for 0 mastery", () => {
    expect(getMasteryColor(0)).toBe("hsla(0, 70%, 55%, 1)");
  });

  it("should return green for 1 mastery", () => {
    expect(getMasteryColor(1)).toBe("hsla(120, 70%, 55%, 1)");
  });

  it("should return green-yellow for 0.5 mastery", () => {
    expect(getMasteryColor(0.5)).toBe("hsla(60, 70%, 55%, 1)");
  });

  it("should support custom alpha", () => {
    expect(getMasteryColor(0.5, 0.3)).toBe("hsla(60, 70%, 55%, 0.3)");
  });
});

describe("getMasteryLabel", () => {
  it("should return 精通 for mastery >= 0.8", () => {
    expect(getMasteryLabel(0.8)).toBe("\u7CBE\u901A");
    expect(getMasteryLabel(1.0)).toBe("\u7CBE\u901A");
  });

  it("should return 熟练 for mastery >= 0.6", () => {
    expect(getMasteryLabel(0.6)).toBe("\u719F\u7EC3");
    expect(getMasteryLabel(0.79)).toBe("\u719F\u7EC3");
  });

  it("should return 了解 for mastery >= 0.3", () => {
    expect(getMasteryLabel(0.3)).toBe("\u4E86\u89E3");
    expect(getMasteryLabel(0.59)).toBe("\u4E86\u89E3");
  });

  it("should return 入门 for mastery > 0", () => {
    expect(getMasteryLabel(0.01)).toBe("\u5165\u95E8");
    expect(getMasteryLabel(0.29)).toBe("\u5165\u95E8");
  });

  it("should return 未学 for mastery = 0", () => {
    expect(getMasteryLabel(0)).toBe("\u672A\u5B66");
  });
});

describe("flattenNodes", () => {
  it("should return single node array for leaf", () => {
    const node = createMockNode();
    expect(flattenNodes(node)).toHaveLength(1);
  });

  it("should flatten nested structure", () => {
    const node = createMockNode({
      children: [
        createMockNode({
          id: "c1",
          children: [createMockNode({ id: "gc1" })],
        }),
        createMockNode({ id: "c2" }),
      ],
    });
    const flat = flattenNodes(node);
    expect(flat).toHaveLength(4);
    expect(flat.map((n) => n.id)).toEqual(["node-test", "c1", "gc1", "c2"]);
  });
});

describe("flattenNodesWithPaths", () => {
  it("should include full path for each node", () => {
    const node = createMockNode({
      content: "Root",
      children: [
        createMockNode({
          id: "c1",
          content: "Child1",
          children: [createMockNode({ id: "gc1", content: "Grandchild" })],
        }),
      ],
    });
    const result = flattenNodesWithPaths(node);
    expect(result).toHaveLength(3);
    expect(result[0].path).toBe("Root");
    expect(result[1].path).toBe("Root > Child1");
    expect(result[2].path).toBe("Root > Child1 > Grandchild");
  });
});

describe("findNodePath", () => {
  it("should return the path to a node", () => {
    const node = createMockNode({
      children: [
        createMockNode({
          id: "c1",
          children: [createMockNode({ id: "target" })],
        }),
      ],
    });
    const path = findNodePath(node, "target");
    expect(path).not.toBeNull();
    expect(path!.map((n) => n.id)).toEqual(["node-test", "c1", "target"]);
  });

  it("should return null if target not found", () => {
    const node = createMockNode({
      children: [createMockNode({ id: "c1" })],
    });
    expect(findNodePath(node, "nonexistent")).toBeNull();
  });

  it("should return [root] if root is target", () => {
    const node = createMockNode();
    expect(findNodePath(node, "node-test")).toEqual([node]);
  });
});

describe("isSemanticDuplicate", () => {
  it("should detect identical strings", () => {
    expect(isSemanticDuplicate("K-Means", "K-Means")).toBe(true);
  });

  it("should detect duplicates with noise words stripped", () => {
    expect(isSemanticDuplicate("K-Means\u7B97\u6CD5", "K-Means")).toBe(true);
    expect(isSemanticDuplicate("\u805A\u7C7B\u7B97\u6CD5", "\u805A\u7C7B")).toBe(true);
  });

  it("should return false for different concepts", () => {
    expect(isSemanticDuplicate("K-Means", "DBSCAN")).toBe(false);
  });

  it("should handle empty inputs", () => {
    expect(isSemanticDuplicate("", "test")).toBe(false);
    expect(isSemanticDuplicate("test", "")).toBe(false);
    expect(isSemanticDuplicate("", "")).toBe(false);
  });

  it("should detect substring matches after normalization", () => {
    expect(
      isSemanticDuplicate("\u673A\u5668\u5B66\u4E60", "\u673A\u5668\u5B66\u4E60\u7B97\u6CD5"),
    ).toBe(true);
    expect(
      isSemanticDuplicate("\u673A\u5668\u5B66\u4E60\u7B97\u6CD5", "\u673A\u5668\u5B66\u4E60"),
    ).toBe(true);
  });
});
