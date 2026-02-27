import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, FolderOpen, Plus, Settings, Zap, LogIn, LogOut, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const NavBar: React.FC = () => {
    const location = useLocation();
    const { user, loading, isGuest, signInWithGoogle, signOut } = useAuth();

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
                    <Link
                        to="/"
                        className="navbar__nav-item"
                    >
                        <FolderOpen size={14} />
                        MY PROJECTS
                    </Link>
                </div>
            </div>
            <div className="navbar__right">
                <button className="btn-secondary" style={{ fontSize: '0.75rem', padding: '6px 16px' }}>
                    Upgrade
                </button>
                <Link to="/project/idea" className="btn-primary" style={{ fontSize: '0.75rem', padding: '6px 16px' }}>
                    <Plus size={14} />
                    New Project
                </Link>
                <button className="btn-ghost">
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
                    <button className="btn-ghost" onClick={signInWithGoogle} style={{ fontSize: '0.7rem', padding: '4px 8px' }}>
                        <LogIn size={12} /> 로그인
                    </button>
                )}
            </div>
        </nav>
    );
};

export default NavBar;
