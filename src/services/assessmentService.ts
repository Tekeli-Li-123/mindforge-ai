import { fetchFromAI } from "./aiService";
import type { LLMEvidence, QuizQuestion, MindMapNode } from "../types";
import { safeParseJson } from "../utils/jsonExtractor";
import { getFilledPrompt } from "../config/prompts/promptRegistry";

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
    customDifficulty: string = "进阶水平：侧重概念的理解与简单应用。",
    count: number = 3,
    allowedTypes: ("choice" | "trueFalse" | "openEnded" | "fillBlank")[] = ["openEnded"],
  ): Promise<QuizQuestion[]> {
    const typeDesc: Record<string, string> = {
      choice: "单选题 (choice)：提供 4 个选项，1 个正确答案。",
      trueFalse: "判断题 (trueFalse)：判断表述正误。",
      openEnded: "问答题 (openEnded)：开放式回答，考查深度理解。",
      fillBlank: "填空题 (fillBlank)：提供包含空白的陈述，用户填写缺失的关键词/短语。",
    };

    const systemMsg = `你是一个专业的教育评估专家。
    
【诊断人设/要求】：${customDifficulty}
允许题型：${allowedTypes && allowedTypes.length > 0 ? allowedTypes.map((t) => typeDesc[t]).join("；") : "由你根据知识点特性决定 (单选/判断/问答) "}

请严格按照下面的 JSON 格式输出，不要包含任何 markdown 代码块标记或者额外文字：

{
  "questions": [
    {
      "id": "q-xxxxx",
      "type": "choice | trueFalse | openEnded | fillBlank",
      "question": "题目标题/题干",
      "options": ["选项A", "选项B", "选项C", "选项D"]   // 仅 type=choice 时需要
      "correctAnswer": "正确答案文本",
      "referenceAnswer": "评分参考（客观题可忽略此字段，填空题包含其他可接受答案，用;分隔）",
      "explanation": "解析（为什么对/为什么错）",
      "relatedNodeId": "${node.id}",
      "difficulty": "easy | medium | hard"
    }
  ]
}`;

    const userMsg = `请根据知识点【${node.content}】生成${count}道考核题目。
【节点详细内容】${node.explanation || node.content}
【知识点路径】${contextPath}`;

    const rawJson = await fetchFromAI(systemMsg, userMsg);
    try {
      const parsed = safeParseJson(rawJson, null) as Record<string, any> | null;
      if (!parsed) {
        throw new Error("AI did not return valid questions array");
      }
      // Support both { questions: [...] } and bare array formats
      const questions = Array.isArray(parsed.questions)
        ? parsed.questions
        : Array.isArray(parsed)
          ? parsed
          : null;
      if (!questions) {
        throw new Error("AI did not return valid questions array");
      }

      return questions.map((q: Record<string, any>, idx: number) => {
        const question: QuizQuestion = {
          id: q.id || `q-${idx}-${Date.now()}`,
          type: (["choice", "trueFalse", "openEnded", "fillBlank"].includes(q.type)
            ? q.type
            : "openEnded") as "choice" | "trueFalse" | "openEnded" | "fillBlank",
          question: q.question || "题目生成失败",
          options: q.type === "choice" && Array.isArray(q.options) ? q.options : undefined,
          correctAnswer: q.correctAnswer || (q.type === "trueFalse" ? "正确" : undefined),
          referenceAnswer: Array.isArray(q.referenceAnswer)
            ? q.referenceAnswer.join(";")
            : typeof q.referenceAnswer === "string"
              ? q.referenceAnswer
              : undefined,
          explanation: q.explanation || "暂无解析",
          relatedNodeId: q.relatedNodeId || node.id,
          difficulty: (["easy", "medium", "hard"].includes(q.difficulty)
            ? q.difficulty
            : "medium") as "easy" | "medium" | "hard",
        };

        // Validate correctAnswer for choice type
        if (question.type === "choice" && question.options) {
          if (
            question.correctAnswer &&
            !question.options.some(
              (opt) =>
                opt === question.correctAnswer ||
                question.options?.includes(question.correctAnswer!),
            )
          ) {
            // Try to interpret correctAnswer as letter index
            const letterIdx = (question.correctAnswer || "").charCodeAt(0) - 65;
            if (letterIdx >= 0 && letterIdx < question.options.length) {
              question.correctAnswer = question.options[letterIdx];
            } else {
              // Default to first option if no match
              question.correctAnswer = question.options[0];
            }
          }
        }

        return question;
      });
    } catch (e) {
      console.error("Failed to generate batch:", rawJson);
      throw new Error("AI 生成题目失败，请重试。", { cause: e });
    }
  }

  /**
   * 针对评估中的单道错误题目进行原地替换生成
   */
  static async regenerateQuestion(
    node: MindMapNode,
    contextPath: string,
    _previousQuestion: string,
    customDifficulty: string,
    allowedTypes: ("choice" | "trueFalse" | "openEnded" | "fillBlank")[],
  ): Promise<QuizQuestion> {
    const batch = await this.generateAssessmentBatch(
      node,
      contextPath,
      customDifficulty,
      1,
      allowedTypes,
    );

    return batch[0];
  }

  /**
   * 优化诊断人设/要求描述
   */
  static async optimizePrompt(userPrompt: string, systemMsg: string): Promise<string> {
    const result = await fetchFromAI(systemMsg, userPrompt);
    // Trim surrounding quotes and whitespace
    return result.replace(/^["'\s]+|["'\s]+$/g, "").trim();
  }

  /**
   * 基于独立评估 prompt 的认知证据提取（前端问答题使用）
   */
  static async extractEvidence(
    nodeName: string,
    nodeDefinition: string,
    question: string,
    referenceAnswer: string,
    userAnswer: string,
    bloomLevel: string = "understand",
  ): Promise<LLMEvidence> {
    // 使用独立的评估 prompt (assessment-evaluate-v1)
    const filled = getFilledPrompt("assessment-evaluate", {
      knowledgePoint: nodeName,
      explanation: nodeDefinition,
      question: question,
      referenceAnswer: referenceAnswer,
      studentAnswer: userAnswer,
      bloomLevel: bloomLevel,
    });

    if (!filled) {
      // fallback 到内联 prompt
      return this.extractEvidenceFallback(
        nodeName,
        nodeDefinition,
        question,
        referenceAnswer,
        userAnswer,
      );
    }

    const rawJson = await fetchFromAI(filled.text, "请严格按照要求的 JSON 格式输出评估结果。");
    try {
      const parsed = safeParseJson(rawJson, null) as Record<string, any> | null;
      if (!parsed) {
        throw new Error("Parsed result is null");
      }

      const clamp = (val: any) =>
        Math.min(1, Math.max(0, typeof val === "number" ? val : parseFloat(val) || 0));

      return {
        recall: clamp(parsed.recall),
        comprehension: clamp(parsed.comprehension),
        application: clamp(parsed.application),
        analysis: clamp(parsed.analysis),
        feedback: parsed.feedback || "感谢你的作答。",
        errorType: this.mapErrorType(parsed.errorType || "none"),
        suggestion: parsed.suggestion || "建议继续深入学习。",
      };
    } catch (e) {
      console.error("Failed to extract evidence (evaluate prompt):", rawJson);
      // 降级到内联 prompt
      return this.extractEvidenceFallback(
        nodeName,
        nodeDefinition,
        question,
        referenceAnswer,
        userAnswer,
      );
    }
  }

  /**
   * 错误类型映射：将评估 prompt 返回的 errorType 映射到 LLMEvidence 类型
   */
  private static mapErrorType(t: string): "factual" | "conceptual" | "logical" | "none" {
    if (t === "factual" || t === "conceptual" || t === "logical") return t;
    if (t === "incomplete" || t === "misunderstood") return "conceptual";
    return "none";
  }

  /**
   * 内联版 extractEvidence 降级方案 (原有的内置 prompt)
   */
  private static async extractEvidenceFallback(
    nodeName: string,
    nodeDefinition: string,
    question: string,
    referenceAnswer: string,
    userAnswer: string,
  ): Promise<LLMEvidence> {
    const systemMsg = `你是一个严格的认知诊断专家。请根据用户的回答，评估其在知识点"${nodeName}"上的表现。

【知识点定义/背景】${nodeDefinition}
【参考标准答案】${referenceAnswer}

请根据用户的【回答】进行深度分析，并输出一个严格的 JSON 对象。

【评分校准参考】
- 分数 0.9-1.0：用户回答与标准答案高度一致，能举一反三，展示了超越预期的掌握。
- 分数 0.6-0.8：用户部分正确，理解了大意但细节不完整或有轻微错误。
- 分数 0.3-0.5：用户答非所问、明显混淆概念或只能复制定义而不理解。
- 分数 0.0-0.2：用户完全没有掌握该知识点，或答错关键事实。

【注意】请严格按此校准标准评分。大多数回答的分数应在 0.3-0.7 之间。只有在真正优秀的回答时才给 0.8+ 的高分。

JSON 字段要求：
- recall: 0 到 1 之间的数字
- comprehension: 0 到 1 之间的数字
- application: 0 到 1 之间的数字
- analysis: 0 到 1 之间的数字
- feedback: 一段鼓励性但诚实的反馈（不超过 100 字）
- errorType: "factual" | "conceptual" | "logical" | "none"
- suggestion: 一条针对性的后续学习建议

只输出 JSON，不要任何额外文字。`;

    const userMsg = `【题目】${question}\n【用户回答】${userAnswer}\n\n请进行认知诊断评估：`;

    const rawJson = await fetchFromAI(systemMsg, userMsg);
    try {
      // 使用健壮解析器
      const parsed = safeParseJson(rawJson, null) as Record<string, any> | null;

      if (!parsed) {
        throw new Error("Parsed result is null");
      }

      const clamp = (val: any) =>
        Math.min(1, Math.max(0, typeof val === "number" ? val : parseFloat(val) || 0));

      return {
        recall: clamp(parsed.recall),
        comprehension: clamp(parsed.comprehension),
        application: clamp(parsed.application),
        analysis: clamp(parsed.analysis),
        feedback: parsed.feedback || "感谢你的作答。",
        errorType: parsed.errorType || "none",
        suggestion: parsed.suggestion || "建议继续深入学习。",
      };
    } catch (e) {
      console.error("Failed to extract evidence:", rawJson);
      // 降级处理：返回中性偏保守的证据 (不再是全 0.5)
      return {
        recall: 0.3,
        comprehension: 0.3,
        application: 0.3,
        analysis: 0.3,
        feedback: "系统解析评估结果时出现异常，已记录保守表现。",
        errorType: "none" as const,
        suggestion: "建议重新考核或检查 AI 服务状态。",
      };
    }
  }
}
