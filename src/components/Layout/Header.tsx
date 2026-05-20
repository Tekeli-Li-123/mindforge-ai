import { useLocation } from "react-router-dom";
import { MessageSquare, Sparkles } from "lucide-react";
import { useMindMapStore } from "../../stores/mindmapStore";
import { useTranslation } from "../../i18n";
import "./Header.css";

const pageTitles: Record<string, string> = {
  "/": "header.dashboard",
  "/editor": "header.editor",
  "/quiz": "header.quiz",
  "/settings": "header.settings",
};

export default function Header() {
  const location = useLocation();
  const { isChatOpen, toggleChat } = useMindMapStore();
  const { t } = useTranslation();

  const title = t(pageTitles[location.pathname] || "header.unknown");

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
      </div>

      <div className="header-right">
        {location.pathname === "/editor" && (
          <button
            className={`header-btn ${isChatOpen ? "active" : ""}`}
            onClick={toggleChat}
            title={t("header.aiAssistant")}
          >
            <MessageSquare size={18} />
            {!isChatOpen && <span className="header-btn-badge" />}
          </button>
        )}
        <button className="header-btn" title={t("header.aiAssistant")}>
          <Sparkles size={18} />
        </button>
      </div>
    </header>
  );
}
