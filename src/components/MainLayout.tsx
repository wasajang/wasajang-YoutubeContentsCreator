/**
 * MainLayout — 047: 좌측 사이드바(다크) + 우측 워크스페이스(라이트) 분할 레이아웃
 *
 * Plan/layout_plan.md 기획서 기반
 * - 사이드바: 280-320px 고정, 다크 테마, 글로벌 설정 (API 키, 모델, 언어 등)
 * - 워크스페이스: 나머지 영역, 라이트 테마, 씬 카드 및 콘텐츠
 */
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Zap, Home, ChevronDown, ChevronRight, Key, Cpu, Globe,
  Clock, Settings, CreditCard, Plus
} from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import type { ProjectMode } from '../store/projectStore';
import { useCredits } from '../hooks/useCredits';

/* ──────────── Props ──────────── */
interface MainLayoutProps {
  children: React.ReactNode;
  /** 워크스페이스 상단 헤더 영역 (프로젝트 제목, 글로벌 액션 등) */
  workspaceHeader?: React.ReactNode;
}

/* ──────────── 사이드바 섹션 접기/펼치기 ──────────── */
interface SidebarSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const SidebarSection: React.FC<SidebarSectionProps> = ({
  title, icon, defaultOpen = true, children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="sidebar-section">
      <button
        className="sidebar-section__header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="sidebar-section__icon">{icon}</span>
        <span className="sidebar-section__title">{title}</span>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {isOpen && (
        <div className="sidebar-section__body">{children}</div>
      )}
    </div>
  );
};

/* ──────────── MainLayout ──────────── */
const MainLayout: React.FC<MainLayoutProps> = ({ children, workspaceHeader }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { remaining } = useCredits();
  const startNewProject = useProjectStore((s) => s.startNewProject);
  const setEntryPoint = useProjectStore((s) => s.setEntryPoint);
  const setTemplateId = useProjectStore((s) => s.setTemplateId);
  const handleNewProject = (mode: ProjectMode) => {
    startNewProject('Untitled Project', mode);
    setEntryPoint('script');
    setTemplateId(null);
    navigate('/project/idea');
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="sidebar-layout">
      {/* ── 좌측 사이드바 (다크 테마) ── */}
      <aside className="sidebar-layout__sidebar">
        {/* 로고 */}
        <div className="sidebar-logo">
          <Link to="/" className="sidebar-logo__link">
            <div className="sidebar-logo__icon">
              <Zap size={16} color="#fff" />
            </div>
            <span className="sidebar-logo__text gradient-text">AntiGravity</span>
          </Link>
        </div>

        {/* 네비게이션 */}
        <nav className="sidebar-nav">
          <Link
            to="/"
            className={`sidebar-nav__item ${isActive('/') && location.pathname === '/' ? 'active' : ''}`}
          >
            <Home size={16} />
            <span>Home</span>
          </Link>
          <button
            className="sidebar-nav__new-btn"
            onClick={() => handleNewProject('cinematic')}
          >
            <Plus size={16} />
            <span>New Project</span>
          </button>
        </nav>

        {/* 구분선 */}
        <div className="sidebar-divider" />

        {/* 설정 섹션들 */}
        <div className="sidebar-sections">
          <SidebarSection title="AI Models" icon={<Cpu size={16} />}>
            <div className="sidebar-field">
              <label className="sidebar-field__label">Image Model</label>
              <select className="sidebar-field__select">
                <option>Gemini Imagen 3</option>
                <option>DALL-E 3</option>
              </select>
            </div>
            <div className="sidebar-field">
              <label className="sidebar-field__label">Video Model</label>
              <select className="sidebar-field__select">
                <option>Veo 2</option>
                <option>Runway Gen-3</option>
              </select>
            </div>
          </SidebarSection>

          <SidebarSection title="API Keys" icon={<Key size={16} />} defaultOpen={false}>
            <div className="sidebar-field">
              <label className="sidebar-field__label">Gemini API Key</label>
              <input
                type="password"
                className="sidebar-field__input"
                placeholder="sk-..."
              />
            </div>
            <div className="sidebar-field">
              <label className="sidebar-field__label">OpenAI API Key</label>
              <input
                type="password"
                className="sidebar-field__input"
                placeholder="sk-..."
              />
            </div>
          </SidebarSection>

          <SidebarSection title="Output" icon={<Globe size={16} />} defaultOpen={false}>
            <div className="sidebar-field">
              <label className="sidebar-field__label">Language</label>
              <select className="sidebar-field__select">
                <option>한국어</option>
                <option>English</option>
                <option>日本語</option>
              </select>
            </div>
          </SidebarSection>

          <SidebarSection title="Timeline" icon={<Clock size={16} />} defaultOpen={false}>
            <div className="sidebar-field">
              <label className="sidebar-field__label">Scene Duration</label>
              <select className="sidebar-field__select">
                <option>6s</option>
                <option>8s</option>
                <option>10s</option>
              </select>
            </div>
            <div className="sidebar-field">
              <label className="sidebar-field__label">Aspect Ratio</label>
              <select className="sidebar-field__select">
                <option>16:9</option>
                <option>9:16</option>
                <option>1:1</option>
              </select>
            </div>
          </SidebarSection>
        </div>

        {/* 하단 고정: 크레딧 + 설정 */}
        <div className="sidebar-bottom">
          <div className="sidebar-divider" />
          <Link to="/settings" className="sidebar-bottom__item">
            <Settings size={16} />
            <span>Settings</span>
          </Link>
          <Link to="/payment" className="sidebar-bottom__item">
            <CreditCard size={16} />
            <span>Credits</span>
            <span className="sidebar-bottom__badge">{remaining}</span>
          </Link>
        </div>
      </aside>

      {/* ── 우측 워크스페이스 (라이트 테마) ── */}
      <main className="sidebar-layout__workspace workspace-theme">
        {workspaceHeader && (
          <div className="workspace-header">{workspaceHeader}</div>
        )}
        <div className="workspace-content">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
