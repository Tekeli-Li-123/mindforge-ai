import { useSettingsStore, defaultAISettings } from '../stores/settingsStore';
import { useMindMapStore } from '../stores/mindmapStore';
import type { ProjectAIConfig, ChatMessage, MindMapNode } from '../types';
import { flattenNodesWithPaths } from '../utils/mindmapHelpers';
import { detectModelCapabilities, type ModelCapabilities } from '../config/modelCapabilities';
import type { AIProvider } from '../stores/settingsStore';

// ==========================================
// AI 响应类型
// ==========================================

export interface AIResponse {
  /** 最终输出内容 */
  content: string;
  /** 思维/推理过程（可选，来自推理模型） */
  reasoning?: string;
}

export interface GenerateMapRequest {
  prompt: string;
  title?: string;
  description?: string;
  systemPromptOverride?: string;
}

// ==========================================
// 底层工具函数：请求构建、发送、解析
// ==========================================

/**
 * 根据 Provider + 模型能力自动构建 API 请求体
 * 自动处理：system/developer role 适配、temperature 移除、推理参数注入
 */
export function buildRequestBody(options: {
  messages: Array<{role: string; content: string}>;
  provider: AIProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  reasoningEffort: string;
  caps: ModelCapabilities;
}): Record<string, any> {
  const { messages, model, temperature, maxTokens, reasoningEffort, caps } = options;
  const body: Record<string, any> = { model };

  // ── Anthropic 原生 Messages API ──
  if (caps.useNativeAnthropicAPI) {
    const systemMsg = messages.find(m => m.role === 'system');
    body.system = systemMsg?.content || '';
    body.messages = messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role,
      content: m.content,
    }));
    body.max_tokens = maxTokens;

    if (caps.supportsTemperature) {
      body.temperature = temperature;
    }

    // Anthropic 推理控制
    if (reasoningEffort !== 'off' && caps.isReasoning) {
      if (caps.reasoningControl === 'effort') {
        // Claude 4.6+ Adaptive Thinking
        body.thinking = { type: 'adaptive' };
        body.effort = reasoningEffort;
      } else if (caps.reasoningControl === 'budget') {
        // Claude 3.7 Legacy
        const budgetMap: Record<string, number> = {
          low: 1024,
          medium: 4096,
          high: 16384,
        };
        body.thinking = {
          type: 'enabled',
          budget_tokens: budgetMap[reasoningEffort] || 4096,
        };
        // budget_tokens 必须小于 max_tokens
        if (body.max_tokens <= body.thinking.budget_tokens) {
          body.max_tokens = body.thinking.budget_tokens + maxTokens;
        }
      }
    }

    return body;
  }

  // ── OpenAI 兼容格式（OpenAI / DeepSeek / Local） ──

  // 消息格式适配
  if (!caps.supportsSystemRole && caps.systemRoleAlternative) {
    // OpenAI 推理模型: system → developer
    body.messages = messages.map(m =>
      m.role === 'system'
        ? { role: caps.systemRoleAlternative, content: m.content }
        : { role: m.role, content: m.content }
    );
  } else {
    body.messages = messages.map(m => ({ role: m.role, content: m.content }));
  }

  // Temperature（仅在模型支持时添加）
  if (caps.supportsTemperature) {
    body.temperature = temperature;
  }

  // Max Tokens
  body.max_tokens = maxTokens;

  // 推理强度（仅在模型支持 effort 控制且用户开启时）
  if (reasoningEffort !== 'off' && caps.isReasoning && caps.reasoningControl === 'effort') {
    body.reasoning_effort = reasoningEffort;
    // DeepSeek V4 Pro / Reasoner 需要显式开启 thinking 模式
    if (caps.responseReasoningField === 'reasoning_content') {
      body.thinking = { type: 'enabled' };
    }
  }

  return body;
}

/**
 * 根据 Provider + 模型能力构建请求 headers
 */
function buildHeaders(_provider: AIProvider, apiKey: string, caps: ModelCapabilities): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    if (caps.useNativeAnthropicAPI) {
      // Anthropic 原生 API
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  }

  return headers;
}

