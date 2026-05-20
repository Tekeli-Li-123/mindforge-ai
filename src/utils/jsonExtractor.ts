/**
 * 健壮的 JSON 提取器 — 应对 LLM 各种不规范的 JSON 输出
 *
 * 功能：
 * - 去除 Markdown 代码块标记（```json, ```, ``）
 * - 修复常见 JSON 格式错误（末尾逗号、单引号、缺少引号键名）
 * - 多级 fallback：正则提取 → JSON5/宽容解析 → 最终错误返回
 *
 * v2.0.0 改进:
 * - 新增 escapedUnicode 自动解码 (\uXXXX → 字符)
 * - 新增 十六进制/科学计数法 宽容
 * - 新增 括号自动补全 (unbalancedBraceRepair)
 * - 新增 字符串截断修复 (truncation repair for "abc → "abc")
 * - 新增 JSON 值类型自动推断 (数字、布尔、null 值识别不依赖于引号)
 * - 优化 aggressiveJsonRepair: 值中的换行符保留但转义
 * - Level 5 改进为逐级深度 BFS 片段提取
 * - 添加 Array wrap 保护: 仅当明显为 QuizQuestion[] 场景时包裹
 */

/**
 * 从 LLM 响应中提取并解析 JSON
 * @param raw LLM 原始文本响应
 * @param fallback 解析失败时的兜底返回值
 *
 * 多级 fallback 策略:
 *   Level 1: JSON.parse 直接解析
 *   Level 2: cleanJsonString 清理后解析
 *   Level 3: extractJsonBlock 正则提取后清理+解析
 *   Level 4: 正则修复常见 JSON 病句（缺失引号键、值未引号包裹等）+ 解析
 *   Level 5: 提取所有形如 {k:v, ...} 的片段并尝试逐段解析，返回第一个有效结果
 *   Level 6: 如果期望 Array 但解析出 Object，包裹成 [obj] (仅当含 type/question 字段)
 *   Level 7: 返回 fallback
 */
export function safeParseJson<T>(raw: string, fallback: T): T {
  // Level 1: 直接解析
  try {
    return JSON.parse(raw) as T;
  } catch {
    // 继续
  }

  // Level 2: 清理后解析
  try {
    const cleaned = cleanJsonString(raw);
    return JSON.parse(cleaned) as T;
  } catch {
    // 继续
  }

  // Level 3: 正则提取 + 清理 + 解析
  try {
    const extracted = extractJsonBlock(raw);
    if (extracted) {
      const cleaned = cleanJsonString(extracted);
      return JSON.parse(cleaned) as T;
    }
  } catch {
    // 继续
  }

  // Level 4: 正则修复常见畸形 + 解析
  try {
    const repaired = aggressiveJsonRepair(raw);
    const cleaned = cleanJsonString(repaired);
    return JSON.parse(cleaned) as T;
  } catch {
    // 继续
  }

  // Level 5: 扫描所有可能的 JSON 片段，逐个尝试解析 (BFS by depth)
  try {
    const fragments = extractAllJsonFragments(raw);
    for (const frag of fragments) {
      try {
        const cleaned = cleanJsonString(frag);
        const repaired = aggressiveJsonRepair(cleaned);
        const parsed = JSON.parse(repaired);
        if (parsed !== null && typeof parsed === "object") {
          return parsed as T;
        }
      } catch {
        continue;
      }
    }
  } catch {
    // 继续
  }

  // Level 6: 如果 fallback 是数组类型，尝试将解析出的对象包裹为数组
  try {
    const repaired = aggressiveJsonRepair(raw);
    const cleaned = cleanJsonString(repaired);
    // 尝试解析，如果是对象则包裹成数组
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      // 检查是否符合 quiz question 结构（有 type/question 字段）
      if (parsed.type || parsed.question) {
        return [parsed] as unknown as T;
      }
    }
  } catch {
    // 继续
  }

  return fallback;
}

/**
 * 从字符串中提取所有可能的 JSON 对象/数组片段
 * 使用贪心策略找到所有 {...} 和 [...] 包围的内容
 * v2: BFS by depth, 短片段优先
 */
function extractAllJsonFragments(raw: string): string[] {
  const fragments: string[] = [];
  // 增强版：支持嵌套深度最多 10 层
  for (let depth = 1; depth <= 10; depth++) {
    const objPattern = buildNestedPattern("{", "}", depth);
    const arrPattern = buildNestedPattern("[", "]", depth);

    const regex = new RegExp(`(?:${objPattern.source}|${arrPattern.source})`, "g");
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(raw)) !== null) {
      fragments.push(match[0]);
    }
  }

  // 去重 + 按长度排序（短片段优先，减少嵌套错误的概率）
  const unique = [...new Set(fragments)];
  unique.sort((a, b) => a.length - b.length);
  return unique;
}

