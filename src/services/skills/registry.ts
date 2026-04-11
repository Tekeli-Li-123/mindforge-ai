import type { Skill, SkillDispatchResult, SkillHandlerContext } from './types';

/**
 * 技能注册中心 (Skill Registry)
 * 统一管理 AI 的所有能力，并提供分发和 Prompt 生成功能
 */
class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  /**
   * 注册一个新技能
   */
  register(skill: Skill) {
    this.skills.set(skill.definition.name, skill);
  }

  /**
   * 获取所有已注册技能的文档说明，用于注入 System Prompt
   */
  getSkillsPrompt(): string {
    if (this.skills.size === 0) return '无可用技能。';

    let prompt = '\n### 协作编辑协议 (Collaborative Protocol)\n';
    prompt += '当你认为需要通过操作工具来辅助用户时，请在回复中包含以下指令标签：\n\n';

    this.skills.forEach((skill) => {
      const def = skill.definition;
      prompt += `${def.name}: ${def.description}\n`;
      if (def.usageExample) {
        prompt += `   用法示例: ${def.usageExample}\n`;
      }
      // 可以在此处增加参数细节描述
      prompt += '\n';
    });

    return prompt;
  }

  /**
   * 从文本中提取并执行所有匹配的技能指令
   * @param content AI 返回的原始回答
   * @param context 执行上下文
   */
  async dispatch(content: string, context: SkillHandlerContext): Promise<SkillDispatchResult> {
    let cleanContent = content;
    const actionLogs: string[] = [];

    // 遍历所有注册的消息，执行正则匹配
    // 注意：我们按注册顺序执行，或者可以根据权重。
    for (const [_, skill] of this.skills) {
      // 必须带全局匹配标志以免只匹配第一个
      const regex = new RegExp(skill.regex.source, skill.regex.flags.includes('g') ? skill.regex.flags : skill.regex.flags + 'g');
      let match;
      
      // 注意：exec 在循环中需要重置 lastIndex (如果是同一个正则对象的多次使用)
      // 这里使用的是从 source 创建的新正则对象，索引从 0 开始。
      while ((match = regex.exec(content)) !== null) {
        try {
          // match[0] 是完整标签，match[1...n] 是捕获的参数
          const args = match.slice(1);
          const result = await skill.handler(args, context);
          
          if (typeof result === 'string') {
            actionLogs.push(result);
          }
          
          // 从 cleanContent 中移除已处理的标签
          cleanContent = cleanContent.replace(match[0], '');
        } catch (error: any) {
          console.error(`Skill Execution Error (${skill.definition.name}):`, error);
          actionLogs.push(`执行 [${skill.definition.name}] 失败: ${error.message}`);
        }
      }
    }

    return {
      cleanContent: cleanContent.trim(),
      actionLogs
    };
  }

  /**
   * 获取所有注册的技能实例
   */
  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }
}

// 导出单例
export const skillRegistry = new SkillRegistry();
