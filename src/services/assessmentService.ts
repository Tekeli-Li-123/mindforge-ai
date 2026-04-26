import { fetchFromAI } from './aiService';
import type { LLMEvidence, QuizQuestion, MindMapNode } from '../types';

/**
 * 智能自适应考核服务
 */
export class AssessmentService {
  /**
   * 批量生成考核题目
   */
  static async generateAssessmentBatch(
    node: MindMapNode,
    contextPath: string,
    customDifficulty: string = '进阶水平：侧重概念的理解与简单应用。',
    count: number = 3,
    allowedTypes: ('choice' | 'trueFalse' | 'openEnded')[] = ['openEnded']
  ): Promise<QuizQuestion[]> {
    const typeDesc = {
      choice: '单选题 (choice)：提供 4 个选项，1 个正确答案。',
      trueFalse: '判断题 (trueFalse)：判断表述正误。',
      openEnded: '问答题 (openEnded)：开放式回答，考查深度理解。'
    };

    const systemMsg = `你是一个专业的教育评估专家。
    
【诊断人设/要求】：${customDifficulty}
允许题型：${allowedTypes && allowedTypes.length > 0 ? allowedTypes.map(t => typeDesc[t]).join('；') : '由你根据知识点特性决定 (单选/判断/问答) '}

【规则】：
1. 如果未指定固定题目数量，请根据知识点深度自行决定生成 2-5 道题。
2. 题目深度必须严格匹配目标难度。
3. 必须返回标准的 JSON 数组格式。

JSON 数组项格式：
{
  "type": "choice" | "trueFalse" | "openEnded",
  "question": "题目内容",
  "options": ["A", "B", "C", "D"], // 仅限选择题
  "correctAnswer": "正确项内容", // 非问答题必填
  "referenceAnswer": "参考标准答案", // 仅限问答题
  "explanation": "题目解析",
  "difficulty": "从 easy, medium, hard 中选择一个最贴切的描述"
}`;

    const userMsg = `知识点：${node.content}\n背景：${node.explanation || '无'}\n路径：${contextPath}\n\n${count ? `请生成 ${count} 道题目：` : '请自主决定题目数量和题型并生成题目：'}`;

    const rawJson = await fetchFromAI(systemMsg, userMsg);
    try {
      const cleanJson = rawJson.replace(/```json\n?/, '').replace(/```/, '').trim();
      const parsed = JSON.parse(cleanJson);
      const results = Array.isArray(parsed) ? parsed : [parsed];
      
      return results.map((q, index) => ({
        id: `q-${Date.now()}-${index}`,
        type: q.type || 'openEnded',
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        referenceAnswer: q.referenceAnswer,
        explanation: q.explanation,
        relatedNodeId: node.id,
        difficulty: q.difficulty || 'medium',
      }));
    } catch (e) {
      console.error('Failed to generate batch:', rawJson);
      throw new Error('AI 生成题目失败，请重试。');
    }
  }

  /**
   * 针对评估中的单道错误题目进行原地替换生成
   */
  static async regenerateQuestion(
    node: MindMapNode,
    contextPath: string,
    previousQuestion: string,
    customDifficulty: string,
    allowedTypes: ('choice' | 'trueFalse' | 'openEnded')[]
  ): Promise<QuizQuestion> {
    const systemInstruction = `用户反馈上一道题目有误或不适用，请生成一道全新的替代题目。
    【被反馈的旧题目】：${previousQuestion}
    请确保新题目与旧题目完全不同，但仍保持同样的难度级别和知识点相关性。`;

    const batch = await this.generateAssessmentBatch(
      node,
      contextPath,
      `${customDifficulty}\n\n${systemInstruction}`,
      1,
      allowedTypes
    );

    return batch[0];
  }

  /**
   * 生成针对特定节点的单道考核题目 (保留兼容性)
   */
  static async generateAssessmentQuestion(
    node: MindMapNode,
    contextPath: string,
    difficulty: 'easy' | 'medium' | 'hard' = 'medium'
  ): Promise<QuizQuestion> {
    const batch = await this.generateAssessmentBatch(node, contextPath, difficulty, 1, ['openEnded']);
    return batch[0];
  }

  /**
   * 提取用户回答中的评估证据 (LLM 观测器)
   */
  static async extractEvidence(
    nodeName: string,
    nodeDefinition: string,
    question: string,
    referenceAnswer: string,
    userAnswer: string
  ): Promise<LLMEvidence> {
    const systemMsg = `你是一个严格的认知诊断专家。请根据用户的回答，评估其在知识点“${nodeName}”上的表现。

【知识点定义/背景】${nodeDefinition}
【参考标准答案】${referenceAnswer}

请根据用户的【回答】进行深度分析，并输出一个严格的 JSON 对象。

JSON 字段要求：
- recall: 0 到 1 之间的数字。用户能否准确回忆核心事实/定义？
- comprehension: 0 到 1 之间的数字。用户是否展示了深层理解而非死记硬背？
- application: 0 到 1 之间的数字。用户是否能给出恰当例子或关联实际场景？
- analysis: 0 到 1 之间的数字。用户是否能辨析常见误解或分析原因？
- feedback: 一段鼓励性但诚实的反馈（不超过 100 字）。
- errorType: "factual" | "conceptual" | "logical" | "none"。
- suggestion: 一条针对性的后续学习建议。

只输出 JSON，不要任何额外文字。`;

    const userMsg = `【题目】${question}\n【用户回答】${userAnswer}\n\n请进行认知诊断评估：`;

    const rawJson = await fetchFromAI(systemMsg, userMsg);
    try {
      const cleanJson = rawJson.replace(/```json\n?/, '').replace(/```/, '').trim();
      const parsed = JSON.parse(cleanJson);
      
      const clamp = (val: any) => Math.min(1, Math.max(0, typeof val === 'number' ? val : parseFloat(val) || 0));

      return {
        recall: clamp(parsed.recall),
        comprehension: clamp(parsed.comprehension),
        application: clamp(parsed.application),
        analysis: clamp(parsed.analysis),
        feedback: parsed.feedback || '感谢你的作答。',
        errorType: parsed.errorType || 'none',
        suggestion: parsed.suggestion || '建议继续深入学习。',
      };
    } catch (e) {
      console.error('Failed to extract evidence:', rawJson);
      // 降级处理：返回中立证据
      return {
        recall: 0.5,
        comprehension: 0.5,
        application: 0.5,
        analysis: 0.5,
        feedback: '系统解析评估结果时出现异常，已记录中立表现。',
        errorType: 'none',
        suggestion: '请尝试重新组织语言作答或检查网络状态。',
      };
    }
  }

  /**
   * 优化用户输入的考核要求 (Magic Sparkle)
   */
  static async optimizePrompt(userPrompt: string, systemMsg: string): Promise<string> {
    const rawResult = await fetchFromAI(systemMsg, `用户要求：${userPrompt}\n\n请优化后的专业指令：`);
    return rawResult.trim().replace(/^["']|["']$/g, '');
  }
}
