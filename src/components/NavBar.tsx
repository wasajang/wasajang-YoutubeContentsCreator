import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, FolderOpen, Plus, Settings, Zap } from 'lucide-react';

const NavBar: React.FC = () => {
    const location = useLocation();

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
            </div>
        </nav>
    );
};

export default NavBar;
