import { useState, useEffect } from 'react';
import { Brain, CheckCircle2, AlertCircle, ArrowRight, Loader2, Sparkles, Send, Layers, ListChecks, HelpCircle } from 'lucide-react';
import Modal from '../common/Modal';
import { AssessmentService } from '../../services/assessmentService';
import { updateCognitiveState, formatMasteryPercentage, ASSESSMENT_PRESETS, calculateProxyEvidence } from '../../utils/bayesianEngine';
import { useMindMapStore } from '../../stores/mindmapStore';
import type { MindMapNode, QuizQuestion, LLMEvidence, CognitiveState } from '../../types';
import './AssessmentModal.css';

interface AssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: MindMapNode;
  contextPath: string;
}

type Step = 'setup' | 'loading' | 'question' | 'evaluating' | 'summary';

export default function AssessmentModal({ isOpen, onClose, node, contextPath }: AssessmentModalProps) {
  const { currentProject, updateNodeCognitiveState } = useMindMapStore();
  
  const [step, setStep] = useState<Step>('setup');
  const [difficultyPrompt, setDifficultyPrompt] = useState('进阶水平：侧重概念的理解与简单应用。');
  const [questionCount, setQuestionCount] = useState(3);
  const [allowedTypes, setAllowedTypes] = useState<('choice' | 'trueFalse' | 'openEnded')[]>(['openEnded', 'choice']);
  const [isOptimizing, setIsOptimizing] = useState(false);
  
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [sessionEvidences, setSessionEvidences] = useState<LLMEvidence[]>([]);
  const [masteryData, setMasteryData] = useState<{ before: number; after: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const presets = [
    { label: '👶 基础入门', prompt: '基础水平：侧重核心定义、基本概念的准确回忆，用通俗易懂的方式出题。' },
    { label: '💼 面试模拟', prompt: '面试官人设：模拟大厂社招架构师面试提问，侧重技术选型对比与实际落地瓶颈分析。' },
    { label: '🎓 专家深挖', prompt: '专家水平：侧重深度分析、逻辑辨析与底层原理，考查知识点的深度关联。' }
  ];

  // 初始化：重置状态
  useEffect(() => {
    if (isOpen && node) {
      setStep('setup');
      setError(null);
      setUserAnswer('');
      setCurrentIndex(0);
      setSessionEvidences([]);
    }
  }, [isOpen, node]);

  const optimizeDifficultyPrompt = async () => {
    if (!difficultyPrompt.trim()) return;
    setIsOptimizing(true);
    try {
      const systemMsg = "你是一个 Prompt 优化专家。请将用户简单的考核要求转化为一段专业的、具有人设色彩的教育评估指令。输出要简洁有力（50字以内）。只输出优化后的文本。";
      const optimized = await AssessmentService.optimizePrompt(difficultyPrompt, systemMsg);
      setDifficultyPrompt(optimized);
    } catch (err) {
      console.error(err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const initAssessment = async () => {
    if (allowedTypes.length === 0) {
      setError('请至少选择一种题型');
      return;
    }
    setStep('loading');
    setError(null);
    try {
      const qBatch = await AssessmentService.generateAssessmentBatch(
        node, 
        contextPath, 
        difficultyPrompt, 
        questionCount === 0 ? undefined : questionCount, 
        allowedTypes.length === 0 ? undefined : allowedTypes
      );
      setQuestions(qBatch);
      setCurrentIndex(0);
      setStep('question');
    } catch (err: any) {
      setError(err.message || '无法生成题目');
      setStep('setup');
    }
  };

  const handleAnswerSubmit = async () => {
    const currentQ = questions[currentIndex];
    if (!currentQ || !userAnswer.trim()) return;

    setStep('evaluating');
    try {
      let evidence: LLMEvidence;

      if (currentQ.type === 'openEnded') {
        // AI 深度评估
        evidence = await AssessmentService.extractEvidence(
          node.content,
          node.explanation || '',
          currentQ.question,
          currentQ.referenceAnswer || '',
          userAnswer
        );
      } else {
        // 简单对错匹配 (代理评估)
        const isCorrect = userAnswer.trim() === (currentQ.correctAnswer || '').trim();
        evidence = calculateProxyEvidence(isCorrect, currentQ.difficulty);
      }

      const newEvidences = [...sessionEvidences, evidence];
      setSessionEvidences(newEvidences);

      if (currentIndex < questions.length - 1) {
        // 进入下一题
        setCurrentIndex(currentIndex + 1);
        setUserAnswer('');
        setStep('question');
      } else {
        // 完成所有题目，进行贝叶斯更新
        finalizeSession(newEvidences);
      }
    } catch (err: any) {
      setError('评估失败: ' + err.message);
      setStep('question');
    }
  };

  const finalizeSession = (evidences: LLMEvidence[]) => {
    // 聚合更新 (简单的线性更新，或逐个更新)
    let currentState = (currentProject?.cognitiveStates || {})[node.id] || {
      alpha: 2,
      beta: 8,
      lastUpdate: Date.now(),
      evidenceHistory: []
    };

    const preset = currentProject?.cognitiveConfig?.preset || 'balanced';
    const weights = currentProject?.cognitiveConfig?.customWeights || ASSESSMENT_PRESETS[preset];

    let lastMasteryAfter = 0;
    let firstMasteryBefore = 0;

    evidences.forEach((ev, idx) => {
      const { newState, masteryBefore, masteryAfter } = updateCognitiveState(
        currentState as CognitiveState,
        { ...ev, question: questions[idx].question, userAnswer: 'Session Answer' },
        weights
      );
      currentState = newState;
      lastMasteryAfter = masteryAfter;
      if (idx === 0) firstMasteryBefore = masteryBefore;
    });

    updateNodeCognitiveState(node.id, currentState as CognitiveState);
    setMasteryData({ before: firstMasteryBefore, after: lastMasteryAfter });
    setStep('summary');
  };

  const toggleType = (type: any) => {
    if (allowedTypes.includes(type)) {
      setAllowedTypes(allowedTypes.filter(t => t !== type));
    } else {
      setAllowedTypes([...allowedTypes, type]);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`知识诊断：${node.content}`}
    >
      <div className="assessment-container">
        {step === 'setup' && (
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
                  className={`optimize-btn ${isOptimizing ? 'loading' : ''}`}
                  onClick={optimizeDifficultyPrompt}
                  title="AI 优化指令"
                >
                  <Sparkles size={16} />
                </button>
              </div>
              <div className="persona-presets">
                {presets.map(p => (
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
                  className={`type-chip auto ${allowedTypes.length === 0 ? 'active' : ''}`}
                  onClick={() => setAllowedTypes([])}
                >
                  <Sparkles size={14} /> 自动
                </button>
                <button 
                  type="button"
                  className={`type-chip ${allowedTypes.includes('openEnded') ? 'active' : ''}`}
                  onClick={() => toggleType('openEnded')}
                >
                  <Send size={14} /> 问答
                </button>
                <button 
                  type="button"
                  className={`type-chip ${allowedTypes.includes('choice') ? 'active' : ''}`}
                  onClick={() => toggleType('choice')}
                >
                  <ListChecks size={14} /> 选择
                </button>
                <button 
                  type="button"
                  className={`type-chip ${allowedTypes.includes('trueFalse') ? 'active' : ''}`}
                  onClick={() => toggleType('trueFalse')}
                >
                  <HelpCircle size={14} /> 判断
                </button>
              </div>
            </div>

            <div className="setup-section">
                <div className="section-label-group">
                    <label>题目数量</label>
                    <span className="count-value">{questionCount === 0 ? 'AI 自动' : `${questionCount} 道`}</span>
                </div>
                <div className="count-selector-group">
                    <button 
                        type="button"
                        className={`auto-count-btn ${questionCount === 0 ? 'active' : ''}`}
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
                    <span>预计 Token 消耗：{questionCount === 0 ? 'AI 动态确定' : (questionCount > 5 ? '较高' : '正常')}</span>
                </div>
                {(questionCount > 5 || questionCount === 0) && (
                    <div className="warning-item attention">
                        <Layers size={14} />
                        <span>{questionCount === 0 ? '自动模式下 AI 将生成 2-5 道题以保证诊断深度。' : '建议一次不要生成过多题目，避免 AI 注意力缺陷导致质量下降。'}</span>
                    </div>
                )}
            </div>

            {error && <p className="setup-error">{error}</p>}

            <button className="btn-primary start-btn" onClick={initAssessment}>
              启动诊断
            </button>
          </div>
        )}

        {step === 'loading' && (
          <div className="assessment-state-view animate-fade-in">
            <Loader2 className="spinner" size={40} />
            <p>AI 正在根据你的偏好构建测验模块...</p>
          </div>
        )}

        {step === 'question' && (
          <div className="assessment-question-view animate-slide-up">
            <div className="quiz-progress-bar">
                <div className="progress-fill" style={{ width: `${(currentIndex / questions.length) * 100}%` }} />
                <span className="progress-text">第 {currentIndex + 1} / {questions.length} 题</span>
            </div>

            <div className="question-content">
                <span className="type-badge">{questions[currentIndex].type.toUpperCase()}</span>
                <p className="question-text">{questions[currentIndex].question}</p>

                {questions[currentIndex].type === 'openEnded' ? (
                  <textarea
                    className="answer-input"
                    placeholder="请输入你的解答..."
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    autoFocus
                  />
                ) : questions[currentIndex].type === 'choice' ? (
                  <div className="choice-list">
                    {questions[currentIndex].options?.map((opt, i) => (
                      <button 
                        key={i}
                        className={`choice-item ${userAnswer === opt ? 'selected' : ''}`}
                        onClick={() => setUserAnswer(opt)}
                      >
                        <span className="choice-index">{String.fromCharCode(65 + i)}</span>
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="boolean-list">
                    {['正确', '错误'].map((opt) => (
                      <button 
                        key={opt}
                        className={`boolean-item ${userAnswer === opt ? 'selected' : ''}`}
                        onClick={() => setUserAnswer(opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
            </div>

            <div className="assessment-actions">
              <button 
                className="btn-primary" 
                onClick={handleAnswerSubmit}
                disabled={!userAnswer.trim()}
              >
                {currentIndex === questions.length - 1 ? '提交测验' : '下一题'} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 'evaluating' && (
          <div className="assessment-state-view animate-fade-in">
            <Loader2 className="spinner" size={40} />
            <p>正在同步诊断结果...</p>
          </div>
        )}

        {step === 'summary' && (
          <div className="assessment-feedback-view animate-slide-up">
            <h3 className="summary-title"><Sparkles size={20} /> 诊断总结</h3>
            
            <div className="mastery-shift-card">
              <div className="mastery-score-group">
                <div className="score-item">
                  <span className="label">评估前</span>
                  <span className="value">{formatMasteryPercentage(masteryData?.before || 0)}%</span>
                </div>
                <ArrowRight size={24} className="shift-arrow" />
                <div className="score-item after">
                  <span className="label">最终测评结果</span>
                  <span className="value">{formatMasteryPercentage(masteryData?.after || 0)}%</span>
                </div>
              </div>
              <div className="mastery-progress-bar">
                <div className="progress-bg" />
                <div 
                  className="progress-fill" 
                  style={{ width: `${formatMasteryPercentage(masteryData?.after || 0)}%` }} 
                />
              </div>
            </div>

            <div className="summary-note">
                <CheckCircle2 size={16} color="var(--color-success)" />
                <p>完成了 {questions.length} 道题目的深层诊断。你现在的掌握情况已同步至全局热力图。</p>
            </div>

            <div className="assessment-actions">
              <button className="btn-secondary" onClick={onClose}>返回导图</button>
              <button className="btn-primary" onClick={() => setStep('setup')}>再次测评</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function EvidenceItem({ label, value }: { label: string; value: number }) {
  const percentage = Math.round(value * 100);
  let colorClass = 'low';
  if (value >= 0.8) colorClass = 'high';
  else if (value >= 0.5) colorClass = 'medium';

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
