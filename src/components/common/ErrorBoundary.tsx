import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 300,
            padding: 40,
            gap: 16,
            textAlign: "center",
          }}
        >
          <AlertTriangle size={48} color="var(--color-warning, #f59e0b)" />
          <h3 style={{ margin: 0, color: "var(--color-text, #1a1a2e)" }}>Something went wrong</h3>
          <p
            style={{
              margin: 0,
              color: "var(--color-text-dim, #64748b)",
              maxWidth: 480,
              fontSize: 14,
            }}
          >
            {this.state.error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 20px",
              border: "none",
              borderRadius: 8,
              background: "var(--color-primary, #6366f1)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            <RotateCcw size={16} />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
