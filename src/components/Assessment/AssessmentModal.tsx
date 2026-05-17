import { useState, useEffect } from "react";
import {
  Brain,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Sparkles,
  Send,
  Layers,
  ListChecks,
  HelpCircle,
  AlertTriangle,
  RefreshCw,
  SkipForward,
} from "lucide-react";
import Modal from "../common/Modal";
import { AssessmentService } from "../../services/assessmentService";
import {
  updateCognitiveState,
  formatMasteryPercentage,
  ASSESSMENT_PRESETS,
  calculateProxyEvidence,
  INITIAL_COGNITIVE_STATE,
} from "../../utils/bayesianEngine";
import { useMindMapStore } from "../../stores/mindmapStore";
import type { MindMapNode, QuizQuestion, LLMEvidence, CognitiveState } from "../../types";
import "./AssessmentModal.css";

interface AssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: MindMapNode;
  contextPath: string;
}

type Step = "setup" | "loading" | "question" | "evaluating" | "summary";

export default function AssessmentModal({
  isOpen,
  onClose,
  node,
  contextPath,
}: AssessmentModalProps) {
  const { currentProject, updateNodeCognitiveState } = useMindMapStore();

  const [step, setStep] = useState<Step>("setup");
  const [difficultyPrompt, setDifficultyPrompt] = useState("进阶水平：侧重概念的理解与简单应用。");
  const [questionCount, setQuestionCount] = useState(3);
  const [allowedTypes, setAllowedTypes] = useState<("choice" | "trueFalse" | "openEnded")[]>([
    "openEnded",
    "choice",
  ]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [sessionEvidences, setSessionEvidences] = useState<LLMEvidence[]>([]);
  const [sessionResults, setSessionResults] = useState<
    {
      question: string;
      type: string;
      userAnswer: string;
      correctAnswer: string;
      isCorrect: boolean;
      explanation: string;
    }[]
  >([]);
  const [masteryData, setMasteryData] = useState<{ before: number; after: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const presets = [
    {
      label: "👶 基础入门",
      prompt: "基础水平：侧重核心定义、基本概念的准确回忆，用通俗易懂的方式出题。",
    },
    {
      label: "💼 面试模拟",
      prompt: "面试官人设：模拟大厂社招架构师面试提问，侧重技术选型对比与实际落地瓶颈分析。",
    },
    {
      label: "🎓 专家深挖",
      prompt: "专家水平：侧重深度分析、逻辑辨析与底层原理，考查知识点的深度关联。",
    },
  ];

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => {
        setStep("setup");
        setError(null);
        setUserAnswer("");
        setCurrentIndex(0);
        setSessionEvidences([]);
        setSessionResults([]);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isOpen, node?.id]); // 修正：仅在项目开启或切换节点时重置，避免更新掌握度时因 node 对象引用变化导致重置

  const optimizeDifficultyPrompt = async () => {
    if (!difficultyPrompt.trim()) return;
    setIsOptimizing(true);
    try {
      const systemMsg =
        "你是一个 Prompt 优化专家。请将用户简单的考核要求转化为一段专业的、具有人设色彩的教育评估指令。输出要简洁有力（50字以内）。只输出优化后的文本。";
      const optimized = await AssessmentService.optimizePrompt(difficultyPrompt, systemMsg);
      setDifficultyPrompt(optimized);
    } catch (err) {
      console.error(err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const initAssessment = async () => {
    setStep("loading");
    setError(null);
    try {
      const qBatch = await AssessmentService.generateAssessmentBatch(
        node,
        contextPath,
        difficultyPrompt,
        questionCount === 0 ? undefined : questionCount,
        allowedTypes.length === 0 ? undefined : allowedTypes,
      );
      setQuestions(qBatch);
      setCurrentIndex(0);
      setStep("question");
    } catch (err: any) {
      setError(err.message || "无法生成题目");
      setStep("setup");
    }
  };

  const handleRegenerateQuestion = async () => {
    const currentQ = questions[currentIndex];
    if (!currentQ || isRegenerating) return;

    setIsRegenerating(true);
    try {
      const newQ = await AssessmentService.regenerateQuestion(
        node,
        contextPath,
        currentQ.question,
        difficultyPrompt,
        allowedTypes.length === 0 ? ["choice", "trueFalse", "openEnded"] : allowedTypes,
      );

      const newQuestions = [...questions];
      newQuestions[currentIndex] = newQ;
      setQuestions(newQuestions);
      setUserAnswer("");
    } catch (err: any) {
      setError("重新生成失败：" + err.message);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSkipQuestion = () => {
    const currentQ = questions[currentIndex];

    // 记录跳过结果
    setSessionResults((prev) => [
      ...prev,
      {
        question: currentQ.question,
        type: currentQ.type,
        userAnswer: "（用户已跳过此题）",
        correctAnswer:
          currentQ.correctAnswer || (currentQ.type === "openEnded" ? "见标准答案" : ""),
        isCorrect: false,
        explanation: "该题目已被用户标记为有误并跳过。",
        isSkipped: true as any, // 扩展字段
      },
    ]);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer("");
    } else {
      finalizeSession(sessionEvidences);
    }
  };

  const handleAnswerSubmit = async () => {
    const currentQ = questions[currentIndex];
    if (!currentQ || !userAnswer.trim()) return;

    setStep("evaluating");
    try {
      let evidence: LLMEvidence;

      if (currentQ.type === "openEnded") {
        // AI 深度评估
        evidence = await AssessmentService.extractEvidence(
          node.content,
          node.explanation || "",
          currentQ.question,
          currentQ.referenceAnswer || "",
          userAnswer,
        );
      } else {
        // 简单对错匹配 (代理评估)
        const cleanAnswer = userAnswer.trim().toLowerCase();
        const cleanCorrect = (currentQ.correctAnswer || "").trim().toLowerCase();

        // 1. 布尔映射增强 (判断题专用)
        const booleanMap: Record<string, string[]> = {
          正确: ["正确", "对", "true", "yes", "1"],
          错误: ["错误", "错", "false", "no", "0"],
        };

        const isBooleanMatch = (input: string, target: string) => {
          for (const [key, aliases] of Object.entries(booleanMap)) {
            if (aliases.includes(input) && aliases.includes(target)) return true;
            if (key === input && aliases.includes(target)) return true;
            if (key === target && aliases.includes(input)) return true;
          }
          return false;
        };

        // 2. 匹配检查
        const isLiteralMatch = cleanAnswer === cleanCorrect;
        const isBoolMatch =
          currentQ.type === "trueFalse" && isBooleanMatch(cleanAnswer, cleanCorrect);
        const isOptionMatch =
          currentQ.type === "choice" &&
          currentQ.options?.some((opt, idx) => {
            const label = String.fromCharCode(65 + idx).toLowerCase();
            return (
              (cleanAnswer === label || cleanAnswer === opt.toLowerCase()) &&
              opt.toLowerCase() === cleanCorrect
            );
          });

        const isCorrect = isLiteralMatch || isBoolMatch || isOptionMatch;
        evidence = calculateProxyEvidence(isCorrect, currentQ.difficulty);

        // 记录结果供复盘使用
        setSessionResults((prev) => [
          ...prev,
          {
            question: currentQ.question,
            type: currentQ.type,
            userAnswer,
            correctAnswer: currentQ.correctAnswer || "",
            isCorrect,
            explanation: currentQ.explanation || "",
          },
        ]);
      }

      // 处理问答题的结果记录 (由于 extractEvidence 是纯逻辑，我们在其后手动记录)
      if (currentQ.type === "openEnded") {
        setSessionResults((prev) => [
          ...prev,
          {
            question: currentQ.question,
            type: currentQ.type,
            userAnswer,
            correctAnswer: currentQ.referenceAnswer || "见 AI 评估结果",
            isCorrect: (evidence as any).recall >= 0.6, // 简化的“正确”标记
            explanation: (evidence as any).feedback || "",
          },
        ]);
      }

      const newEvidences = [...sessionEvidences, evidence];
      setSessionEvidences(newEvidences);

      if (currentIndex < questions.length - 1) {
        // 进入下一题
        setCurrentIndex(currentIndex + 1);
        setUserAnswer("");
        setStep("question");
      } else {
        // 完成所有题目，进行贝叶斯更新
        finalizeSession(newEvidences);
      }
    } catch (err: any) {
      setError("评估失败: " + err.message);
      setStep("question");
    }
  };

  const finalizeSession = (evidences: LLMEvidence[]) => {
    // 聚合更新 (简单的线性更新，或逐个更新)
    let currentState = (currentProject?.cognitiveStates || {})[node.id] || INITIAL_COGNITIVE_STATE;

    const preset = currentProject?.cognitiveConfig?.preset || "balanced";
    const weights = currentProject?.cognitiveConfig?.customWeights || ASSESSMENT_PRESETS[preset];

    let lastMasteryAfter = 0;
    let firstMasteryBefore = 0;

    // 过滤掉因为跳过而可能产生的空证据，或者确保 evidences 数量与题目匹配
    // 这里的实现方式是 evidences 仅包含已回答题目产生的证据
    evidences.forEach((ev, idx) => {
      const { newState, masteryBefore, masteryAfter } = updateCognitiveState(
        currentState as CognitiveState,
        { ...ev, question: "Diagnostic Session", userAnswer: "Aggregated Evidence" },
        weights,
      );
      currentState = newState;
      lastMasteryAfter = masteryAfter;
      if (idx === 0) firstMasteryBefore = masteryBefore;
    });

    updateNodeCognitiveState(node.id, currentState as CognitiveState);
    setMasteryData({ before: firstMasteryBefore, after: lastMasteryAfter });
    setStep("summary");
  };

  const toggleType = (type: any) => {
    if (allowedTypes.includes(type)) {
      setAllowedTypes(allowedTypes.filter((t) => t !== type));
    } else {
      setAllowedTypes([...allowedTypes, type]);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`知识诊断：${node.content}`}>
      <div className="assessment-container">
        {step === "setup" && (
          <div className="assessment-setup-view animate-fade-in">
            <div className="setup-header">
              <Brain size={32} className="setup-icon" />
              <h3>深度自学考核设置</h3>
            </div>

            <div className="setup-section">
              <label>诊断人设与要求</label>
              <div className="difficulty-prompt-container">
                <textarea
                  className="difficulty-textarea"
                  placeholder="例如：考考我最底层的实现原理，对比类似技术方案..."
                  value={difficultyPrompt}
                  onChange={(e) => setDifficultyPrompt(e.target.value)}
                />
                <button
                  className={`optimize-btn ${isOptimizing ? "loading" : ""}`}
                  onClick={optimizeDifficultyPrompt}
                  title="AI 优化指令"
                >
                  <Sparkles size={16} />
                </button>
              </div>
              <div className="persona-presets">
                {presets.map((p) => (
                  <button
                    key={p.label}
                    className="preset-btn"
                    onClick={() => setDifficultyPrompt(p.prompt)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="setup-section">
              <label>题型偏好 (多选)</label>
              <div className="type-selector">
                <button
                  type="button"
                  className={`type-chip auto ${allowedTypes.length === 0 ? "active" : ""}`}
                  onClick={() => setAllowedTypes([])}
                >
                  <Sparkles size={14} /> 自动
                </button>
                <button
                  type="button"
                  className={`type-chip ${allowedTypes.includes("openEnded") ? "active" : ""}`}
                  onClick={() => toggleType("openEnded")}
                >
                  <Send size={14} /> 问答
                </button>
                <button
                  type="button"
                  className={`type-chip ${allowedTypes.includes("choice") ? "active" : ""}`}
                  onClick={() => toggleType("choice")}
                >
                  <ListChecks size={14} /> 选择
                </button>
                <button
                  type="button"
                  className={`type-chip ${allowedTypes.includes("trueFalse") ? "active" : ""}`}
                  onClick={() => toggleType("trueFalse")}
                >
                  <HelpCircle size={14} /> 判断
                </button>
              </div>
            </div>

            <div className="setup-section">
              <div className="section-label-group">
                <label>题目数量</label>
                <span className="count-value">
                  {questionCount === 0 ? "AI 自动" : `${questionCount} 道`}
                </span>
              </div>
              <div className="count-selector-group">
                <button
                  type="button"
                  className={`auto-count-btn ${questionCount === 0 ? "active" : ""}`}
                  onClick={() => setQuestionCount(questionCount === 0 ? 3 : 0)}
                >
                  <Sparkles size={14} /> 自动
                </button>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={questionCount === 0 ? 3 : questionCount}
                  onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                  className={`count-slider`}
                />
              </div>
            </div>

            <div className="warnings-area">
              <div className="warning-item token">
                <AlertCircle size={14} />
                <span>
                  预计 Token 消耗：
                  {questionCount === 0 ? "AI 动态确定" : questionCount > 5 ? "较高" : "正常"}
                </span>
              </div>
              {(questionCount > 5 || questionCount === 0) && (
                <div className="warning-item attention">
                  <Layers size={14} />
                  <span>
                    {questionCount === 0
                      ? "自动模式下 AI 将生成 2-5 道题以保证诊断深度。"
                      : "建议一次不要生成过多题目，避免 AI 注意力缺陷导致质量下降。"}
                  </span>
                </div>
              )}
            </div>

            {error && <p className="setup-error">{error}</p>}

            <button className="btn-primary start-btn" onClick={initAssessment}>
              启动诊断
            </button>
          </div>
        )}

        {step === "loading" && (
          <div className="assessment-state-view animate-fade-in">
            <Loader2 className="spinner" size={40} />
            <p>AI 正在根据你的偏好构建测验模块...</p>
          </div>
        )}

        {step === "question" && (
          <div className="assessment-question-view animate-slide-up">
            <div className="quiz-progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(currentIndex / questions.length) * 100}%` }}
              />
              <span className="progress-text">
                第 {currentIndex + 1} / {questions.length} 题
              </span>
            </div>

            <div className={`question-content ${isRegenerating ? "dimmed" : ""}`}>
              {isRegenerating && (
                <div className="content-loader">
                  <Loader2 className="spinner" />
                </div>
              )}
              <span className="type-badge">{questions[currentIndex].type.toUpperCase()}</span>
              <p className="question-text">{questions[currentIndex].question}</p>

              {questions[currentIndex].type === "openEnded" ? (
                <textarea
                  className="answer-input"
                  placeholder="请输入你的解答..."
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  autoFocus
                />
              ) : questions[currentIndex].type === "choice" ? (
                <div className="choice-list">
                  {questions[currentIndex].options?.map((opt, i) => (
                    <button
                      key={i}
                      className={`choice-item ${userAnswer === opt ? "selected" : ""}`}
                      onClick={() => setUserAnswer(opt)}
                    >
                      <span className="choice-index">{String.fromCharCode(65 + i)}</span>
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="boolean-list">
                  {["正确", "错误"].map((opt) => (
                    <button
                      key={opt}
                      className={`boolean-item ${userAnswer === opt ? "selected" : ""}`}
                      onClick={() => setUserAnswer(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="assessment-actions">
              <div className="question-error-control">
                <button className="error-report-trigger" title="题目有误？">
                  <AlertTriangle size={14} /> 题目有误
                  <div className="error-actions-popover">
                    <button onClick={handleRegenerateQuestion} disabled={isRegenerating}>
                      <RefreshCw size={12} className={isRegenerating ? "spinner" : ""} /> 重新生成
                    </button>
                    <button onClick={handleSkipQuestion}>
                      <SkipForward size={12} /> 跳过此题
                    </button>
                  </div>
                </button>
              </div>

              <button
                className="btn-primary"
                onClick={handleAnswerSubmit}
                disabled={!userAnswer.trim()}
              >
                {currentIndex === questions.length - 1 ? "提交测验" : "下一题"}{" "}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === "evaluating" && (
          <div className="assessment-state-view animate-fade-in">
            <Loader2 className="spinner" size={40} />
            <p>正在同步诊断结果...</p>
          </div>
        )}

        {step === "summary" && (
          <div className="assessment-feedback-view animate-slide-up">
            <h3 className="summary-title">
              <Sparkles size={20} /> 深度诊断报告
            </h3>

            <div className="mastery-shift-card">
              <div className="mastery-score-group">
                <div className="score-item">
                  <span className="label">评估前</span>
                  <span className="value">
                    {formatMasteryPercentage(masteryData?.before || 0)}%
                  </span>
                </div>
                <ArrowRight size={24} className="shift-arrow" />
                <div className="score-item after">
                  <span className="label">评估后掌握度</span>
                  <span className="value">{formatMasteryPercentage(masteryData?.after || 0)}%</span>
                </div>
              </div>

              <div className="mastery-progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(masteryData?.after || 0) * 100}%` }}
                />
              </div>
            </div>

            <div className="diagnostic-details">
              <div className="detail-section">
                <h4>
                  <Layers size={16} /> 认知维度细分
                </h4>
                <div className="dimension-grid">
                  {["recall", "comprehension", "application", "analysis"].map((dim) => {
                    const avgValue =
                      sessionEvidences.length > 0
                        ? sessionEvidences.reduce(
                            (sum, ev) => sum + ((ev[dim as keyof LLMEvidence] as number) || 0),
                            0,
                          ) / sessionEvidences.length
                        : 0;
                    const label =
                      dim === "recall"
                        ? "核心记忆"
                        : dim === "comprehension"
                          ? "概念理解"
                          : dim === "application"
                            ? "知识应用"
                            : "深度分析";
                    return (
                      <div key={dim} className="dimension-item">
                        <div className="dim-label">
                          <span>{label}</span>
                          <span>{Math.round(avgValue * 100)}%</span>
                        </div>
                        <div className="dim-bar">
                          <div className="dim-fill" style={{ width: `${avgValue * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {sessionEvidences.some((ev) => ev.suggestion) && (
                <div className="detail-section highlight">
                  <h4>
                    <Brain size={16} /> AI 学习建议
                  </h4>
                  <ul className="suggestion-list">
                    {Array.from(
                      new Set(
                        sessionEvidences.filter((ev) => ev.suggestion).map((ev) => ev.suggestion),
                      ),
                    ).map((sug, i) => (
                      <li key={i}>{sug}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="detail-section review-section">
                <h4>
                  <ListChecks size={16} /> 测验复盘
                </h4>
                <div className="review-list">
                  {sessionResults.map((res: any, i) => (
                    <div
                      key={i}
                      className={`review-card ${res.isSkipped ? "skipped" : res.isCorrect ? "correct" : "incorrect"}`}
                    >
                      <div className="review-header">
                        <span className="q-index">Q{i + 1}</span>
                        {res.isSkipped ? (
                          <SkipForward size={16} color="var(--color-text-dim)" />
                        ) : res.isCorrect ? (
                          <CheckCircle2 size={16} color="var(--color-success)" />
                        ) : (
                          <AlertCircle size={16} color="var(--color-error)" />
                        )}
                      </div>
                      <p className="review-q-text">{res.question}</p>
                      <div className="answer-grid">
                        <div className="answer-col">
                          <span className="label">你的回答</span>
                          <span
                            className={`val ${res.isSkipped ? "dim" : res.isCorrect ? "correct" : "incorrect"}`}
                          >
                            {res.userAnswer}
                          </span>
                        </div>
                        <div className="answer-col">
                          <span className="label">正确答案</span>
                          <span className="val primary">{res.correctAnswer}</span>
                        </div>
                      </div>
                      {res.explanation && (
                        <div className="review-explanation">
                          <strong>解析：</strong>
                          {res.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="assessment-actions">
              <button className="btn-secondary" onClick={onClose}>
                返回导图
              </button>
              <button className="btn-primary" onClick={() => setStep("setup")}>
                再次诊断
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function EvidenceItem({ label, value }: { label: string; value: number }) {
  const percentage = Math.round(value * 100);
  let colorClass = "low";
  if (value >= 0.8) colorClass = "high";
  else if (value >= 0.5) colorClass = "medium";

  return (
    <div className={`evidence-item ${colorClass}`}>
      <span className="evidence-label">{label}</span>
      <div className="evidence-track">
        <div className="evidence-fill" style={{ width: `${percentage}%` }} />
      </div>
      <span className="evidence-value">{percentage}%</span>
    </div>
  );
}
