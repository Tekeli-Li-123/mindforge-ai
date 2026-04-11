import { useSettingsStore, defaultAISettings } from '../stores/settingsStore';
import { useMindMapStore } from '../stores/mindmapStore';
import type { ProjectAIConfig, ChatMessage, MindMapNode } from '../types';
import { flattenNodes, flattenNodesWithPaths } from '../utils/mindmapHelpers';

export interface GenerateMapRequest {
  prompt: string;
  title?: string;
  description?: string;
  systemPromptOverride?: string;
}

export async function generateMindMap(request: GenerateMapRequest): Promise<string> {
  const { aiSettings } = useSettingsStore.getState();
  const { provider, apiKey, baseUrl, model } = aiSettings;
  const systemPrompt = request.systemPromptOverride || aiSettings.systemPrompt || defaultAISettings.systemPrompt;

  if (provider !== 'local' && !apiKey) {
    throw new Error('未配置 API Key，请先在设置页中输入密钥。');
  }

  const userContent = `
生成主题: ${request.prompt}
${request.title ? `可选标题建议: ${request.title}` : ''}
${request.description ? `学习目标/要求描述: ${request.description}` : ''}
`;

  // 大部分 provider (OpenAI, Ollama, LM Studio, vLLM) 都支持标准的 OpenAI Chat Completions 接口
  // Anthropic 的 messages API 格式有本质不同，这里目前采用兼容 OpenAI 的请求体
  let endpoint = baseUrl.replace(/\/$/, '') + '/chat/completions';
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    
    // Anthropic 兼容处理（如果用户使用了 Anthropic 相关的桥接服务或是原生 API）
    // 注意：如果是原生 Anthropic API，路径和头信息是完全不同的，这里假设使用的是 OneAPI 之类的中转，或者直接就是 OpenAI 格式。
    // 如果想要深度支持原生 Anthropic，需要在这里写专门的 Anthropic 构建逻辑。
    if (provider === 'anthropic') {
      // 简单提醒：为了方便，建议用户使用兼容 OpenAI 格式的代理端点。
      // ... 可以在之后扩展原生 Anthropic 请求
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01'; 
    }
  }

  const body = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ],
    temperature: 0.7,
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 请求失败: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    console.groupCollapsed('🧠 [MindForge] AI 原始交互日志 (点击展开查看)');
    console.log('【系统指令 (System Prompt)】\n', systemPrompt);
    console.log('【用户指令 (User Prompt)】\n', userContent);
    console.log('【AI 原始返回报文】\n', data);
    console.groupEnd();

    // 如果是 Anthropic 格式的返回
    if (data.type === 'message' && data.content) {
       return data.content[0].text;
    }

    // 默认 OpenAI 格式的返回
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content;
    }

    throw new Error('无法解析返回数据，格式验证失败。');
  } catch (error: any) {
    console.error('LLM Generation Error:', error);
    throw new Error(error.message || '生成失败，请检查网络和 API 设置。');
  }
}

export async function fetchFromAI(
  systemMessage: string, 
  userMessage: string
): Promise<string> {
  const { aiSettings } = useSettingsStore.getState();
  const { provider, apiKey, baseUrl, model } = aiSettings;
  
  if (provider !== 'local' && !apiKey) {
    throw new Error('未配置 API Key，请先在设置页中输入密钥。');
  }

  let endpoint = baseUrl.replace(/\/$/, '') + '/chat/completions';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    if (provider === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01'; 
    }
  }

  const body = {
    model: model,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.7,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 请求失败: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  if (data.type === 'message' && data.content) {
     return data.content[0].text;
  }
  if (data.choices && data.choices.length > 0) {
    return data.choices[0].message.content;
  }
  throw new Error('无法解析返回数据，格式验证失败。');
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
用户想学 AI 基础设施，要求是“像面试官一样”。
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

  let rawData = await fetchFromAI(reorganizePrompt, '请直接输出纯 Markdown 格式，不要包含 ```markdown 标记。');
  return rawData.replace(/^```markdown\n/m, '').replace(/\n```$/m, '');
}

/**
 * AI 侧边栏对话
 * 支持上下文感知（选中节点）和项目人设
 */
export async function chatWithAI(
  messages: ChatMessage[],
  contextNode?: MindMapNode,
  contextPath?: string
): Promise<string> {
  const { currentProject } = useMindMapStore.getState();
  const { aiSettings } = useSettingsStore.getState();
  const persona = currentProject?.aiConfig;

  // 构建系统提示词
  let systemMsg = `你是一个集成在思维导图工具 (MindForge AI) 中的学习助理。
你不仅能通过文本回答问题，还能直接命令工具修改导图。
${skillRegistry.getSkillsPrompt()}

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

  const { provider, apiKey, baseUrl, model } = aiSettings;
  const endpoint = baseUrl.replace(/\/$/, '') + '/chat/completions';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  
  // 构建消息流，包含历史记录
  const formattedMessages = messages.map(m => ({
    role: m.role,
    content: m.content
  }));

  const body = {
    model: model,
    messages: [
      { role: 'system', content: systemMsg },
      ...formattedMessages
    ],
    temperature: 0.7,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chat API 请求失败: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  if (data.choices && data.choices.length > 0) {
    return data.choices[0].message.content;
  }
  throw new Error('AI 返回数据格式异常。');
}