/**
 * 根据 Provider + 模型能力构建 API 端点
 */
function buildEndpoint(baseUrl: string, caps: ModelCapabilities): string {
  const base = baseUrl.replace(/\/$/, '');
  if (caps.useNativeAnthropicAPI) {
    return base + '/messages';
  }
  return base + '/chat/completions';
}

/**
 * 统一解析 AI 响应，提取 content 和可选的 reasoning
 */
function parseAIResponse(data: any, caps: ModelCapabilities): AIResponse {
  // Anthropic 原生格式 (content blocks 数组)
  if (data.type === 'message' && Array.isArray(data.content)) {
    const thinkingBlock = data.content.find((b: any) => b.type === 'thinking');
    const textBlock = data.content.find((b: any) => b.type === 'text');
    return {
      content: textBlock?.text || '',
      reasoning: thinkingBlock?.thinking || undefined,
    };
  }

  // OpenAI / DeepSeek 格式
  if (data.choices && data.choices.length > 0) {
    const msg = data.choices[0].message;
    return {
      content: msg.content || '',
      reasoning: caps.responseReasoningField
        ? msg[caps.responseReasoningField]
        : undefined,
    };
  }

  throw new Error('无法解析返回数据，格式验证失败。');
}

/**
 * 带降级重试的 fetch
 * 当 API 返回 400（参数不支持）时，自动移除推理相关参数后重试
 */
