import { useState, useMemo } from 'react';
import { Settings as SettingsIcon, BrainCircuit, Key, Globe, Database, Check, Download, Upload, Zap, Thermometer, Hash, Code } from 'lucide-react';
import { useSettingsStore, defaultAISettings, type AIProvider, type ReasoningEffort } from '../stores/settingsStore';
import { useMindMapStore } from '../stores/mindmapStore';
import { downloadFile } from '../utils/mindmapHelpers';
import { detectModelCapabilities, getMatchedRuleLabel } from '../config/modelCapabilities';
import { buildRequestBody } from '../services/aiService';
import './Settings.css';

const DEFAULT_BASE_URLS: Record<AIProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  deepseek: 'https://api.deepseek.com', // DeepSeek official API base URL without trailing slash
  local: 'http://localhost:11434/v1', // 默认推荐 Ollama
};

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI (GPT-4o, o3, GPT-5)' },
  { value: 'anthropic', label: 'Anthropic (Claude 4.6 Sonnet/Opus)' },
  { value: 'deepseek', label: 'DeepSeek (V4 Pro / V4 Flash)' },
  { value: 'local', label: 'Local Model (Ollama / LM Studio)' },
];

const EFFORT_OPTIONS: Array<{ value: ReasoningEffort; label: string; description: string }> = [
  { value: 'off', label: '关闭', description: '不使用推理模式' },
  { value: 'low', label: '低', description: '快速思考' },
  { value: 'medium', label: '中等', description: '平衡速度与深度' },
  { value: 'high', label: '深度', description: '最深度推理' },
];

