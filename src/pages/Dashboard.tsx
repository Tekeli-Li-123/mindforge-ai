import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Map, GraduationCap, Sparkles, BookOpen, GitBranch, Clock, Brain, Trash2, Copy, MoreVertical, Edit2 } from 'lucide-react';
import { useMindMapStore } from '../stores/mindmapStore';
import { countNodes, averageMastery, parseMarkdownToMindMapNode } from '../utils/mindmapHelpers';
import { generateMindMap } from '../services/aiService';
import type { MindMapProject } from '../types';
import Modal from '../components/common/Modal';
import './Dashboard.css';

export default function Dashboard() {
  const { projects, addProject, setCurrentProject, updateProjectRoot, deleteProject, duplicateProject, updateProject } = useMindMapStore();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectParams, setNewProjectParams] = useState({
    title: '',
    description: '',
    prompt: '',
  });

  const handleCreateNew = () => {
    if (!newProjectParams.prompt.trim()) return;
    
    // Create generating placeholder immediately
    const projectId = `proj-${Date.now()}`;
    const generatedTitle = newProjectParams.title || newProjectParams.prompt.slice(0, 20);
    const newProject: MindMapProject = {
       id: projectId,
       title: generatedTitle,
       description: newProjectParams.description,
       createdAt: Date.now(),
       updatedAt: Date.now(),
       root: { 
         id: 'root', 
         content: newProjectParams.title || '正在思考导图结构...', 
         depth: 0, 
         mastery: 0, 
         expanded: true, 
         children: [] 
       },
       isGenerating: true,
       generatingReasoning: '',
       generationPrompt: {
         prompt: newProjectParams.prompt,
         title: newProjectParams.title,
         description: newProjectParams.description,
       }
    };

    addProject(newProject);
    setCurrentProject(newProject);
    setIsModalOpen(false);
    navigate('/editor');
  };

  const totalNodes = projects.reduce(
    (sum, p) => sum + countNodes(p.root),
    0
  );
  const avgMastery = projects.length > 0
    ? projects.reduce((sum, p) => sum + averageMastery(p.root), 0) / projects.length
    : 0;

  return (
    <div className="dashboard">
      {/* Welcome */}
      <div className="dashboard-welcome">
        <h2>
          欢迎使用 <span className="gradient-text">MindForge AI</span> 🧠
        </h2>
        <p>用 AI 构建知识思维导图，一键细化、智能考核，让学习更高效</p>
      </div>

      {/* Stats */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon purple"><BookOpen size={20} /></div>
          <div className="stat-info">
            <h3>{projects.length}</h3>
            <p>导图项目</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><GitBranch size={20} /></div>
          <div className="stat-info">
            <h3>{totalNodes}</h3>
            <p>知识节点</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><Brain size={20} /></div>
          <div className="stat-info">
            <h3>{Math.round(avgMastery * 100)}%</h3>
            <p>平均掌握度</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><GraduationCap size={20} /></div>
          <div className="stat-info">
            <h3>0</h3>
            <p>已完成考核</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <h3 className="dashboard-section-title">快速开始</h3>
      <div className="dashboard-actions">
        <div className="action-card" onClick={() => setIsModalOpen(true)}>
          <div className="action-card-icon">
            <Sparkles size={22} />
          </div>
          <h3>AI 生成导图</h3>
          <p>输入任意主题，AI 自动构建完整的知识思维导图</p>
        </div>
        <Link to="/editor" className="action-card">
          <div className="action-card-icon">
            <Map size={22} />
          </div>
          <h3>编辑导图</h3>
          <p>打开现有导图，与 AI 对话细化节点，深入学习</p>
        </Link>
        <Link to="/quiz" className="action-card">
          <div className="action-card-icon">
            <GraduationCap size={22} />
          </div>
          <h3>知识考核</h3>
          <p>AI 根据导图内容自动出题，检验掌握程度</p>
        </Link>
      </div>

      {/* Recent Projects */}
      <h3 className="dashboard-section-title">最近项目</h3>
      <div className="dashboard-projects">
        {projects.map((project) => (
          <div 
            key={project.id} 
            className="project-card"
            onClick={() => {
              setCurrentProject(project);
              navigate('/editor');
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
              <span><GitBranch size={12} /> {countNodes(project.root)} 节点</span>
              <span><Clock size={12} /> {new Date(project.updatedAt).toLocaleDateString('zh-CN')}</span>
            </div>
            
            <div className="project-card-actions">
              <button 
                className="project-action-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  const newTitle = window.prompt('请输入新的导图标题：', project.title);
                  if (newTitle !== null && newTitle.trim() !== '') {
                    updateProject(project.id, { title: newTitle.trim() });
                  }
                }}
                title="重命名项目"
              >
                <Edit2 size={16} />
              </button>
              <button 
                className="project-action-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateProject(project.id);
                }}
                title="创建副本"
              >
                <Copy size={16} />
              </button>
              <button 
                className="project-action-btn delete" 
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`确定要彻底删除“${project.title}”及其所有学习进度吗？`)) {
                    deleteProject(project.id);
                  }
                }}
                title="删除项目"
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
        title="AI 智能生成知识导图"
        footer={
          <>
            <button className="modal-btn secondary" onClick={() => setIsModalOpen(false)}>取消</button>
            <button
              className="modal-btn primary"
              disabled={!newProjectParams.prompt.trim()}
              onClick={handleCreateNew}
            >
              <Sparkles size={14} style={{ display: 'inline', marginRight: '4px' }} />
              后台生成
            </button>
          </>
        }
      >
        <div className="modal-form-group">
          <label className="modal-label">我想学习的主题 (Prompt)</label>
          <textarea
            className="modal-textarea"
            placeholder="例如：Python 异步编程基础、微观经济学原理解析..."
            value={newProjectParams.prompt}
            onChange={(e) => setNewProjectParams({ ...newProjectParams, prompt: e.target.value })}
            autoFocus
          />
        </div>
        <div className="modal-form-group">
          <label className="modal-label">导图标题 (可选)</label>
          <input
            type="text"
            className="modal-input"
            placeholder="留空则由 AI 自动生成标题"
            value={newProjectParams.title}
            onChange={(e) => setNewProjectParams({ ...newProjectParams, title: e.target.value })}
          />
        </div>
        <div className="modal-form-group">
          <label className="modal-label">学习目标 / 详细描述 (可选)</label>
          <input
            type="text"
            className="modal-input"
            placeholder="例如：侧重于实战应用，或者用于应对期末考试"
            value={newProjectParams.description}
            onChange={(e) => setNewProjectParams({ ...newProjectParams, description: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
}