async function fetchWithFallback(
  endpoint: string,
  headers: Record<string, string>,
  body: Record<string, any>
): Promise<any> {
  let response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  // 400 错误时尝试降级：移除推理参数
  if (response.status === 400) {
    const errorText = await response.text();
    console.warn('[MindForge] API 400 错误，尝试降级重试:', errorText);

    const fallbackBody = { ...body };
    delete fallbackBody.reasoning_effort;
    delete fallbackBody.thinking;
    delete fallbackBody.effort;

    // 恢复 developer → system（如果之前替换了的话）
    if (fallbackBody.messages) {
      fallbackBody.messages = fallbackBody.messages.map((m: any) =>
        m.role === 'developer' ? { ...m, role: 'system' } : m
      );
    }

    // 加回 temperature（之前可能被移除了）
    if (!fallbackBody.temperature) {
      fallbackBody.temperature = 0.7;
    }

    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(fallbackBody),
    });

    if (response.ok) {
      console.info('[MindForge] 降级重试成功（已移除推理参数）');
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 请求失败: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * 带有降级重试的流式 fetch (Server-Sent Events)
 */
async function fetchStreamWithFallback(
  endpoint: string,
  headers: Record<string, string>,
  body: Record<string, any>,
  caps: ModelCapabilities,
  onStream: (chunk: string, isReasoning: boolean) => void
): Promise<AIResponse> {
  const streamBody = { ...body, stream: true };

  let response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(streamBody),
  });

  // 400 降级处理
  if (response.status === 400) {
    const errorText = await response.text();
    console.warn('[MindForge] 流式 API 400 错误，尝试降级重试:', errorText);

    const fallbackBody = { ...streamBody };
    delete fallbackBody.reasoning_effort;
    delete fallbackBody.thinking;
    delete fallbackBody.effort;

    if (fallbackBody.messages) {
      fallbackBody.messages = fallbackBody.messages.map((m: any) =>
        m.role === 'developer' ? { ...m, role: 'system' } : m
      );
    }
    if (!fallbackBody.temperature) {
      fallbackBody.temperature = 0.7;
    }

    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(fallbackBody),
    });

    if (response.ok) {
      console.info('[MindForge] 流式降级重试成功');
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 流式请求失败: ${response.status} ${errorText}`);
  }

  if (!response.body) {
    throw new Error('当前环境不支持 ReadableStream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let done = false;
  
  let fullContent = '';
  let fullReasoning = '';
  let buffer = '';

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留最后一行未完整的 JSON 字符串

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          if (trimmed === 'data: [DONE]') continue;
          const dataStr = trimmed.slice(6).trim();
          if (!dataStr) continue;
          try {
            const data = JSON.parse(dataStr);
            
            // Anthropic 原生格式
            if (caps.useNativeAnthropicAPI) {
              if (data.type === 'content_block_delta' && data.delta) {
                if (data.delta.type === 'text_delta' && data.delta.text) {
                  fullContent += data.delta.text;
                  onStream(data.delta.text, false);
                } else if (data.delta.type === 'thinking_delta' && data.delta.thinking) {
                  fullReasoning += data.delta.thinking;
                  onStream(data.delta.thinking, true);
                }
              }
            } 
            // OpenAI / DeepSeek 格式
            else {
              if (data.choices && data.choices.length > 0 && data.choices[0].delta) {
                const delta = data.choices[0].delta;
                
                // DeepSeek reasoning_content
                if (caps.responseReasoningField && delta[caps.responseReasoningField]) {
                  fullReasoning += delta[caps.responseReasoningField];
                  onStream(delta[caps.responseReasoningField], true);
                }
                
                if (delta.content) {
                  fullContent += delta.content;
                  onStream(delta.content, false);
                }
              }
            }
          } catch (e) {
            // 解析失败通常是最后一部分被截断了（但在使用 buffer 拆行后应当很少见）
            // 忽略，等待下一个 chunk
          }
        }
      }
    }
  }

  return {
    content: fullContent,
    reasoning: fullReasoning || undefined
  };
}

// ==========================================
// 对外 API：generateMindMap / fetchFromAI / chatWithAI 等
// ==========================================

/**
 * 通用的底层 AI 请求函数（内部复用）
 */
async function callAI(
  systemMessage: string,
  userMessage: string,
  onStream?: (chunk: string, isReasoning: boolean) => void
): Promise<AIResponse> {
  const { aiSettings } = useSettingsStore.getState();
  const { provider, apiKey, baseUrl, model, temperature, maxTokens, reasoningEffort } = aiSettings;
  const caps = detectModelCapabilities(model, provider);

  if (provider !== 'local' && !apiKey) {
    throw new Error('未配置 API Key，请先在设置页中输入密钥。');
  }

  const messages = [
    { role: 'system', content: systemMessage },
    { role: 'user', content: userMessage }
  ];

  const endpoint = buildEndpoint(baseUrl, caps);
  const headers = buildHeaders(provider, apiKey, caps);
  const body = buildRequestBody({
    messages, model, temperature, maxTokens, reasoningEffort, caps,
  });

  if (aiSettings.customPayload) {
    try {
      const overrides = JSON.parse(aiSettings.customPayload);
      Object.assign(body, overrides);
    } catch (e) {
      console.warn('[MindForge] Custom payload 解析失败，已忽略:', e);
    }
  }

  console.groupCollapsed('🧠 [MindForge] AI 交互日志 (点击展开)');
  console.log('【Provider】', provider, '|【Model】', model);
  console.log('【能力探测】', caps);
  console.log('【系统指令】\n', systemMessage);
  console.log('【用户指令】\n', userMessage);
  console.log('【请求体】', body);
  console.groupEnd();

  if (onStream) {
    return await fetchStreamWithFallback(endpoint, headers, body, caps, onStream);
  }

  const data = await fetchWithFallback(endpoint, headers, body);

  console.groupCollapsed('🧠 [MindForge] AI 原始返回 (点击展开)');
  console.log(data);
  console.groupEnd();

  return parseAIResponse(data, caps);
}

export async function generateMindMap(
  request: GenerateMapRequest,
  onStream?: (chunk: string, isReasoning: boolean) => void
): Promise<string> {
  const { aiSettings } = useSettingsStore.getState();
  const systemPrompt = request.systemPromptOverride || aiSettings.systemPrompt || defaultAISettings.systemPrompt;

  const userContent = `
生成主题: ${request.prompt}
${request.title ? `可选标题建议: ${request.title}` : ''}
${request.description ? `学习目标/要求描述: ${request.description}` : ''}
`;

  const response = await callAI(systemPrompt, userContent, onStream);
  return response.content;
}

export async function fetchFromAI(
  systemMessage: string, 
  userMessage: string
): Promise<string> {
  const response = await callAI(systemMessage, userMessage);
  return response.content;
}

export async function explainConcept(targetName: string, contextString: string): Promise<string> {
  const { currentProject } = useMindMapStore.getState();
  const aiSettings = useSettingsStore.getState().aiSettings;
  
  let personaPrefix = "";
  let styleInstruction = "";
  
  if (currentProject?.aiConfig) {
    const { persona, explainStyle } = currentProject.aiConfig;
    if (persona) personaPrefix = `你的人设是：${persona}\n\n`;
    
    if (explainStyle === 'beginner') {
      styleInstruction = "\n请使用极其通俗浅显的语言，多用生活化的比喻，避免使用深奥术语。";
    } else if (explainStyle === 'expert') {
      styleInstruction = "\n请提供极具深度的底层原理解析，使用专业术语，展示学术/行业前沿视角。";
    }
  }

  const baseExplainPrompt = aiSettings.explainPrompt || defaultAISettings.explainPrompt;
  const compiledPrompt = personaPrefix + baseExplainPrompt
    .replace(/\{\{target\}\}/g, targetName)
    .replace(/\{\{context\}\}/g, contextString) + styleInstruction;

  return fetchFromAI(compiledPrompt, '请开始解释。');
}

/** 
 * AI 智能生成项目人设
 * 根据用户对该导图的简单描述和当前的特殊要求，生成一个契合的 ProjectAIConfig 对象
 */
export async function generateProjectPersona(description: string, topic: string, requirement?: string): Promise<ProjectAIConfig> {
  const sysMsg = `你是一个专业的 Prompt 工程师和学习专家。
你的任务是根据用户想要学习的主题、目标以及【用户的特殊要求】，生成一个最适合该项目的 AI 导师人设和解释风格。

你需要返回一个标准的 JSON 对象，格式如下：
{
  "persona": "一句话描述该学科领域的顶级专家人设及语气要求，必须包含并升华用户提到的特殊指令",
  "explainStyle": "beginner | intermediate | expert"
}

例如：
用户想学 AI 基础设施，要求是"像面试官一样"。
返回：{"persona": "一位严苛的硅谷大厂 AI 基础设施面试官，不仅解释概念，还会针对性地提出追问并指出回答中的技术漏洞", "explainStyle": "expert"}

请直接返回 JSON，不要任何多余描述。`;

  const userMsg = `主题：${topic}\n项目背景：${description}\n用户特殊要求：${requirement || "无"}\n\n请生成对应的人设配置：`;
  
  const rawJson = await fetchFromAI(sysMsg, userMsg);
  try {
    // 简单清理下 markdown 代码块标记（如果有的话）
    const cleanJson = rawJson.replace(/```json\n?/, '').replace(/```/, '').trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("Failed to parse AI persona JSON", rawJson);
    throw new Error("AI 返回的人设格式不正确，请重试。");
  }
}

export async function reorganizeMindMap(childrenMarkdown: string, contextString: string): Promise<string> {
  const reorganizePrompt = useSettingsStore.getState().aiSettings.reorganizePrompt || defaultAISettings.reorganizePrompt;
  const compiledPrompt = reorganizePrompt
    .replace(/\{\{context\}\}/g, contextString)
    .replace(/\{\{childrenMarkdown\}\}/g, childrenMarkdown);

  let rawData = await fetchFromAI(compiledPrompt, '请直接输出纯 Markdown 格式，不要包含 ```markdown 标记。');
  return rawData.replace(/^```markdown\n/m, '').replace(/\n```$/m, '');
}

