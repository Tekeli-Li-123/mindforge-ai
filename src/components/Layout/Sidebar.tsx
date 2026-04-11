import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import { useMindMapStore } from '../../stores/mindmapStore';
import './Sidebar.css';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  // { to: '/editor', icon: Map, label: '知识导图' }, // We will replace this with custom logic
  { to: '/quiz', icon: GraduationCap, label: '知识考核' },
];

const bottomItems = [
  { to: '/settings', icon: Settings, label: '设置' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { projects, currentProject, setCurrentProject, deleteProject, duplicateProject, updateProject } = useMindMapStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // 判定当前是否在一个项目的编辑页
  const isEditorActive = location.pathname === '/editor';

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Brain size={18} />
        </div>
        {!collapsed && <span className="sidebar-logo-text gradient-text">MindForge</span>}
      </div>

      {/* Main Nav */}
      <nav className="sidebar-nav">
        {!collapsed && <div className="sidebar-section-label">主菜单</div>}
        {/* Render Dashboard */}
        <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''}`
            }
            title={collapsed ? '仪表盘' : undefined}
          >
            <LayoutDashboard className="sidebar-nav-item-icon" size={20} />
            {!collapsed && <span className="sidebar-nav-item-label">仪表盘</span>}
        </NavLink>

        {/* Custom Project List Item */}
        <div className="sidebar-projects-group">
          <button 
            className={`sidebar-nav-item ${isEditorActive && collapsed ? 'active' : ''}`}
            title={collapsed ? '我的导图项目' : undefined}
            onClick={() => {
              if (collapsed) {
                // 如果是折叠状态，点击就跳转到仪表盘挑选
                navigate('/');
              } else {
                setProjectsExpanded(!projectsExpanded);
              }
            }}
          >
            <Map className="sidebar-nav-item-icon" size={20} />
            {!collapsed && (
              <>
                <span className="sidebar-nav-item-label">我的导图</span>
                <ChevronDown 
                  size={14} 
                  style={{ 
                    transition: 'transform 0.2s', 
                    transform: projectsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                    color: 'var(--color-text-tertiary)'
                  }} 
                />
              </>
            )}
          </button>
          
          {/* 展开的项目列表 */}
          {!collapsed && projectsExpanded && (
            <div className="sidebar-projects-list">
              {projects.length === 0 ? (
                <div className="sidebar-empty-state">暂无项目</div>
              ) : (
                projects.map(proj => {
                  const isActiveProj = isEditorActive && currentProject?.id === proj.id;
                  return (
                    <div key={proj.id} className="sidebar-project-item-container">
                      <button
                        className={`sidebar-project-item ${isActiveProj ? 'active' : ''}`}
                        onClick={() => {
                          setCurrentProject(proj);
                          navigate('/editor');
                        }}
                        title={proj.title}
                      >
                        <FileText size={14} />
                        <span className="sidebar-project-name">{proj.title}</span>
                      </button>
                      
                      <button 
                        className={`sidebar-project-more-btn ${activeMenuId === proj.id ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === proj.id ? null : proj.id);
                        }}
                      >
                        <MoreVertical size={14} />
                      </button>

                      {activeMenuId === proj.id && (
                        <div className="sidebar-project-dropdown glass animate-fade-in">
                          <div className="dropdown-item" onClick={(e) => {
                            e.stopPropagation();
                            const newTitle = window.prompt('设个新名字吧：', proj.title);
                            if (newTitle) {
                               updateProject(proj.id, { title: newTitle });
                            }
                            setActiveMenuId(null);
                          }}>
                            <Edit2 size={13} /> 重命名
                          </div>
                          <div className="dropdown-item" onClick={(e) => {
                            e.stopPropagation();
                            duplicateProject(proj.id);
                            setActiveMenuId(null);
                          }}>
                            <Copy size={13} /> 复制
                          </div>
                          <div className="dropdown-item delete" onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`确定要删除“${proj.title}”及其学习记录吗？`)) {
                              deleteProject(proj.id);
                              if (isActiveProj) navigate('/');
                            }
                            setActiveMenuId(null);
                          }}>
                            <Trash2 size={13} /> 删除
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
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''}`
            }
            title={collapsed ? '知识考核' : undefined}
          >
            <GraduationCap className="sidebar-nav-item-icon" size={20} />
            {!collapsed && <span className="sidebar-nav-item-label">知识考核</span>}
        </NavLink>

        <div style={{ flex: 1 }} />

        {!collapsed && <div className="sidebar-section-label">系统</div>}
        {bottomItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''}`
            }
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
          title={collapsed ? '展开侧栏' : '收起侧栏'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
