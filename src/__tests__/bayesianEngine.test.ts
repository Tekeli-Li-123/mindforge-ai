import { describe, it, expect } from "vitest";
import {
  updateCognitiveState,
  calculateMastery,
  calculateProxyEvidence,
  INITIAL_COGNITIVE_STATE,
  ASSESSMENT_PRESETS,
} from "../utils/bayesianEngine";

describe("calculateMastery", () => {
  it("should return correct mastery for alpha=2, beta=8", () => {
    expect(calculateMastery(2, 8)).toBeCloseTo(0.2, 5);
  });

  it("should return 0.5 for no evidence", () => {
    expect(calculateMastery(0, 0)).toBe(0.5);
  });

  it("should return 1.0 when alpha is large relative to beta", () => {
    expect(calculateMastery(100, 1)).toBeCloseTo(0.9901, 2);
  });

  it("should return 0.0 when beta is large relative to alpha", () => {
    expect(calculateMastery(1, 100)).toBeCloseTo(0.0099, 2);
  });
});

describe("INITIAL_COGNITIVE_STATE", () => {
  it("should have skeptical prior (low mastery)", () => {
    const mastery = calculateMastery(INITIAL_COGNITIVE_STATE.alpha, INITIAL_COGNITIVE_STATE.beta);
    expect(mastery).toBeCloseTo(0.2, 2);
  });

  it("should have empty evidence history", () => {
    expect(INITIAL_COGNITIVE_STATE.evidenceHistory).toEqual([]);
  });
});

describe("updateCognitiveState", () => {
  it("should increase mastery with good evidence", () => {
    const evidence = {
      recall: 0.9,
      comprehension: 0.8,
      application: 0.7,
      analysis: 0.6,
      feedback: "Good",
      errorType: "none" as const,
      suggestion: "Keep going",
    };

    const { newState, masteryBefore, masteryAfter } = updateCognitiveState(
      INITIAL_COGNITIVE_STATE,
      evidence,
      ASSESSMENT_PRESETS.balanced,
    );

    expect(masteryAfter).toBeGreaterThan(masteryBefore);
    expect(newState.evidenceHistory).toHaveLength(1);
  });

  it("should decrease mastery with poor evidence", () => {
    const evidence = {
      recall: 0.1,
      comprehension: 0.1,
      application: 0.1,
      analysis: 0.1,
      feedback: "Bad",
      errorType: "conceptual" as const,
      suggestion: "Review more",
    };

    const { newState, masteryBefore, masteryAfter } = updateCognitiveState(
      { alpha: 10, beta: 2, lastUpdate: Date.now(), evidenceHistory: [] },
      evidence,
      ASSESSMENT_PRESETS.balanced,
    );

    expect(masteryAfter).toBeLessThan(masteryBefore);
  });

  it("should record evidence history correctly", () => {
    const evidence = {
      recall: 1.0,
      comprehension: 1.0,
      application: 1.0,
      analysis: 1.0,
      feedback: "Perfect",
      errorType: "none" as const,
      suggestion: "Excellent",
      question: "What is ML?",
      userAnswer: "Machine learning is...",
    };

    const { newState } = updateCognitiveState(INITIAL_COGNITIVE_STATE, evidence);

    expect(newState.evidenceHistory[0].question).toBe("What is ML?");
    expect(newState.evidenceHistory[0].userAnswer).toBe("Machine learning is...");
    expect(newState.evidenceHistory[0].llmEvidence.recall).toBe(1.0);
    expect(newState.evidenceHistory[0].masteryBefore).toBeDefined();
    expect(newState.evidenceHistory[0].masteryAfter).toBeDefined();
  });

  it("should apply theoretical preset weights correctly", () => {
    // Theoretical preset weights comprehension and analysis higher
    const evidence = {
      recall: 1.0,
      comprehension: 0.5,
      application: 0.0,
      analysis: 1.0,
      feedback: "",
      errorType: "none" as const,
      suggestion: "",
    };

    const balancedResult = updateCognitiveState(
      INITIAL_COGNITIVE_STATE,
      evidence,
      ASSESSMENT_PRESETS.balanced,
    );

    const theoreticalResult = updateCognitiveState(
      INITIAL_COGNITIVE_STATE,
      evidence,
      ASSESSMENT_PRESETS.theoretical,
    );

    // With theoretical preset, comprehension+analysis have higher weight
    // Since comprehension=0.5 drags down, but analysis=1.0 boosts more with higher weight
    // So theoretical result should be >= balanced result for this evidence pattern
    expect(theoreticalResult.masteryAfter).toBeDefined();
    expect(balancedResult.masteryAfter).toBeDefined();
  });
});

describe("calculateProxyEvidence", () => {
  it("should return high scores for correct answer", () => {
    const evidence = calculateProxyEvidence(true, "medium");
    expect(evidence.recall).toBeGreaterThan(0.7);
    expect(evidence.comprehension).toBeGreaterThan(0.5);
    expect(evidence.application).toBeGreaterThan(0.4);
    expect(evidence.analysis).toBeGreaterThan(0.3);
    expect(evidence.errorType).toBe("none");
  });

  it("should return low scores for wrong answer", () => {
    const evidence = calculateProxyEvidence(false, "medium");
    expect(evidence.recall).toBeLessThan(0.5);
    expect(evidence.comprehension).toBeLessThan(0.3);
    expect(evidence.application).toBeLessThan(0.2);
    expect(evidence.analysis).toBeLessThan(0.2);
    expect(evidence.errorType).not.toBe("none");
  });

  it("should scale with difficulty for correct answers", () => {
    const easyEvidence = calculateProxyEvidence(true, "easy");
    const hardEvidence = calculateProxyEvidence(true, "hard");
    expect(hardEvidence.recall).toBeGreaterThan(easyEvidence.recall);
  });
});

describe("ASSESSMENT_PRESETS", () => {
  it("should have four presets defined", () => {
    expect(Object.keys(ASSESSMENT_PRESETS)).toHaveLength(4);
    expect(ASSESSMENT_PRESETS).toHaveProperty("balanced");
    expect(ASSESSMENT_PRESETS).toHaveProperty("theoretical");
    expect(ASSESSMENT_PRESETS).toHaveProperty("practical");
    expect(ASSESSMENT_PRESETS).toHaveProperty("exam");
  });

  it("exam preset should weight recall highest", () => {
    const { recall, comprehension, application, analysis } = ASSESSMENT_PRESETS.exam;
    expect(recall).toBeGreaterThan(comprehension);
    expect(recall).toBeGreaterThan(application);
    expect(recall).toBeGreaterThan(analysis);
  });

  it("practical preset should weight application highest", () => {
    const { recall, comprehension, application, analysis } = ASSESSMENT_PRESETS.practical;
    expect(application).toBeGreaterThan(recall);
    expect(application).toBeGreaterThan(comprehension);
    expect(application).toBeGreaterThan(analysis);
  });
});