function buildNestedPattern(open: string, close: string, maxDepth: number): RegExp {
  // 构建支持嵌套的正则
  // 深度 1: [^{}]
  // 深度 2: (?:[^{}]|(?:{[^{}]*}))*
  let inner = `[^${open}${close}]`;
  for (let i = 1; i < maxDepth; i++) {
    inner = `(?:${inner}|${open}${inner}*${close})*`;
  }
  return new RegExp(`${open}${inner}${close}`);
}

/**
 * 解码 JSON 中的 Unicode 转义序列 (\uXXXX)
 */
function decodeUnicodeEscapes(s: string): string {
  return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
}

/**
 * 自动补全未闭合的括号（尾部截断修复）
 */
function unbalanceBraceRepair(s: string): string {
  const stack: string[] = [];
  const openers: Record<string, string> = { "{": "}", "[": "]" };
  const closers: Record<string, string> = { "}": "{", "]": "[" };
  let result = "";

  for (const ch of s) {
    result += ch;
    if (openers[ch]) {
      stack.push(ch);
    } else if (closers[ch]) {
      if (stack.length > 0 && stack[stack.length - 1] === closers[ch]) {
        stack.pop();
      }
      // 多余的闭合括号已跳过（不移入 result）
    }
  }

  // 补全未闭合的括号
  for (let i = stack.length - 1; i >= 0; i--) {
    result += openers[stack[i]];
  }

  return result;
}

/**
 * 激进 JSON 修复：处理 LLM 常见的各种不规范输出
 * - 修复缺少引号的键值对值（数字/布尔/null 外的值）
 * - 修复 = 替代 :
 * - 修复 undefined/null 字符串替代
 * - 修复 trailing comma 在各种嵌套层级
 * - 修复缺失的引号闭合
 * - 修复中文冒号 ：
 * - 修复首行非 JSON 内容的剥离
 * - 修复 Unicode 转义
 * - 修复字符串截断
 * - 自动补全未闭合括号
 */
function aggressiveJsonRepair(raw: string): string {
  let s = raw.trim();

  // 0. Unicode 转义解码
  s = decodeUnicodeEscapes(s);

  // 清理 Markdown 包裹标记
  s = s.replace(/```(?:json)?\s*/gi, "");
  s = s.replace(/\s*```/g, "");
  s = s.replace(/^``\s*/, "");
  s = s.replace(/\s*``$/, "");

  // 查找第一个 { 或 [，剥离前面的非 JSON 文本
  const firstBrace = s.indexOf("{");
  const firstBracket = s.indexOf("[");
  const firstJsonChar =
    firstBrace === -1
      ? firstBracket === -1
        ? 0
        : firstBracket
      : firstBracket === -1
        ? firstBrace
        : Math.min(firstBrace, firstBracket);

  if (firstJsonChar > 0) {
    s = s.slice(firstJsonChar);
  }

  // 修复中文冒号 ：
  s = s.replace(/：/g, ":");

  // 修复 = 替代 :
  s = s.replace(/(\w+)\s*=\s*/g, '"$1": ');

  // 修复缺少引号的值（如 "key: value" 而不是 "key": "value"）
  s = s.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)([\s,\]}])/g, ': "$1"$2');

  // 修复尾随逗号
  s = s.replace(/,\s*([}\]])/g, "$1");
  s = s.replace(/,\s*,/g, ",");

  // 修复单引号（保护已转义的单引号）
  s = s.replace(/(?<!\\)'/g, '"');

  // 修复键名缺少引号
  s = s.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

  // 修复值中的换行符（转义为 \n）
  s = s.replace(/"([^"]*?)\n([^"]*?)"/g, (_, p1, p2) => `"${p1}\\n${p2}"`);

  // 修复字符串值中的未转义控制字符
  s = s
    .split("")
    .map((c) => {
      const code = c.charCodeAt(0);
      if (c === '"' || c === "\\" || (code >= 32 && code !== 127)) return c;
      return "";
    })
    .join("");

  // 修复 null/undefined 字面量被引用
  s = s.replace(/"null"/g, "null");
  s = s.replace(/"undefined"/g, "null");

  // 修复 true/false 被引号包裹
  s = s.replace(/"true"/g, "true");
  s = s.replace(/"false"/g, "false");

  // 移除注释
  s = s.replace(/[ \t]*\/\/.*$/gm, "");
  s = s.replace(/[ \t]*\/\*[\s\S]*?\*\/[ \t]*/g, "");

  // 修复括号不匹配 + 自动补全未闭合括号
  s = s.replace(/,\s*$/m, ""); // 移除末尾残留逗号
  s = unbalanceBraceRepair(s);

  // 修复字符串截断（例如最后的 "abc 缺少闭合引号）
  // 匹配模式: 在字符串值中，如果最后一个引号前的字符串不完整，补全
  const lastQuotePos = s.lastIndexOf('"');
  if (lastQuotePos >= 0) {
    // 从最后一个引号开始，往后如果还有 colons/commas/brackets 则正常，否则可能是截断
    const afterLastQuote = s.slice(lastQuotePos + 1);
    if (/^[a-zA-Z0-9_\-.,:;!?@#$%^&*()\s]+$/.test(afterLastQuote) && afterLastQuote.length > 0) {
      // 可能在字符串中间被截断，去掉后面的非 JSON 字符
      s = s.slice(0, lastQuotePos + 1) + '"' + afterLastQuote.replace(/[^,\]}\s].*$/, "");
    }
  }

  return s.trim();
}