/**
 * AI 侧边栏对话
 * 支持上下文感知（选中节点）和项目人设
 * 返回 AIResponse（包含 content + 可选 reasoning）
 */
export async function chatWithAI(
  messages: ChatMessage[],
  contextNode?: MindMapNode,
  contextPath?: string,
  onStream?: (chunk: string, isReasoning: boolean) => void
): Promise<AIResponse> {
  const { currentProject } = useMindMapStore.getState();
  const { aiSettings } = useSettingsStore.getState();
  const { provider, apiKey, baseUrl, model, temperature, maxTokens, reasoningEffort } = aiSettings;
  const caps = detectModelCapabilities(model, provider);
  const persona = currentProject?.aiConfig;

  // 构建系统提示词
  let systemMsg = `你是一个集成在思维导图工具 (MindForge AI) 中的学习助理。
你不仅能通过文本回答问题，还能直接命令工具修改导图。
${skillRegistry.getSkillsPrompt()}
利用 [[ADD:parentId:content]]、[[DELETE:nodeId]] 等指令操作导图。

### 核心约束：唯一性与去重原则 (Knowledge Deduplication)
1. **禁止语义重复**：在添加子节点前，务必检查其父节点下的同级节点（Siblings）以及父节点的同级节点（Uncles）。
2. **避免包含关系冗余**：如果一个概念已经在高层级存在（例如顶级节点已有"K-Means"），不要在较低层级（如"聚类算法"子分类）中重复添加完全相同的名称。
3. **精准命名**：如果必须添加，请通过增加限定词使名称具象化（例如"K-Means 的实现细节"），或者使用 [[SAVE_EXPLAIN]] 将内容补充到已有节点中。

### 当前导图全量索引 (Global Context)
以下是当前导图中所有节点的路径信息。请根据全路径（Path）精准选择你想要操作的 ID，严禁张冠李戴：
${currentProject ? flattenNodesWithPaths(currentProject.root).map(n => `- [${n.id}] ${n.path}`).join('\n') : "无"}
`;
  
  if (persona?.persona) {
    systemMsg += `\n你当前的人设定位是：${persona.persona}`;
  }

  if (persona?.explainStyle) {
    const styles = {
      'beginner': '你的解释风格应极其通俗易懂，多用比喻。',
      'intermediate': '你的解释风格应平衡专业度与可懂度。',
      'expert': '你的解释风格应极具深度和专业性，面向专家或进阶学习者。'
    };
    systemMsg += `\n${styles[persona.explainStyle]}`;
  }

  // 注入上下文节点信息
  if (contextNode) {
    systemMsg += `\n\n当前用户关注的学习点（选中节点）：\n- 内容：${contextNode.content}\n- 路径位置：${contextPath || '根目录'}\n- 说明：${contextNode.note || '暂无详细说明'}`;
    if (contextNode.explanation) {
      systemMsg += `\n- 已有的词条解释：${contextNode.explanation}`;
    }
    systemMsg += `\n\n请优先基于上述上下文回答用户的问题，并结合整个导图项目 "${currentProject?.title || '未命名项目'}" 的背景。`;
  }

  if (provider !== 'local' && !apiKey) {
    throw new Error('未配置 API Key，请先在设置页中输入密钥。');
  }

  // 构建消息流，包含历史记录
  const allMessages = [
    { role: 'system', content: systemMsg },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ];

  const endpoint = buildEndpoint(baseUrl, caps);
  const headers = buildHeaders(provider, apiKey, caps);
  const body = buildRequestBody({
    messages: allMessages,
    model, temperature, maxTokens, reasoningEffort, caps,
  });

  if (aiSettings.customPayload) {
    try {
      const overrides = JSON.parse(aiSettings.customPayload);
      Object.assign(body, overrides);
    } catch (e) {
      console.warn('[MindForge] Custom payload 解析失败，已忽略:', e);
    }
  }

  if (onStream) {
    return await fetchStreamWithFallback(endpoint, headers, body, caps, onStream);
  }

  const data = await fetchWithFallback(endpoint, headers, body);
  return parseAIResponse(data, caps);
}

// 需要在 chatWithAI 中使用的 skillRegistry 引用
import { skillRegistry } from './skills';
