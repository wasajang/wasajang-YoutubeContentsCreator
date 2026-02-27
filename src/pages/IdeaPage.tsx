import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Pencil, Wand2, Check, Minus, Plus, ArrowRight, RotateCcw, Loader,
    Hash, User, X, MapPin, Sword,
} from 'lucide-react';
import WorkflowSteps from '../components/WorkflowSteps';
import { useProjectStore } from '../store/projectStore';
import type { AssetType } from '../store/projectStore';
import { mockScript, generateMockScriptFromIdea, artStyles, mockCardLibrary } from '../data/mockData';

type IdeaTab = 'script' | 'style' | 'cast';
type InputMode = 'script' | 'idea';

// ── 텍스트를 N개 씬으로 균등 분할하는 함수 ──
function splitScriptIntoScenes(text: string, count: number) {
    const source = text.trim() || mockScript.join('\n\n');
    const paragraphs = source
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);

    if (paragraphs.length === 0) return [];

    const result: string[] = [];
    const total = paragraphs.length;
    const targetCount = Math.min(count, total);

    if (total >= targetCount) {
        const groupSize = total / targetCount;
        for (let i = 0; i < targetCount; i++) {
            const start = Math.round(i * groupSize);
            const end = Math.round((i + 1) * groupSize);
            result.push(paragraphs.slice(start, end).join(' '));
        }
    } else {
        result.push(...paragraphs);
        while (result.length < targetCount) {
            const longest = result.reduce((a, b) => (a.length > b.length ? a : b));
            const idx = result.indexOf(longest);
            const sentences = longest.match(/[^.!?]+[.!?]*/g) ?? [longest];
            if (sentences.length <= 1) break;
            const mid = Math.ceil(sentences.length / 2);
            result.splice(idx, 1, sentences.slice(0, mid).join(''), sentences.slice(mid).join(''));
        }
    }

    return result.slice(0, targetCount).map((text, i) => ({
        id: `scene-${i + 1}`,
        text: text.trim(),
        location: '',
        cameraAngle: '',
        imageUrl: '',
        characters: [] as string[],
        status: 'pending' as const,
        checked: false,
    }));
}

