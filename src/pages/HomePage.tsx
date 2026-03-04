import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, Users, ArrowRight, Trash2, FolderOpen, Loader } from 'lucide-react';
import { mockCardLibrary } from '../data/mockData';
import { getPublicTemplates } from '../data/templates';
import type { Template } from '../data/templates';
import { useProjectStore } from '../store/projectStore';
import type { ProjectMode } from '../store/projectStore';
import { useAuth } from '../hooks/useAuth';
import { listProjects, deleteProject, loadProject } from '../services/project-api';
import type { DbProject } from '../types/database';

const templateList = getPublicTemplates();

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { user, isGuest } = useAuth();

    const {
        startNewProject, setEntryPoint, setTemplateId,
        setArtStyleId, setAspectRatio, setAiModelPreference,
        setProjectId, setTitle, setScenes, setCurrentPhase,
        cardLibrary, addToCardLibrary,
    } = useProjectStore();

    // 모드 선택 오버레이 표시 여부
    const [showModeSelect, setShowModeSelect] = useState(false);

    // My Projects 상태
    const [myProjects, setMyProjects] = useState<DbProject[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // 선택된 템플릿 (모드 선택 오버레이에서 제목 반영용)
    const [pendingTemplate, setPendingTemplate] = useState<Template | null>(null);

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

    const handleModeSelect = (mode: ProjectMode) => {
        startNewProject(
            pendingTemplate ? pendingTemplate.name : 'Untitled Project',
            mode
        );
        setEntryPoint('script');
        setTemplateId(null);
        setShowModeSelect(false);
        setPendingTemplate(null);
        navigate('/project/idea');
    };

    // 프로젝트 열기
    const handleOpenProject = async (project: DbProject) => {
        try {
            const result = await loadProject(project.id);
            if (!result) return;
            setProjectId(result.project.id);
            setTitle(result.project.title);
            setArtStyleId(result.project.selected_style ?? 'cinematic');
            setAspectRatio(result.project.aspect_ratio);
            setScenes(result.scenes);
            setCurrentPhase(2);
            navigate('/project/idea');
        } catch (err) {
            console.error('[HomePage] 프로젝트 열기 실패:', err);
        }
    };

    // 프로젝트 삭제 — confirm 모달 표시
    const handleDeleteProject = (projectId: string) => {
        setDeleteConfirmId(projectId);
    };

    // 삭제 확인 후 실제 삭제 실행
    const handleDeleteConfirm = async () => {
        if (!deleteConfirmId) return;
        const projectId = deleteConfirmId;
        setDeleteConfirmId(null);
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

    // 템플릿 카드 클릭 → 바로 프로젝트 시작 (모드는 템플릿에 포함)
    const handleTemplateCardSelect = (template: Template) => {
        startNewProject(template.name, template.mode);
        setEntryPoint('style');
        setTemplateId(template.id);
        setArtStyleId(template.artStyleId);
        setAspectRatio(template.aspectRatio);
        if (template.defaultModels) {
            Object.entries(template.defaultModels).forEach(([category, modelId]) => {
                setAiModelPreference(category as 'script' | 'image' | 'video' | 'tts', modelId);
            });
        }
        navigate('/project/idea');
    };

    // My Cast 미리보기 (최대 4장)
    const castPreview = cardLibrary.slice(0, 4);

    return (
        <>
        <div className="page-container">
            <div className="page-content">
                {/* Hero */}
                <div className="home-hero">
                    <h1 className="home-hero__title">What story will you tell today?</h1>
                </div>

                {/* 메인 CTA: 대본 작성으로 시작하기 */}
                <div className="home-cta">
                    <button className="home-cta__btn" onClick={handleScriptStart}>
                        <FileText size={22} />
                        대본 작성으로 시작하기
                        <ArrowRight size={16} />
                    </button>
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
                                    <p>영상 중심 — 씬별 이미지/영상을 먼저 만들고, 나레이션은 나중에</p>
                                    <ul className="mode-select__details">
                                        <li>예: 영화 예고편, 다큐멘터리, 뮤직비디오</li>
                                        <li>대본 → 스토리보드 → AI 이미지/영상 생성 → 편집</li>
                                    </ul>
                                </div>
                                <div className="mode-select__option" onClick={() => handleModeSelect('narration')}>
                                    <div className="mode-select__icon">🎙️</div>
                                    <h4>나레이션</h4>
                                    <p>음성 중심 — TTS 음성을 먼저 만들고, 자막과 영상을 동기화</p>
                                    <ul className="mode-select__details">
                                        <li>예: 해설 영상, 교육 콘텐츠, 뉴스 리포트</li>
                                        <li>대본 → TTS 음성 → 자막 편집 → 이미지/영상 배치</li>
                                    </ul>
                                </div>
                            </div>
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

                {/* 템플릿 그리드 (5개 공식 템플릿) */}
                <div className="generate-section">
                    <h2 className="generate-section__title">템플릿으로 시작하기</h2>
                    <div className="template-grid">
                        {templateList.map((template) => (
                            <div
                                key={template.id}
                                className="template-card"
                                onClick={() => handleTemplateCardSelect(template)}
                            >
                                {template.thumbnail ? (
                                    <img
                                        src={template.thumbnail}
                                        className="template-card__img"
                                        alt={template.name}
                                    />
                                ) : (
                                    <div className="template-card__img" style={{ background: 'linear-gradient(135deg, #1a3a2e 0%, #0f2027 100%)' }} />
                                )}
                                <div className="template-card__overlay">
                                    <span className="template-card__title">{template.name}</span>
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                        <span className="preset-grid-card__ratio" style={{ fontSize: '0.65rem' }}>{template.aspectRatio}</span>
                                        <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>
                                            {template.mode === 'cinematic' ? '시네마틱' : '나레이션'}
                                        </span>
                                    </div>
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

        {/* 프로젝트 삭제 확인 모달 */}
        {deleteConfirmId && (
            <div
                className="preset-confirm-overlay"
                onClick={() => setDeleteConfirmId(null)}
            >
                <div
                    className="preset-confirm-modal"
                    onClick={(e) => e.stopPropagation()}
                >
                    <h3 className="preset-confirm-modal__title">프로젝트 삭제</h3>
                    <p className="preset-confirm-modal__desc">
                        이 프로젝트를 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.
                    </p>
                    <div className="preset-confirm-modal__actions">
                        <button
                            className="btn-secondary"
                            onClick={() => setDeleteConfirmId(null)}
                        >
                            취소
                        </button>
                        <button
                            className="btn-primary"
                            style={{ background: 'var(--color-danger, #ef4444)' }}
                            onClick={handleDeleteConfirm}
                        >
                            <Trash2 size={14} /> 삭제
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default HomePage;
