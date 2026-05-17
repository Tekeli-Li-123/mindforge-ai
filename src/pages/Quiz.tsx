import { useState, useMemo, useEffect } from "react";
import {
  GraduationCap,
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
  ChevronRight,
  ChevronDown,
  FileText,
  BarChart3,
  History,
  BookOpen,
  Target,
  RotateCcw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useMindMapStore } from "../stores/mindmapStore";
import { AssessmentService } from "../services/assessmentService";
import {
  updateCognitiveState,
  formatMasteryPercentage,
  ASSESSMENT_PRESETS,
  calculateProxyEvidence,
  INITIAL_COGNITIVE_STATE,
} from "../utils/bayesianEngine";
import { flattenNodesWithPaths } from "../utils/mindmapHelpers";
import type { MindMapNode, QuizQuestion, LLMEvidence, CognitiveState } from "../types";
import "./Quiz.css";

// ==========================================
// Types
// ==========================================

type QuizStep = "overview" | "setup" | "loading" | "question" | "evaluating" | "summary";

interface SessionResult {
  question: string;
  type: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  isSkipped: boolean;
  explanation: string;
}

interface SessionRecord {
  id: string;
  nodeId: string;
  nodeName: string;
  timestamp: number;
  questionCount: number;
  results: SessionResult[];
  masteryBefore: number;
  masteryAfter: number;
}

// ==========================================
// Helper: Recursive node collector
// ==========================================

function collectFlatNodes(
  node: MindMapNode,
  depth: number = 0,
): Array<{ node: MindMapNode; path: string; depth: number }> {
  const nodes: Array<{ node: MindMapNode; path: string; depth: number }> = [];

  // Build path from ancestors
  const pathLabel = node.content;

  nodes.push({ node, path: pathLabel, depth });

  for (const child of node.children) {
    const childNodes = collectFlatNodes(child, depth + 1);
    // Prepend parent path to child paths
    for (const cn of childNodes) {
      cn.path = `${pathLabel} › ${cn.path}`;
    }
    nodes.push(...childNodes);
  }

  return nodes;
}

// ==========================================
// Default comparison weight
// ==========================================
const getWeights = (preset?: string) => {
  if (preset && preset in ASSESSMENT_PRESETS) {
    return ASSESSMENT_PRESETS[preset as keyof typeof ASSESSMENT_PRESETS];
  }
  return ASSESSMENT_PRESETS.balanced;
};

// ==========================================
// Main Component
// ==========================================