export default function Settings() {
  const { aiSettings, updateAISettings } = useSettingsStore();
  
  // Local state for the form so we don't save on every keystroke
  const [formData, setFormData] = useState({
    ...aiSettings,
    systemPrompt: aiSettings.systemPrompt || defaultAISettings.systemPrompt,
    refinePrompt: aiSettings.refinePrompt || defaultAISettings.refinePrompt,
    explainPrompt: aiSettings.explainPrompt || defaultAISettings.explainPrompt,
    reorganizePrompt: aiSettings.reorganizePrompt || defaultAISettings.reorganizePrompt,
    customPayload: aiSettings.customPayload || defaultAISettings.customPayload || '',
  });
  const [showSavedState, setShowSavedState] = useState(false);

  // 实时探测当前模型能力
  const caps = useMemo(
    () => detectModelCapabilities(formData.model, formData.provider),
    [formData.model, formData.provider]
  );
  const matchedRule = useMemo(
    () => getMatchedRuleLabel(formData.model, formData.provider),
    [formData.model, formData.provider]
  );

  const previewJson = useMemo(() => {
    try {
      const mockMessages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' }
      ];
      const body = buildRequestBody({
        messages: mockMessages,
        model: formData.model,
        temperature: formData.temperature,
        maxTokens: formData.maxTokens,
        reasoningEffort: formData.reasoningEffort,
        caps
      });
      if (formData.customPayload && formData.customPayload.trim()) {
        const overrides = JSON.parse(formData.customPayload);
        Object.assign(body, overrides);
      }
      return JSON.stringify(body, null, 2);
    } catch (e) {
      return '// 自定义 JSON 格式错误，请检查语法';
    }
  }, [formData, caps]);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as AIProvider;
    setFormData((prev) => ({
      ...prev,
      provider: newProvider,
      // Auto-set the correct default base URL when provider changes
      baseUrl: DEFAULT_BASE_URLS[newProvider],
      // Reset model field to a hint depending on provider
      model: newProvider === 'openai' ? 'gpt-4o' 
           : newProvider === 'anthropic' ? 'claude-sonnet-4-20250514' 
           : newProvider === 'deepseek' ? 'deepseek-v4-flash'
           : 'llama3',
    }));
  };

  const handleSave = () => {
    updateAISettings(formData);
    
    // Show checkmark briefly
    setShowSavedState(true);
    setTimeout(() => setShowSavedState(false), 2000);
  };

  const handleReset = () => {
    setFormData(aiSettings);
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>全局设置</h2>
        <p>配置 AI 模型接入参数，这些将作为所有导图的默认调用配置。</p>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">
          <BrainCircuit size={20} className="gradient-text" />
          AI 引擎接入配置
        </div>

        <div className="settings-form-group">
          <label className="settings-label">
            选择供应商 (Provider)
          </label>
          <select 
            className="settings-select"
            value={formData.provider}
            onChange={handleProviderChange}
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="settings-form-group">
          <label className="settings-label">
            <Globe size={14} style={{ display: 'inline', marginRight: '4px' }} />
            API 地址 (Base URL)
          </label>
          <input
            type="text"
            className="settings-input"
            value={formData.baseUrl}
            onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
            placeholder="例如: https://api.openai.com/v1"
          />
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
            可配置代理接口地址，或连接本地服务的 URL（如 Ollama）。
          </p>
        </div>

        <div className="settings-form-group">
          <label className="settings-label">
            <Database size={14} style={{ display: 'inline', marginRight: '4px' }} />
            默认模型名称 (Model)
          </label>
          <input
            type="text"
            className="settings-input"
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            placeholder="例如: gpt-4o, claude-sonnet-4-20250514, llama3"
          />
          {/* 模型能力探测结果 */}
          <div className="model-caps-banner">
            <div className="model-caps-label">
              <Zap size={12} />
              {matchedRule ? `识别为：${matchedRule}` : '通用模型（默认配置）'}
            </div>
            <div className="model-caps-tags">
              <span className={`cap-tag ${caps.isReasoning ? 'active' : ''}`}>
                {caps.isReasoning ? '✅' : '—'} 推理模型
              </span>
              <span className={`cap-tag ${caps.supportsTemperature ? 'active' : ''}`}>
                {caps.supportsTemperature ? '✅' : '❌'} Temperature
              </span>
              <span className={`cap-tag ${caps.reasoningControl !== 'none' ? 'active' : ''}`}>
                {caps.reasoningControl !== 'none' ? '✅' : '—'} 思维强度
              </span>
              {caps.useNativeAnthropicAPI && (
                <span className="cap-tag active">✅ 原生 Anthropic API</span>
              )}
              {caps.systemRoleAlternative && (
                <span className="cap-tag active">🔄 {caps.systemRoleAlternative} role</span>
              )}
            </div>
          </div>
        </div>

        {formData.provider !== 'local' && (
          <div className="settings-form-group">
            <label className="settings-label">
              <Key size={14} style={{ display: 'inline', marginRight: '4px' }} />
              API 密钥 (API Key)
            </label>
            <input
              type="password"
              className="settings-input"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="sk-..."
            />
            <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
              您的密钥将安全地储存在浏览器的本地缓存中，不会被上传到其他服务器。
            </p>
          </div>
        )}
      </div>

      {/* ═══════════════ 推理控制面板 ═══════════════ */}
      <div className="settings-section">
        <div className="settings-section-title">
          <Zap size={20} className="gradient-text" />
          推理控制 (Reasoning Control)
        </div>

        {/* 思维强度 */}
        <div className="settings-form-group">
          <label className="settings-label">
            🧠 思维强度 (Reasoning Effort)
          </label>
          <div className="effort-selector">
            {EFFORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`effort-option ${formData.reasoningEffort === opt.value ? 'active' : ''}`}
                onClick={() => setFormData({ ...formData, reasoningEffort: opt.value })}
                disabled={
                  opt.value !== 'off' && !caps.isReasoning && caps.reasoningControl === 'none'
                }
                title={opt.description}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="settings-hint">
            {caps.isReasoning && caps.reasoningControl !== 'none'
              ? '当前模型支持思维强度控制。开启后 AI 将使用思维链进行深度推理，token 消耗和响应时间会增加。'
              : caps.isReasoning
                ? '当前推理模型自动启用思维链，无需手动控制强度。'
                : '当前模型不是推理模型，开启此选项可能无效（系统会自动降级处理）。'
            }
          </p>
        </div>

        {/* Temperature */}
        <div className="settings-form-group">
          <label className="settings-label">
            <Thermometer size={14} style={{ display: 'inline', marginRight: '4px' }} />
            Temperature — <span className="settings-value-badge">{formData.temperature.toFixed(2)}</span>
          </label>
          <div className="range-wrapper">
            <input
              type="range"
              className="settings-range"
              min="0"
              max="2"
              step="0.05"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
              disabled={!caps.supportsTemperature}
            />
            <div className="range-labels">
              <span>精确 0</span>
              <span>创意 2</span>
            </div>
          </div>
          {!caps.supportsTemperature && (
            <p className="settings-hint warning">
              ⚠️ 当前推理模型不支持 Temperature 参数，该值将被自动忽略。
            </p>
          )}
        </div>

        {/* Max Tokens */}
        <div className="settings-form-group">
          <label className="settings-label">
            <Hash size={14} style={{ display: 'inline', marginRight: '4px' }} />
            最大输出 Token (Max Tokens)
          </label>
          <input
            type="number"
            className="settings-input"
            value={formData.maxTokens}
            onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) || 4096 })}
            min={256}
            max={128000}
            step={256}
          />
          <p className="settings-hint">
            控制 AI 单次回复的最大 token 数量。推荐 4096，复杂导图生成可设为 8192+。
          </p>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">
          <SettingsIcon size={20} className="gradient-text" />
          控制指令 (Prompt Tuning)
        </div>

        <div className="settings-form-group">
          <label className="settings-label">
            生成新导图: 系统提示词 (System Prompt)
          </label>
          <textarea
            className="settings-select"
            style={{ minHeight: '120px', resize: 'vertical' }}
            value={formData.systemPrompt}
            onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
            placeholder="在这里输入控制系统行为的全局指令..."
          />
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
             决定了 AI 生成导图深度、语气和 Markdown 细节的系统指令。
          </p>
        </div>

        <div className="settings-form-group">
          <label className="settings-label">
            右键菜单: 节点细化提示词 (Refine Prompt)
          </label>
          <textarea
            className="settings-select"
            style={{ minHeight: '80px', resize: 'vertical' }}
            value={formData.refinePrompt}
            onChange={(e) => setFormData({ ...formData, refinePrompt: e.target.value })}
            placeholder="支持变量: {{target}} 代表被点击的节点名，{{context}} 代表祖先路径"
          />
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
             魔法变量：由于 AI 需要知道你在点哪一个枝干，你可以使用 <code>{"{{target}}"}</code> 引用当前文字，使用 <code>{"{{context}}"}</code> 引用面包屑路径上下文。
          </p>
        </div>

        <div className="settings-form-group">
          <label className="settings-label">
            右键菜单: 词条解释提示词 (Explain Prompt)
          </label>
          <textarea
            className="settings-select"
            style={{ minHeight: '80px', resize: 'vertical' }}
            value={formData.explainPrompt}
            onChange={(e) => setFormData({ ...formData, explainPrompt: e.target.value })}
            placeholder="支持变量: {{target}} 代表被点击的节点名，{{context}} 代表祖先路径"
          />
        </div>

        <div className="settings-form-group">
          <label className="settings-label">
            右键菜单: 节点重组提示词 (Reorganize Prompt)
          </label>
          <textarea
            className="settings-select"
            style={{ minHeight: '80px', resize: 'vertical' }}
            value={formData.reorganizePrompt}
            onChange={(e) => setFormData({ ...formData, reorganizePrompt: e.target.value })}
            placeholder="支持变量: {{context}}, {{childrenMarkdown}}"
          />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">
          <Code size={20} className="gradient-text" />
          高级自定义参数 (JSON Override)
        </div>
        
        <div className="settings-form-group">
          <label className="settings-label">
            请求体预览 (Preview)
          </label>
          <pre className="settings-select" style={{ fontSize: '12px', background: 'var(--color-bg-secondary)', padding: '10px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {previewJson}
          </pre>
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
            这是根据当前设置生成的模拟请求体。如果您需要在请求中添加额外的特殊参数（如 top_p, stream 等），可以在下方填入 JSON 覆盖这些设置。
          </p>
        </div>

        <div className="settings-form-group">
          <label className="settings-label">
            自定义参数覆盖 (Custom JSON)
          </label>
          <textarea
            className="settings-select"
            style={{ minHeight: '100px', resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
            value={formData.customPayload || ''}
            onChange={(e) => setFormData({ ...formData, customPayload: e.target.value })}
            placeholder='例如: { "top_p": 0.9, "presence_penalty": 0.5 }'
          />
        </div>

        <div className="settings-actions">
          {showSavedState && (
            <div className="settings-saved-indicator">
              <Check size={16} /> 已保存
            </div>
          )}
          <button className="settings-btn secondary" onClick={handleReset}>取消更改</button>
          <button className="settings-btn primary" onClick={handleSave}>保存配置</button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">
          <Database size={20} className="gradient-text" />
          数据管理 (Data Persistence)
        </div>
        
        <div className="settings-form-group">
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
            备份您的所有导图项目及其 AI 配置。您可以将导出的 JSON 文件在另一台设备上导入。
          </p>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="settings-btn secondary" 
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              onClick={() => {
                const { projects } = useMindMapStore.getState();
                const data = JSON.stringify({
                  projects,
                  version: '1.0.0',
                  exportedAt: Date.now()
                }, null, 2);
                downloadFile(data, `mindforge-backup-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
              }}
            >
              <Download size={16} /> 导出全量备份
            </button>
            
            <label className="settings-btn secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
              <Upload size={16} /> 导入 JSON 备份
              <input 
                type="file" 
                accept=".json" 
                style={{ display: 'none' }} 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const content = event.target?.result as string;
                      const data = JSON.parse(content);
                      
                      if (!data.projects || !Array.isArray(data.projects)) {
                        throw new Error('无效的备份文件：缺失项目列表');
                      }
                      
                      const confirm = window.confirm(`检测到 ${data.projects.length} 个导图项目。导入将合并到您当前的列表中，是否继续？`);
                      if (confirm) {
                        const { projects, addProject } = useMindMapStore.getState();
                        // 简单的合并逻辑：如果 ID 重复则跳过，或者询问？这里先简单 add
                        data.projects.forEach((newProj: any) => {
                          const exists = projects.find(p => p.id === newProj.id);
                          if (!exists) {
                            addProject(newProj);
                          } else {
                            // 如果已存在，生成新 ID 导入
                            addProject({ ...newProj, id: `imported-${Date.now()}-${Math.random().toString(36).slice(2,5)}` });
                          }
                        });
                        alert('导入成功！');
                      }
                    } catch (err: any) {
                      alert('恢复失败: ' + err.message);
                    }
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
