import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, FileText, ArrowRight, Star, Trash2, FolderOpen, Loader } from 'lucide-react';
import { genreFilters, heroTemplates, templateCards } from '../data/mockData';
import { useProjectStore } from '../store/projectStore';
import { useAuth } from '../hooks/useAuth';
import { listProjects, deleteProject, loadProject } from '../services/project-api';
import type { DbProject } from '../types/database';

const HomePage: React.FC = () => {
    const [activeFilter, setActiveFilter] = useState('MOST POPULAR');
    const navigate = useNavigate();
    const startNewProject = useProjectStore((state) => state.startNewProject);
    const setProjectId = useProjectStore((state) => state.setProjectId);
    const setTitle = useProjectStore((state) => state.setTitle);
    const setScenes = useProjectStore((state) => state.setScenes);
    const setSelectedStyle = useProjectStore((state) => state.setSelectedStyle);
    const setAspectRatio = useProjectStore((state) => state.setAspectRatio);
    const setCurrentPhase = useProjectStore((state) => state.setCurrentPhase);

    const { user, isGuest } = useAuth();
    const [myProjects, setMyProjects] = useState<DbProject[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // 로그인 시 프로젝트 목록 로드
    useEffect(() => {
        if (isGuest || !user) return;
        setProjectsLoading(true);
        listProjects(user.id)
            .then(setMyProjects)
            .catch((err) => console.warn('[HomePage] 프로젝트 목록 로드 실패:', err))
            .finally(() => setProjectsLoading(false));
    }, [user, isGuest]);

    // 프로젝트 열기
    const handleOpenProject = async (project: DbProject) => {
        try {
            const result = await loadProject(project.id);
            if (!result) return;

            setProjectId(result.project.id);
            setTitle(result.project.title);
            setSelectedStyle(result.project.selected_style);
            setAspectRatio(result.project.aspect_ratio);
            setScenes(result.scenes);
            setCurrentPhase(2); // 스토리보드부터 재개
            navigate('/project/idea');
        } catch (err) {
            console.error('[HomePage] 프로젝트 열기 실패:', err);
        }
    };

    // 프로젝트 삭제
    const handleDeleteProject = async (projectId: string) => {
        if (!confirm('이 프로젝트를 삭제하시겠습니까?')) return;
        setDeletingId(projectId);
        try {
            await deleteProject(projectId);
            setMyProjects((prev) => prev.filter((p) => p.id !== projectId));
        } catch (err) {
            console.error('[HomePage] 프로젝트 삭제 실패:', err);
        } finally {
            setDeletingId(null);
        }
    };

    // 날짜 포맷 헬퍼
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const filteredTemplates =
        activeFilter === 'MOST POPULAR'
            ? templateCards
            : templateCards.filter((t) => t.genre === activeFilter);

    const handleNewProject = (title?: string) => {
        startNewProject(title || 'Untitled Project');
        navigate('/project/idea');
    };

    // Generate placeholder colors for template cards
    const getCardColor = (index: number) => {
        const colors = [
            'linear-gradient(135deg, #1a3a2e 0%, #0f2027 100%)',
            'linear-gradient(135deg, #2d1b3d 0%, #1a1a2e 100%)',
            'linear-gradient(135deg, #3a2518 0%, #1a0f0a 100%)',
            'linear-gradient(135deg, #0f2027 0%, #1a1a2e 100%)',
            'linear-gradient(135deg, #1e3a1e 0%, #0a1f0a 100%)',
            'linear-gradient(135deg, #3a1e3a 0%, #1a0a1a 100%)',
            'linear-gradient(135deg, #1e2a3a 0%, #0a1520 100%)',
            'linear-gradient(135deg, #3a2d1e 0%, #1f170a 100%)',
            'linear-gradient(135deg, #2e1e3a 0%, #150a20 100%)',
            'linear-gradient(135deg, #1a3a3a 0%, #0a2020 100%)',
            'linear-gradient(135deg, #3a3a1e 0%, #20200a 100%)',
            'linear-gradient(135deg, #2a1a3a 0%, #130a1f 100%)',
        ];
        return colors[index % colors.length];
    };

    return (
        <div className="page-container">
            <div className="page-content">
                {/* My Projects (로그인 시에만 표시) */}
                {!isGuest && user && (
                    <div className="my-projects">
                        <div className="my-projects__header">
                            <h2 className="my-projects__title">
                                <FolderOpen size={20} />
                                My Projects
                            </h2>
                        </div>

                        {projectsLoading ? (
                            <div className="my-projects__loading">
                                <Loader size={20} className="spin" />
                                <span>프로젝트 불러오는 중...</span>
                            </div>
                        ) : myProjects.length === 0 ? (
                            <div className="my-projects__empty">
                                아직 저장된 프로젝트가 없습니다. 새 프로젝트를 시작해보세요!
                            </div>
                        ) : (
                            <div className="my-projects__grid">
                                {myProjects.map((project) => (
                                    <div
                                        key={project.id}
                                        className="my-projects__card"
                                        onClick={() => handleOpenProject(project)}
                                    >
                                        <div className="my-projects__card-top">
                                            <span className="my-projects__card-style">{project.selected_style}</span>
                                            <span className={`my-projects__card-status my-projects__card-status--${project.status}`}>
                                                {project.status === 'in_progress' ? '진행중' : project.status === 'completed' ? '완료' : '초안'}
                                            </span>
                                        </div>
                                        <h3 className="my-projects__card-title">{project.title}</h3>
                                        <div className="my-projects__card-meta">
                                            <span>{project.aspect_ratio}</span>
                                            <span>{formatDate(project.updated_at)}</span>
                                        </div>
                                        <button
                                            className="my-projects__card-delete"
                                            title="프로젝트 삭제"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteProject(project.id);
                                            }}
                                            disabled={deletingId === project.id}
                                        >
                                            {deletingId === project.id ? <Loader size={14} className="spin" /> : <Trash2 size={14} />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Hero */}
                <div className="home-hero">
                    <h1 className="home-hero__title">
                        What story will you tell today?
                    </h1>
                </div>

                {/* Filter Tabs */}
                <div className="filter-tabs">
                    {genreFilters.map((filter) => (
                        <button
                            key={filter}
                            className={`filter-tab ${activeFilter === filter ? 'active' : ''}`}
                            onClick={() => setActiveFilter(filter)}
                        >
                            {filter}
                        </button>
                    ))}
                </div>

                {/* Hero Cards */}
                <div className="hero-cards">
                    {heroTemplates.map((template) => (
                        <div
                            key={template.id}
                            className="hero-card"
                            onClick={() => handleNewProject(template.title)}
                        >
                            <div
                                className="hero-card__bg"
                                style={{
                                    backgroundImage: template.imageUrl ? `url(${template.imageUrl})` : 'none',
                                    background: template.imageUrl ? undefined : template.gradient,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }}
                            />
                            <div className="hero-card__content">
                                <h3 className="hero-card__title">{template.title}</h3>
                                <p className="hero-card__desc">{template.description}</p>
                                <button className="btn-primary">
                                    Generate <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Generate Options + Template Grid */}
                <div className="generate-section">
                    <h2 className="generate-section__title">Generate</h2>
                    <div className="home-main">
                        {/* Left: Generate Options */}
                        <div className="generate-options">
                            <div
                                className="generate-option"
                                onClick={() => handleNewProject()}
                            >
                                <div className="generate-option__icon">
                                    <Sparkles size={20} />
                                </div>
                                <div className="generate-option__text">
                                    <h4>Generate from idea or script</h4>
                                    <p>Create a new project from an idea or script</p>
                                </div>
                            </div>
                            <div
                                className="generate-option"
                                onClick={() => handleNewProject()}
                            >
                                <div className="generate-option__icon">
                                    <FileText size={20} />
                                </div>
                                <div className="generate-option__text">
                                    <h4>Blank project</h4>
                                    <p>Start with an empty project</p>
                                </div>
                            </div>
                            <div className="generate-option">
                                <div className="generate-option__icon">
                                    <Star size={20} />
                                </div>
                                <div className="generate-option__text">
                                    <h4>Create preset</h4>
                                    <p>Save your settings as a template</p>
                                </div>
                            </div>
                        </div>

                        {/* Right: Template Grid */}
                        <div className="template-grid">
                            {filteredTemplates.map((template, index) => (
                                <div
                                    key={template.id}
                                    className="template-card"
                                    onClick={() => handleNewProject(template.title)}
                                >
                                    {template.imageUrl ? (
                                        <img
                                            src={template.imageUrl}
                                            className="template-card__img"
                                            alt={template.title}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.background = getCardColor(index);
                                                (e.target as HTMLImageElement).src = ''; // Hide broken image icon
                                            }}
                                        />
                                    ) : (
                                        <div
                                            className="template-card__img"
                                            style={{ background: getCardColor(index) }}
                                        />
                                    )}
                                    <div className="template-card__overlay">
                                        <span className="template-card__title">{template.title}</span>
                                    </div>
                                    <div className="template-card__arrow">
                                        <ArrowRight size={12} color="#fff" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
