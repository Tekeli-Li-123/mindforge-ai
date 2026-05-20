/**
 * Few-shot Example Library — 示例库管理
 *
 * 本文件管理所有用于 AI prompt 的 few-shot 示例。
 * 每个示例包含:
 *   - id: 唯一标识
 *   - category: 所属类别（system/refine/explain/reorganize/assessment）
 *   - input: 输入示例
 *   - output: 期望输出示例
 *   - tags: 标签，用于检索匹配
 *   - quality: 质量评分 (0-1)，用于评估和自动选取最佳示例
 */

export interface FewShotExample {
  id: string;
  category: string;
  input: string;
  output: string;
  tags: string[];
  quality: number;
  modelCompatibility: string[];
}

/** System prompt examples — 思维导图生成 */
export const systemExamples: FewShotExample[] = [
  {
    id: "system-ex-001",
    category: "system",
    input: '请生成关于"机器学习"的思维导图',
    output: `# 机器学习
## 监督学习
### 回归
- 线性回归
- 决策树回归
- 神经网络回归
### 分类
- 逻辑回归
- 支持向量机
- K近邻
## 无监督学习
### 聚类
- K-Means
- DBSCAN
- 层次聚类
### 降维
- PCA
- t-SNE
## 强化学习
### 基于值
- Q-Learning
- DQN
### 基于策略
- Policy Gradient
- PPO`,
    tags: ["machine-learning", "完整结构", "3级深度"],
    quality: 0.95,
    modelCompatibility: ["openai", "anthropic", "deepseek", "local"],
  },
  {
    id: "system-ex-002",
    category: "system",
    input: '请生成关于"TypeScript"的思维导图',
    output: `# TypeScript
## 基础类型
### 原始类型
- string / number / boolean
- null / undefined / void
### 复合类型
- Array / Tuple
- Enum / Union
## 高级类型
### 泛型
- 泛型函数与类
- 约束与条件类型
### 类型工具
- Partial / Required / Readonly
- Pick / Omit / Record
## 工程实践
### 类型声明
- d.ts 文件
- 模块扩增
### 配置
- tsconfig.json
- 严格模式`,
    tags: ["typescript", "工程实践", "完整结构"],
    quality: 0.9,
    modelCompatibility: ["openai", "anthropic", "deepseek", "local"],
  },
];

/** Refine examples — 节点细化发散 */
export const refineExamples: FewShotExample[] = [
  {
    id: "refine-ex-001",
    category: "refine",
    input: '细化"线性回归"，上下文路径为"机器学习 > 监督学习 > 回归"',
    output: `- 最小二乘法
- 梯度下降优化
- 评估指标
  - MSE / RMSE
  - R² 决定系数
- 正则化变体
  - Lasso 回归
  - Ridge 回归`,
    tags: ["线性回归", "机器学习", "细化"],
    quality: 0.92,
    modelCompatibility: ["openai", "anthropic", "deepseek", "local"],
  },
  {
    id: "refine-ex-002",
    category: "refine",
    input: '细化"React Hooks"，上下文路径为"React > 核心概念"',
    output: `- useState
  - 惰性初始化
  - 更新时机
- useEffect
  - 依赖数组
  - 清理函数
- useContext
- useRef
- useMemo / useCallback
- 自定义 Hooks`,
    tags: ["React", "Hooks", "前端"],
    quality: 0.88,
    modelCompatibility: ["openai", "anthropic", "deepseek", "local"],
  },
];

/** Explain examples — 知识点解释 */
export const explainExamples: FewShotExample[] = [
  {
    id: "explain-ex-001",
    category: "explain",
    input: '解释"梯度下降"，上下文路径为"深度学习 > 优化算法"',
    output: `梯度下降是一种通过迭代调整参数来最小化损失函数的优化算法。在深度学习的语境中，它的重要性在于：几乎所有神经网络的训练都依赖它来更新权重。

打个比方：想象你在浓雾中站在山坡上，想走到山谷最低处。你看不清整个地形，只能感受脚下的坡度，往最陡的下坡方向迈步。每一步的方向由当前位置的梯度（即坡度）决定，步长由学习率控制。

核心公式: θ_new = θ_old - α * ∇J(θ)
其中 α 是学习率，∇J(θ) 是损失函数关于参数的梯度。`,
    tags: ["梯度下降", "优化", "基础概念", "生活类比"],
    quality: 0.94,
    modelCompatibility: ["openai", "anthropic", "deepseek", "local"],
  },
  {
    id: "explain-ex-002",
    category: "explain",
    input: '解释"闭包"，上下文路径为"JavaScript > 函数式编程"',
    output: `闭包是指一个函数能记住并访问其词法作用域中的变量，即使该函数在其作用域之外执行。

在 JavaScript 中，闭包的重要性体现在：它是实现数据封装和创建高阶函数的基础机制。每次创建函数时，闭包会自动创建，但最有用的场景是函数内部返回另一个函数。

举例：假设你要创建一个计数器，又不希望 count 变量被全局污染——闭包正好解决这个问题：
function createCounter() {
  let count = 0;
  return function() { return ++count; };
}
这里的匿名函数"记住"了 count 变量，形成了闭包。`,
    tags: ["闭包", "JavaScript", "函数式"],
    quality: 0.91,
    modelCompatibility: ["openai", "anthropic", "deepseek", "local"],
  },
];

