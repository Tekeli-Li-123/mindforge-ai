import { useEffect, useRef } from "react";
import {
  Sparkles,
  Edit2,
  PlusCircle,
  Trash2,
  BookOpen,
  Network,
  Eraser,
  RotateCw,
  Brain,
} from "lucide-react";
import { useTranslation } from "../../i18n";
import "./ContextMenu.css";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ContextMenuProps {
  position: ContextMenuPosition | null;
  onClose: () => void;
  onAction: (
    action:
      | "edit"
      | "add_child"
      | "add_sibling"
      | "delete"
      | "delete_children"
      | "ai_refine"
      | "explain"
      | "explain_regen"
      | "reorganize"
      | "assessment",
  ) => void;
}

export default function ContextMenu({ position, onClose, onAction }: ContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (position) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [position, onClose]);

  if (!position) return null;

  // Prevent menu going offscreen
  const style: React.CSSProperties = {
    top: position.y,
    left: position.x,
  };

  return (
    <div
      className="context-menu-overlay"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className="context-menu"
        style={style}
        ref={menuRef}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <button
          className="context-menu-item highlight"
          onClick={() => {
            onAction("ai_refine");
            onClose();
          }}
        >
          <Sparkles style={{ width: 16, height: 16, flexShrink: 0 }} className="gradient-text" />
          <span className="gradient-text">{t("contextmenu.refine")}</span>
        </button>
        <button
          className="context-menu-item highlight"
          style={{ background: "rgba(59, 130, 246, 0.1)" }}
          onClick={() => {
            onAction("explain");
            onClose();
          }}
        >
          <BookOpen style={{ width: 16, height: 16, flexShrink: 0, color: "#3b82f6" }} />
          <span style={{ color: "#3b82f6", fontWeight: 500 }}>{t("contextmenu.explain")}</span>
        </button>
        <button
          className="context-menu-item"
          style={{ paddingLeft: "36px", fontSize: "12px", opacity: 0.8 }}
          onClick={() => {
            onAction("explain_regen");
            onClose();
          }}
        >
          <RotateCw style={{ width: 12, height: 12, flexShrink: 0 }} />
          <span>{t("contextmenu.regenerate")}</span>
        </button>
        <button
          className="context-menu-item highlight"
          style={{ background: "rgba(234, 179, 8, 0.1)" }}
          onClick={() => {
            onAction("reorganize");
            onClose();
          }}
        >
          <Network style={{ width: 16, height: 16, flexShrink: 0, color: "#eab308" }} />
          <span style={{ color: "#eab308", fontWeight: 500 }}>{t("contextmenu.reorganize")}</span>
        </button>
        <button
          className="context-menu-item highlight"
          style={{ background: "rgba(124, 92, 252, 0.1)" }}
          onClick={() => {
            onAction("assessment");
            onClose();
          }}
        >
          <Brain style={{ width: 16, height: 16, flexShrink: 0, color: "#7c5cfc" }} />
          <span style={{ color: "#7c5cfc", fontWeight: 500 }}>{t("contextmenu.assessment")}</span>
        </button>
        <div className="context-menu-divider" />
        <button
          className="context-menu-item"
          onClick={() => {
            onAction("edit");
            onClose();
          }}
        >
          <Edit2 style={{ width: 16, height: 16, flexShrink: 0 }} /> {t("contextmenu.rename")}
        </button>
        <button
          className="context-menu-item"
          onClick={() => {
            onAction("add_child");
            onClose();
          }}
        >
          <PlusCircle style={{ width: 16, height: 16, flexShrink: 0 }} />{" "}
          {t("contextmenu.addChild")}
        </button>
        <div className="context-menu-divider" />
        <button
          className="context-menu-item danger"
          onClick={() => {
            onAction("delete_children");
            onClose();
          }}
        >
          <Eraser style={{ width: 16, height: 16, flexShrink: 0 }} />{" "}
          {t("contextmenu.deleteChildren")}
        </button>
        <button
          className="context-menu-item danger"
          onClick={() => {
            onAction("delete");
            onClose();
          }}
        >
          <Trash2 style={{ width: 16, height: 16, flexShrink: 0 }} /> {t("contextmenu.delete")}
        </button>
      </div>
    </div>
  );
}
