import type { Skill } from './types';
import { generateId } from '../../utils/mindmapHelpers';

/**
 * 添加节点技能
 * 用法: [[ADD:parentId:content]]
 */
export const AddNodeSkill: Skill = {
  definition: {
    name: 'ADD_NODE',
    description: '在指定父节点下添加一个新子节点。',
    parameters: [
      { name: 'parentId', type: 'string', description: '父节点的 ID', required: true },
      { name: 'content', type: 'string', description: '新节点的内容', required: true },
    ],
    usageExample: '[[ADD:node-123:新知识点]]',
  },
  regex: /\[\[ADD:([^:]+):([^\]]+)\]\]/g,
  handler: async (args, context) => {
    const [parentId, content] = args;
    const { appendChildren, allNodes } = context;
    
    if (!appendChildren) throw new Error('Context missing appendChildren');
    
    const parentNode = allNodes?.find((n: any) => n.id === parentId);
    
    appendChildren(parentId, [{
      id: generateId(),
      content: content.trim(),
      children: [],
      depth: 0,
      mastery: 0,
      expanded: true
    }]);

    return `在节点“${parentNode?.content || parentId}”下添加了“${content.trim()}”`;
  }
};

/**
 * 删除节点技能
 * 用法: [[DELETE:nodeId]]
 */
export const DeleteNodeSkill: Skill = {
  definition: {
    name: 'DELETE_NODE',
    description: '删除指定的节点及其所有子节点。',
    parameters: [
      { name: 'nodeId', type: 'string', description: '要删除的节点 ID', required: true },
    ],
    usageExample: '[[DELETE:node-123]]',
  },
  regex: /\[\[DELETE:([^\]]+)\]\]/g,
  handler: async (args, context) => {
    const [nodeId] = args;
    const { deleteNodes, allNodes } = context;
    
    if (!deleteNodes) throw new Error('Context missing deleteNodes');
    
    const targetNode = allNodes?.find((n: any) => n.id === nodeId);
    deleteNodes([nodeId]);

    return `删除了节点“${targetNode?.content || nodeId}”`;
  }
};

/**
 * 重命名节点技能
 * 用法: [[RENAME:nodeId:newContent]]
 */
export const RenameNodeSkill: Skill = {
  definition: {
    name: 'RENAME_NODE',
    description: '修改指定节点的文字内容。',
    parameters: [
      { name: 'nodeId', type: 'string', description: '要修改的节点 ID', required: true },
      { name: 'newContent', type: 'string', description: '新的文字内容', required: true },
    ],
    usageExample: '[[RENAME:node-123:更准确的名字]]',
  },
  regex: /\[\[RENAME:([^:]+):([^\]]+)\]\]/g,
  handler: async (args, context) => {
    const [nodeId, newContent] = args;
    const { updateNode, allNodes } = context;
    
    if (!updateNode) throw new Error('Context missing updateNode');
    
    const targetNode = allNodes?.find((n: any) => n.id === nodeId);
    updateNode(nodeId, { content: newContent.trim() });

    return `将节点“${targetNode?.content || nodeId}”重命名为“${newContent.trim()}”`;
  }
};
