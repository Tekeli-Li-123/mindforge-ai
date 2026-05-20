import { useState, useEffect, useCallback } from "react";
import { Save, Upload, Download, Sparkles, Settings as SettingsIcon } from "lucide-react";
import { useSettingsStore } from "../stores/settingsStore";
import { useTranslation, setLanguage, getCurrentLanguage } from "../i18n";
import { useMindMapStore } from "../stores/mindmapStore";
import type { AIProvider } from "../stores/settingsStore";
import { useToast } from "../components/common/Toast";
import "./Settings.css";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { aiSettings, updateAISettings } = useSettingsStore();
  const { projects } = useMindMapStore();
  const { showToast } = useToast();
  const [saved, setSaved] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(aiSettings.provider);

  // Local copies for editing
  const [localApiKey, setLocalApiKey] = useState(aiSettings.apiKey);
  const [localBaseUrl, setLocalBaseUrl] = useState(aiSettings.baseUrl);
  const [localModel, setLocalModel] = useState(aiSettings.model);
  const [localTemperature, setLocalTemperature] = useState(aiSettings.temperature);
  const [localMaxTokens, setLocalMaxTokens] = useState(aiSettings.maxTokens);

  // -- Language switching --
  const [selectedLang, setSelectedLang] = useState<"zh" | "en">(getCurrentLanguage());

  useEffect(() => {
    setLanguage(selectedLang);
  }, [selectedLang]);

  const handleSave = () => {
    updateAISettings({
      provider: selectedProvider,
      apiKey: localApiKey,
      baseUrl: localBaseUrl,
      model: localModel,
      temperature: localTemperature,
      maxTokens: localMaxTokens,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleProviderChange = (provider: AIProvider) => {
    setSelectedProvider(provider);
    switch (provider) {
      case "openai":
        setLocalBaseUrl("https://api.openai.com/v1");
        break;
      case "anthropic":
        setLocalBaseUrl("https://api.anthropic.com");
        break;
      case "deepseek":
        setLocalBaseUrl("https://api.deepseek.com");
        break;
      case "local":
        setLocalBaseUrl("http://localhost:11434/v1");
        break;
    }
  };

  const handleExport = useCallback(() => {
    const data = JSON.stringify(projects, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mindforge-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [projects]);

  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        showToast(
          t("settings.importSuccess") + ` ${parsed.length || 0} ${t("sidebar.mindmaps")}`,
          "success",
        );
      } catch (err) {
        showToast(t("settings.importError") + String(err), "error");
      }
    };
    input.click();
  }, [t]);

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h2>{t("settings.title")}</h2>
          <p className="settings-subtitle">{t("settings.subtitle")}</p>
        </div>
      </div>

      {/* Language */}
      <div className="settings-section">
        <div className="settings-section-header">
          <SettingsIcon size={16} />
          <h3>{t("language.label")}</h3>
        </div>
        <div className="settings-field">
          <div className="settings-field-row">
            <label>{t("language.label")}</label>
            <select
              className="settings-select"
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value as "zh" | "en")}
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>

      {/* AI Engine */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Sparkles size={16} />
          <h3>{t("settings.aiEngine")}</h3>
        </div>

        {/* Provider */}
        <div className="settings-field">
          <div className="settings-field-row">
            <label>{t("settings.provider")}</label>
            <select
              className="settings-select"
              value={selectedProvider}
              onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="deepseek">DeepSeek</option>
              <option value="local">{t("settings.local")}</option>
            </select>
          </div>
        </div>

        {/* API Key */}
        <div className="settings-field">
          <div className="settings-field-row">
            <label>{t("settings.apiKey")}</label>
            <input
              type="password"
              className="settings-input"
              placeholder={t("settings.apiKeyPlaceholder")}
              value={localApiKey}
              onChange={(e) => setLocalApiKey(e.target.value)}
            />
          </div>
          <p className="settings-hint">{t("settings.apiKeyHint")}</p>
        </div>

        {/* Base URL */}
        <div className="settings-field">
          <div className="settings-field-row">
            <label>{t("settings.baseUrl")}</label>
            <input
              type="text"
              className="settings-input"
              placeholder={t("settings.baseUrlPlaceholder")}
              value={localBaseUrl}
              onChange={(e) => setLocalBaseUrl(e.target.value)}
            />
          </div>
          <p className="settings-hint">{t("settings.baseUrlHint")}</p>
        </div>

        {/* Model Name */}
        <div className="settings-field">
          <div className="settings-field-row">
            <label>{t("settings.model")}</label>
            <input
              type="text"
              className="settings-input"
              placeholder={t("settings.modelPlaceholder")}
              value={localModel}
              onChange={(e) => setLocalModel(e.target.value)}
            />
          </div>
          <p className="settings-hint">{t("settings.modelDetected")}</p>
        </div>

        {/* Temperature */}
        <div className="settings-field">
          <div className="settings-field-row">
            <label>{t("settings.temperature")}</label>
            <div className="settings-range-row">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={localTemperature}
                onChange={(e) => setLocalTemperature(parseFloat(e.target.value))}
              />
              <span className="settings-range-value">{localTemperature.toFixed(1)}</span>
              <span className="settings-range-labels">
                <span>{t("settings.rangePrecise")}</span>
                <span>{t("settings.rangeCreative")}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Max Tokens */}
        <div className="settings-field">
          <div className="settings-field-row">
            <label>{t("settings.maxTokens")}</label>
            <input
              type="number"
              className="settings-input settings-input-small"
              value={localMaxTokens}
              onChange={(e) => setLocalMaxTokens(parseInt(e.target.value) || 4096)}
              min={256}
              max={65536}
            />
          </div>
          <p className="settings-hint">{t("settings.maxTokensHint")}</p>
        </div>
      </div>

      {/* Data Management */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Upload size={16} />
          <h3>{t("settings.dataManagement")}</h3>
        </div>
        <p className="settings-hint">{t("settings.dataHint")}</p>
        <div className="settings-btn-group">
          <button className="settings-btn settings-btn-secondary" onClick={handleExport}>
            <Download size={14} />
            {t("settings.exportBackup")}
          </button>
          <button className="settings-btn settings-btn-secondary" onClick={handleImport}>
            <Upload size={14} />
            {t("settings.importBackup")}
          </button>
        </div>
      </div>

      {/* Save */}
      <button
        className={`settings-btn settings-btn-primary ${saved ? "saved" : ""}`}
        onClick={handleSave}
      >
        <Save size={16} />
        {saved ? t("settings.saved") : t("settings.saveConfig")}
      </button>
    </div>
  );
}
