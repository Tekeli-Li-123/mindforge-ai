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
  calculateConfidenceInterval,
} from "../../utils/bayesianEngine";
import { useMindMapStore } from "../../stores/mindmapStore";
import type { MindMapNode, QuizQuestion, LLMEvidence, CognitiveState } from "../../types";
import { useTranslation } from "../../i18n";
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
  const { t } = useTranslation();
  const { currentProject, updateNodeCognitiveState } = useMindMapStore();

  const [step, setStep] = useState<Step>("setup");
  const [difficultyPrompt, setDifficultyPrompt] = useState(t("assessment.presetMedium"));
  const [questionCount, setQuestionCount] = useState(3);
  const [allowedTypes, setAllowedTypes] = useState<
    ("choice" | "trueFalse" | "openEnded" | "fillBlank")[]
  >(["openEnded", "choice"]);
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
      label: t("assessment.presetBeginner"),
      prompt: t("assessment.presetBeginnerPrompt"),
    },
    {
      label: t("assessment.presetInterview"),
      prompt: t("assessment.presetInterviewPrompt"),
    },
    {
      label: t("assessment.presetExpert"),
      prompt: t("assessment.presetExpertPrompt"),
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
  }, [isOpen, node?.id]);

  const optimizeDifficultyPrompt = async () => {
    if (!difficultyPrompt.trim()) return;
    setIsOptimizing(true);
    try {
      const systemMsg = t("assessment.optimizeSystemMsg");
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
      setError(err.message || t("assessment.generateError"));
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
        allowedTypes.length === 0
          ? ["choice", "trueFalse", "openEnded", "fillBlank"]
          : allowedTypes,
      );

      const newQuestions = [...questions];
      newQuestions[currentIndex] = newQ;
      setQuestions(newQuestions);
      setUserAnswer("");
    } catch (err: any) {
      setError(t("assessment.regenerateError") + err.message);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSkipQuestion = () => {
    const currentQ = questions[currentIndex];

    setSessionResults((prev) => [
      ...prev,
      {
        question: currentQ.question,
        type: currentQ.type,
        userAnswer: t("assessment.skipped"),
        correctAnswer:
          currentQ.correctAnswer ||
          (currentQ.type === "openEnded" ? t("assessment.evaluateAnswer") : ""),
        isCorrect: false,
        explanation: t("assessment.skippedExplanation"),
        isSkipped: true as any,
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
        evidence = await AssessmentService.extractEvidence(
          node.content,
          node.explanation || "",
          currentQ.question,
          currentQ.referenceAnswer || "",
          userAnswer,
        );
      } else if (currentQ.type === "fillBlank") {
        const cleanAnswer = userAnswer.trim().toLowerCase();
        const correctAnswer = (currentQ.correctAnswer || "").trim();
        const referenceVariants = (currentQ.referenceAnswer || "")
          .split(/[,;，；、/|]/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);

        const allAccepted = [correctAnswer.toLowerCase(), ...referenceVariants];

        const fuzzyScore = (accepted: string[]): number => {
          if (accepted.includes(cleanAnswer)) return 1.0;

          const normalize = (s: string) =>
            s
              .replace(/^[a-e][.、\s)]+/, "")
              .replace(/[，,。.！!？?、：:；;""''""（）()【】[\]{}《》<>「」『』]/g, "")
              .replace(/\s+/g, "")
              .trim();
          const normInput = normalize(cleanAnswer);
          for (const candidate of accepted) {
            const normCandidate = normalize(candidate);
            if (normInput === normCandidate) return 0.95;
          }

          const extractKeywords = (s: string): string[] => {
            const parts = s
              .split(/[,，、]/)
              .map((p) => p.trim())
              .filter((p) => p.length >= 2);
            if (parts.length > 0) return parts;
            return s
              .replace(/[^a-zA-Z\u4e00-\u9fff0-9]/g, " ")
              .split(/\s+/)
              .filter((w) => w.length >= 2);
          };

          const keywords = extractKeywords(correctAnswer);
          if (keywords.length > 0) {
            const matchCount = keywords.filter((kw) => cleanAnswer.includes(kw)).length;
            const ratio = matchCount / keywords.length;
            if (ratio >= 0.8) return 0.85;
            if (ratio >= 0.5) return 0.6;
            if (ratio > 0) return 0.4;
          }

          return 0;
        };

        const score = fuzzyScore(allAccepted);
        const isCorrect = score >= 0.6;
        evidence = calculateProxyEvidence(isCorrect, currentQ.difficulty);

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
      } else {
        const cleanAnswer = userAnswer.trim().toLowerCase();
        const cleanCorrect = (currentQ.correctAnswer || "").trim().toLowerCase();

        const booleanMap: Record<string, string[]> = {
          [t("common.true")]: [t("common.true"), "true", "yes", "1"],
          [t("common.false")]: [t("common.false"), "false", "no", "0"],
        };

        const isBooleanMatch = (input: string, target: string) => {
          for (const [key, aliases] of Object.entries(booleanMap)) {
            if (aliases.includes(input) && aliases.includes(target)) return true;
            if (key === input && aliases.includes(target)) return true;
            if (key === target && aliases.includes(input)) return true;
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

        const isCorrect = Boolean(isLiteralMatch || isBoolMatch || isOptionMatch);
        evidence = calculateProxyEvidence(isCorrect, currentQ.difficulty);

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

      if (currentQ.type === "openEnded") {
        setSessionResults((prev) => [
          ...prev,
          {
            question: currentQ.question,
            type: currentQ.type,
            userAnswer,
            correctAnswer: currentQ.referenceAnswer || t("assessment.evaluateAnswer"),
            isCorrect: (evidence as any).recall >= 0.6,
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
      setError(t("assessment.evaluateError") + err.message);
      setStep("question");
    }
  };

  const finalizeSession = (evidences: LLMEvidence[]) => {
    let currentState = (currentProject?.cognitiveStates || {})[node.id] || INITIAL_COGNITIVE_STATE;

    const preset = currentProject?.cognitiveConfig?.preset || "balanced";
    const weights = currentProject?.cognitiveConfig?.customWeights || ASSESSMENT_PRESETS[preset];

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
    <Modal isOpen={isOpen} onClose={onClose} title={`${t("assessment.title")}${node.content}`}>
      <div className="assessment-container">
        {step === "setup" && (
          <div className="assessment-setup-view animate-fade-in">
            <div className="setup-header">
              <Brain size={32} className="setup-icon" />
              <h3>{t("assessment.setup")}</h3>
            </div>

            <div className="setup-section">
              <label>{t("assessment.personaLabel")}</label>
              <div className="difficulty-prompt-container">
                <textarea
                  className="difficulty-textarea"
                  placeholder={t("assessment.personaPlaceholder")}
                  value={difficultyPrompt}
                  onChange={(e) => setDifficultyPrompt(e.target.value)}
                />
                <button
                  className={`optimize-btn ${isOptimizing ? "loading" : ""}`}
                  onClick={optimizeDifficultyPrompt}
                  title={t("assessment.optimizeTooltip")}
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
              <label>{t("assessment.questionType")}</label>
              <div className="type-selector">
                <button
                  type="button"
                  className={`type-chip auto ${allowedTypes.length === 0 ? "active" : ""}`}
                  onClick={() => setAllowedTypes([])}
                >
                  <Sparkles size={14} /> {t("assessment.typeAuto")}
                </button>
                <button
                  type="button"
                  className={`type-chip ${allowedTypes.includes("openEnded") ? "active" : ""}`}
                  onClick={() => toggleType("openEnded")}
                >
                  <Send size={14} /> {t("assessment.typeQA")}
                </button>
                <button
                  type="button"
                  className={`type-chip ${allowedTypes.includes("choice") ? "active" : ""}`}
                  onClick={() => toggleType("choice")}
                >
                  <ListChecks size={14} /> {t("assessment.typeChoice")}
                </button>
                <button
                  type="button"
                  className={`type-chip ${allowedTypes.includes("trueFalse") ? "active" : ""}`}
                  onClick={() => toggleType("trueFalse")}
                >
                  <HelpCircle size={14} /> {t("assessment.typeTrueFalse")}
                </button>
                <button
                  type="button"
                  className={`type-chip ${allowedTypes.includes("fillBlank") ? "active" : ""}`}
                  onClick={() => toggleType("fillBlank")}
                >
                  <Layers size={14} /> {t("assessment.typeFillBlank")}
                </button>
              </div>
            </div>

            <div className="setup-section">
              <div className="section-label-group">
                <label>{t("assessment.questionCount")}</label>
                <span className="count-value">
                  {questionCount === 0
                    ? t("assessment.countAuto")
                    : t("assessment.countTemplate", { count: String(questionCount) })}
                </span>
              </div>
              <div className="count-selector-group">
                <button
                  type="button"
                  className={`auto-count-btn ${questionCount === 0 ? "active" : ""}`}
                  onClick={() => setQuestionCount(questionCount === 0 ? 3 : 0)}
                >
                  <Sparkles size={14} /> {t("assessment.typeAuto")}
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
                  {t("assessment.warningToken")}
                  {questionCount === 0
                    ? t("assessment.warningAuto")
                    : questionCount > 5
                      ? t("assessment.warningHigh")
                      : t("assessment.warningNormal")}
                </span>
              </div>
              {(questionCount > 5 || questionCount === 0) && (
                <div className="warning-item attention">
                  <Layers size={14} />
                  <span>
                    {questionCount === 0
                      ? t("assessment.warningAutoMode")
                      : t("assessment.warningTooMany")}
                  </span>
                </div>
              )}
            </div>

            {error && <p className="setup-error">{error}</p>}

            <button className="btn-primary start-btn" onClick={initAssessment}>
              {t("assessment.start")}
            </button>
          </div>
        )}

        {step === "loading" && (
          <div className="assessment-state-view animate-fade-in">
            <Loader2 className="spinner" size={40} />
            <p>{t("assessment.loading")}</p>
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
                {t("assessment.progress", {
                  current: String(currentIndex + 1),
                  total: String(questions.length),
                })}
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
                  placeholder={t("assessment.answerPlaceholder")}
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  autoFocus
                />
              ) : questions[currentIndex].type === "fillBlank" ? (
                <div className="fillblank-container">
                  <p className="fillblank-hint">{t("assessment.fillBlankHint")}</p>
                  <input
                    className="fillblank-input"
                    type="text"
                    placeholder={t("assessment.fillBlankInput")}
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    autoFocus
                  />
                  {questions[currentIndex].referenceAnswer && (
                    <details className="fillblank-hint-details">
                      <summary>{t("assessment.fillBlankTip")}</summary>
                      <p>{t("assessment.fillBlankTipDesc")}</p>
                    </details>
                  )}
                </div>
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
                  {[t("common.true"), t("common.false")].map((opt) => (
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
                <button className="error-report-trigger" title={t("assessment.bugReport")}>
                  <AlertTriangle size={14} /> {t("assessment.bugReport")}
                  <div className="error-actions-popover">
                    <button onClick={handleRegenerateQuestion} disabled={isRegenerating}>
                      <RefreshCw size={12} className={isRegenerating ? "spinner" : ""} />{" "}
                      {t("assessment.regenerate")}
                    </button>
                    <button onClick={handleSkipQuestion}>
                      <SkipForward size={12} /> {t("assessment.skip")}
                    </button>
                  </div>
                </button>
              </div>

              <button
                className="btn-primary"
                onClick={handleAnswerSubmit}
                disabled={!userAnswer.trim()}
              >
                {currentIndex === questions.length - 1
                  ? t("assessment.submit")
                  : t("assessment.nextQuestion")}{" "}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === "evaluating" && (
          <div className="assessment-state-view animate-fade-in">
            <Loader2 className="spinner" size={40} />
            <p>{t("assessment.evaluating")}</p>
          </div>
        )}

        {step === "summary" && (
          <div className="assessment-feedback-view animate-slide-up">
            <h3 className="summary-title">
              <Sparkles size={20} /> {t("assessment.reportTitle")}
            </h3>

            <div className="mastery-shift-card">
              <div className="mastery-score-group">
                <div className="score-item">
                  <span className="label">{t("assessment.beforeScore")}</span>
                  <span className="value">
                    {formatMasteryPercentage(masteryData?.before || 0)}%
                  </span>
                </div>
                <ArrowRight size={24} className="shift-arrow" />
                <div className="score-item after">
                  <span className="label">{t("assessment.afterScore")}</span>
                  <span className="value">{formatMasteryPercentage(masteryData?.after || 0)}%</span>
                </div>
              </div>

              <div className="mastery-progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(masteryData?.after || 0) * 100}%` }}
                />
              </div>

              {(() => {
                const state = (currentProject?.cognitiveStates || {})[node.id];
                if (state) {
                  const ci = calculateConfidenceInterval(state.alpha, state.beta);
                  const width = ci.upper - ci.lower;
                  const evidenceLevel =
                    ci.evidenceCount < 5
                      ? t("assessment.ciLow")
                      : ci.evidenceCount < 20
                        ? t("assessment.ciMedium")
                        : t("assessment.ciHigh");
                  return (
                    <div className="confidence-interval-display">
                      <div className="ci-bar">
                        <div
                          className="ci-range"
                          style={{
                            left: `${ci.lower * 100}%`,
                            width: `${width * 100}%`,
                          }}
                        />
                        <div
                          className="ci-point"
                          style={{ left: `${((ci.lower + ci.upper) / 2) * 100}%` }}
                        />
                      </div>
                      <div className="ci-labels">
                        <span>
                          {t("assessment.ciLabel", {
                            lower: String(Math.round(ci.lower * 100)),
                            upper: String(Math.round(ci.upper * 100)),
                          })}
                        </span>
                        <span className="ci-evidence">
                          {t("assessment.ciEvidence", {
                            level: evidenceLevel,
                            count: String(ci.evidenceCount),
                          })}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div className="diagnostic-details">
              <div className="detail-section">
                <h4>
                  <Layers size={16} /> {t("assessment.cognitiveTitle")}
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
                        ? t("assessment.dimensionRecall")
                        : dim === "comprehension"
                          ? t("assessment.dimensionComprehension")
                          : dim === "application"
                            ? t("assessment.dimensionApplication")
                            : t("assessment.dimensionAnalysis");
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
                    <Brain size={16} /> {t("assessment.suggestionTitle")}
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
                  <ListChecks size={16} /> {t("assessment.reviewTitle")}
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
                          <span className="label">{t("assessment.yourAnswer")}</span>
                          <span
                            className={`val ${res.isSkipped ? "dim" : res.isCorrect ? "correct" : "incorrect"}`}
                          >
                            {res.userAnswer}
                          </span>
                        </div>
                        <div className="answer-col">
                          <span className="label">{t("assessment.correctAnswer")}</span>
                          <span className="val primary">{res.correctAnswer}</span>
                        </div>
                      </div>
                      {res.explanation && (
                        <div className="review-explanation">
                          <strong>{t("assessment.explanation")}</strong>
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
                {t("assessment.backToMindmap")}
              </button>
              <button className="btn-primary" onClick={() => setStep("setup")}>
                {t("assessment.retake")}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