const IdeaPage: React.FC = () => {
    const navigate = useNavigate();
    const {
        title, setTitle, scenes, setScenes,
        aspectRatio, setAspectRatio, toggleSceneCheck,
        selectedStyle, setSelectedStyle,
        cardLibrary, addToCardLibrary, removeFromCardLibrary,
    } = useProjectStore();

    // ── 공통 상태 ──
    const [activeTab, setActiveTab] = useState<IdeaTab>('script');

    // ── Script 탭 상태 ──
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(title);
    const [inputMode, setInputMode] = useState<InputMode>('script');
    const [rawScript, setRawScript] = useState('');
    const [ideaText, setIdeaText] = useState('');
    const [sceneCount, setSceneCount] = useState(10);
    const [isGenerated, setIsGenerated] = useState(scenes.length > 0);
    const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const [isIdeaGenerating, setIsIdeaGenerating] = useState(false);

    // ── Cast 탭 상태 ──
    const [showModal, setShowModal] = useState(false);
    const [newCard, setNewCard] = useState({ name: '', description: '' });
    const [castTypeFilter, setCastTypeFilter] = useState<AssetType | 'all'>('all');
    const [newCardType, setNewCardType] = useState<AssetType>('character');

    // ── Cast 초기화 (cardLibrary가 비어있으면 mockCardLibrary로 채움) ──
    React.useEffect(() => {
        if (cardLibrary.length === 0) {
            mockCardLibrary.forEach((c) => addToCardLibrary(c));
        }
    }, []);

    // ── Script 핸들러 ──
    const handleTitleSave = () => {
        setTitle(editTitle);
        setIsEditing(false);
    };

    const handleGenerateScript = () => {
        const generated = splitScriptIntoScenes(rawScript, sceneCount);
        setScenes(generated);
        setIsGenerated(true);
    };

    const handleIdeaGenerate = () => {
        if (!ideaText.trim()) return;
        setIsIdeaGenerating(true);
        setTimeout(() => {
            const mockParagraphs = generateMockScriptFromIdea(ideaText, sceneCount);
            const fullScript = mockParagraphs.join('\n\n');
            const generated = splitScriptIntoScenes(fullScript, sceneCount);
            setScenes(generated);
            setIsIdeaGenerating(false);
            setIsGenerated(true);
        }, 2000);
    };

    const handleReset = () => {
        setIsGenerated(false);
        setScenes([]);
    };

    const handleEditScene = (id: string, text: string) => {
        setEditingSceneId(id);
        setEditingText(text);
    };

    const handleSaveEdit = () => {
        if (!editingSceneId) return;
        setScenes(scenes.map((s) => s.id === editingSceneId ? { ...s, text: editingText } : s));
        setEditingSceneId(null);
    };

    // ── Cast 핸들러 (AssetCard 생성) ──
    const handleAddCard = () => {
        if (!newCard.name.trim()) return;
        addToCardLibrary({
            id: `card-${Date.now()}`,
            name: newCard.name,
            type: newCardType,
            description: newCard.description,
            imageUrl: '',
            seed: Math.floor(Math.random() * 100000),
            status: 'pending',
            source: 'manual',
        });
        setNewCard({ name: '', description: '' });
        setNewCardType('character');
        setShowModal(false);
    };

    // ── 스타일 그라디언트 ──
    const getStyleGradient = (color: string) =>
        `linear-gradient(145deg, ${color} 0%, ${color}88 50%, ${color}44 100%)`;

    // ── 워크플로우 클릭 ──
    const handleWorkflowStepClick = (step: number) => {
        switch (step) {
            case 1: break; // 이미 여기
            case 2: navigate('/project/storyboard'); break;
            case 3: navigate('/project/storyboard'); break;
            case 4: navigate('/project/timeline'); break;
        }
    };

    const aspectOptions = [
        { ratio: '16:9' as const, label: '16:9 landscape', icon: '🖥️' },
        { ratio: '9:16' as const, label: '9:16 portrait', icon: '📱' },
        { ratio: '1:1' as const, label: '1:1 square', icon: '⬜' },
    ];

    return (
        <div className="page-container">
            {/* Phase Header */}
            <div className="phase-header">
                <div className="phase-header__left">
                    <div className="phase-header__title">
                        {isEditing ? (
                            <input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onBlur={handleTitleSave}
                                onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                                autoFocus
                                style={{
                                    background: 'var(--bg-input)',
                                    padding: '4px 10px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-accent)',
                                    fontSize: '1rem',
                                    color: 'var(--text-primary)',
                                    width: '300px',
                                }}
                            />
                        ) : (
                            <>
                                {title || 'Untitled Project'}
                                <button
                                    className="btn-icon"
                                    onClick={() => { setEditTitle(title); setIsEditing(true); }}
                                >
                                    <Pencil size={14} />
                                </button>
                            </>
                        )}
                    </div>
                    <WorkflowSteps currentStep={1} onStepClick={handleWorkflowStepClick} />
                </div>

                <div className="phase-tabs">
                    <button
                        className={`phase-tab ${activeTab === 'script' ? 'active' : ''}`}
                        onClick={() => setActiveTab('script')}
                    >
                        SCRIPT
                    </button>
                    <span className="phase-tab-separator">&gt;</span>
                    <button
                        className={`phase-tab ${activeTab === 'style' ? 'active' : ''}`}
                        onClick={() => setActiveTab('style')}
                    >
                        STYLE
                    </button>
                    <span className="phase-tab-separator">&gt;</span>
                    <button
                        className={`phase-tab ${activeTab === 'cast' ? 'active' : ''}`}
                        onClick={() => setActiveTab('cast')}
                    >
                        CAST
                    </button>
                </div>

                <div className="phase-header__right">
                    {aspectOptions.map((opt) => (
                        <button
                            key={opt.ratio}
                            className="aspect-ratio-btn"
                            onClick={() => setAspectRatio(opt.ratio)}
                            style={{
                                borderColor: aspectRatio === opt.ratio ? 'var(--accent-primary)' : undefined,
                            }}
                        >
                            <span>{opt.icon}</span>
                            <span>{opt.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ═══ SCRIPT 탭 ═══ */}
            {activeTab === 'script' && (
                <>
                    {!isGenerated ? (
                        <div className="script-input-area">
                            <div className="script-input-tabs">
                                <button
                                    className={`script-input-tab ${inputMode === 'idea' ? 'active' : ''}`}
                                    onClick={() => setInputMode('idea')}
                                >
                                    <Wand2 size={13} /> 아이디어 입력
                                </button>
                                <button
                                    className={`script-input-tab ${inputMode === 'script' ? 'active' : ''}`}
                                    onClick={() => setInputMode('script')}
                                >
                                    대본 직접 입력
                                </button>
                            </div>

                            {inputMode === 'script' ? (
                                <div className="script-input-body">
                                    <textarea
                                        className="script-textarea"
                                        placeholder={`대본을 여기에 붙여넣거나 직접 입력하세요.\n\n문단을 빈 줄로 구분하면 씬 분할 시 기준으로 사용됩니다.\n\n예시:\n첫 번째 씬 내용...\n\n두 번째 씬 내용...`}
                                        value={rawScript}
                                        onChange={(e) => setRawScript(e.target.value)}
                                    />
                                    <div className="script-input-footer">
                                        <div className="scene-count-picker">
                                            <button className="scene-count-btn" onClick={() => setSceneCount((n) => Math.max(1, n - 1))}>
                                                <Minus size={12} />
                                            </button>
                                            <span className="scene-count-value">{sceneCount} scenes</span>
                                            <button className="scene-count-btn" onClick={() => setSceneCount((n) => Math.min(30, n + 1))}>
                                                <Plus size={12} />
                                            </button>
                                        </div>
                                        <button className="btn-primary script-generate-btn" onClick={handleGenerateScript}>
                                            Generate Script <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="script-input-body">
                                    <textarea
                                        className="script-textarea script-textarea--idea"
                                        placeholder={`영상의 아이디어나 줄거리를 자유롭게 입력하세요.\n\n예시: "1950년대 한국전쟁 중 미래에서 온 현대 군대가 타임포털을 통해 나타나 전세를 바꾼다. K2 전차와 아파치 헬기가 등장하며 두 시대의 병사들이 연대한다."`}
                                        value={ideaText}
                                        onChange={(e) => setIdeaText(e.target.value)}
                                    />
                                    <div className="script-input-footer">
                                        <div className="scene-count-picker">
                                            <button className="scene-count-btn" onClick={() => setSceneCount((n) => Math.max(1, n - 1))}>
                                                <Minus size={12} />
                                            </button>
                                            <span className="scene-count-value">{sceneCount} scenes</span>
                                            <button className="scene-count-btn" onClick={() => setSceneCount((n) => Math.min(30, n + 1))}>
                                                <Plus size={12} />
                                            </button>
                                        </div>
                                        <button
                                            className="btn-primary script-generate-btn"
                                            onClick={handleIdeaGenerate}
                                            disabled={!ideaText.trim() || isIdeaGenerating}
                                        >
                                            {isIdeaGenerating ? (
                                                <><Loader size={14} className="animate-spin" /> 생성 중...</>
                                            ) : (
                                                <><Wand2 size={14} /> AI로 대본 생성</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="script-editor">
                            <div className="script-breakdown-header">
                                <h3 className="script-breakdown-title">Script Breakdown</h3>
                                <button className="btn-secondary script-reset-btn" onClick={handleReset}>
                                    <RotateCcw size={13} /> 다시 입력
                                </button>
                            </div>
                            {scenes.map((scene, i) => (
                                <div key={scene.id} className="script-editor__scene">
                                    <span className="script-scene-num">{String(i + 1).padStart(2, '0')}</span>
                                    {editingSceneId === scene.id ? (
                                        <textarea
                                            className="script-scene-edit"
                                            value={editingText}
                                            onChange={(e) => setEditingText(e.target.value)}
                                            onBlur={handleSaveEdit}
                                            onKeyDown={(e) => e.key === 'Escape' && setEditingSceneId(null)}
                                            autoFocus
                                        />
                                    ) : (
                                        <p className="script-editor__scene-text">{scene.text}</p>
                                    )}
                                    <div className="script-scene-actions">
                                        <button className="btn-icon" title="편집" onClick={() => handleEditScene(scene.id, scene.text)}>
                                            <Pencil size={13} />
                                        </button>
                                        <div
                                            className={`script-editor__scene-check ${scene.checked ? 'checked' : ''}`}
                                            onClick={() => toggleSceneCheck(scene.id)}
                                            title="씬 포함 여부"
                                        >
                                            <Check size={16} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* ═══ STYLE 탭 ═══ */}
            {activeTab === 'style' && (
                <div className="page-scrollable-content">
                    <div style={{ padding: '24px 40px 0' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
                            Choose a Style for Your Project
                        </h2>
                    </div>
                    <div className="style-grid">
                        {artStyles.map((style) => (
                            <div
                                key={style.id}
                                className={`style-card ${selectedStyle === style.name ? 'selected' : ''}`}
                                onClick={() => setSelectedStyle(style.name)}
                            >
                                {style.imageUrl ? (
                                    <img src={style.imageUrl} className="style-card__img" alt={style.name} />
                                ) : (
                                    <div
                                        className="style-card__img"
                                        style={{ background: getStyleGradient(style.color || '#333') }}
                                    />
                                )}
                                <span className="style-card__label">{style.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ CAST 탭 (카드 라이브러리) ═══ */}
            {activeTab === 'cast' && (
                <div className="page-scrollable-content">
                    <div className="cast-section">
                        <div className="cast-section__header">
                            <h2 className="cast-section__title">
                                카드 라이브러리
                                <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px' }}>
                                    ({cardLibrary.length}장)
                                </span>
                            </h2>
                            <button className="btn-primary" onClick={() => setShowModal(true)}>
                                <Plus size={14} /> 카드 추가
                            </button>
                        </div>

                        {/* 타입 필터 버튼 */}
                        <div className="cast-type-filter">
                            {([['all', '전체'], ['character', '캐릭터'], ['background', '배경'], ['item', '아이템']] as const).map(([val, label]) => (
                                <button
                                    key={val}
                                    className={`cast-type-filter__btn ${castTypeFilter === val ? 'active' : ''}`}
                                    onClick={() => setCastTypeFilter(val)}
                                >
                                    {label}
                                    <span className="cast-type-filter__count">
                                        {val === 'all' ? cardLibrary.length : cardLibrary.filter((c) => c.type === val).length}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="cast-grid">
                            {cardLibrary
                                .filter((card) => castTypeFilter === 'all' || card.type === castTypeFilter)
                                .map((card) => (
                                    <div key={card.id} className="cast-card">
                                        {/* 타입 뱃지 */}
                                        <span className={`cast-card__type-badge cast-card__type-badge--${card.type}`}>
                                            {card.type === 'character' ? '캐릭터' : card.type === 'background' ? '배경' : '아이템'}
                                        </span>
                                        {/* 삭제 버튼 */}
                                        <button
                                            className="cast-card__remove-btn"
                                            onClick={(e) => { e.stopPropagation(); removeFromCardLibrary(card.id); }}
                                            title="카드 삭제"
                                        >
                                            <X size={12} />
                                        </button>
                                        {card.imageUrl ? (
                                            <img src={card.imageUrl} className="cast-card__img" alt={card.name} />
                                        ) : (
                                            <div
                                                className="cast-card__img"
                                                style={{
                                                    background: `linear-gradient(180deg, hsl(${(card.seed % 360)}, 20%, 25%) 0%, hsl(${(card.seed % 360)}, 15%, 15%) 100%)`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'var(--text-muted)',
                                                }}
                                            >
                                                {card.type === 'character' ? <User size={40} /> :
                                                 card.type === 'background' ? <MapPin size={40} /> :
                                                 <Sword size={40} />}
                                            </div>
                                        )}
                                        <div className="cast-card__info">
                                            <div className="cast-card__name">{card.name}</div>
                                            <div className="cast-card__desc">{card.description}</div>
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                marginTop: '6px', fontSize: '0.625rem', color: 'var(--accent-primary)',
                                            }}>
                                                <Hash size={10} />
                                                Seed: {card.seed}
                                                {card.source && (
                                                    <span style={{ marginLeft: '6px', opacity: 0.6 }}>
                                                        · {card.source === 'ai' ? 'AI' : '수동'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            <div className="cast-add-card" onClick={() => setShowModal(true)}>
                                <Plus size={24} />
                                <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>카드 추가</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Navigation */}
            <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: '16px 40px',
                flexShrink: 0,
                borderTop: '1px solid var(--border-subtle)',
                background: 'var(--bg-secondary)',
            }}>
                <button className="btn-primary" onClick={() => navigate('/project/storyboard')}>
                    다음: 스토리보드 →
                </button>
            </div>

            {/* Add Card Modal */}
            {showModal && (
                <div className="modal-backdrop" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 className="modal__title">새 카드 추가</h3>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        {/* 타입 선택 */}
                        <div className="modal__field">
                            <label className="modal__label">카드 타입</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {([['character', '캐릭터', User], ['background', '배경', MapPin], ['item', '아이템', Sword]] as const).map(([type, label, Icon]) => (
                                    <button
                                        key={type}
                                        className={`cast-type-filter__btn ${newCardType === type ? 'active' : ''}`}
                                        onClick={() => setNewCardType(type)}
                                        style={{ flex: 1 }}
                                    >
                                        <Icon size={13} /> {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="modal__field">
                            <label className="modal__label">이름 (Name)</label>
                            <input
                                className="modal__input"
                                placeholder={newCardType === 'character' ? '예: 민수 (Minsoo)' : newCardType === 'background' ? '예: 전장의 폐허' : '예: K2 전차'}
                                value={newCard.name}
                                onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
                            />
                        </div>
                        <div className="modal__field">
                            <label className="modal__label">설명 (Description)</label>
                            <textarea
                                className="modal__textarea"
                                placeholder={newCardType === 'character' ? '예: A tattered olive drab winter military uniform, young Korean soldier...' : newCardType === 'background' ? '예: 눈 내리는 산악 지대, 포격으로 부서진 건물들...' : '예: 현대식 K2 흑표 전차, 위장 도색...'}
                                value={newCard.description}
                                onChange={(e) => setNewCard({ ...newCard, description: e.target.value })}
                            />
                        </div>
                        <div className="modal__actions">
                            <button className="btn-secondary" onClick={() => setShowModal(false)}>취소</button>
                            <button className="btn-primary" onClick={handleAddCard}>
                                <Plus size={14} /> 추가
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IdeaPage;
