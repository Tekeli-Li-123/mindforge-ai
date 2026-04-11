import type { Skill } from './types';

/**
 * 存入详细解释技能
 * 用法: [[SAVE_EXPLAIN:nodeId:content]]
 */
export const SaveExplainSkill: Skill = {
  definition: {
    name: 'SAVE_EXPLAIN',
    description: '当用户询问特定概念或要求记录详细解释时，将内容持久化保存到该导图节点的元数据中。',
    parameters: [
      { name: 'nodeId', type: 'string', description: '节点 ID', required: true },
      { name: 'content', type: 'string', description: '详细的知识解释内容', required: true },
    ],
    usageExample: '[[SAVE_EXPLAIN:node-123:这是一个关于...的详细说明]]',
  },
  regex: /\[\[SAVE_EXPLAIN:([^:]+):([^\]]+)\]\]/g,
  handler: async (args, context) => {
    const [nodeId, explainContent] = args;
    const { updateNode, allNodes } = context;
    
    if (!updateNode) throw new Error('Context missing updateNode');
    
    const targetNode = allNodes?.find((n: any) => n.id === nodeId);
    
    if (targetNode) {
      const oldTags = targetNode.tags || [];
      const newTags = oldTags.includes('explained') ? oldTags : [...oldTags, 'explained'];
      updateNode(nodeId, { 
        explanation: explainContent.trim(), 
        tags: newTags 
      });
      return `已将详细解释同步至节点“${targetNode.content}”`;
    }
  }
};

/**
 * 记忆整理技能 (Memory Flush)
 * 用法: [[MEMORY_FLUSH]]
 * 触发 AI 分析最近对话，沉淀核心见解并更新掌握度。
 */
export const MemoryFlushSkill: Skill = {
  definition: {
    name: 'MEMORY_FLUSH',
    description: '整理当前对话中的核心见解。当你认为一段讨论非常有价值，包含重要结论或能评估用户掌握度时，请调用此技能。',
    parameters: [],
    usageExample: '[[MEMORY_FLUSH]]',
  },
  regex: /\[\[MEMORY_FLUSH\]\]/g,
  handler: async (_args, context) => {
    const { messages, allNodes, addProjectMemory, updateNode, projectId } = context;
    
    // 动态加载记忆转换逻辑
    const { memoryService } = await import('../memoryService');
    const insights = await memoryService.extractInsights(messages, allNodes);

    let log = "记忆整理完成：";
    
    // 1. 沉淀事实
    if (insights.facts.length > 0) {
      insights.facts.forEach(fact => addProjectMemory(projectId, fact));
      log += ` 沉淀了 ${insights.facts.length} 条见解;`;
    }

    // 2. 更新掌握度
    if (insights.masteryUpdates.length > 0) {
      insights.masteryUpdates.forEach(update => {
        updateNode(update.nodeId, { mastery: update.score });
      });
      log += ` 更新了 ${insights.masteryUpdates.length} 个节点的掌握度;`;
    }

    if (insights.facts.length === 0 && insights.masteryUpdates.length === 0) {
      log = "整理完成，暂无新的核心见解沉淀。";
    }

    return log;
  }
};