export default function Quiz() {
  const { currentProject, updateNodeCognitiveState } = useMindMapStore();

  // --- Navigation state ---
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");

  // --- Assessment flow state ---
  const [step, setStep] = useState<QuizStep>("overview");
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);
  const [selectedNodePath, setSelectedNodePath] = useState("");

  /// Setup config
  const [difficultyPrompt, setDifficultyPrompt] = useState("进阶水平：侧重概念的理解与简单应用。");
  const [questionCount, setQuestionCount] = useState(3);
  const [allowedTypes, setAllowedTypes] = useState<("choice" | "trueFalse" | "openEnded")[]>([
    "openEnded",
    "choice",
  ]);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Question state
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [sessionEvidences, setSessionEvidences] = useState<LLMEvidence[]>([]);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [masteryData, setMasteryData] = useState<{ before: number; after: number } | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session history (stored in memory for this session)
  const [sessionHistory, setSessionHistory] = useState<SessionRecord[]>(() => {
    try {
      const saved = localStorage.getItem("mindforge-quiz-history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Node browser tree collapsed state
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // --- Derived data ---
  const flatNodes = useMemo(() => {
    if (!currentProject) return [];
    return collectFlatNodes(currentProject.root);
  }, [currentProject]);

  const nodeMasteryMap = useMemo(() => {
    const map: Record<string, { mastery: number; state?: CognitiveState }> = {};
    if (!currentProject) return map;

    for (const { node } of flatNodes) {
      const state = currentProject.cognitiveStates?.[node.id];
      map[node.id] = {
        mastery: node.mastery ?? 0,
        state: state || INITIAL_COGNITIVE_STATE,
      };
    }
    return map;
  }, [flatNodes, currentProject]);

  const overallMastery = useMemo(() => {
    if (flatNodes.length === 0) return 0;
    return flatNodes.reduce((sum, { node }) => sum + (node.mastery || 0), 0) / flatNodes.length;
  }, [flatNodes]);

  // Preset cards
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

  // --- Reset assessment ---
  const resetAssessment = () => {
    setStep("overview");
    setError(null);
    setUserAnswer("");
    setCurrentIndex(0);
    setSessionEvidences([]);
    setSessionResults([]);
    setMasteryData(null);
    setQuestions([]);
    setIsRegenerating(false);
  };

  // --- Optimize prompt ---
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

  // --- Start assessment ---
  const initAssessment = async () => {
    if (!selectedNode) return;
    setStep("loading");
    setError(null);
    try {
      const qBatch = await AssessmentService.generateAssessmentBatch(
        selectedNode,
        selectedNodePath,
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

  // --- Select node for assessment ---
  const handleSelectNode = (node: MindMapNode, path: string) => {
    setSelectedNode(node);
    setSelectedNodePath(path);
    setStep("setup");
    setError(null);
  };

  // --- Regenerate current question ---
  const handleRegenerateQuestion = async () => {
    const currentQ = questions[currentIndex];
    if (!currentQ || !selectedNode || isRegenerating) return;

    setIsRegenerating(true);
    try {
      const newQ = await AssessmentService.regenerateQuestion(
        selectedNode,
        selectedNodePath,
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

  // --- Skip question ---
  const handleSkipQuestion = () => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    setSessionResults((prev) => [
      ...prev,
      {
        question: currentQ.question,
        type: currentQ.type,
        userAnswer: "（用户已跳过此题）",
        correctAnswer:
          currentQ.correctAnswer || (currentQ.type === "openEnded" ? "见标准答案" : ""),
        isCorrect: false,
        isSkipped: true,
        explanation: "该题目已被用户标记为有误并跳过。",
      },
    ]);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer("");
    } else {
      finalizeSession(sessionEvidences);
    }
  };

  // --- Submit answer ---
  const handleAnswerSubmit = async () => {
    const currentQ = questions[currentIndex];
    if (!currentQ || !userAnswer.trim()) return;

    setStep("evaluating");
    try {
      let evidence: LLMEvidence;

      if (currentQ.type === "openEnded") {
        evidence = await AssessmentService.extractEvidence(
          selectedNode?.content || "",
          selectedNode?.explanation || "",
          currentQ.question,
          currentQ.referenceAnswer || "",
          userAnswer,
        );
      } else {
        const cleanAnswer = userAnswer.trim().toLowerCase();
        const cleanCorrect = (currentQ.correctAnswer || "").trim().toLowerCase();

        // Boolean mapping for trueFalse
        const booleanMap: Record<string, string[]> = {
          正确: ["正确", "对", "true", "yes", "1"],
          错误: ["错误", "错", "false", "no", "0"],
        };

        const isBooleanMatch = (input: string, target: string) => {
          for (const [, aliases] of Object.entries(booleanMap)) {
            if (aliases.includes(input) && aliases.includes(target)) return true;
            if (input === target) return true;
          }
          return false;
        };

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

        setSessionResults((prev) => [
          ...prev,
          {
            question: currentQ.question,
            type: currentQ.type,
            userAnswer,
            correctAnswer: currentQ.correctAnswer || "",
            isCorrect,
            isSkipped: false,
            explanation: currentQ.explanation || "",
          },
        ]);
      }

      // For openEnded, record after extractEvidence
      if (currentQ.type === "openEnded") {
        setSessionResults((prev) => [
          ...prev,
          {
            question: currentQ.question,
            type: currentQ.type,
            userAnswer,
            correctAnswer: currentQ.referenceAnswer || "见 AI 评估结果",
            isCorrect: (evidence as any).recall >= 0.6,
            isSkipped: false,
            explanation: (evidence as any).feedback || "",
          },
        ]);
      }

      const newEvidences = [...sessionEvidences, evidence];
      setSessionEvidences(newEvidences);

      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setUserAnswer("");
        setStep("question");
      } else {
        finalizeSession(newEvidences);
      }
    } catch (err: any) {
      setError("评估失败: " + err.message);
      setStep("question");
    }
  };

  // --- Finalize session ---
  const finalizeSession = (evidences: LLMEvidence[]) => {
    if (!currentProject || !selectedNode) return;

    let currentState =
      (currentProject.cognitiveStates || {})[selectedNode.id] || INITIAL_COGNITIVE_STATE;
    const preset = currentProject.cognitiveConfig?.preset || "balanced";
    const weights = currentProject.cognitiveConfig?.customWeights || getWeights(preset);

    let lastMasteryAfter = 0;
    let firstMasteryBefore = 0;

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

    updateNodeCognitiveState(selectedNode.id, currentState as CognitiveState);
    setMasteryData({ before: firstMasteryBefore, after: lastMasteryAfter });

    // Save to session history
    const record: SessionRecord = {
      id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      nodeId: selectedNode.id,
      nodeName: selectedNode.content,
      timestamp: Date.now(),
      questionCount: questions.length,
      results: sessionResults,
      masteryBefore: firstMasteryBefore,
      masteryAfter: lastMasteryAfter,
    };

    const newHistory = [record, ...sessionHistory].slice(0, 50); // Keep latest 50
    setSessionHistory(newHistory);
    try {
      localStorage.setItem("mindforge-quiz-history", JSON.stringify(newHistory));
    } catch {
      /* ignore quota errors */
    }

    setStep("summary");
  };

  // --- Toggle type ---
  const toggleType = (type: "choice" | "trueFalse" | "openEnded") => {
    if (allowedTypes.includes(type)) {
      setAllowedTypes(allowedTypes.filter((t) => t !== type));
    } else {
      setAllowedTypes([...allowedTypes, type]);
    }
  };

  // --- Render node tree recursively ---
  const renderNodeTree = (node: MindMapNode, depth: number = 0, parentPath: string = "") => {
    const currentPath = parentPath ? `${parentPath} › ${node.content}` : node.content;
    const isCollapsed = collapsedNodes.has(node.id);
    const masteryInfo = nodeMasteryMap[node.id];
    const masteryPercent = masteryInfo ? Math.round(masteryInfo.mastery * 100) : 0;

    const hasChildren = node.children.length > 0;

    const masteryColor =
      masteryPercent >= 70
        ? "var(--color-success)"
        : masteryPercent >= 40
          ? "var(--color-warning)"
          : "var(--color-text-dim)";

    return (
      <div key={node.id} className="node-tree-item" style={{ paddingLeft: `${depth * 16 + 8}px` }}>
        <div className="node-tree-row">
          {hasChildren ? (
            <button
              className="tree-toggle-btn"
              onClick={() => {
                const next = new Set(collapsedNodes);
                if (isCollapsed) next.delete(node.id);
                else next.add(node.id);
                setCollapsedNodes(next);
              }}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : (
            <span className="tree-toggle-spacer" />
          )}

          <button
            className={`node-select-btn ${selectedNode?.id === node.id ? "selected" : ""}`}
            onClick={() => handleSelectNode(node, currentPath)}
          >
            <span className="node-name">{node.content}</span>
            <span className="node-mastery-badge" style={{ color: masteryColor }}>
              {masteryPercent}%
            </span>
          </button>
        </div>

        {!isCollapsed && hasChildren && (
          <div className="node-tree-children">
            {node.children.map((child) => renderNodeTree(child, depth + 1, currentPath))}
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // Empty State: No project
  // ==========================================
  if (!currentProject) {
    return (
      <div className="quiz-page">
        <div className="quiz-header">
          <h2>知识考核</h2>
          <p>AI 根据你的知识导图自动生成测试题目</p>
        </div>
        <div className="quiz-empty">
          <div className="quiz-empty-icon">
            <GraduationCap size={36} />
          </div>
          <h3>准备好测试了吗？</h3>
          <p>AI 将基于你的思维导图内容，生成选择题、判断题和问答题， 帮你检验知识掌握程度。</p>
          <Link to="/">
            <button className="quiz-start-btn">先去创建项目 →</button>
          </Link>
        </div>
      </div>
    );
  }

  // ==========================================
  // Main Quiz Page
  // ==========================================
  return (
    <div className="quiz-page">
      {/* Header */}
      <div className="quiz-header">
        <h2>
          <Brain size={24} />
          知识考核
        </h2>
        <p>
          项目：{currentProject.title} — {flatNodes.length} 个知识点
        </p>
      </div>

      <div className="quiz-layout">
        {/* Left: Node Browser + Stats */}
        <div className="quiz-sidebar">
          {/* Overall Mastery */}
          <div className="sidebar-card mastery-overview-card">
            <div className="mastery-overview-header">
              <BarChart3 size={16} />
              <span>整体掌握度</span>
            </div>
            <div className="mastery-big-number">{formatMasteryPercentage(overallMastery)}%</div>
            <div className="mastery-big-bar">
              <div className="mastery-big-fill" style={{ width: `${overallMastery * 100}%` }} />
            </div>
            <div className="mastery-stats-row">
              <span>
                已评估: {Object.keys(currentProject.cognitiveStates || {}).length}/
                {flatNodes.length}
              </span>
            </div>
          </div>

          {/* Node Browser */}
          <div className="sidebar-card node-browser-card">
            <div className="node-browser-header">
              <BookOpen size={16} />
              <span>选择知识点</span>
            </div>
            <div className="node-tree-container">{renderNodeTree(currentProject.root)}</div>
          </div>

          {/* Quick Tips */}
          <div className="sidebar-card tips-card">
            <div className="tips-header">
              <Target size={14} />
              <span>考核提示</span>
            </div>
            <ul className="tips-list">
              <li>选择一个知识点节点开始考核</li>
              <li>AI 会根据节点内容生成题目</li>
              <li>问答题会由 AI 深度评估</li>
              <li>选择/判断题自动评分</li>
            </ul>
          </div>
        </div>

        {/* Right: Main Content */}
        <div className="quiz-main">
          {/* Step: Overview (Welcome) */}
          {step === "overview" && (
            <div className="quiz-overview-view animate-fade-in">
              <div className="overview-welcome">
                <Brain size={48} className="overview-icon" />
                <h3>选择知识点开始考核</h3>
                <p>
                  从左侧导航树中选择一个知识点，AI
                  将根据其内容生成定制化的测试题目，检验你的理解深度。
                </p>
              </div>

              {/* Tabs */}
              <div className="overview-tabs">
                <button
                  className={`tab-btn ${activeTab === "new" ? "active" : ""}`}
                  onClick={() => setActiveTab("new")}
                >
                  <FileText size={16} /> 新考核
                </button>
                <button
                  className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
                  onClick={() => setActiveTab("history")}
                >
                  <History size={16} /> 考核记录
                </button>
              </div>

              {activeTab === "history" && sessionHistory.length > 0 && (
                <div className="history-list">
                  {sessionHistory.map((session) => (
                    <div key={session.id} className="history-card">
                      <div className="history-header">
                        <span className="history-node-name">{session.nodeName}</span>
                        <span className="history-date">
                          {new Date(session.timestamp).toLocaleDateString("zh-CN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="history-stats">
                        <span>{session.questionCount} 题</span>
                        <span className="history-mastery">
                          掌握度: {formatMasteryPercentage(session.masteryBefore)}% →{" "}
                          {formatMasteryPercentage(session.masteryAfter)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "history" && sessionHistory.length === 0 && (
                <div className="history-empty">
                  <History size={24} />
                  <p>暂无考核记录</p>
                </div>
              )}
            </div>
          )}

          {/* Step: Setup */}
          {step === "setup" && selectedNode && (
            <div className="quiz-setup-view animate-fade-in">
              <div className="setup-breadcrumb">
                <button className="breadcrumb-back" onClick={resetAssessment}>
                  ← 返回
                </button>
                <span className="breadcrumb-path">{selectedNodePath}</span>
              </div>

              <div className="setup-header">
                <Brain size={24} className="setup-icon" />
                <h3>考核配置：{selectedNode.content}</h3>
              </div>

              {/* Difficulty */}
              <div className="setup-section">
                <label>诊断人设与要求</label>
                <div className="difficulty-prompt-container">
                  <textarea
                    className="difficulty-textarea"
                    placeholder="例如：考考我最底层的实现原理，对比类似技术方案..."
                    value={difficultyPrompt}
                    onChange={(e) => setDifficultyPrompt(e.target.value)}
                    rows={3}
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
                      className={`preset-btn ${difficultyPrompt === p.prompt ? "active" : ""}`}
                      onClick={() => setDifficultyPrompt(p.prompt)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question types */}
              <div className="setup-section">
                <label>题型偏好（多选）</label>
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

              {/* Question count */}
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
                    className="count-slider"
                  />
                </div>
              </div>

              {/* Warnings */}
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
                <Brain size={16} /> 启动诊断
              </button>
            </div>
          )}

          {/* Step: Loading */}
          {step === "loading" && (
            <div className="quiz-state-view animate-fade-in">
              <Loader2 className="spinner" size={40} />
              <p>AI 正在根据你的偏好构建测验模块...</p>
            </div>
          )}

          {/* Step: Question */}
          {step === "question" && questions.length > 0 && (
            <div className="quiz-question-view animate-slide-up">
              {/* Progress bar */}
              <div className="quiz-progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(currentIndex / questions.length) * 100}%` }}
                />
                <span className="progress-text">
                  第 {currentIndex + 1} / {questions.length} 题
                </span>
              </div>

              {/* Question content */}
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
                    rows={6}
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

              {/* Actions */}
              <div className="quiz-actions">
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

          {/* Step: Evaluating */}
          {step === "evaluating" && (
            <div className="quiz-state-view animate-fade-in">
              <Loader2 className="spinner" size={40} />
              <p>正在同步诊断结果...</p>
            </div>
          )}

          {/* Step: Summary */}
          {step === "summary" && masteryData && (
            <div className="quiz-summary-view animate-slide-up">
              <h3 className="summary-title">
                <Sparkles size={20} /> 深度诊断报告
              </h3>

              {/* Mastery shift */}
              <div className="mastery-shift-card">
                <div className="mastery-score-group">
                  <div className="score-item">
                    <span className="label">评估前</span>
                    <span className="value">{formatMasteryPercentage(masteryData.before)}%</span>
                  </div>
                  <ArrowRight size={24} className="shift-arrow" />
                  <div className="score-item after">
                    <span className="label">评估后掌握度</span>
                    <span className="value">{formatMasteryPercentage(masteryData.after)}%</span>
                  </div>
                </div>
                <div className="mastery-progress-bar">
                  <div className="progress-fill" style={{ width: `${masteryData.after * 100}%` }} />
                </div>
              </div>

              {/* Dimension breakdown */}
              <div className="diagnostic-details">
                <div className="detail-section">
                  <h4>
                    <Layers size={16} /> 认知维度细分
                  </h4>
                  <div className="dimension-grid">
                    {(["recall", "comprehension", "application", "analysis"] as const).map(
                      (dim) => {
                        const avgValue =
                          sessionEvidences.length > 0
                            ? sessionEvidences.reduce(
                                (sum, ev) => sum + ((ev[dim] as number) || 0),
                                0,
                              ) / sessionEvidences.length
                            : 0;
                        const labels: Record<string, string> = {
                          recall: "核心记忆",
                          comprehension: "概念理解",
                          application: "知识应用",
                          analysis: "深度分析",
                        };
                        return (
                          <div key={dim} className="dimension-item">
                            <div className="dim-label">
                              <span>{labels[dim]}</span>
                              <span>{Math.round(avgValue * 100)}%</span>
                            </div>
                            <div className="dim-bar">
                              <div className="dim-fill" style={{ width: `${avgValue * 100}%` }} />
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>

                {/* Suggestions */}
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

                {/* Review */}
                <div className="detail-section review-section">
                  <h4>
                    <ListChecks size={16} /> 测验复盘
                  </h4>
                  <div className="review-list">
                    {sessionResults.map((res, i) => (
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

              {/* Actions */}
              <div className="summary-actions">
                <button className="btn-secondary" onClick={resetAssessment}>
                  <RotateCcw size={16} /> 返回概览
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    setStep("setup");
                    setSessionEvidences([]);
                    setSessionResults([]);
                    setMasteryData(null);
                  }}
                >
                  <Brain size={16} /> 再次诊断「{selectedNode?.content}」
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
