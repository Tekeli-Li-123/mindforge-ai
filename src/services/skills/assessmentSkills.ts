import type { Skill } from './types';

/**
 * 更新掌握度技能
 * 用法: [[UPDATE_MASTERY:nodeId:value]]
 */
export const UpdateMasterySkill: Skill = {
  definition: {
    name: 'UPDATE_MASTERY',
    description: '根据用户在对话中表现出的对知识点的理解程度，动态更新该节点的掌握百分比。',
    parameters: [
      { name: 'nodeId', type: 'string', description: '节点 ID', required: true },
      { name: 'value', type: 'number', description: '掌握度数值 (0.0 到 1.0)', required: true },
    ],
    usageExample: '[[UPDATE_MASTERY:node-123:0.85]]',
  },
  regex: /\[\[UPDATE_MASTERY:([^:]+):([^\]]+)\]\]/g,
  handler: async (args, context) => {
    const [nodeId, valueStr] = args;
    const { updateNode, allNodes } = context;
    
    if (!updateNode) throw new Error('Context missing updateNode');
    
    const value = parseFloat(valueStr);
    if (isNaN(value)) throw new Error('Invalid mastery value');

    const targetNode = allNodes?.find((n: any) => n.id === nodeId);
    if (targetNode) {
      updateNode(nodeId, { mastery: Math.min(1, Math.max(0, value)) });
      return `已根据对话表现更新了“${targetNode.content}”的掌握度至 ${Math.round(value * 100)}%`;
    }
  }
};
