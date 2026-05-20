import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
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
  Target,
  RotateCcw,
  Map,
  FolderOpen,
} from "lucide-react";
import { useMindMapStore } from "../stores/mindmapStore";
import { AssessmentService } from "../services/assessmentService";
import {
  updateCognitiveState,
  formatMasteryPercentage,
  ASSESSMENT_PRESETS,
  calculateProxyEvidence,
  INITIAL_COGNITIVE_STATE,
} from "../utils/bayesianEngine";
import type { MindMapNode, QuizQuestion, LLMEvidence, CognitiveState } from "../types";
import { countNodes, averageMastery } from "../utils/mindmapHelpers";
import { useTranslation } from "../i18n";
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
// NodeBrowser sub-component (extracted to fix useState-in-render issue)
// ==========================================

function NodeBrowser({
  flatNodes,
  selectedNode,
  onSelectNode,
  t,
}: {
  flatNodes: Array<{ node: MindMapNode; path: string; depth: number }>;
  selectedNode: MindMapNode | null;
  onSelectNode: (node: MindMapNode, path: string) => void;
  t: (key: string, params?: Record<string, any>) => string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(flatNodes.length > 0 ? [flatNodes[0].node.id] : []),
  );

  const toggleExpand = (nodeId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const renderNodeItem = (item: { node: MindMapNode; path: string; depth: number }) => {
    const isLeaf = item.node.children.length === 0;
    const isExpanded = expanded.has(item.node.id);
    const isSelected = selectedNode?.id === item.node.id;
    return (
      <div key={item.node.id} className="node-tree-item">
        <div className="node-tree-row" style={{ paddingLeft: item.depth * 16 }}>
          {isLeaf ? (
            <span className="tree-toggle-spacer" />
          ) : (
            <button className="tree-toggle-btn" onClick={() => toggleExpand(item.node.id)}>
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
          <button
            className={`node-select-btn ${isSelected ? "selected" : ""}`}
            onClick={() => onSelectNode(item.node, item.path)}
          >
            <span className="node-name">{item.node.content}</span>
            <span
              className="node-mastery-badge"
              style={{ color: `hsl(${item.node.mastery * 120}, 70%, 45%)` }}
            >
              {formatMasteryPercentage(item.node.mastery)}
            </span>
          </button>
        </div>
        {!isLeaf && isExpanded && (
          <div className="node-tree-children">
            {item.node.children.map((child) => {
              const childFlat = flatNodes.find((n) => n.node.id === child.id);
              return childFlat ? renderNodeItem(childFlat) : null;
            })}
          </div>
        )}
      </div>
    );
  };

  const rootNode = flatNodes.find((n) => n.depth === 0);
  if (!rootNode) return <div className="node-tree-empty">{t("quiz.mapEmpty")}</div>;

  return <div className="node-tree-container">{renderNodeItem(rootNode)}</div>;
}

// ==========================================
// Helper: Recursive node collector
// ==========================================

function collectFlatNodes(
  node: MindMapNode,
  depth: number = 0,
): Array<{ node: MindMapNode; path: string; depth: number }> {
  const nodes: Array<{ node: MindMapNode; path: string; depth: number }> = [];

  const pathLabel = node.content;

  nodes.push({ node, path: pathLabel, depth });

  for (const child of node.children) {
    const childNodes = collectFlatNodes(child, depth + 1);
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
// Preset keys
// ==========================================
const PRESET_KEYS = ["balanced", "theoretical", "practical", "exam"] as const;

const PRESET_DESCRIPTION: Record<string, string> = {
  balanced: "Intermediate: Focuses on conceptual understanding and simple application.",
  theoretical: "Advanced: Focuses on deep concept analysis and critical thinking.",
  practical: "Applied: Focuses on real-world case analysis and problem-solving.",
  exam: "Basic: Focuses on knowledge memorization and accurate recall.",
};

// ==========================================
// Main Component
// ==========================================

export default function Quiz() {
  const { t } = useTranslation();
  const { currentProject, projects, setCurrentProject, updateNodeCognitiveState } =
    useMindMapStore();

  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [step, setStep] = useState<QuizStep>("overview");
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);
  const [selectedNodePath, setSelectedNodePath] = useState("");
  const [difficultyPrompt, setDifficultyPrompt] = useState(
    "Intermediate: Focuses on conceptual understanding and simple application.",
  );
  const [questionCount, setQuestionCount] = useState(3);
  const [allowedTypes, setAllowedTypes] = useState<
    ("choice" | "trueFalse" | "openEnded" | "fillBlank")[]
  >(["openEnded", "choice"]);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [sessionEvidences, setSessionEvidences] = useState<LLMEvidence[]>([]);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [masteryData, setMasteryData] = useState<{ before: number; after: number } | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessionHistory, setSessionHistory] = useState<SessionRecord[]>(() => {
    try {
      const saved = localStorage.getItem("mindforge-quiz-history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // --- Project selector state ---
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);

  // --- Memoized data ---
  const flatNodes = useMemo(() => {
    if (!currentProject) return [];
    return collectFlatNodes(currentProject.root);
  }, [currentProject]);

  const nodeCount = useMemo(() => {
    if (!currentProject) return 0;
    return countNodes(currentProject.root);
  }, [currentProject]);

  const overallMastery = useMemo(() => {
    if (!currentProject) return 0;
    return averageMastery(currentProject.root);
  }, [currentProject]);

  const totalQuestionsAnswered = useMemo(() => {
    return sessionHistory.length;
  }, [sessionHistory]);

  // --- Reset assessment state ---
  const resetAssessment = () => {
    setStep("overview");
    setSelectedNode(null);
    setSelectedNodePath("");
    setQuestions([]);
    setCurrentIndex(0);
    setUserAnswer("");
    setSessionEvidences([]);
    setSessionResults([]);
    setMasteryData(null);
    setIsRegenerating(false);
    setError(null);
  };

  // --- Handle switching project ---
  const handleSwitchProject = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      setCurrentProject(project);
      resetAssessment();
    }
    setProjectSelectorOpen(false);
  };

  // --- Optimize prompt ---
  const optimizeDifficultyPrompt = async () => {
    if (!difficultyPrompt.trim()) return;
    setIsOptimizing(true);
    try {
      const systemMsg = t("quiz.optimizeSystemMsg");
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
      setError(err.message || t("quiz.generateFailed"));
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
        allowedTypes.length === 0
          ? ["choice", "trueFalse", "openEnded", "fillBlank"]
          : allowedTypes,
      );

      const newQuestions = [...questions];
      newQuestions[currentIndex] = newQ;
      setQuestions(newQuestions);
      setUserAnswer("");
    } catch (err: any) {
      setError(t("quiz.regenerateFailed") + err.message);
    } finally {
      setIsRegenerating(false);
    }
  };

  // --- Skip question ---
  const handleSkip = () => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const result: SessionResult = {
      question: currentQ.question,
      type: currentQ.type,
      userAnswer: t("quiz.skippedAnswer"),
      correctAnswer: currentQ.correctAnswer || "",
      isCorrect: false,
      isSkipped: true,
      explanation: currentQ.explanation || "",
    };
    saveAndNext(result);
  };

  // --- Submit answer ---
  const handleSubmit = () => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    let isCorrect: boolean;
    let correctAnswer = currentQ.correctAnswer || "";

    if (currentQ.type === "trueFalse") {
      isCorrect = userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    } else if (currentQ.type === "fillBlank") {
      isCorrect = userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    } else if (currentQ.type === "choice" && currentQ.options) {
      // For choice type, correctAnswer holds the text of the correct option
      const selectedText = currentQ.options[parseInt(userAnswer, 10)];
      isCorrect = selectedText === correctAnswer;
      correctAnswer = correctAnswer || (currentQ.options[0] ?? "");
    } else {
      // openEnded: mark correct if answer has content; better match if includes keywords
      isCorrect = userAnswer.trim().length > 0;
      if (
        correctAnswer &&
        userAnswer.trim().toLowerCase().includes(correctAnswer.trim().toLowerCase())
      ) {
        isCorrect = true;
      }
    }

    const result: SessionResult = {
      question: currentQ.question,
      type: currentQ.type,
      userAnswer: userAnswer.trim(),
      correctAnswer,
      isCorrect,
      isSkipped: false,
      explanation: currentQ.explanation || "",
    };
    saveAndNext(result);
  };

  // --- Save result and advance ---
  const saveAndNext = (result: SessionResult) => {
    const newResults = [...sessionResults, result];
    setSessionResults(newResults);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer("");
    } else {
      setStep("evaluating");
      evaluateSession(newResults);
    }
  };

  // --- Evaluate session with bayesian update ---
  const evaluateSession = useCallback(
    async (results: SessionResult[]) => {
      if (!selectedNode || !currentProject) return;

      const masteryBefore = selectedNode.mastery;
      const weights = getWeights(currentProject.cognitiveConfig?.preset);

      const counts = { correct: 0, wrong: 0, skip: 0 };
      for (const r of results) {
        if (r.isSkipped) counts.skip++;
        else if (r.isCorrect) counts.correct++;
        else counts.wrong++;
      }

      // AI-driven evidence per result
      const llmEvidences: LLMEvidence[] = [];
      for (const r of results) {
        if (r.isSkipped) continue;
        try {
          const evidence = await AssessmentService.extractEvidence(
            selectedNode.content,
            selectedNode.explanation || selectedNode.content,
            r.question,
            r.correctAnswer,
            r.userAnswer,
            "understand",
          );
          llmEvidences.push(evidence);
        } catch {
          // Fallback: use proxy evidence
          const proxy = calculateProxyEvidence(r.isCorrect, "medium", r.type === "choice");
          llmEvidences.push(proxy);
        }
      }

      // If no AI evidences collected, use a single proxy
      if (llmEvidences.length === 0) {
        const ratio = counts.correct / Math.max(1, counts.correct + counts.wrong);
        const proxy = calculateProxyEvidence(
          ratio > 0.5,
          ratio > 0.8 ? "easy" : ratio > 0.4 ? "medium" : "hard",
          false,
        );
        llmEvidences.push(proxy);
      }

      setSessionEvidences(llmEvidences);

      // Update cognitive state
      try {
        const currentCognitiveState: CognitiveState = currentProject.cognitiveStates?.[
          selectedNode.id
        ] || {
          ...INITIAL_COGNITIVE_STATE,
          alpha: INITIAL_COGNITIVE_STATE.alpha,
          beta: INITIAL_COGNITIVE_STATE.beta,
          lastUpdate: Date.now(),
          evidenceHistory: [],
        };

        // Aggregate all evidences into one combined update
        const combinedEvidence: LLMEvidence = {
          recall: llmEvidences.reduce((s, e) => s + e.recall, 0) / llmEvidences.length,
          comprehension:
            llmEvidences.reduce((s, e) => s + e.comprehension, 0) / llmEvidences.length,
          application: llmEvidences.reduce((s, e) => s + e.application, 0) / llmEvidences.length,
          analysis: llmEvidences.reduce((s, e) => s + e.analysis, 0) / llmEvidences.length,
          feedback: llmEvidences.map((e) => e.feedback).join("; "),
          errorType: llmEvidences.some((e) => e.errorType !== "none")
            ? (llmEvidences.find((e) => e.errorType !== "none")?.errorType ?? "none")
            : "none",
          suggestion: llmEvidences
            .map((e) => e.suggestion)
            .filter(Boolean)
            .join("；"),
        };

        const { newState, masteryAfter } = updateCognitiveState(
          currentCognitiveState,
          { ...combinedEvidence, question: "", userAnswer: "" },
          weights,
        );

        updateNodeCognitiveState(selectedNode.id, newState);

        setMasteryData({ before: masteryBefore, after: masteryAfter });

        // Save to history
        const record: SessionRecord = {
          id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          nodeId: selectedNode.id,
          nodeName: selectedNode.content,
          timestamp: Date.now(),
          questionCount: results.length,
          results,
          masteryBefore,
          masteryAfter,
        };
        const newHistory = [record, ...sessionHistory].slice(0, 50);
        setSessionHistory(newHistory);
        localStorage.setItem("mindforge-quiz-history", JSON.stringify(newHistory));
      } catch (err) {
        console.error(t("quiz.cognitiveUpdateFailed"), err);
      }

      setStep("summary");
    },
    [selectedNode, currentProject, sessionHistory, updateNodeCognitiveState, t],
  );

  // ==========================================
  // Render: Project Selector Dropdown
  // ==========================================
  const renderProjectSelector = () => (
    <div className="project-selector-container">
      <button
        className="project-selector-btn"
        onClick={(e) => {
          e.stopPropagation();
          setProjectSelectorOpen(!projectSelectorOpen);
        }}
      >
        <FolderOpen size={16} />
        <span className="project-selector-label">
          {currentProject ? currentProject.title : t("quiz.selectProject")}
        </span>
        <ChevronDown
          size={14}
          style={{
            transition: "transform 0.2s",
            transform: projectSelectorOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>
      {projectSelectorOpen && (
        <div className="project-selector-dropdown glass">
          {projects.length === 0 ? (
            <div className="project-selector-empty">{t("quiz.noProjects")}</div>
          ) : (
            projects.map((proj) => (
              <button
                key={proj.id}
                className={`project-selector-item ${currentProject?.id === proj.id ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSwitchProject(proj.id);
                }}
              >
                <Map size={14} />
                <span className="project-selector-item-name">{proj.title}</span>
                {currentProject?.id === proj.id && (
                  <CheckCircle2 size={14} className="project-selected-check" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );

  // ==========================================
  // Render: Question View
  // ==========================================
  const renderQuestion = () => {
    const currentQ = questions[currentIndex];
    if (!currentQ) {
      return (
        <div className="quiz-state-view">
          <Loader2 size={32} className="spinner" />
          <p>{t("quiz.loadingQuestionsText")}</p>
        </div>
      );
    }

    const typeLabel =
      currentQ.type === "choice"
        ? t("quiz.typeChoice")
        : currentQ.type === "trueFalse"
          ? t("quiz.typeTrueFalse")
          : currentQ.type === "fillBlank"
            ? t("quiz.typeFillBlank")
            : t("quiz.typeOpenEnded");

    return (
      <div className="quiz-question-view">
        {/* Progress Bar */}
        <div className="quiz-progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
          <span className="progress-text">
            {currentIndex + 1} / {questions.length}
          </span>
        </div>

        {/* Question content */}
        <div className="question-content">
          <span className="type-badge">{typeLabel}</span>
          <div className="question-text">{currentQ.question}</div>

          {/* Render based on type */}
          {currentQ.type === "choice" && currentQ.options && (
            <div className="choice-list">
              {currentQ.options.map((choice, idx) => (
                <button
                  key={idx}
                  className={`choice-item ${userAnswer === idx.toString() ? "selected" : ""}`}
                  onClick={() => setUserAnswer(idx.toString())}
                >
                  <span className="choice-index">{String.fromCharCode(65 + idx)}</span>
                  {choice}
                </button>
              ))}
            </div>
          )}

          {currentQ.type === "trueFalse" && (
            <div className="boolean-list">
              <button
                className={`boolean-item ${userAnswer === "true" ? "selected" : ""}`}
                onClick={() => setUserAnswer("true")}
              >
                {t("quiz.correct")}
              </button>
              <button
                className={`boolean-item ${userAnswer === "false" ? "selected" : ""}`}
                onClick={() => setUserAnswer("false")}
              >
                {t("quiz.false")}
              </button>
            </div>
          )}

          {currentQ.type === "fillBlank" && (
            <input
              className={`fill-blank-input ${userAnswer ? "has-value" : ""}`}
              type="text"
              placeholder={t("quiz.answerPlaceholder")}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && userAnswer.trim()) handleSubmit();
              }}
              autoFocus
            />
          )}

          {currentQ.type === "openEnded" && (
            <textarea
              className="answer-input"
              placeholder={t("quiz.openEndedPlaceholder")}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              rows={6}
            />
          )}
        </div>

        {/* Actions */}
        <div className="quiz-actions">
          <div className="question-error-control">
            <button
              className="regenerate-btn"
              onClick={handleRegenerateQuestion}
              disabled={isRegenerating}
              title={t("quiz.regenerate")}
            >
              <RefreshCw size={14} className={isRegenerating ? "spinner" : ""} />
              {isRegenerating ? t("quiz.regenerating") : t("quiz.regenerate")}
            </button>
          </div>
          <div className="action-group">
            <button className="skip-btn" onClick={handleSkip}>
              <SkipForward size={14} /> {t("quiz.skip")}
            </button>
            <button className="submit-btn" onClick={handleSubmit} disabled={!userAnswer.trim()}>
              <Send size={14} /> {t("quiz.submitAnswer")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // Main Render
  // ==========================================

  if (!currentProject) {
    return (
      <div className="quiz-page">
        <div className="quiz-empty">
          <div className="quiz-empty-icon">
            <GraduationCap size={36} />
          </div>
          <h3>{t("quiz.startTitle")}</h3>
          <p>{t("quiz.startDesc")}</p>
          <Link to="/" className="quiz-start-btn">
            {t("quiz.goToDashboard")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-page" onClick={() => setProjectSelectorOpen(false)}>
      {/* Header */}
      <div className="quiz-header" onClick={(e) => e.stopPropagation()}>
        <h2>
          <GraduationCap size={24} />
          {t("quiz.title")}
          {renderProjectSelector()}
        </h2>
        <p>
          {nodeCount} {t("quiz.knowledge")} · {t("quiz.diagnosed")} {totalQuestionsAnswered}{" "}
          {t("quiz.times")} ·{t("quiz.overallMastery")} {formatMasteryPercentage(overallMastery)}
        </p>
      </div>

      {/* Layout */}
      <div className="quiz-layout">
        {/* Left Sidebar */}
        <aside className="quiz-sidebar">
          {/* Mastery Overview */}
          <div className="sidebar-card mastery-overview-card">
            <div className="mastery-overview-header">
              <Brain size={14} />
              {t("quiz.overallMastery")}
            </div>
            <div className="mastery-big-number">{formatMasteryPercentage(overallMastery)}</div>
            <div className="mastery-big-bar">
              <div className="mastery-big-fill" style={{ width: `${overallMastery * 100}%` }} />
            </div>
            <div className="mastery-stats-row">{t("quiz.nodesMastery", { count: nodeCount })}</div>
          </div>

          {/* Node Browser */}
          <div className="sidebar-card">
            <div className="node-browser-header">
              <Layers size={14} />
              {t("quiz.selectNode")}
            </div>
            {flatNodes.length > 0 ? (
              <NodeBrowser
                flatNodes={flatNodes}
                selectedNode={selectedNode}
                onSelectNode={handleSelectNode}
                t={t}
              />
            ) : (
              <div className="node-tree-empty">{t("quiz.mapEmpty")}</div>
            )}
          </div>

          {/* Tips */}
          <div className="sidebar-card">
            <div className="tips-header">
              <HelpCircle size={12} />
              {t("quiz.tipsTitle")}
            </div>
            <ul className="tips-list">
              <li>{t("quiz.tip1")}</li>
              <li>{t("quiz.tip2")}</li>
              <li>{t("quiz.tip3")}</li>
            </ul>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="quiz-main">
          {/* Overview View */}
          {step === "overview" && (
            <div className="quiz-overview-view">
              <div className="overview-welcome">
                <div className="overview-icon">
                  <GraduationCap size={48} />
                </div>
                <h3>{t("quiz.startTitle")}</h3>
                <p>{t("quiz.noNodeDesc")}</p>
              </div>

              <div className="overview-tabs">
                <button
                  className={`tab-btn ${activeTab === "new" ? "active" : ""}`}
                  onClick={() => setActiveTab("new")}
                >
                  <Sparkles size={16} /> {t("quiz.newAssessment")}
                </button>
                <button
                  className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
                  onClick={() => setActiveTab("history")}
                >
                  <History size={16} /> {t("quiz.history")}
                </button>
              </div>

              {activeTab === "new" && (
                <div className="history-empty">
                  <HelpCircle size={40} />
                  <p>{t("quiz.noNodeLeft")}</p>
                </div>
              )}

              {activeTab === "history" && (
                <div className="history-list">
                  {sessionHistory.length === 0 ? (
                    <div className="history-empty">
                      <History size={40} />
                      <p>{t("quiz.noHistory")}</p>
                    </div>
                  ) : (
                    sessionHistory.map((rec) => (
                      <div key={rec.id} className="history-card">
                        <div className="history-header">
                          <span className="history-node-name">{rec.nodeName}</span>
                          <span className="history-date">
                            {new Date(rec.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="history-stats">
                          <span>
                            {rec.questionCount} {t("quiz.submit")}
                          </span>
                          <span className="history-mastery">
                            {formatMasteryPercentage(rec.masteryBefore)} →{" "}
                            {formatMasteryPercentage(rec.masteryAfter)}
                          </span>
                          <span>
                            {t("quiz.accuracy")}{" "}
                            {Math.round(
                              (rec.results.filter((r) => r.isCorrect).length / rec.results.length) *
                                100,
                            )}
                            %
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Setup View */}
          {step === "setup" && selectedNode && (
            <div className="quiz-setup-view">
              <div className="setup-breadcrumb">
                <button className="breadcrumb-back" onClick={() => setStep("overview")}>
                  {t("quiz.backToOverview")}
                </button>
                <span className="breadcrumb-path">{selectedNodePath}</span>
              </div>
              <div className="setup-header">
                <Target size={24} className="setup-icon" />
                <h3>{t("quiz.setupTitle", { node: selectedNode.content })}</h3>
              </div>

              <div className="setup-section">
                <label>{t("quiz.difficultyLabel")}</label>
                <div className="difficulty-prompt-container">
                  <textarea
                    className="difficulty-textarea"
                    value={difficultyPrompt}
                    onChange={(e) => setDifficultyPrompt(e.target.value)}
                    placeholder={t("quiz.difficultyPlaceholder")}
                    rows={2}
                  />
                  <button
                    className={`optimize-btn ${isOptimizing ? "loading" : ""}`}
                    onClick={optimizeDifficultyPrompt}
                    title={t("quiz.optimizeTooltip")}
                  >
                    <Sparkles size={14} />
                  </button>
                </div>
                <div className="persona-presets">
                  {PRESET_KEYS.map((key) => (
                    <button
                      key={key}
                      className={`preset-btn ${difficultyPrompt === PRESET_DESCRIPTION[key] ? "active" : ""}`}
                      onClick={() => setDifficultyPrompt(PRESET_DESCRIPTION[key])}
                    >
                      {t(`quiz.preset${key.charAt(0).toUpperCase() + key.slice(1)}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setup-section">
                <label>{t("quiz.allowedTypes")}</label>
                <div className="type-selector">
                  {(["choice", "trueFalse", "openEnded", "fillBlank"] as const).map((type) => (
                    <button
                      key={type}
                      className={`type-chip ${allowedTypes.includes(type) ? "active" : ""}`}
                      onClick={() => {
                        if (allowedTypes.includes(type)) {
                          if (allowedTypes.length > 1) {
                            setAllowedTypes(allowedTypes.filter((t) => t !== type));
                          }
                        } else {
                          setAllowedTypes([...allowedTypes, type]);
                        }
                      }}
                    >
                      {type === "choice"
                        ? t("quiz.typeChoice")
                        : type === "trueFalse"
                          ? t("quiz.typeTrueFalse")
                          : type === "fillBlank"
                            ? t("quiz.typeFillBlank")
                            : t("quiz.typeOpenEnded")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setup-section">
                <div className="section-label-group">
                  <label>{t("quiz.questionCount")}</label>
                  <span className="count-value">{questionCount || t("quiz.auto")}</span>
                </div>
                <div className="count-selector-group">
                  <button
                    className={`auto-count-btn ${questionCount === 0 ? "active" : ""}`}
                    onClick={() => setQuestionCount(0)}
                  >
                    <Sparkles size={12} /> {t("quiz.auto")}
                  </button>
                  <input
                    className="count-slider"
                    type="range"
                    min={1}
                    max={10}
                    value={questionCount || 3}
                    disabled={questionCount === 0}
                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                  />
                </div>
              </div>

              {selectedNode && (
                <div className="warnings-area">
                  {selectedNode.mastery > 0.8 && (
                    <div className="warning-item attention">
                      <AlertTriangle size={14} />
                      {t("quiz.highMastery", { mastery: Math.round(selectedNode.mastery * 100) })}
                    </div>
                  )}
                  {selectedNode.mastery < 0.2 && (
                    <div className="warning-item attention">
                      <AlertTriangle size={14} />
                      {t("quiz.lowMastery", { mastery: Math.round(selectedNode.mastery * 100) })}
                    </div>
                  )}
                  {selectedNode.children.length > 0 && (
                    <div className="warning-item">
                      <AlertCircle size={14} />
                      {t("quiz.subNodeCount", { count: selectedNode.children.length })}
                    </div>
                  )}
                </div>
              )}

              {error && <div className="setup-error">{error}</div>}

              <button className="start-btn" onClick={initAssessment}>
                <Brain size={18} /> {t("quiz.startAssessment")}
              </button>
            </div>
          )}

          {/* Loading View */}
          {step === "loading" && (
            <div className="quiz-state-view">
              <Loader2 size={32} className="spinner" />
              <p>{t("quiz.loadingQuestions")}</p>
            </div>
          )}

          {/* Question View */}
          {step === "question" && renderQuestion()}

          {/* Evaluating View */}
          {step === "evaluating" && (
            <div className="quiz-state-view">
              <Loader2 size={32} className="spinner" />
              <p>{t("quiz.evaluatingAnswer")}</p>
            </div>
          )}

          {/* Summary View */}
          {step === "summary" && (
            <div className="quiz-summary-view">
              {masteryData && (
                <div className="mastery-change-card">
                  <div className="mastery-change-icon">
                    <BarChart3 size={32} />
                  </div>
                  <div className="mastery-change-title">{t("quiz.masteryChange")}</div>
                  <div className="mastery-change-values">
                    <span className="mastery-before">
                      {formatMasteryPercentage(masteryData.before)}
                    </span>
                    <ArrowRight size={20} />
                    <span className="mastery-after">
                      {formatMasteryPercentage(masteryData.after)}
                    </span>
                  </div>
                </div>
              )}

              {/* Evidence Details */}
              {sessionEvidences.length > 0 && (
                <div className="summary-details">
                  <div className="detail-section">
                    <h4>
                      <FileText size={14} /> {t("quiz.evalDetails")}
                    </h4>
                    {sessionEvidences.map((ev, idx) => (
                      <div key={idx} className="evidence-row">
                        <span className="evidence-text">{ev.feedback}</span>
                        <span className="evidence-confidence" title="Confidence">
                          {`R:${Math.round(ev.recall * 100)}% C:${Math.round(ev.comprehension * 100)}%`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Suggestions */}
                  {sessionEvidences.some((ev) => ev.suggestion) && (
                    <div className="detail-section highlight">
                      <h4>
                        <Brain size={16} /> {t("quiz.aiSuggestions")}
                      </h4>
                      <ul className="suggestion-list">
                        {Array.from(
                          new Set(
                            sessionEvidences
                              .filter((ev) => ev.suggestion)
                              .map((ev) => ev.suggestion),
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
                      <ListChecks size={16} /> {t("quiz.reviewSummary")}
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
                              <span className="label">{t("quiz.yourAnswer")}</span>
                              <span
                                className={`val ${res.isSkipped ? "dim" : res.isCorrect ? "correct" : "incorrect"}`}
                              >
                                {res.userAnswer}
                              </span>
                            </div>
                            <div className="answer-col">
                              <span className="label">{t("quiz.correctAnswer")}</span>
                              <span className="val primary">{res.correctAnswer}</span>
                            </div>
                          </div>
                          {res.explanation && (
                            <div className="review-explanation">
                              <strong>{t("quiz.explanation")}</strong>
                              {res.explanation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="summary-actions">
                <button className="btn-secondary" onClick={resetAssessment}>
                  <RotateCcw size={16} /> {t("quiz.backToOverviewBtn")}
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
                  <Brain size={16} /> {t("quiz.retake", { node: selectedNode?.content || "" })}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