/** Reorganize examples — 节点重组 */
export const reorganizeExamples: FewShotExample[] = [
  {
    id: "reorg-ex-001",
    category: "reorganize",
    input:
      '重组以下杂乱节点，父级概念为"CSS 布局"\n弹性布局、Grid、浮动布局、flex-direction、grid-template-columns、清除浮动、justify-content、align-items、grid-area、flex-wrap',
    output: `- Flexbox
  - flex-direction
  - justify-content
  - align-items
  - flex-wrap
- CSS Grid
  - grid-template-columns
  - grid-area
- 传统布局
  - 浮动布局
  - 清除浮动`,
    tags: ["CSS", "布局", "重组"],
    quality: 0.93,
    modelCompatibility: ["openai", "anthropic", "deepseek", "local"],
  },
];

/** Assessment examples — 考核题目生成 */
export const assessmentExamples: FewShotExample[] = [
  {
    id: "assess-ex-001",
    category: "assessment",
    input: "生成考核题，知识点：JavaScript Promise，范围：异步编程，难度：进阶",
    output: `{
  "questions": [
    {
      "id": "q1",
      "type": "choice",
      "difficulty": "basic",
      "bloomLevel": "remember",
      "question": "Promise 的三种状态是哪三种？",
      "options": ["pending/resolved/rejected", "pending/fullfilled/rejected", "wait/done/fail", "start/success/error"],
      "correctAnswer": "pending/fullfilled/rejected",
      "explanation": "Promise 有三种状态：pending（进行中）、fullfilled（已成功）、rejected（已失败）。"
    },
    {
      "id": "q2",
      "type": "coding",
      "difficulty": "advanced",
      "bloomLevel": "apply",
      "question": "请用 Promise 实现一个带超时控制的 fetch 请求封装",
      "correctAnswer": "function fetchWithTimeout(url, timeout = 5000) { return Promise.race([ fetch(url), new Promise((_, reject) => setTimeout(() => reject(new Error('请求超时')), timeout)) ]); }",
      "explanation": "使用 Promise.race 在原始 fetch 和超时 Promise 之间竞争，先完成的决定最终结果。"
    }
  ]
}`,
    tags: ["JavaScript", "Promise", "异步"],
    quality: 0.87,
    modelCompatibility: ["openai", "anthropic", "deepseek", "local"],
  },
];

/** 合并所有示例 */
export const allExamples: FewShotExample[] = [
  ...systemExamples,
  ...refineExamples,
  ...explainExamples,
  ...reorganizeExamples,
  ...assessmentExamples,
];

/** 按类别获取示例 */
export function getExamplesByCategory(category: FewShotExample["category"]): FewShotExample[] {
  return allExamples.filter((ex) => ex.category === category);
}

/** 按标签获取示例 */
export function getExamplesByTag(tag: string): FewShotExample[] {
  return allExamples.filter((ex) => ex.tags.includes(tag));
}

/** 获取质量最高的 N 个示例 */
export function getTopKExamples(
  category: FewShotExample["category"],
  k: number = 2,
): FewShotExample[] {
  return getExamplesByCategory(category)
    .sort((a, b) => b.quality - a.quality)
    .slice(0, k);
}

/** 将示例格式化为 prompt 上下文文本 */
export function formatExamplesAsContext(examples: FewShotExample[]): string {
  if (examples.length === 0) return "";

  return examples
    .map((ex) => `示例输入：\n${ex.input}\n\n期望输出：\n${ex.output}`)
    .join("\n\n---\n\n");
}

export default allExamples;
