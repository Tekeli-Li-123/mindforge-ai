import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Map,
  GraduationCap,
  Settings,
  ChevronLeft,
  ChevronRight,
  Brain,
  FileText,
  ChevronDown,
  MoreVertical,
  Edit2,
  Copy,
  Trash2,
} from "lucide-react";
import { useMindMapStore } from "../../stores/mindmapStore";
import { useTranslation } from "../../i18n";
import "./Sidebar.css";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { t } = useTranslation();
  const {
    projects,
    currentProject,
    setCurrentProject,
    deleteProject,
    duplicateProject,
    updateProject,
  } = useMindMapStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const isEditorActive = location.pathname === "/editor";

  const bottomItems = [{ to: "/settings", icon: Settings, label: t("sidebar.settings") }];

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Brain size={18} />
        </div>
        {!collapsed && <span className="sidebar-logo-text gradient-text">MindForge</span>}
      </div>

      {/* Main Nav */}
      <nav className="sidebar-nav">
        {!collapsed && <div className="sidebar-section-label">{t("sidebar.main")}</div>}
        {/* Render Dashboard */}
        <NavLink
          to="/"
          end
          className={({ isActive }) => `sidebar-nav-item ${isActive ? "active" : ""}`}
          title={collapsed ? t("sidebar.dashboard") : undefined}
        >
          <LayoutDashboard className="sidebar-nav-item-icon" size={20} />
          {!collapsed && <span className="sidebar-nav-item-label">{t("sidebar.dashboard")}</span>}
        </NavLink>

        {/* Custom Project List Item */}
        <div className="sidebar-projects-group">
          <button
            className={`sidebar-nav-item ${isEditorActive && collapsed ? "active" : ""}`}
            title={collapsed ? t("sidebar.mindmaps") : undefined}
            onClick={() => {
              if (collapsed) {
                navigate("/");
              } else {
                setProjectsExpanded(!projectsExpanded);
              }
            }}
          >
            <Map className="sidebar-nav-item-icon" size={20} />
            {!collapsed && (
              <>
                <span className="sidebar-nav-item-label">{t("sidebar.mindmaps")}</span>
                <ChevronDown
                  size={14}
                  style={{
                    transition: "transform 0.2s",
                    transform: projectsExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                    color: "var(--color-text-tertiary)",
                  }}
                />
              </>
            )}
          </button>

          {!collapsed && projectsExpanded && (
            <div className="sidebar-projects-list">
              {projects.length === 0 ? (
                <div className="sidebar-empty-state">{t("sidebar.noProjects")}</div>
              ) : (
                projects.map((proj) => {
                  const isActiveProj = isEditorActive && currentProject?.id === proj.id;
                  return (
                    <div key={proj.id} className="sidebar-project-item-container">
                      <button
                        className={`sidebar-project-item ${isActiveProj ? "active" : ""}`}
                        onClick={() => {
                          setCurrentProject(proj);
                          navigate("/editor");
                        }}
                        title={proj.title}
                      >
                        <FileText size={14} />
                        <span className="sidebar-project-name">{proj.title}</span>
                      </button>

                      <button
                        className={`sidebar-project-more-btn ${activeMenuId === proj.id ? "active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === proj.id ? null : proj.id);
                        }}
                      >
                        <MoreVertical size={14} />
                      </button>

                      {activeMenuId === proj.id && (
                        <div className="sidebar-project-dropdown glass animate-fade-in">
                          <div
                            className="dropdown-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newTitle = window.prompt(t("sidebar.renamePrompt"), proj.title);
                              if (newTitle) {
                                updateProject(proj.id, { title: newTitle });
                              }
                              setActiveMenuId(null);
                            }}
                          >
                            <Edit2 size={13} /> {t("sidebar.rename")}
                          </div>
                          <div
                            className="dropdown-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateProject(proj.id);
                              setActiveMenuId(null);
                            }}
                          >
                            <Copy size={13} /> {t("sidebar.duplicate")}
                          </div>
                          <div
                            className="dropdown-item delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                window.confirm(t("sidebar.deleteConfirm", { title: proj.title }))
                              ) {
                                deleteProject(proj.id);
                                if (isActiveProj) navigate("/");
                              }
                              setActiveMenuId(null);
                            }}
                          >
                            <Trash2 size={13} /> {t("sidebar.delete")}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Render Quiz */}
        <NavLink
          to="/quiz"
          className={({ isActive }) => `sidebar-nav-item ${isActive ? "active" : ""}`}
          title={collapsed ? t("sidebar.knowledgeQuiz") : undefined}
        >
          <GraduationCap className="sidebar-nav-item-icon" size={20} />
          {!collapsed && (
            <span className="sidebar-nav-item-label">{t("sidebar.knowledgeQuiz")}</span>
          )}
        </NavLink>

        <div style={{ flex: 1 }} />

        {!collapsed && <div className="sidebar-section-label">{t("sidebar.system")}</div>}
        {bottomItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-nav-item ${isActive ? "active" : ""}`}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="sidebar-nav-item-icon" size={20} />
            {!collapsed && <span className="sidebar-nav-item-label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="sidebar-toggle">
        <button
          className="sidebar-toggle-btn"
          onClick={onToggle}
          title={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
