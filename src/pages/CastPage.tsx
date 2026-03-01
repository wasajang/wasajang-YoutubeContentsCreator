import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Plus, X, Loader, Sparkles, Check, Trash2, Star } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import type { AssetCard, AssetType } from '../store/projectStore';
import { mockCardLibrary } from '../data/mockData';
import { getPublicTemplates } from '../data/templates';
import type { Template } from '../data/templates';
import { generateImage } from '../services/ai-image';
import { useCredits } from '../hooks/useCredits';

type CardTypeFilter = 'all' | AssetType;

const TYPE_LABELS: Record<AssetType, string> = {
    character: '배우',
    background: '촬영 장소',
    item: '소품/아이템',
};

const CastPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // ?mode=project 쿼리 파라미터로 프로젝트 시작 모드 구분
    const isProjectMode = searchParams.get('mode') === 'project';

    const {
        cardLibrary, addToCardLibrary, removeFromCardLibrary,
        selectedDeck, setSelectedDeck, setEntryPoint, startNewProject,
        setTemplateId, setArtStyleId, setAspectRatio,
    } = useProjectStore();
    const { canAfford, spend, CREDIT_COSTS } = useCredits();

    // 최초 진입 시 mockCardLibrary 주입 (빈 경우에만)
    useEffect(() => {
        if (cardLibrary.length === 0) {
            mockCardLibrary.forEach((card) => addToCardLibrary(card));
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const [typeFilter, setTypeFilter] = useState<CardTypeFilter>('all');
    const [showGenPanel, setShowGenPanel] = useState(false);

    // AI 생성 폼 상태
    // 스타일 선택 오버레이 상태
    const [showStyleSelect, setShowStyleSelect] = useState(false);
    const allPresets = getPublicTemplates();

    const [genType, setGenType] = useState<AssetType>('character');
    const [genName, setGenName] = useState('');
    const [genPrompt, setGenPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [genError, setGenError] = useState<string | null>(null);

    const filteredCards = typeFilter === 'all'
        ? cardLibrary
        : cardLibrary.filter((c) => c.type === typeFilter);

    const isSelected = (id: string) => selectedDeck.includes(id);

    const toggleSelect = (card: AssetCard) => {
        if (isSelected(card.id)) {
            setSelectedDeck(selectedDeck.filter((id) => id !== card.id));
        } else {
            if (selectedDeck.length >= 5) return; // 최대 5장
            setSelectedDeck([...selectedDeck, card.id]);
        }
    };

    const handleDeleteCard = (e: React.MouseEvent, cardId: string) => {
        e.stopPropagation();
        removeFromCardLibrary(cardId);
        if (isSelected(cardId)) {
            setSelectedDeck(selectedDeck.filter((id) => id !== cardId));
        }
    };

    const handleGenerate = async () => {
        if (!genName.trim() || !genPrompt.trim()) {
            setGenError('이름과 프롬프트를 입력해주세요.');
            return;
        }
        if (!canAfford('image')) {
            setGenError('크레딧이 부족합니다.');
            return;
        }
        setIsGenerating(true);
        setGenError(null);
        try {
            spend('image');
            const result = await generateImage({ prompt: genPrompt });
            const newCard: AssetCard = {
                id: `gen-${Date.now()}`,
                name: genName.trim(),
                type: genType,
                description: genPrompt.trim(),
                imageUrl: result.imageUrl,
                seed: result.seed,
                status: 'done',
                source: 'ai',
            };
            addToCardLibrary(newCard);
            setGenName('');
            setGenPrompt('');
            setShowGenPanel(false);
        } catch (err) {
            setGenError('이미지 생성에 실패했습니다. 다시 시도해주세요.');
            console.error('[CastPage] generateImage 실패:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    // 카드 선택 완료 → 스타일 선택 오버레이 표시
    const handleStartProject = () => {
        setShowStyleSelect(true);
    };

    // 스타일 프리셋 선택 → 프로젝트 시작 & IdeaPage로 이동 (keepDeck으로 선택 카드 유지)
    const handlePresetSelect = (preset: Template) => {
        startNewProject(preset.name, preset.mode, { keepDeck: true });
        setEntryPoint('cast');
        setTemplateId(preset.id);
        setArtStyleId(preset.artStyleId);
        setAspectRatio(preset.aspectRatio);
        setShowStyleSelect(false);
        navigate('/project/idea');
    };

    return (
        <div className="page-container">
            <div className="page-content">
                {/* 헤더 */}
                <div className="cast-header">
                    <div className="cast-header__title-row">
                        <Users size={22} />
                        <h1 className="cast-header__title">나의 Cast</h1>
                        {isProjectMode && (
                            <span className="cast-header__mode-badge">프로젝트 시작 모드</span>
                        )}
                    </div>
                    <p className="cast-header__desc">
                        배우, 촬영 장소, 소품 카드를 관리하고 AI로 새로운 캐스트를 생성하세요.
                        {isProjectMode && ' 최대 5장을 선택하여 프로젝트를 시작하세요.'}
                    </p>
                </div>

                {/* 타입 필터 */}
                <div className="cast-filter-tabs">
                    {(['all', 'character', 'background', 'item'] as CardTypeFilter[]).map((type) => (
                        <button
                            key={type}
                            className={`cast-filter-tab ${typeFilter === type ? 'active' : ''}`}
                            onClick={() => setTypeFilter(type)}
                        >
                            {type === 'all' ? '전체' : TYPE_LABELS[type as AssetType]}
                        </button>
                    ))}
                    <div className="cast-filter-tabs__spacer" />
                    {isProjectMode && (
                        <span className="cast-deck-count">
                            선택됨: <strong>{selectedDeck.length}</strong>/5
                        </span>
                    )}
                </div>

                {/* 카드 그리드 */}
                <div className="cast-card-grid">
                    {filteredCards.length === 0 ? (
                        <div className="cast-empty">
                            카드가 없습니다. AI로 새 캐스트를 생성해보세요.
                        </div>
                    ) : (
                        filteredCards.map((card) => {
                            const selected = isSelected(card.id);
                            const maxReached = !selected && selectedDeck.length >= 5;
                            return (
                                <div
                                    key={card.id}
                                    className={`cast-card ${selected ? 'selected' : ''} ${maxReached ? 'disabled' : ''}`}
                                    onClick={() => isProjectMode && !maxReached && toggleSelect(card)}
                                >
                                    {/* 카드 이미지 */}
                                    <div className="cast-card__img-wrap">
                                        {card.imageUrl ? (
                                            <img src={card.imageUrl} alt={card.name} className="cast-card__img" />
                                        ) : (
                                            <div className="cast-card__img cast-card__img--placeholder">
                                                <Users size={28} />
                                            </div>
                                        )}
                                        {/* 선택 체크 (프로젝트 모드) */}
                                        {isProjectMode && selected && (
                                            <div className="cast-card__check">
                                                <Check size={14} />
                                            </div>
                                        )}
                                        {/* 삭제 버튼 */}
                                        <button
                                            className="cast-card__delete"
                                            onClick={(e) => handleDeleteCard(e, card.id)}
                                            title="카드 삭제"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                    {/* 카드 정보 */}
                                    <div className="cast-card__info">
                                        <span className="cast-card__type-badge">
                                            {TYPE_LABELS[card.type]}
                                        </span>
                                        <p className="cast-card__name">{card.name}</p>
                                        {card.source === 'ai' && (
                                            <span className="cast-card__ai-badge">AI</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* AI 생성 패널 토글 버튼 */}
                <button
                    className={`cast-gen-toggle btn-secondary ${showGenPanel ? 'active' : ''}`}
                    onClick={() => setShowGenPanel((v) => !v)}
                >
                    {showGenPanel ? <X size={14} /> : <Plus size={14} />}
                    {showGenPanel ? '닫기' : 'AI로 새 카드 생성'}
                </button>

                {/* AI 생성 패널 */}
                {showGenPanel && (
                    <div className="cast-gen-panel">
                        <h3 className="cast-gen-panel__title">
                            <Sparkles size={16} />
                            AI 카드 생성
                        </h3>

                        {/* 타입 선택 */}
                        <div className="cast-gen-row">
                            <label className="cast-gen-label">타입</label>
                            <div className="cast-gen-type-btns">
                                {(['character', 'background', 'item'] as AssetType[]).map((t) => (
                                    <button
                                        key={t}
                                        className={`cast-gen-type-btn ${genType === t ? 'active' : ''}`}
                                        onClick={() => setGenType(t)}
                                    >
                                        {TYPE_LABELS[t]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 이름 */}
                        <div className="cast-gen-row">
                            <label className="cast-gen-label">이름</label>
                            <input
                                type="text"
                                className="cast-gen-input"
                                placeholder="캐릭터/장소/소품 이름"
                                value={genName}
                                onChange={(e) => setGenName(e.target.value)}
                            />
                        </div>

                        {/* 프롬프트 */}
                        <div className="cast-gen-row">
                            <label className="cast-gen-label">프롬프트</label>
                            <textarea
                                className="cast-gen-textarea"
                                placeholder={genType === 'character'
                                    ? '예: A determined young soldier, 1950s Korean military uniform...'
                                    : genType === 'background'
                                    ? '예: Frozen Yalu River battlefield, snow-covered trenches...'
                                    : '예: Ancient sword with glowing blue runes...'}
                                value={genPrompt}
                                onChange={(e) => setGenPrompt(e.target.value)}
                                rows={3}
                            />
                        </div>

                        {genError && (
                            <p className="cast-gen-error">{genError}</p>
                        )}

                        <button
                            className="btn-primary"
                            onClick={handleGenerate}
                            disabled={isGenerating}
                        >
                            {isGenerating ? (
                                <>
                                    <Loader size={14} className="spin" />
                                    생성 중...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={14} />
                                    생성하기 (이미지 {CREDIT_COSTS.image}크레딧)
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* 프로젝트 시작 버튼 (프로젝트 모드) */}
                {isProjectMode && (
                    <div className="cast-start-bar">
                        <button
                            className="btn-secondary"
                            onClick={() => navigate('/')}
                        >
                            취소
                        </button>
                        <button
                            className="btn-primary"
                            onClick={handleStartProject}
                            disabled={selectedDeck.length === 0}
                        >
                            <Check size={14} />
                            {selectedDeck.length === 0
                                ? '카드를 선택하세요'
                                : `${selectedDeck.length}장 선택 → 스타일 선택하기`}
                        </button>
                    </div>
                )}

                {/* 스타일 선택 오버레이 */}
                {showStyleSelect && (
                    <div className="mode-select-overlay" onClick={() => setShowStyleSelect(false)}>
                        <div className="cast-style-select" onClick={(e) => e.stopPropagation()}>
                            <h3 className="cast-style-select__title">영상 스타일을 선택하세요</h3>
                            <p className="cast-style-select__desc">
                                선택한 {selectedDeck.length}장의 카드로 프로젝트를 시작합니다.
                            </p>
                            <div className="cast-style-select__grid">
                                {allPresets.map((preset) => (
                                    <div
                                        key={preset.id}
                                        className="cast-style-select__card"
                                        onClick={() => handlePresetSelect(preset)}
                                    >
                                        {preset.thumbnail ? (
                                            <img src={preset.thumbnail} alt={preset.name} className="cast-style-select__img" />
                                        ) : (
                                            <div className="cast-style-select__img cast-style-select__img--placeholder">
                                                <Star size={24} />
                                            </div>
                                        )}
                                        <div className="cast-style-select__info">
                                            <span className="cast-style-select__name">{preset.name}</span>
                                            <span className={`cast-style-select__mode-badge cast-style-select__mode-badge--${preset.mode}`}>
                                                {preset.mode === 'cinematic' ? '시네마틱' : '나레이션'}
                                            </span>
                                        </div>
                                        <p className="cast-style-select__desc-text">{preset.description}</p>
                                    </div>
                                ))}
                            </div>
                            <button
                                className="btn-secondary cast-style-select__cancel"
                                onClick={() => setShowStyleSelect(false)}
                            >
                                돌아가기
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CastPage;
