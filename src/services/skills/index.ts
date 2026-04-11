import { skillRegistry } from './registry';
import { AddNodeSkill, DeleteNodeSkill, RenameNodeSkill } from './mapSkills';
import { SaveExplainSkill, MemoryFlushSkill } from './memorySkills';
import { UpdateMasterySkill } from './assessmentSkills';

/**
 * 初始化并注册所有 AI 技能
 */
export function initSkills() {
  // 导图操作
  skillRegistry.register(AddNodeSkill);
  skillRegistry.register(DeleteNodeSkill);
  skillRegistry.register(RenameNodeSkill);

  // 知识管理
  skillRegistry.register(SaveExplainSkill);
  skillRegistry.register(MemoryFlushSkill);

  // 评估系统
  skillRegistry.register(UpdateMasterySkill);

  console.log('🧠 [MindForge] AI 技能系统已初始化，共注册了', skillRegistry.getAllSkills().length, '项技能。');
}

export * from './types';
export * from './registry';
