import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";

// ==========================================
// Types
// ==========================================

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

// ==========================================
// Context
// ==========================================

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback for contexts outside the provider (uses alert)
    return { showToast: (msg) => alert(msg) };
  }
  return ctx;
}

// ==========================================
// Provider
// ==========================================

let nextId = 1;

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 size={18} color="#22c55e" />,
  error: <AlertCircle size={18} color="#ef4444" />,
  warning: <AlertTriangle size={18} color="#f59e0b" />,
  info: <Info size={18} color="#6366f1" />,
};

const BG_COLORS: Record<ToastType, string> = {
  success: "#f0fdf4",
  error: "#fef2f2",
  warning: "#fffbeb",
  info: "#eef2ff",
};

const BORDER_COLORS: Record<ToastType, string> = {
  success: "#bbf7d0",
  error: "#fecaca",
  warning: "#fde68a",
  info: "#c7d2fe",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxWidth: 400,
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "12px 16px",
              borderRadius: 10,
              border: `1px solid ${BORDER_COLORS[toast.type]}`,
              background: BG_COLORS[toast.type],
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              fontSize: 14,
              lineHeight: 1.5,
              animation: "slideIn 0.2s ease-out",
              wordBreak: "break-word",
            }}
          >
            <span style={{ flexShrink: 0, marginTop: 1 }}>{ICONS[toast.type]}</span>
            <span style={{ flex: 1, color: "#1e293b" }}>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                flexShrink: 0,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 2,
                color: "#94a3b8",
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
