import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import './Quiz.css';

export default function Quiz() {
  return (
    <div className="quiz-page">
      <div className="quiz-header">
        <h2>知识考核</h2>
        <p>AI 根据你的知识导图自动生成测试题目</p>
      </div>

      <div className="quiz-empty">
        <div className="quiz-empty-icon">
          <GraduationCap size={36} />
        </div>
        <h3>准备好测试了吗？</h3>
        <p>
          AI 将基于你的思维导图内容，生成选择题、判断题和填空题，
          帮你检验知识掌握程度。
        </p>
        <Link to="/editor">
          <button className="quiz-start-btn">
            先去构建导图 →
          </button>
        </Link>
      </div>
    </div>
  );
}
