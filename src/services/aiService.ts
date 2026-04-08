import { useSettingsStore, defaultAISettings } from '../stores/settingsStore';

export interface GenerateMapRequest {
  prompt: string;
  title?: string;
  description?: string;
}

export async function generateMindMap(request: GenerateMapRequest): Promise<string> {
  const { aiSettings } = useSettingsStore.getState();
  const { provider, apiKey, baseUrl, model } = aiSettings;
  const systemPrompt = aiSettings.systemPrompt || defaultAISettings.systemPrompt;

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

async function fetchFromAI(
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
  const explainPrompt = useSettingsStore.getState().aiSettings.explainPrompt || defaultAISettings.explainPrompt;
  const compiledPrompt = explainPrompt
    .replace(/\{\{target\}\}/g, targetName)
    .replace(/\{\{context\}\}/g, contextString);

  return fetchFromAI(compiledPrompt, '请开始解释。');
}

export async function reorganizeMindMap(childrenMarkdown: string, contextString: string): Promise<string> {
  const reorganizePrompt = useSettingsStore.getState().aiSettings.reorganizePrompt || defaultAISettings.reorganizePrompt;
  const compiledPrompt = reorganizePrompt
    .replace(/\{\{context\}\}/g, contextString)
    .replace(/\{\{childrenMarkdown\}\}/g, childrenMarkdown);

  let rawData = await fetchFromAI(compiledPrompt, '请直接输出纯 Markdown 格式，不要包含 ```markdown 标记。');
  return rawData.replace(/^```markdown\n/m, '').replace(/\n```$/m, '');
}