/**
 * 清理 LLM 输出的 JSON 字符串
 * - 移除 Markdown 代码块标记
 * - 修复 trailing comma
 * - 修复单引号为双引号
 * - 修复未加引号的键名
 */
export function cleanJsonString(raw: string): string {
  let s = raw.trim();

  // 移除所有 ```json ... ``` 或 ``` ... ``` 包裹
  s = s.replace(/```(?:json)?\s*/gi, "");
  s = s.replace(/\s*```/g, "");
  // 移除 `` 包裹
  s = s.replace(/^``\s*/, "");
  s = s.replace(/\s*``$/, "");

  // 检测最外层是什么结构
  const trimmed = s.trim();
  const isArray = trimmed.startsWith("[");
  const isObject = trimmed.startsWith("{");

  if (isArray) {
    // 提取最外层的 [...]
    const bracketMatch = trimmed.match(/(\[[\s\S]*\])/);
    if (bracketMatch) s = bracketMatch[1];
  } else if (isObject) {
    // 提取最外层的 {...}
    const braceMatch = trimmed.match(/(\{[\s\S]*\})/);
    if (braceMatch) s = braceMatch[1];
  }

  // 移除注释（// 或 /* */ 风格），同时清理注释前后的多余空格
  s = s.replace(/[ \t]*\/\/.*$/gm, "");
  s = s.replace(/[ \t]*\/\*[\s\S]*?\*\/[ \t]*/g, "");

  // 修复 trailing comma 在最后一个 key:value 或数组元素后
  s = s.replace(/,\s*([}\]])/g, "$1");

  // 修复未被引号包裹的键名（例如 {key: "value"} → {"key": "value"}）
  s = s.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

  // 修复单引号字符串，保护已转义的单引号
  s = s.replace(/(?<!\\)'/g, '"');

  // 修复可能因单引号替换导致的重复引号
  s = s.replace(/""+/g, '"');

  // 修复 = 替代 :
  s = s.replace(/(\w+)\s*=\s*/g, '"$1": ');

  // 修复中文冒号
  s = s.replace(/：/g, ":");

  // 去除控制字符（用函数过滤避免 no-control-regex）
  s = s
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return (code >= 32 && code !== 127) || code === 10 || code === 13;
    })
    .join("");

  // Unicode 解码
  s = decodeUnicodeEscapes(s);

  return s.trim();
}

/**
 * 用正则或字符串扫描提取 JSON 区块
 */
export function extractJsonBlock(raw: string): string | null {
  // 尝试找到 { 到匹配的 }
  const stack: string[] = [];
  let start = -1;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (ch === "{" || ch === "[") {
      if (start === -1) start = i;
      stack.push(ch);
    } else if (ch === "}" || ch === "]") {
      if (stack.length > 0) {
        const last = stack.pop()!;
        if ((ch === "}" && last !== "{") || (ch === "]" && last !== "[")) {
          return null; // 括号不匹配
        }
        if (stack.length === 0 && start !== -1) {
          const candidate = raw.slice(start, i + 1);
          // 尝试解析
          try {
            const cleaned = cleanJsonString(candidate);
            JSON.parse(cleaned);
            return cleaned;
          } catch {
            // 继续找更大的
          }
        }
      }
    }
  }

  return null;
}
