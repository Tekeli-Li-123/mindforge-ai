/**
 * MindForge AI 技能系统类型定义
 */

// 增加一个运行时常量，防止模块因仅包含类型而被解析器认为没有任何导出
export const SKILL_VERSION = '1.0.0';

export type SkillParameter = {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
};

export type SkillDefinition = {
  /** 技能唯一标识，如 "ADD_NODE" */
  name: string;
  /** 供 LLM 阅读的描述，说明该技能的用途及何时调用 */
  description: string;
  /** 参数定义，帮助生成 Prompt 说明 */
  parameters: SkillParameter[];
  /** 匹配模式的示例，例如 "[[ADD:parentId:content]]" */
  usageExample?: string;
};

export type SkillHandlerContext = {
  [key: string]: any;
};

export type Skill = {
  definition: SkillDefinition;
  /** 
   * 处理函数
   * @param args 正则解析出的参数数组
   * @param context 执行上下文（如 store 的方法）
   */
  handler: (args: string[], context: SkillHandlerContext) => Promise<string | void>;
  /** 
   * 用于从 AI 文本中识别该指令的正则表达式
   */
  regex: RegExp;
};

export type SkillDispatchResult = {
  /** 处理后的干净文本（移除指令标签） */
  cleanContent: string;
  /** 执行过程中的日志记录 */
  actionLogs: string[];
};
