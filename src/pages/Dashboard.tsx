import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Map,
  GraduationCap,
  Sparkles,
  BookOpen,
  GitBranch,
  Clock,
  Brain,
  Trash2,
  Copy,
  Edit2,
} from "lucide-react";
import { useMindMapStore } from "../stores/mindmapStore";
import { useTranslation } from "../i18n";
import { countNodes, averageMastery } from "../utils/mindmapHelpers";
import type { MindMapProject } from "../types";
import Modal from "../components/common/Modal";
import "./Dashboard.css";

export default function Dashboard() {
  const { t, lang } = useTranslation();
  const {
    projects,
    addProject,
    setCurrentProject,
    deleteProject,
    duplicateProject,
    updateProject,
  } = useMindMapStore();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectParams, setNewProjectParams] = useState({
    title: "",
    description: "",
    prompt: "",
  });

  const handleCreateNew = () => {
    if (!newProjectParams.prompt.trim()) return;

    const projectId = `proj-${Date.now()}`;
    const generatedTitle = newProjectParams.title || newProjectParams.prompt.slice(0, 20);
    const newProject: MindMapProject = {
      id: projectId,
      title: generatedTitle,
      description: newProjectParams.description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      root: {
        id: "root",
        content: newProjectParams.title || "",
        depth: 0,
        mastery: 0,
        expanded: true,
        children: [],
      },
      isGenerating: true,
      generatingReasoning: "",
      generationPrompt: {
        prompt: newProjectParams.prompt,
        title: newProjectParams.title,
        description: newProjectParams.description,
      },
    };

    addProject(newProject);
    setCurrentProject(newProject);
    setIsModalOpen(false);
    navigate("/editor");
  };

  const { totalNodes, avgMastery, nodeCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    let masterySum = 0;
    for (const p of projects) {
      const n = countNodes(p.root);
      counts[p.id] = n;
      total += n;
      masterySum += averageMastery(p.root);
    }
    return {
      totalNodes: total,
      avgMastery: projects.length > 0 ? masterySum / projects.length : 0,
      nodeCounts: counts,
    };
  }, [projects]);

  return (
    <div className="dashboard">
      {/* Welcome */}
      <div className="dashboard-welcome">
        <h2>
          {t("dashboard.title")} <span className="gradient-text">MindForge AI</span> 🧠
        </h2>
        <p>{t("dashboard.subtitle")}</p>
      </div>

      {/* Stats */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon purple">
            <BookOpen size={20} />
          </div>
          <div className="stat-info">
            <h3>{projects.length}</h3>
            <p>{t("sidebar.mindmaps")}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <GitBranch size={20} />
          </div>
          <div className="stat-info">
            <h3>{totalNodes}</h3>
            <p>{t("editor.nodes")}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow">
            <Brain size={20} />
          </div>
          <div className="stat-info">
            <h3>{Math.round(avgMastery * 100)}%</h3>
            <p>{t("assessment.afterScore")}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">
            <GraduationCap size={20} />
          </div>
          <div className="stat-info">
            <h3>0</h3>
            <p>{t("assessment.reportTitle")}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <h3 className="dashboard-section-title">{t("dashboard.quickStart")}</h3>
      <div className="dashboard-actions">
        <div className="action-card" onClick={() => setIsModalOpen(true)}>
          <div className="action-card-icon">
            <Sparkles size={22} />
          </div>
          <h3>{t("dashboard.createFromAI")}</h3>
          <p>{t("dashboard.quickStartDesc")}</p>
        </div>
        <Link to="/editor" className="action-card">
          <div className="action-card-icon">
            <Map size={22} />
          </div>
          <h3>{t("dashboard.continueEditing")}</h3>
          <p>{t("dashboard.quickStartDesc")}</p>
        </Link>
        <Link to="/quiz" className="action-card">
          <div className="action-card-icon">
            <GraduationCap size={22} />
          </div>
          <h3>{t("sidebar.knowledgeQuiz")}</h3>
          <p>{t("settings.subtitle")}</p>
        </Link>
      </div>

      {/* Recent Projects */}
      <h3 className="dashboard-section-title">{t("dashboard.title")}</h3>
      <div className="dashboard-projects">
        {projects.map((project) => (
          <div
            key={project.id}
            className="project-card"
            onClick={() => {
              setCurrentProject(project);
              navigate("/editor");
            }}
          >
            <div className="project-card-left">
              <div className="project-card-icon">
                <Map size={18} />
              </div>
              <div className="project-card-info">
                <h4>{project.title}</h4>
                <p>{project.description}</p>
              </div>
            </div>
            <div className="project-card-meta">
              <span>
                <GitBranch size={12} /> {nodeCounts[project.id] ?? countNodes(project.root)}{" "}
                {t("editor.nodes")}
              </span>
              <span>
                <Clock size={12} />{" "}
                {new Date(project.updatedAt).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US")}
              </span>
            </div>

            <div className="project-card-actions">
              <button
                className="project-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  const newTitle = window.prompt(t("dashboard.quickStart"), project.title);
                  if (newTitle !== null && newTitle.trim() !== "") {
                    updateProject(project.id, { title: newTitle.trim() });
                  }
                }}
                title={t("sidebar.rename")}
              >
                <Edit2 size={16} />
              </button>
              <button
                className="project-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateProject(project.id);
                }}
                title={t("sidebar.duplicate")}
              >
                <Copy size={16} />
              </button>
              <button
                className="project-action-btn delete"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(t("dashboard.deleteConfirm", { title: project.title }))) {
                    deleteProject(project.id);
                  }
                }}
                title={t("sidebar.delete")}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* New Project Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t("dashboard.createFromAI")}
        footer={
          <>
            <button className="modal-btn secondary" onClick={() => setIsModalOpen(false)}>
              {t("common.cancel")}
            </button>
            <button
              className="modal-btn primary"
              disabled={!newProjectParams.prompt.trim()}
              onClick={handleCreateNew}
            >
              <Sparkles size={14} style={{ display: "inline", marginRight: "4px" }} />
              {t("dashboard.generate")}
            </button>
          </>
        }
      >
        <div className="modal-form-group">
          <label className="modal-label">{t("dashboard.topic")}</label>
          <textarea
            className="modal-textarea"
            placeholder={t("dashboard.quickStartDesc")}
            value={newProjectParams.prompt}
            onChange={(e) => setNewProjectParams({ ...newProjectParams, prompt: e.target.value })}
            autoFocus
          />
        </div>
        <div className="modal-form-group">
          <label className="modal-label">
            {t("sidebar.rename")} ({t("common.cancel")})
          </label>
          <input
            type="text"
            className="modal-input"
            placeholder={t("dashboard.topic")}
            value={newProjectParams.title}
            onChange={(e) => setNewProjectParams({ ...newProjectParams, title: e.target.value })}
          />
        </div>
        <div className="modal-form-group">
          <label className="modal-label">{t("settings.subtitle")}</label>
          <input
            type="text"
            className="modal-input"
            placeholder={t("dashboard.quickStartDesc")}
            value={newProjectParams.description}
            onChange={(e) =>
              setNewProjectParams({ ...newProjectParams, description: e.target.value })
            }
          />
        </div>
      </Modal>
    </div>
  );
}
