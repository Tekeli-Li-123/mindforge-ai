import { projectRepo, memoryRepo } from "../db/repository.js";
import crypto from "node:crypto";
import type { MindMapNode } from "../types/index.js";

export interface ExtractedMemory {
  fact: string;
  source: string; // node ID or 'chat'
}

export interface MemoryConsolidationResult {
  extracted: ExtractedMemory[];
  summary: string;
}

/**
 * MemoryService — extracts facts from mind map nodes,
 * consolidates duplicate/overlapping memories, and manages
 * the long-term memory store for each project.
 */
export const memoryService = {
  /**
   * Extract facts from a mind map node tree.
   * Traverses all nodes and extracts meaningful facts based on content.
   */
  extractFromMindMap(root: MindMapNode): ExtractedMemory[] {
    const facts: ExtractedMemory[] = [];
    const visited = new Set<string>();

    function traverse(node: MindMapNode) {
      if (visited.has(node.id)) return;
      visited.add(node.id);

      // Extract fact from node content if it's meaningful
      const content = node.content?.trim();
      if (content && content.length > 3) {
        facts.push({
          fact: content,
          source: node.id,
        });
      }

      // Extract from note if present
      if (node.note?.trim()) {
        facts.push({
          fact: `[笔记] ${node.note.trim()}`,
          source: node.id,
        });
      }

      // Extract from explanation if present
      if (node.explanation?.trim()) {
        facts.push({
          fact: `[解释] ${node.explanation.trim()}`,
          source: node.id,
        });
      }

      for (const child of node.children) {
        traverse(child);
      }
    }

    traverse(root);
    return facts;
  },

  /**
   * Consolidate memories: deduplicate and merge overlapping facts.
   * Simple strategy: exact match dedup + prefix overlap merging.
   */
  consolidate(memories: ExtractedMemory[]): ExtractedMemory[] {
    const seen = new Set<string>();
    const result: ExtractedMemory[] = [];

    for (const mem of memories) {
      const key = mem.fact.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);

      // Check for near-duplicates (one is prefix of another)
      let isDuplicate = false;
      for (const existing of result) {
        const eKey = existing.fact.toLowerCase().trim();
        if (eKey.includes(key) || key.includes(eKey)) {
          // Keep the longer version
          if (key.length > eKey.length) {
            existing.fact = mem.fact;
            existing.source = mem.source;
          }
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        result.push({ ...mem });
      }
    }

    return result;
  },

  /**
   * Sync mind map facts into project memories.
   * Extracts facts from the mind map, consolidates,
   * and updates the project's memory store.
   */
  syncFromMindMap(projectId: string): ExtractedMemory[] {
    const project = projectRepo.getById(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);

    const extracted = this.extractFromMindMap(project.root);
    const consolidated = this.consolidate(extracted);

    // Save each extracted fact as a memory
    for (const mem of consolidated) {
      const existing = memoryRepo.list(projectId);
      const exists = existing.some((e) => e.fact === mem.fact);
      if (!exists) {
        memoryRepo.create({
          id: crypto.randomUUID(),
          projectId,
          fact: mem.fact,
          source: mem.source,
        });
      }
    }

    return consolidated;
  },

  /**
   * Generate a summary of all memories for a project.
   */
  generateSummary(projectId: string): string {
    const memories = memoryRepo.list(projectId);
    if (memories.length === 0) return "暂无记忆";

    const facts = memories.map((m) => m.fact);
    const categories: Record<string, string[]> = {
      概念: [],
      笔记: [],
      解释: [],
      其他: [],
    };

    for (const fact of facts) {
      if (fact.startsWith("[笔记]")) categories["笔记"].push(fact.replace("[笔记] ", ""));
      else if (fact.startsWith("[解释]")) categories["解释"].push(fact.replace("[解释] ", ""));
      else if (fact.length > 20) categories["概念"].push(fact);
      else categories["其他"].push(fact);
    }

    const parts: string[] = [];
    for (const [cat, items] of Object.entries(categories)) {
      if (items.length > 0) {
        parts.push(`${cat}(${items.length}条)`);
      }
    }

    return parts.join("、");
  },
};
