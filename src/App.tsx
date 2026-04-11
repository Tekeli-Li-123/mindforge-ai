import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { initSkills } from './services/skills';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Dashboard from './pages/Dashboard';
import MapEditor from './pages/MapEditor';
import Quiz from './pages/Quiz';
import Settings from './pages/Settings';
import DropZoneOverlay from './components/common/DropZoneOverlay';
import { useMindMapStore } from './stores/mindmapStore';
import { parseImportedFile } from './utils/mindmapHelpers';
import './App.css';

function AppContent({ sidebarCollapsed, setSidebarCollapsed }: { 
  sidebarCollapsed: boolean, 
  setSidebarCollapsed: (v: boolean) => void 
}) {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const { addProject, setCurrentProject } = useMindMapStore();

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Only set false if leaving to the window (avoid flicker on child elements)
      if (e.relatedTarget === null || (e.relatedTarget as HTMLElement).tagName === 'HTML') {
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
          navigate('/editor');
        } catch (err: any) {
          alert('导入失败: ' + err.message);
        }
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [addProject, setCurrentProject, navigate]);

  return (
    <div className="app-layout" onDragEnter={() => setIsDragging(true)}>
      {isDragging && <DropZoneOverlay />}
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div
        className="app-main"
        style={{
          marginLeft: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        }}
      >
        <Header />
        <div className="app-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/editor" element={<MapEditor />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/settings" element={<Settings />} />
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
      <AppContent 
        sidebarCollapsed={sidebarCollapsed} 
        setSidebarCollapsed={setSidebarCollapsed} 
      />
    </BrowserRouter>
  );
}
