import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, Palette, Users, ArrowRight, Star, Trash2, FolderOpen, Loader, Check } from 'lucide-react';
import { templateCards, genreFilters, mockCardLibrary } from '../data/mockData';
import { getPublicPresets } from '../data/stylePresets';
import type { StylePreset } from '../data/stylePresets';
import { useProjectStore } from '../store/projectStore';
import type { ProjectMode } from '../store/projectStore';
import { useAuth } from '../hooks/useAuth';
import { listProjects, deleteProject, loadProject } from '../services/project-api';
import type { DbProject } from '../types/database';

const stylePresets = getPublicPresets();

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { user, isGuest } = useAuth();

    const {
        startNewProject, setEntryPoint, setSelectedPreset,
        setSelectedStyle, setAspectRatio,
        setProjectId, setTitle, setScenes, setCurrentPhase,
        cardLibrary, addToCardLibrary,
    } = useProjectStore();

    // 진입점 선택 상태 (null: 아무것도 선택 안 됨, 'style': 스타일 프리셋 그리드 표시)
    const [activeEntry, setActiveEntry] = useState<'script' | 'style' | 'cast' | null>(null);

    // 모드 선택 오버레이 표시 여부
    const [showModeSelect, setShowModeSelect] = useState(false);

    // My Projects 상태
    const [myProjects, setMyProjects] = useState<DbProject[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Template grid filter
    const [activeFilter, setActiveFilter] = useState('MOST POPULAR');

    // 선택된 템플릿 (모드 선택 오버레이에서 제목 반영용)
    const [pendingTemplate, setPendingTemplate] = useState<typeof templateCards[0] | null>(null);

    // 카드 라이브러리 초기 주입 (비어있는 경우에만)
    useEffect(() => {
        if (cardLibrary.length === 0) {
            mockCardLibrary.forEach((card) => addToCardLibrary(card));
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // 로그인 시 프로젝트 목록 로드
    useEffect(() => {
        if (isGuest || !user) return;
        setProjectsLoading(true);
        listProjects(user.id)
            .then(setMyProjects)
            .catch((err) => console.warn('[HomePage] 프로젝트 목록 로드 실패:', err))
            .finally(() => setProjectsLoading(false));
    }, [user, isGuest]);

    // [A] 대본부터 시작 → 모드 선택 오버레이 표시
    const handleScriptStart = () => {
        setPendingTemplate(null);
        setShowModeSelect(true);
    };

    // 템플릿 카드 클릭 → 템플릿 제목을 캡처하고 모드 선택 오버레이 표시
    const handleTemplateSelect = (template: typeof templateCards[0]) => {
        setPendingTemplate(template);
        setShowModeSelect(true);
    };

    const handleModeSelect = (mode: ProjectMode) => {
        startNewProject(
            pendingTemplate ? pendingTemplate.title : 'Untitled Project',
            mode
        );
        setEntryPoint('script');
        setSelectedPreset(null);
        setShowModeSelect(false);
        setPendingTemplate(null);
        navigate('/project/idea');
    };

    // [B] 스타일부터 시작 → 프리셋 그리드 토글
    const handleStyleStart = () => {
        setActiveEntry(activeEntry === 'style' ? null : 'style');
    };

    // 프리셋 선택 → IdeaPage로
    const handlePresetSelect = (preset: StylePreset) => {
        startNewProject(preset.name, preset.mode);
        setEntryPoint('style');
        setSelectedPreset(preset.id);
        setSelectedStyle(preset.style);
        setAspectRatio(preset.aspectRatio);
        navigate('/project/idea');
    };

    // [C] Cast부터 시작 → CastPage (프로젝트 모드)
    const handleCastStart = () => {
        navigate('/cast?mode=project');
    };

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
            setCurrentPhase(2);
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

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const filteredTemplates = activeFilter === 'MOST POPULAR'
        ? templateCards
        : templateCards.filter((t) => t.genre === activeFilter);

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

    // My Cast 미리보기 (최대 4장)
    const castPreview = cardLibrary.slice(0, 4);

    return (
        <div className="page-container">
            <div className="page-content">
                {/* Hero */}
                <div className="home-hero">
                    <h1 className="home-hero__title">What story will you tell today?</h1>
                </div>

                {/* ── 3가지 시작 방법 (메인 CTA) ── */}
                <div className="entry-cards">
                    {/* [A] 대본부터 */}
                    <div
                        className={`entry-card ${activeEntry === 'script' ? 'active' : ''}`}
                        onClick={handleScriptStart}
                    >
                        <div className="entry-card__icon">
                            <FileText size={28} />
                        </div>
                        <h3 className="entry-card__title">대본부터</h3>
                        <p className="entry-card__desc">아이디어나 대본으로 시작하기</p>
                        <div className="entry-card__arrow">
                            <ArrowRight size={16} />
                        </div>
                    </div>

                    {/* [B] 스타일부터 */}
                    <div
                        className={`entry-card ${activeEntry === 'style' ? 'active' : ''}`}
                        onClick={handleStyleStart}
                    >
                        <div className="entry-card__icon">
                            <Palette size={28} />
                        </div>
                        <h3 className="entry-card__title">스타일부터</h3>
                        <p className="entry-card__desc">영상 스타일 프리셋으로 시작하기</p>
                        <div className="entry-card__arrow">
                            <ArrowRight size={16} style={{ transform: activeEntry === 'style' ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                        </div>
                    </div>

                    {/* [C] Cast부터 */}
                    <div
                        className={`entry-card ${activeEntry === 'cast' ? 'active' : ''}`}
                        onClick={handleCastStart}
                    >
                        <div className="entry-card__icon">
                            <Users size={28} />
                        </div>
                        <h3 className="entry-card__title">Cast부터</h3>
                        <p className="entry-card__desc">배우·장소·소품 캐스팅부터 시작하기</p>
                        <div className="entry-card__arrow">
                            <ArrowRight size={16} />
                        </div>
                    </div>
                </div>

                {/* 모드 선택 오버레이 (대본부터 클릭 시 표시) */}
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

                {/* [B] 스타일 프리셋 그리드 (스타일부터 클릭 시 확장) */}
                {activeEntry === 'style' && (
                    <div className="preset-grid">
                        <h3 className="preset-grid__title">스타일 프리셋 선택</h3>
                        <div className="preset-grid__cards">
                            {stylePresets.map((preset) => (
                                <div
                                    key={preset.id}
                                    className="preset-grid-card"
                                    onClick={() => handlePresetSelect(preset)}
                                >
                                    {preset.thumbnail ? (
                                        <img src={preset.thumbnail} alt={preset.name} className="preset-grid-card__img" />
                                    ) : (
                                        <div className="preset-grid-card__img preset-grid-card__img--placeholder">
                                            <Star size={24} />
                                        </div>
                                    )}
                                    <div className="preset-grid-card__overlay">
                                        <span className="preset-grid-card__category">{preset.category}</span>
                                        <p className="preset-grid-card__name">{preset.name}</p>
                                        <div className="preset-grid-card__footer">
                                            <span className="preset-grid-card__ratio">{preset.aspectRatio}</span>
                                            <span className={`preset-grid-card__mode-badge preset-grid-card__mode-badge--${preset.mode}`}>
                                                {preset.mode === 'cinematic' ? '시네마틱' : '나레이션'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="preset-grid-card__select">
                                        <Check size={12} />
                                        선택
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* My Cast 미리보기 */}
                {castPreview.length > 0 && (
                    <div className="home-cast-preview">
                        <div className="home-cast-preview__header">
                            <h2 className="home-cast-preview__title">
                                <Users size={18} />
                                My Cast
                            </h2>
                            <Link to="/cast" className="home-cast-preview__more">
                                전체 보기 <ArrowRight size={12} />
                            </Link>
                        </div>
                        <div className="home-cast-preview__cards">
                            {castPreview.map((card) => (
                                <div key={card.id} className="home-cast-card">
                                    {card.imageUrl ? (
                                        <img src={card.imageUrl} alt={card.name} className="home-cast-card__img" />
                                    ) : (
                                        <div className="home-cast-card__img home-cast-card__img--placeholder">
                                            <Users size={20} />
                                        </div>
                                    )}
                                    <p className="home-cast-card__name">{card.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

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

                {/* 템플릿 그리드 */}
                <div className="generate-section">
                    <h2 className="generate-section__title">템플릿으로 시작하기</h2>
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
                    <div className="template-grid">
                        {filteredTemplates.map((template, index) => (
                            <div
                                key={template.id}
                                className="template-card"
                                onClick={() => handleTemplateSelect(template)}
                            >
                                {template.imageUrl ? (
                                    <img
                                        src={template.imageUrl}
                                        className="template-card__img"
                                        alt={template.title}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.background = getCardColor(index);
                                            (e.target as HTMLImageElement).src = '';
                                        }}
                                    />
                                ) : (
                                    <div className="template-card__img" style={{ background: getCardColor(index) }} />
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
    );
};

export default HomePage;
