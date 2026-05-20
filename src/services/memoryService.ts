import type { ChatMessage, MindMapNode } from "../types";
import { fetchFromAI } from "./aiService";
import { safeParseJson } from "../utils/jsonExtractor";

/**
 * 记忆引擎服务 (Memory Engine Service)
 * 处理对话压缩、知识提取和长期记忆同步
 */
export const memoryService = {
  /**
   * 启发式 Token 估算（用于判定是否触发展压缩）
   * 中文环境下约 1 个汉字 = 1.5 - 2 tokens
   */
  estimateTokens(messages: ChatMessage[]): number {
    const totalChars = messages.reduce((acc, msg) => acc + msg.content.length, 0);
    return Math.ceil(totalChars * 0.8); // 粗略估算，根据模型不同会有调整
  },

  /**
   * 对话提取与沉淀 (Memory Extraction)
   * 分析最近的几条对话，提取出新的知识事实或掌握度变更
   */
  async extractInsights(
    messages: ChatMessage[],
    nodes: MindMapNode[],
  ): Promise<{
    facts: string[];
    masteryUpdates: { nodeId: string; score: number }[];
  }> {
    // 选取最近的 N 条对话进行分析
    const recentMessages = messages.slice(-6);
    const conversationContext = recentMessages.map((m) => `${m.role}: ${m.content}`).join("\n");

    // 注入当前节点快照供 AI 参考 ID
    const nodeIndex = nodes.map((n) => `- [${n.id}] ${n.content}`).join("\n");

    const systemMsg = `你是一个知识萃取专家。
你的任务是分析一段学习对话，并提取出两个核心信息：
1. **事实性沉淀 (Facts)**: 关于该学科的绝对事实、定义或用户的深刻见解。
2. **掌握度更新 (Mastery)**: 根据用户在对话中展现出的解释深度，对他所讨论的知识点进行 0.0-1.0 的打分。

确保输出是标准的 JSON 格式：
{
  "facts": ["事实1", "事实2"],
  "masteryUpdates": [
     { "nodeId": "节点ID", "score": 0.9 }
  ]
}

如果没有发现相关信息，请返回空数组。不要包含任何多余文字。

当前可用的节点索引：
${nodeIndex}`;

    try {
      const rawJson = await fetchFromAI(
        systemMsg,
        `请分析以下对话并提取见解：\n\n${conversationContext}`,
      );
      const result = safeParseJson(rawJson, { facts: [], masteryUpdates: [] });
      return result ?? { facts: [], masteryUpdates: [] };
    } catch (e) {
      console.error("Failed to extract insights:", e);
      return { facts: [], masteryUpdates: [] };
    }
  },

  /**
   * 对话压缩 (Compaction)
   * 将旧消息总结为一段紧凑的摘要，以释放上下文窗口
   */
  async summarizeHistory(messages: ChatMessage[]): Promise<string> {
    const systemMsg =
      "你是一个高效的消息摘要助手。请将以下对话历史压缩为一段极其精炼的摘要，保留所有核心事实、结论和进展，删除冗余的寒暄。";
    const historyText = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

    try {
      return await fetchFromAI(systemMsg, historyText);
    } catch (e) {
      console.error("Failed to summarize history:", e);
      return "（压缩摘要失败）";
    }
  },
};
