import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { initSkills } from "./services/skills";
import Sidebar from "./components/Layout/Sidebar";
import Header from "./components/Layout/Header";
import Dashboard from "./pages/Dashboard";
import MapEditor from "./pages/MapEditor";
import Quiz from "./pages/Quiz";
import Settings from "./pages/Settings";
import DropZoneOverlay from "./components/common/DropZoneOverlay";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { ToastProvider, useToast } from "./components/common/Toast";
import { useMindMapStore } from "./stores/mindmapStore";
import { parseImportedFile } from "./utils/mindmapHelpers";
import "./App.css";

function AppContent({
  sidebarCollapsed,
  setSidebarCollapsed,
}: {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const { addProject, setCurrentProject } = useMindMapStore();
  const { showToast } = useToast();

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer?.types.includes("Files")) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Only set false if leaving to the window (avoid flicker on child elements)
      if (e.relatedTarget === null || (e.relatedTarget as HTMLElement).tagName === "HTML") {
        setIsDragging(false);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        try {
          const importedProject = await parseImportedFile(files[0]);
          addProject(importedProject);
          setCurrentProject(importedProject);
          navigate("/editor");
        } catch (err: any) {
          showToast("Import failed: " + err.message, "error");
        }
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [addProject, setCurrentProject, navigate]);

  return (
    <div className="app-layout" onDragEnter={() => setIsDragging(true)}>
      {isDragging && <DropZoneOverlay />}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div
        className="app-main"
        style={{
          marginLeft: sidebarCollapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)",
        }}
      >
        <Header />
        <div className="app-content">
          <Routes>
            <Route
              path="/"
              element={
                <ErrorBoundary>
                  <Dashboard />
                </ErrorBoundary>
              }
            />
            <Route
              path="/editor"
              element={
                <ErrorBoundary>
                  <MapEditor />
                </ErrorBoundary>
              }
            />
            <Route
              path="/quiz"
              element={
                <ErrorBoundary>
                  <Quiz />
                </ErrorBoundary>
              }
            />
            <Route
              path="/settings"
              element={
                <ErrorBoundary>
                  <Settings />
                </ErrorBoundary>
              }
            />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    initSkills();
  }, []);

  return (
    <BrowserRouter>
      <ToastProvider>
        <AppContent sidebarCollapsed={sidebarCollapsed} setSidebarCollapsed={setSidebarCollapsed} />
      </ToastProvider>
    </BrowserRouter>
  );
}
