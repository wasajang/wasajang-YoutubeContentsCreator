import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, FolderOpen, Plus, Settings, Zap, LogIn, LogOut, User, Coins, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useProjectStore } from '../store/projectStore';
import type { ProjectMode } from '../store/projectStore';
import { useCredits } from '../hooks/useCredits';
import SettingsModal from './SettingsModal';

const NavBar: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, loading, isGuest, signInWithGoogle, signInWithKakao, signOut } = useAuth();
    const { remaining } = useCredits();
    const startNewProject = useProjectStore((s) => s.startNewProject);
    const setEntryPoint = useProjectStore((s) => s.setEntryPoint);
    const setTemplateId = useProjectStore((s) => s.setTemplateId);
    const [showSettings, setShowSettings] = useState(false);
    const [showModeSelect, setShowModeSelect] = useState(false);

    const handleNewProject = () => {
        setShowModeSelect(true);
    };

    const handleModeSelect = (mode: ProjectMode) => {
        startNewProject('Untitled Project', mode);
        setEntryPoint('script');
        setTemplateId(null);
        setShowModeSelect(false);
        navigate('/project/idea');
    };

    return (
        <nav className="navbar">
            <div className="navbar__left">
                <Link to="/" className="navbar__logo">
                    <div className="navbar__logo-icon">
                        <Zap size={16} color="#fff" />
                    </div>
                    <span className="gradient-text">AntiGravity</span>
                </Link>
                <div className="navbar__nav">
                    <Link
                        to="/"
                        className={`navbar__nav-item ${location.pathname === '/' ? 'active' : ''}`}
                    >
                        <Home size={14} />
                        Home
                    </Link>
                    {!isGuest && user && (
                        <Link
                            to="/"
                            className="navbar__nav-item"
                        >
                            <FolderOpen size={14} />
                            MY PROJECTS
                        </Link>
                    )}
                    <Link
                        to="/cast"
                        className={`navbar__nav-item ${location.pathname === '/cast' ? 'active' : ''}`}
                    >
                        <Users size={14} />
                        My Cast
                    </Link>
                </div>
            </div>
            <div className="navbar__right">
                <div className="navbar__credits" title={`남은 크레딧: ${remaining}`}>
                    <Coins size={14} />
                    <span className="navbar__credits-count">{remaining}</span>
                </div>
                <Link to="/payment" className="btn-secondary" style={{ fontSize: '0.75rem', padding: '6px 16px', textDecoration: 'none' }}>
                    Upgrade
                </Link>
                <button onClick={handleNewProject} className="btn-primary" style={{ fontSize: '0.75rem', padding: '6px 16px' }}>
                    <Plus size={14} />
                    New Project
                </button>
                <button className="btn-ghost" onClick={() => setShowSettings(true)}>
                    <Settings size={15} />
                    SETTINGS
                </button>

                {/* Auth Section */}
                {loading ? null : isGuest ? (
                    <span className="navbar__guest-badge">
                        <User size={12} /> 게스트
                    </span>
                ) : user ? (
                    <div className="navbar__user">
                        {user.user_metadata?.avatar_url ? (
                            <img src={user.user_metadata.avatar_url} alt="" className="navbar__avatar" />
                        ) : (
                            <div className="navbar__avatar navbar__avatar--placeholder"><User size={14} /></div>
                        )}
                        <button className="btn-ghost" onClick={signOut} style={{ fontSize: '0.7rem', padding: '4px 8px' }}>
                            <LogOut size={12} /> 로그아웃
                        </button>
                    </div>
                ) : (
                    <div className="navbar__auth-btns">
                        <button className="btn-ghost" onClick={signInWithGoogle} style={{ fontSize: '0.7rem', padding: '4px 8px' }}>
                            <LogIn size={12} /> Google
                        </button>
                        <button className="btn-ghost" onClick={signInWithKakao} style={{ fontSize: '0.7rem', padding: '4px 8px' }}>
                            <LogIn size={12} /> Kakao
                        </button>
                    </div>
                )}
            </div>
            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
            {showModeSelect && (
                <div className="mode-select-overlay" onClick={() => setShowModeSelect(false)}>
                    <div className="mode-select" onClick={(e) => e.stopPropagation()}>
                        <h3 className="mode-select__title">영상 제작 방식 선택</h3>
                        <div className="mode-select__options">
                            <div className="mode-select__option" onClick={() => handleModeSelect('cinematic')}>
                                <div className="mode-select__icon">🎬</div>
                                <h4>시네마틱</h4>
                                <p>씬별 이미지/영상을 생성하고 마지막에 나레이션 추가</p>
                            </div>
                            <div className="mode-select__option" onClick={() => handleModeSelect('narration')}>
                                <div className="mode-select__icon">🎙️</div>
                                <h4>나레이션</h4>
                                <p>먼저 나레이션 음성을 생성하고 타이밍에 맞춰 영상 배치</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
};

export default NavBar;
