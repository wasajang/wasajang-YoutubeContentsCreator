import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Trash2, Pencil, RefreshCw, Check, Plus, HelpCircle,
    User, Film, Play, ChevronLeft, Zap, Hash,
    ArrowRight, Loader, Video, CheckCircle2, MapPin, Sparkles,
    X, Star, Sword, Shield, ChevronRight,
} from 'lucide-react';
import WorkflowSteps from '../components/WorkflowSteps';
import { useProjectStore } from '../store/projectStore';
import type { AssetCard, AssetType } from '../store/projectStore';
import { mockStoryboardScenes, mockScript, mockScenePrompts, stylePromptPrefix, aiSuggestedCards, favoritesPool } from '../data/mockData';

type StoryboardPhase = 'script-review' | 'cast-setup' | 'seed-check' | 'generating-video' | 'complete';
type SceneGenStatus = 'idle' | 'generating' | 'done';

// ── 덱 제한 상수 ──
const MAX_AI_SLOTS = 5;
const MAX_MANUAL_SLOTS = 3;
const MAX_DECK_SIZE = 8;

// ── AI_SUGGESTED, FAV_POOL → mockData로 이동됨 (aiSuggestedCards, favoritesPool) ──

const StoryboardPage: React.FC = () => {
    const navigate = useNavigate();
    const { selectedStyle, scenes: storeScenes, cardLibrary, addToCardLibrary } = useProjectStore();
    const [phase, setPhase] = useState<StoryboardPhase>('cast-setup');
    const [selectedScene, setSelectedScene] = useState<string | null>(null);

    // ── 씬별 영상 생성 상태 ──
    const [videoGenStatus, setVideoGenStatus] = useState<Record<string, SceneGenStatus>>({});

    // ── AI 분석 팝업 ──
    const [showAiAnalysisModal, setShowAiAnalysisModal] = useState(true);
    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

    // ScriptPage에서 씬을 생성했으면 그것을 사용, 없으면 목업 폴백
    const scenes = storeScenes.length > 0 ? storeScenes : mockStoryboardScenes;
    const scriptCuts = storeScenes.length > 0
        ? storeScenes.map((s) => s.text)
        : mockScript;

    const [sceneGenStatus, setSceneGenStatus] = useState<Record<string, SceneGenStatus>>(() => {
        const init: Record<string, SceneGenStatus> = {};
        scenes.forEach((s) => { init[s.id] = 'idle'; });
        return init;
    });

    // ── 씬별 영상 개수 (1~3) ──
    const [videoCountPerScene, setVideoCountPerScene] = useState<Record<string, number>>(() => {
        const init: Record<string, number> = {};
        scenes.forEach((s) => { init[s.id] = 1; });
        return init;
    });

    // ── Deck (AI 5장 + 수동 최대 3장 = 최대 8장) ──
    const [deck, setDeck] = useState<AssetCard[]>([]);
    const [poolTab, setPoolTab] = useState<'library' | 'ai' | 'favorites' | 'new'>('library');
    const [poolFilter, setPoolFilter] = useState<AssetType | 'all'>('all');

    // New card form state (cast-setup에서 사용)
    const [addType, setAddType] = useState<AssetType>('character');
    const [newCard, setNewCard] = useState({ name: '', description: '' });

    // Inline new card in pool
    const [showInlineNew, setShowInlineNew] = useState(false);

    // ── 수동 추가 모달 (seed-check 상단 바 "+" 슬롯용) ──
    const [showManualAddModal, setShowManualAddModal] = useState(false);
    const [manualAddType, setManualAddType] = useState<AssetType>('character');
    const [manualAddCard, setManualAddCard] = useState({ name: '', description: '' });

    // ── Per-scene seed assignments ──
    // Maps scene.id → set of deck card IDs selected for that scene
    // Step 6: 빈 배열로 초기화 (AI 분석 후 자동 할당)
    const [sceneSeeds, setSceneSeeds] = useState<Record<string, string[]>>(() => {
        const init: Record<string, string[]> = {};
        scenes.forEach((scene) => { init[scene.id] = []; });
        return init;
    });

    const toggleSceneSeed = (sceneId: string, cardId: string) => {
        setSceneSeeds((prev) => {
            const current = prev[sceneId] || [];
            const has = current.includes(cardId);
            return { ...prev, [sceneId]: has ? current.filter(id => id !== cardId) : [...current, cardId] };
        });
    };

    // ── 덱 필터 계산 ──
    const deckChars = deck.filter((c) => c.type === 'character');
    const deckBgs = deck.filter((c) => c.type === 'background');
    const deckItems = deck.filter((c) => c.type === 'item');
    const aiCards = deck.filter((c) => c.source === 'ai');
    const manualCards = deck.filter((c) => c.source === 'manual');
    const manualSlotsRemaining = MAX_MANUAL_SLOTS - manualCards.length;
    const isDeckSelected = (id: string) => deck.some((c) => c.id === id);

    // ── 덱 추가 (제한 가드 포함) ──
    const addToDeck = (card: AssetCard) => {
        if (isDeckSelected(card.id)) return;
        if (deck.length >= MAX_DECK_SIZE) return;
        const source = card.source || 'ai';
        if (source === 'ai' && aiCards.length >= MAX_AI_SLOTS) return;
        if (source === 'manual' && manualCards.length >= MAX_MANUAL_SLOTS) return;
        const cardWithSource = { ...card, source };
        setDeck((p) => [...p, cardWithSource]);
        addToCardLibrary(cardWithSource);
    };

    const removeFromDeck = (id: string) => setDeck((p) => p.filter((c) => c.id !== id));

    // ── 수동 카드 추가 (상단 바 "+" 슬롯에서 호출) ──
    const handleManualAddCard = () => {
        if (!manualAddCard.name.trim()) return;
        if (manualCards.length >= MAX_MANUAL_SLOTS) return;
        const card: AssetCard = {
            id: `manual-${Date.now()}`,
            name: manualAddCard.name,
            type: manualAddType,
            description: manualAddCard.description,
            imageUrl: '',
            seed: Math.floor(Math.random() * 99999),
            status: 'pending',
            source: 'manual',
        };
        setDeck((p) => [...p, card]);
        addToCardLibrary(card);
        setManualAddCard({ name: '', description: '' });
        setShowManualAddModal(false);
    };

    // ── cast-setup 풀에서 덱에 추가하는 핸들러 ──
    const handleAddCard = () => {
        const card: AssetCard = {
            id: `new-${Date.now()}`, name: newCard.name, type: addType,
            description: newCard.description, imageUrl: '', seed: Math.floor(Math.random() * 99999),
            status: 'pending', source: 'ai',
        };
        setDeck((p) => [...p, card]);
        addToCardLibrary(card);
        setNewCard({ name: '', description: '' });
        setShowInlineNew(false);
    };

    const handleGenerateAsset = (id: string) => {
        setDeck((p) => p.map((c) => c.id === id ? { ...c, status: 'generating' as const } : c));
        setTimeout(() => {
            setDeck((p) => p.map((c) => c.id === id ? { ...c, status: 'done' as const, imageUrl: c.imageUrl || `https://images.unsplash.com/photo-1534030347209-467a5b0ad3e6?auto=format&fit=crop&w=400&q=80&sig=${id}` } : c));
        }, 2000);
    };

    // ── AI 분석 핸들러 (정확히 5장: 캐릭터3 + 배경1 + 아이템1) ──
    const handleAiAnalysis = (doAnalysis: boolean) => {
        if (!doAnalysis) {
            // AI 분석 건너뛰기 → 기본 AI 카드 5장 로드
            const defaultDeck = aiSuggestedCards.slice(0, MAX_AI_SLOTS).map(c => ({ ...c, source: 'ai' as const }));
            setDeck(defaultDeck);
            defaultDeck.forEach(c => addToCardLibrary(c));
            // 모든 씬에 5장 기본 할당
            setSceneSeeds((prev) => {
                const updated = { ...prev };
                const allCardIds = defaultDeck.map(c => c.id);
                scenes.forEach((s) => { updated[s.id] = [...allCardIds]; });
                return updated;
            });
            setShowAiAnalysisModal(false);
            return;
        }
        setIsAiAnalyzing(true);
        // Mock: 2.5초 딜레이 후 대본 분석으로 5장 선택
        setTimeout(() => {
            // 1) cardLibrary에서 기존 카드 매칭 시도
            const libChars = cardLibrary.filter(c => c.type === 'character');
            const libBgs = cardLibrary.filter(c => c.type === 'background');
            const libItems = cardLibrary.filter(c => c.type === 'item');

            // 2) 매칭된 카드로 우선 채움
            const selectedChars: AssetCard[] = libChars.slice(0, 3).map(c => ({ ...c, source: 'ai' as const, isRequired: true }));
            const selectedBgs: AssetCard[] = libBgs.slice(0, 1).map(c => ({ ...c, source: 'ai' as const, isRequired: true }));
            const selectedItems: AssetCard[] = libItems.slice(0, 1).map(c => ({ ...c, source: 'ai' as const, isRequired: true }));

            // 3) 부족한 슬롯은 aiSuggestedCards에서 보충
            const aiChars = aiSuggestedCards.filter(c => c.type === 'character');
            const aiBgs = aiSuggestedCards.filter(c => c.type === 'background');
            const aiItems = aiSuggestedCards.filter(c => c.type === 'item');

            while (selectedChars.length < 3 && aiChars.length > 0) {
                const next = aiChars.shift()!;
                if (!selectedChars.some(c => c.id === next.id)) {
                    selectedChars.push({ ...next, source: 'ai', isRequired: true });
                }
            }
            while (selectedBgs.length < 1 && aiBgs.length > 0) {
                const next = aiBgs.shift()!;
                if (!selectedBgs.some(c => c.id === next.id)) {
                    selectedBgs.push({ ...next, source: 'ai', isRequired: true });
                }
            }
            while (selectedItems.length < 1 && aiItems.length > 0) {
                const next = aiItems.shift()!;
                if (!selectedItems.some(c => c.id === next.id)) {
                    selectedItems.push({ ...next, source: 'ai', isRequired: true });
                }
            }

            // 4) 정확히 5장 결과
            const finalDeck = [...selectedChars, ...selectedBgs, ...selectedItems];

            // 5) 새로 생성된 카드 → cardLibrary에 추가
            finalDeck.forEach(c => addToCardLibrary(c));

            // 6) 덱 설정
            setDeck(finalDeck);

            // 7) 모든 씬에 5장 기본 할당
            setSceneSeeds((prev) => {
                const updated = { ...prev };
                const allCardIds = finalDeck.map(c => c.id);
                scenes.forEach((s) => { updated[s.id] = [...allCardIds]; });
                return updated;
            });

            setIsAiAnalyzing(false);
            setShowAiAnalysisModal(false);
        }, 2500);
    };

    const doneSceneCount = Object.values(sceneGenStatus).filter((s) => s === 'done').length;
    const allImagesDone = doneSceneCount === scenes.length;

    const generateSingleScene = useCallback((sceneId: string) => {
        setSceneGenStatus((p) => ({ ...p, [sceneId]: 'generating' }));
        setTimeout(() => setSceneGenStatus((p) => ({ ...p, [sceneId]: 'done' })), 1500 + Math.random() * 1000);
    }, []);

    const generateAllScenes = useCallback(() => {
        scenes.filter((s) => sceneGenStatus[s.id] === 'idle').forEach((scene, i) => {
            setTimeout(() => {
                setSceneGenStatus((p) => ({ ...p, [scene.id]: 'generating' }));
                setTimeout(() => setSceneGenStatus((p) => ({ ...p, [scene.id]: 'done' })), 1500 + Math.random() * 500);
            }, i * 600);
        });
    }, [scenes, sceneGenStatus]);

    // ── 영상 인라인 생성 (phase 변경 없이) ──
    const generateAllVideos = useCallback(() => {
        scenes.forEach((scene, i) => {
            setTimeout(() => {
                setVideoGenStatus((p) => ({ ...p, [scene.id]: 'generating' }));
                setTimeout(() => {
                    setVideoGenStatus((p) => ({ ...p, [scene.id]: 'done' }));
                }, 1500 + Math.random() * 1000);
            }, i * 600);
        });
    }, [scenes]);

    const regenerateSingleVideo = useCallback((sceneId: string) => {
        setVideoGenStatus((p) => ({ ...p, [sceneId]: 'generating' }));
        setTimeout(() => setVideoGenStatus((p) => ({ ...p, [sceneId]: 'done' })), 1500 + Math.random() * 1000);
    }, []);

    const doneVideoCount = Object.values(videoGenStatus).filter((s) => s === 'done').length;
    const allVideosDone = doneVideoCount === scenes.length;

    const getSceneGradient = (i: number) => {
        const g = ['linear-gradient(135deg,#1a0533,#2d1b3d,#0f2027)', 'linear-gradient(135deg,#0f2027,#1a1a2e,#2d1b3d)', 'linear-gradient(135deg,#3a2518,#1a0f0a,#2d1b3d)', 'linear-gradient(135deg,#1e2a3a,#0a1520,#1a0533)', 'linear-gradient(135deg,#2d1b3d,#3a2518,#0f2027)', 'linear-gradient(135deg,#1a1a2e,#0f2027,#3a2518)'];
        return g[i % g.length];
    };

    const getPoolSections = (): Array<{ label: string; icon: 'sparkles' | 'star'; cards: AssetCard[] }> => {
        const filter = (cards: AssetCard[]) =>
            poolFilter === 'all' ? cards : cards.filter((c) => c.type === poolFilter);
        if (poolTab === 'library') {
            // 내 라이브러리 — cardLibrary 전체 (덱에 이미 있는 것도 표시, 선택 여부 표시)
            return [
                { label: '내 라이브러리', icon: 'star', cards: filter(cardLibrary) },
            ];
        }
        if (poolTab === 'ai') {
            // AI 추천 — 라이브러리에 없는 것만 표시
            const libIds = new Set(cardLibrary.map(c => c.id));
            return [
                { label: 'AI 추천', icon: 'sparkles', cards: filter(aiSuggestedCards.filter(c => !libIds.has(c.id))) },
            ];
        }
        if (poolTab === 'favorites') {
            // 즐겨찾기 — cardLibrary 중 isFavorite인 것 + favoritesPool에서 라이브러리에 없는 것
            const libFavs = cardLibrary.filter(c => c.isFavorite);
            const libIds = new Set(cardLibrary.map(c => c.id));
            const externalFavs = favoritesPool.filter(c => !libIds.has(c.id));
            return [
                { label: '즐겨찾기', icon: 'star', cards: filter([...libFavs, ...externalFavs]) },
            ];
        }
        // 'new' tab — form shown above grid; grid shows library
        return [
            { label: '내 라이브러리', icon: 'star', cards: filter(cardLibrary) },
        ];
    };

    const phaseConfig = [
        { key: 'cast-setup', label: '카드 선택', step: 2 },
        { key: 'script-review', label: '컷 분할', step: 2 },
        { key: 'seed-check', label: '시드 매칭 & 생성', step: 3 },
    ];
    const currentPhaseIndex = phaseConfig.findIndex((p) => p.key === phase);

    // 현재 phase에 따라 워크플로우 스텝 결정
    const workflowStep = (phase === 'seed-check' || phase === 'generating-video' || phase === 'complete') ? 3 : 2;

    const handleWorkflowStepClick = (step: number) => {
        switch (step) {
            case 1: navigate('/project/idea'); break;
            case 2: if (workflowStep !== 2) setPhase('cast-setup'); break;
            case 3: if (workflowStep !== 3) setPhase('seed-check'); break;
            case 4: navigate('/project/timeline'); break;
        }
    };

    // ── Helper: render deck card (compact) ──
    const renderDeckCard = (card: AssetCard) => (
        <div key={card.id} className={`deck-card ${card.type === 'background' ? 'deck-card--bg' : ''}`}>
            <div className={`deck-card__img-wrap ${card.type === 'background' ? 'deck-card__img-wrap--bg' : ''}`}>
                {card.imageUrl && card.status === 'done' ? (
                    <img src={card.imageUrl} className="deck-card__img" alt={card.name} />
                ) : card.status === 'generating' ? (
                    <div className="deck-card__img deck-card__img--gen"><Loader size={14} className="animate-spin" /></div>
                ) : (
                    <div className="deck-card__img deck-card__img--empty">
                        {card.type === 'character' ? <User size={16} /> : card.type === 'background' ? <MapPin size={16} /> : <Sword size={16} />}
                    </div>
                )}
                <button className="deck-card__remove" onClick={() => removeFromDeck(card.id)}><X size={8} /></button>
                {card.status !== 'done' && <button className="deck-card__gen" onClick={() => handleGenerateAsset(card.id)}><Sparkles size={8} /></button>}
            </div>
            <span className="deck-card__name">{card.name.split(' ')[0]}</span>
            <span className="deck-card__seed">#{card.seed}</span>
        </div>
    );

    return (
        <div className="page-container" style={{ minHeight: 0, height: 'calc(100vh - 56px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div className="storyboard-header">
                <h2 className="storyboard-header__title">강철의 북진</h2>
                <div className="storyboard-header__center">
                    <WorkflowSteps currentStep={workflowStep} onStepClick={handleWorkflowStepClick} />
                </div>
                <div className="storyboard-header__right">
                    <button className="export-btn">Export</button>
                    <button className="btn-icon"><HelpCircle size={16} /></button>
                </div>
            </div>

            {/* Phase Bar */}
            <div className="sb-phase-bar">
                {phaseConfig.map((p, i) => {
                    const isActive = phase === p.key;
                    const isDone = currentPhaseIndex > i;
                    return (
                        <React.Fragment key={p.key}>
                            {i > 0 && phaseConfig[i - 1].step !== p.step && (
                                <div className="sb-phase-step__group-divider" />
                            )}
                            <div
                                className={`sb-phase-step ${isActive ? 'sb-phase-step--active' : ''} ${isDone ? 'sb-phase-step--done' : ''}`}
                                onClick={() => setPhase(p.key as StoryboardPhase)}
                                style={{ cursor: 'pointer' }}
                            >
                                <span className="sb-phase-step__num">{isDone ? <Check size={10} /> : i + 1}</span>
                                <span className="sb-phase-step__label">{p.label}</span>
                                {i < phaseConfig.length - 1 && phaseConfig[i + 1].step === p.step && <div className="sb-phase-step__line" />}
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>

            {/* ===== PHASE 1: Script Review ===== */}
            {phase === 'script-review' && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div className="sb-phase-title"><span>1단계: 대본 컷 분할 확인</span><span className="sb-phase-title__progress">{scriptCuts.length}개 컷</span></div>
                    <div className="sb-content" style={{ flex: 1, overflowY: 'auto' }}>
                        <div className="sb-cut-list">
                            {scriptCuts.map((cut, index) => {
                                const sceneId = scenes[index]?.id || `scene-${index + 1}`;
                                const vc = videoCountPerScene[sceneId] || 1;
                                return (
                                <div key={index} className="sb-cut-card">
                                    <div className="sb-cut-card__num"><span>{String(index + 1).padStart(2, '0')}</span></div>
                                    <div className="sb-cut-card__body"><p className="sb-cut-card__text">{cut}</p>
                                        <div className="sb-cut-card__meta"><span>📍 {scenes[index]?.location || 'Unknown'}</span><span>🎬 {scenes[index]?.cameraAngle || 'Wide Angle'}</span></div>
                                    </div>
                                    {/* 영상 개수 선택 */}
                                    <div className="sb-cut-card__video-count">
                                        <span className="sb-cut-card__video-count-label"><Film size={11} /> 영상</span>
                                        <div className="sb-cut-card__video-count-btns">
                                            {[1, 2, 3].map((n) => (
                                                <button
                                                    key={n}
                                                    className={`sb-cut-card__vc-btn ${vc === n ? 'sb-cut-card__vc-btn--active' : ''}`}
                                                    onClick={() => setVideoCountPerScene(prev => ({ ...prev, [sceneId]: n }))}
                                                >
                                                    {n}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="sb-cut-card__actions"><button className="sb-cut-card__action"><Pencil size={12} /></button><button className="sb-cut-card__action"><Trash2 size={12} /></button></div>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="sb-bottom-actions">
                        <button className="btn-secondary" onClick={() => setPhase('cast-setup')}><ChevronLeft size={14} /> 이전: 카드 선택</button>
                        <span className="sb-bottom-actions__info">{scriptCuts.length}개 컷이 분할되었습니다</span>
                        <button className="btn-primary sb-bottom-actions__btn" onClick={() => setPhase('seed-check')}>다음: 시드 매칭 & 생성 <ArrowRight size={14} /></button>
                    </div>
                </div>
            )}

            {/* ===== PHASE 2: Game-style Card Deck (기존 그대로 유지) ===== */}
            {phase === 'cast-setup' && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    {/* AI 분석 팝업 모달 */}
                    {showAiAnalysisModal && (
                        <div className="modal-overlay">
                            <div className="ai-analysis-modal">
                                <div className="ai-analysis-modal__icon">
                                    <Sparkles size={32} />
                                </div>
                                <h3 className="ai-analysis-modal__title">AI 대본 분석</h3>
                                <p className="ai-analysis-modal__desc">
                                    대본을 분석하여 주요 등장인물(3명), 배경(1개), 아이템(1개)을<br />
                                    자동으로 추출합니다. (총 5장 선택, 추가 3장은 수동 추가 가능)
                                </p>
                                {isAiAnalyzing ? (
                                    <div className="ai-analysis-modal__loading">
                                        <Loader size={24} className="animate-spin" />
                                        <span>대본 분석 중... 캐릭터 3 + 배경 1 + 아이템 1</span>
                                        <div className="ai-analysis-modal__progress-bar">
                                            <div className="ai-analysis-modal__progress-fill" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="ai-analysis-modal__actions">
                                        <button className="btn-primary" onClick={() => handleAiAnalysis(true)}>
                                            <Sparkles size={14} /> 네, AI로 분석하기
                                        </button>
                                        <button className="btn-secondary" onClick={() => handleAiAnalysis(false)}>
                                            아니오, 기본 카드 사용
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="sb-phase-title">
                        <span>2단계: 촬영 카드 선택</span>
                        <span className="sb-phase-title__progress">
                            AI {aiCards.length}/{MAX_AI_SLOTS} · 수동 {manualCards.length}/{MAX_MANUAL_SLOTS} · 총 {deck.length}/{MAX_DECK_SIZE}
                        </span>
                    </div>
                    <div className="deck-layout" style={{ flex: 1, overflow: 'hidden' }}>
                        {/* LEFT: My Deck */}
                        <div className="deck-selected">
                            <div className="deck-selected__header">
                                <Shield size={16} /><span className="deck-selected__title">내 덱</span>
                                <span className="deck-selected__count">{deck.length}/{MAX_DECK_SIZE}</span>
                            </div>
                            <div className="deck-group">
                                <div className="deck-group__label"><User size={11} /> 캐릭터 <span className="deck-group__cnt">{deckChars.length}</span></div>
                                <div className="deck-group__cards">{deckChars.map(renderDeckCard)}</div>
                            </div>
                            <div className="deck-group">
                                <div className="deck-group__label"><MapPin size={11} /> 배경 <span className="deck-group__cnt">{deckBgs.length}</span></div>
                                <div className="deck-group__cards">{deckBgs.map(renderDeckCard)}</div>
                            </div>
                            <div className="deck-group">
                                <div className="deck-group__label"><Sword size={11} /> 아이템 <span className="deck-group__cnt">{deckItems.length}</span></div>
                                <div className="deck-group__cards">{deckItems.map(renderDeckCard)}</div>
                            </div>
                        </div>

                        {/* RIGHT: Card Pool */}
                        <div className="deck-pool">
                            <div className="deck-pool__tabs">
                                <button className={`deck-pool__tab ${poolTab === 'library' ? 'deck-pool__tab--active' : ''}`} onClick={() => { setPoolTab('library'); setShowInlineNew(false); }}><Shield size={12} /> 내 라이브러리</button>
                                <button className={`deck-pool__tab ${poolTab === 'ai' ? 'deck-pool__tab--active' : ''}`} onClick={() => { setPoolTab('ai'); setShowInlineNew(false); }}><Sparkles size={12} /> AI 추천</button>
                                <button className={`deck-pool__tab ${poolTab === 'favorites' ? 'deck-pool__tab--active' : ''}`} onClick={() => { setPoolTab('favorites'); setShowInlineNew(false); }}><Star size={12} /> 즐겨찾기</button>
                                <button className={`deck-pool__tab ${poolTab === 'new' ? 'deck-pool__tab--active' : ''}`} onClick={() => { setPoolTab('new'); setShowInlineNew(false); }}>새로 만들기</button>
                                <div className="deck-pool__filters">
                                    {(['all', 'character', 'background', 'item'] as const).map((f) => (
                                        <button key={f} className={`deck-pool__filter ${poolFilter === f ? 'deck-pool__filter--active' : ''}`} onClick={() => setPoolFilter(f)}>
                                            {f === 'all' ? '전체' : f === 'character' ? '캐릭터' : f === 'background' ? '배경' : '아이템'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* New Card Creator — compact form shown above grid when tab is active */}
                            {poolTab === 'new' && (
                                <div className="deck-pool__new deck-pool__new--inline">
                                    <div className="deck-pool__new-types">
                                        {(['character', 'background', 'item'] as const).map((t) => (
                                            <button key={t} className={`deck-pool__new-type ${addType === t ? 'deck-pool__new-type--active' : ''}`} onClick={() => setAddType(t)}>
                                                {t === 'character' ? <><User size={14} /> 캐릭터</> : t === 'background' ? <><MapPin size={14} /> 배경</> : <><Sword size={14} /> 아이템</>}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="deck-pool__new-form">
                                        <div className="modal__field"><label className="modal__label">이름</label><input className="modal__input" placeholder="이름을 입력하세요" value={newCard.name} onChange={(e) => setNewCard({ ...newCard, name: e.target.value })} /></div>
                                        <div className="modal__field"><label className="modal__label">설명 (프롬프트)</label><textarea className="modal__textarea" placeholder="자세히 묘사해주세요" rows={3} value={newCard.description} onChange={(e) => setNewCard({ ...newCard, description: e.target.value })} /></div>
                                        <button className="btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={handleAddCard} disabled={!newCard.name || !newCard.description}><Plus size={14} /> 덱에 추가</button>
                                    </div>
                                </div>
                            )}

                            {/* Pool Grid — always visible, sections ordered by active tab */}
                            <div className="deck-pool__grid">
                                {getPoolSections().map((section, si) => (
                                    section.cards.length > 0 && (
                                        <React.Fragment key={section.label}>
                                            <div className={`deck-pool__section-label${si > 0 ? ' deck-pool__section-label--secondary' : ''}`}>
                                                {section.icon === 'sparkles' ? <Sparkles size={10} /> : <Star size={10} />}
                                                {section.label}
                                                <span className="deck-pool__section-count">{section.cards.length}</span>
                                            </div>
                                            {section.cards.map((card) => {
                                                const inDeck = isDeckSelected(card.id);
                                                return (
                                                    <div key={card.id} className={`pool-card ${inDeck ? 'pool-card--in-deck' : ''}`} onClick={() => inDeck ? removeFromDeck(card.id) : addToDeck(card)}>
                                                        <div className="pool-card__img-wrap">
                                                            <img src={card.imageUrl} className="pool-card__img" alt={card.name} />
                                                            {card.isRequired && <span className="pool-card__ai-badge">AI 추천</span>}
                                                            {card.isFavorite && <Star size={11} className="pool-card__star" />}
                                                            {inDeck && <div className="pool-card__selected-overlay"><CheckCircle2 size={24} /><span>선택됨</span></div>}
                                                        </div>
                                                        <div className="pool-card__info">
                                                            <div className="pool-card__name">{card.name}</div>
                                                            <div className="pool-card__desc">{card.description}</div>
                                                            <div className="pool-card__meta">
                                                                <span className="pool-card__type-badge" data-type={card.type}>
                                                                    {card.type === 'character' ? '캐릭터' : card.type === 'background' ? '배경' : '아이템'}
                                                                </span>
                                                                <span className="pool-card__seed"><Hash size={8} />{card.seed}</span>
                                                            </div>
                                                        </div>
                                                        <div className={`pool-card__action-bar ${inDeck ? 'pool-card__action-bar--remove' : ''}`}>
                                                            {inDeck ? <><X size={11} /> 덱에서 제거</> : <><Plus size={11} /> 덱에 추가</>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </React.Fragment>
                                    )
                                ))}
                                {/* Inline "+" Add New Card */}
                                {!showInlineNew ? (
                                    <div className="pool-card pool-card--add-new" onClick={() => setShowInlineNew(true)}>
                                        <Plus size={28} />
                                        <span>새 카드 추가</span>
                                    </div>
                                ) : (
                                    <div className="pool-card--inline-form">
                                        <div className="pool-card--inline-form__header">
                                            <span>새 카드 만들기</span>
                                            <button onClick={() => setShowInlineNew(false)}><X size={12} /></button>
                                        </div>
                                        <div className="pool-card--inline-form__types">
                                            {(['character', 'background', 'item'] as const).map((t) => (
                                                <button key={t} className={`pool-card--inline-form__type ${addType === t ? 'pool-card--inline-form__type--active' : ''}`} onClick={() => setAddType(t)}>
                                                    {t === 'character' ? <User size={10} /> : t === 'background' ? <MapPin size={10} /> : <Sword size={10} />}
                                                </button>
                                            ))}
                                        </div>
                                        <input className="pool-card--inline-form__input" placeholder="이름" value={newCard.name} onChange={(e) => setNewCard({ ...newCard, name: e.target.value })} />
                                        <textarea className="pool-card--inline-form__textarea" placeholder="프롬프트 설명" rows={3} value={newCard.description} onChange={(e) => setNewCard({ ...newCard, description: e.target.value })} />
                                        <button className="btn-primary" style={{ width: '100%', fontSize: '0.6875rem', padding: '6px' }} onClick={handleAddCard} disabled={!newCard.name || !newCard.description}>
                                            <Plus size={11} /> 덱에 추가
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="sb-bottom-actions">
                        <span className="sb-bottom-actions__info">{deck.filter(c => c.status === 'done').length}/{deck.length} 카드 준비 완료</span>
                        <button className="btn-primary sb-bottom-actions__btn" onClick={() => setPhase('script-review')}>다음: 컷 분할 <ArrowRight size={14} /></button>
                    </div>
                </div>
            )}

            {/* ===== PHASE 3: Seed Check - Vertical List + Cast Strip with Manual Slots ===== */}
            {phase === 'seed-check' && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div className="sb-phase-title">
                        <span>3단계: 컷별 프롬프트 & 시드 매칭</span>
                        <span className="sb-phase-title__progress">{doneSceneCount}/{scenes.length} 생성완료</span>
                        {!allImagesDone && <button className="btn-primary" style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={generateAllScenes}><Zap size={13} /> 일괄 이미지 생성</button>}
                        {allImagesDone && !allVideosDone && <button className="btn-primary" style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={generateAllVideos}><Video size={13} /> 5초 영상 일괄 생성</button>}
                        {allVideosDone && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={13} /> 모든 이미지 및 영상 생성 완료!</span>}
                    </div>

                    {/* ── TOP: Horizontal Cast Seed Strip with Manual Slots ── */}
                    <div className="sc-cast-strip">
                        <div className="sc-cast-strip__section-label"><Shield size={11} /> 마이덱 ({deck.length}/{MAX_DECK_SIZE})</div>
                        <div className="sc-cast-strip__divider" />

                        {/* AI 카드 - 캐릭터 */}
                        {deck.filter(c => c.source === 'ai' && c.type === 'character').map((card) => {
                            const isActive = selectedScene ? (sceneSeeds[selectedScene] || []).includes(card.id) : false;
                            return (
                                <div
                                    key={`c-${card.id}`}
                                    className={`sc-cast-strip-card ${isActive ? 'sc-cast-strip-card--active' : ''}`}
                                    onClick={() => selectedScene && toggleSceneSeed(selectedScene, card.id)}
                                    title={selectedScene ? (isActive ? '씨드 해제' : '이 씬에 씨드 추가') : '먼저 씬을 선택하세요'}
                                >
                                    <div className="sc-cast-strip-card__img">
                                        {card.imageUrl ? <img src={card.imageUrl} alt={card.name} /> : <User size={14} />}
                                    </div>
                                    <div className="sc-cast-strip-card__info">
                                        <div className="sc-cast-strip-card__name">{card.name.split(' ')[0]}</div>
                                        <div className="sc-cast-strip-card__seed"><Hash size={7} />{card.seed}</div>
                                    </div>
                                    {isActive && <span className="sc-cast-strip-card__check"><Check size={8} /></span>}
                                </div>
                            );
                        })}
                        <div className="sc-cast-strip__divider" />

                        {/* AI 카드 - 배경 */}
                        {deck.filter(c => c.source === 'ai' && c.type === 'background').map((card) => {
                            const isActive = selectedScene ? (sceneSeeds[selectedScene] || []).includes(card.id) : false;
                            return (
                                <div
                                    key={`b-${card.id}`}
                                    className={`sc-cast-strip-card sc-cast-strip-card--bg ${isActive ? 'sc-cast-strip-card--active sc-cast-strip-card--bg-active' : ''}`}
                                    onClick={() => selectedScene && toggleSceneSeed(selectedScene, card.id)}
                                >
                                    <div className="sc-cast-strip-card__img sc-cast-strip-card__img--wide">
                                        {card.imageUrl ? <img src={card.imageUrl} alt={card.name} /> : <MapPin size={14} />}
                                    </div>
                                    <div className="sc-cast-strip-card__info">
                                        <div className="sc-cast-strip-card__name">{card.name.split(' ').slice(0, 2).join(' ')}</div>
                                        <div className="sc-cast-strip-card__seed"><Hash size={7} />{card.seed}</div>
                                    </div>
                                    {isActive && <span className="sc-cast-strip-card__check"><Check size={8} /></span>}
                                </div>
                            );
                        })}
                        <div className="sc-cast-strip__divider" />

                        {/* AI 카드 - 아이템 */}
                        {deck.filter(c => c.source === 'ai' && c.type === 'item').map((card) => {
                            const isActive = selectedScene ? (sceneSeeds[selectedScene] || []).includes(card.id) : false;
                            return (
                                <div
                                    key={`i-${card.id}`}
                                    className={`sc-cast-strip-card sc-cast-strip-card--item ${isActive ? 'sc-cast-strip-card--active sc-cast-strip-card--item-active' : ''}`}
                                    onClick={() => selectedScene && toggleSceneSeed(selectedScene, card.id)}
                                >
                                    <div className="sc-cast-strip-card__img">
                                        {card.imageUrl ? <img src={card.imageUrl} alt={card.name} /> : <Sword size={14} />}
                                    </div>
                                    <div className="sc-cast-strip-card__info">
                                        <div className="sc-cast-strip-card__name">{card.name.split(' ')[0]}</div>
                                        <div className="sc-cast-strip-card__seed"><Hash size={7} />{card.seed}</div>
                                    </div>
                                    {isActive && <span className="sc-cast-strip-card__check"><Check size={8} /></span>}
                                </div>
                            );
                        })}

                        {/* ── 구분선: AI → 수동 ── */}
                        {(manualCards.length > 0 || manualSlotsRemaining > 0) && (
                            <div className="sc-cast-strip__divider sc-cast-strip__divider--manual" />
                        )}

                        {/* 수동 추가된 카드 */}
                        {manualCards.map((card) => {
                            const isActive = selectedScene ? (sceneSeeds[selectedScene] || []).includes(card.id) : false;
                            return (
                                <div
                                    key={`m-${card.id}`}
                                    className={`sc-cast-strip-card sc-cast-strip-card--manual ${isActive ? 'sc-cast-strip-card--active' : ''}`}
                                    onClick={() => selectedScene && toggleSceneSeed(selectedScene, card.id)}
                                    title={card.name}
                                >
                                    <div className="sc-cast-strip-card__img">
                                        {card.imageUrl ? <img src={card.imageUrl} alt={card.name} /> : (
                                            card.type === 'character' ? <User size={14} /> : card.type === 'background' ? <MapPin size={14} /> : <Sword size={14} />
                                        )}
                                    </div>
                                    <div className="sc-cast-strip-card__info">
                                        <div className="sc-cast-strip-card__name">{card.name.split(' ')[0]}</div>
                                        <div className="sc-cast-strip-card__seed"><Hash size={7} />{card.seed}</div>
                                    </div>
                                    <button
                                        className="sc-cast-strip-card__remove-btn"
                                        onClick={(e) => { e.stopPropagation(); removeFromDeck(card.id); }}
                                        title="수동 카드 제거"
                                    >
                                        <X size={8} />
                                    </button>
                                    {isActive && <span className="sc-cast-strip-card__check"><Check size={8} /></span>}
                                </div>
                            );
                        })}

                        {/* 빈 수동 "+" 슬롯들 */}
                        {Array.from({ length: manualSlotsRemaining }, (_, i) => (
                            <button
                                key={`add-slot-${i}`}
                                className="sc-cast-strip__add-slot"
                                onClick={() => setShowManualAddModal(true)}
                                title="수동 카드 추가"
                            >
                                <Plus size={14} />
                            </button>
                        ))}

                        {!selectedScene && (
                            <div className="sc-cast-strip__hint">씬을 선택하면 이곳에서 씨드를 토글할 수 있어요</div>
                        )}
                    </div>

                    {/* ── 수동 추가 모달 ── */}
                    {showManualAddModal && (
                        <div className="modal-overlay" onClick={() => setShowManualAddModal(false)}>
                            <div className="manual-add-modal" onClick={(e) => e.stopPropagation()}>
                                <div className="manual-add-modal__header">
                                    <h3>수동 카드 추가</h3>
                                    <span className="manual-add-modal__count">{manualCards.length}/{MAX_MANUAL_SLOTS}</span>
                                    <button className="btn-icon" onClick={() => setShowManualAddModal(false)} style={{ marginLeft: 'auto' }}><X size={14} /></button>
                                </div>
                                <div className="manual-add-modal__types">
                                    {(['character', 'background', 'item'] as const).map((t) => (
                                        <button
                                            key={t}
                                            className={`manual-add-modal__type-btn ${manualAddType === t ? 'manual-add-modal__type-btn--active' : ''}`}
                                            onClick={() => setManualAddType(t)}
                                        >
                                            {t === 'character' ? <><User size={12} /> 캐릭터</> : t === 'background' ? <><MapPin size={12} /> 배경</> : <><Sword size={12} /> 아이템</>}
                                        </button>
                                    ))}
                                </div>
                                <div className="manual-add-modal__form">
                                    <div className="modal__field">
                                        <label className="modal__label">이름</label>
                                        <input className="modal__input" placeholder="카드 이름을 입력하세요" value={manualAddCard.name} onChange={(e) => setManualAddCard({ ...manualAddCard, name: e.target.value })} />
                                    </div>
                                    <div className="modal__field">
                                        <label className="modal__label">프롬프트 설명</label>
                                        <textarea className="modal__textarea" placeholder="자세히 묘사해주세요" rows={3} value={manualAddCard.description} onChange={(e) => setManualAddCard({ ...manualAddCard, description: e.target.value })} />
                                    </div>
                                    <button
                                        className="btn-primary"
                                        style={{ width: '100%', marginTop: 8 }}
                                        onClick={handleManualAddCard}
                                        disabled={!manualAddCard.name.trim() || manualCards.length >= MAX_MANUAL_SLOTS}
                                    >
                                        <Plus size={14} /> 덱에 추가 ({manualCards.length}/{MAX_MANUAL_SLOTS})
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Vertical Scene List ── full width */}
                    <div className="sc-layout">
                        <div className="sc-list">
                            {scenes.map((scene, index) => {
                                const genStatus = sceneGenStatus[scene.id];
                                const isSelected = selectedScene === scene.id;
                                const videoCount = videoCountPerScene[scene.id] || 1;
                                const prefix = stylePromptPrefix[selectedStyle] || stylePromptPrefix['Cinematic'];
                                const prompts = mockScenePrompts[scene.id];

                                return (
                                    <React.Fragment key={scene.id}>
                                        {Array.from({ length: videoCount }, (_, subIdx) => (
                                            <div
                                                key={`${scene.id}-${subIdx}`}
                                                className={`sc-row ${isSelected ? 'sc-row--selected' : ''} ${genStatus === 'done' ? 'sc-row--done' : ''} ${subIdx > 0 ? 'sc-row--sub-row' : ''}`}
                                                onClick={() => setSelectedScene(isSelected ? null : scene.id)}
                                            >
                                                {/* Col 1: Image */}
                                                <div className="sc-row__img-col">
                                                    {genStatus === 'done' && scene.imageUrl ? (
                                                        <div className="sc-row__img" style={{ backgroundImage: `url(${scene.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                                                            <button className="sc-row__regen-overlay-btn" onClick={(e) => { e.stopPropagation(); generateSingleScene(scene.id); }} title="이미지 재생성">
                                                                <RefreshCw size={11} /> 재생성
                                                            </button>
                                                            <span className="sc-row__done-badge"><CheckCircle2 size={12} /></span>
                                                        </div>
                                                    ) : genStatus === 'generating' ? (
                                                        <div className="sc-row__img sc-row__img--gen"><Loader size={20} className="animate-spin" /><span>생성 중...</span></div>
                                                    ) : (
                                                        <div className="sc-row__img sc-row__img--empty">
                                                            <span className="sc-row__img-num">{String(index + 1).padStart(2, '0')}{videoCount > 1 ? `-${subIdx + 1}` : ''}</span>
                                                            <button className="sc-row__gen-btn" onClick={(e) => { e.stopPropagation(); generateSingleScene(scene.id); }}>
                                                                <Sparkles size={11} /> 개별 생성
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Col 2: Seed Cards (+ 버튼 제거됨 — 상단 바에서만 수동 추가) */}
                                                <div className="sc-row__seed-col">
                                                    {subIdx === 0 ? (
                                                        <>
                                                            <div className="sc-row__tags">
                                                                <span className="sc-row__scene-num">SCENE {String(index + 1).padStart(2, '0')}</span>
                                                                {videoCount > 1 && <span className="sc-row__video-count-badge">{videoCount}컷</span>}
                                                            </div>
                                                            <div className="sc-row__script-label"><Sparkles size={9} /> 참고할 씨드 카드</div>
                                                            <div className="sc-row__seed-stack sc-row__seed-stack--overlap">
                                                                {(sceneSeeds[scene.id] || []).map((cardId, seedIdx) => {
                                                                    const card = deck.find(c => c.id === cardId);
                                                                    if (!card) return null;
                                                                    return (
                                                                        <div
                                                                            key={cardId}
                                                                            className={`sc-row__seed-card sc-row__seed-card--${card.type} sc-row__seed-card--img-only`}
                                                                            style={{ zIndex: 10 - seedIdx, marginLeft: seedIdx > 0 ? '-12px' : '0' }}
                                                                            onClick={(e) => { e.stopPropagation(); toggleSceneSeed(scene.id, cardId); }}
                                                                            title={`${card.name} #${card.seed} (클릭하여 해제)`}
                                                                        >
                                                                            {card.imageUrl ? (
                                                                                <img src={card.imageUrl} className="sc-row__seed-card__img" alt={card.name} />
                                                                            ) : (
                                                                                <div className="sc-row__seed-card__img sc-row__seed-card__img--empty">
                                                                                    {card.type === 'character' ? <User size={10} /> : card.type === 'background' ? <MapPin size={10} /> : <Sword size={10} />}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                                {(sceneSeeds[scene.id] || []).length === 0 && (
                                                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>상단 카드를 클릭하여 배정</span>
                                                                )}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="sc-row__sub-label">
                                                            <span>파트 {subIdx + 1}/{videoCount}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Col 3: Script (대본) */}
                                                <div className="sc-row__script-col">
                                                    {subIdx === 0 ? (
                                                        <>
                                                            <div className="sc-row__script-label"><Sparkles size={9} /> 대본</div>
                                                            <p className="sc-row__text">{scene.text}</p>
                                                        </>
                                                    ) : (
                                                        <p className="sc-row__text" style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.75rem' }}>
                                                            (파트 {subIdx + 1} 대본)
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Col 4: Prompts */}
                                                <div className="sc-row__prompt-col">
                                                    <div className="sc-row__prompt-section">
                                                        <div className="sc-row__prompt-label">🖼 이미지 생성 프롬프트</div>
                                                        <p className="sc-row__prompt-text">
                                                            <span className="sc-row__prompt-prefix">{prefix}</span>{' '}
                                                            {prompts?.imagePrompt ?? '—'}
                                                        </p>
                                                    </div>
                                                    <div className="sc-row__prompt-divider" />
                                                    <div className="sc-row__prompt-section">
                                                        <div className="sc-row__prompt-label">🎬 영상 생성 프롬프트</div>
                                                        <p className="sc-row__prompt-text">
                                                            {prompts?.videoPrompt ?? '—'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Col 5: Video Box */}
                                                <div className="sc-row__video-col">
                                                    {videoGenStatus[scene.id] === 'done' ? (
                                                        <div className="sc-row__video-clip" style={{ backgroundImage: scene.imageUrl ? `url(${scene.imageUrl})` : getSceneGradient(index), backgroundSize: 'cover', backgroundPosition: 'center' }}>
                                                            <div className="sc-row__video-play"><Play size={18} /></div>
                                                            <span className="sc-row__video-dur">0:05</span>
                                                            <button className="sc-row__video-regen" onClick={(e) => { e.stopPropagation(); regenerateSingleVideo(scene.id); }} title="영상 재생성">
                                                                <RefreshCw size={11} /> 재생성
                                                            </button>
                                                        </div>
                                                    ) : videoGenStatus[scene.id] === 'generating' ? (
                                                        <div className="sc-row__video-clip sc-row__video-clip--gen">
                                                            <Loader size={22} className="animate-spin" />
                                                            <span>영상 생성 중...</span>
                                                        </div>
                                                    ) : (
                                                        <div className="sc-row__video-clip sc-row__video-clip--empty">
                                                            <Video size={18} />
                                                            <span>영상 대기</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <ChevronRight size={16} className={`sc-row__arrow ${isSelected ? 'sc-row__arrow--open' : ''}`} />
                                            </div>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    {/* Filmstrip */}
                    {doneSceneCount > 0 && (
                        <div className="filmstrip">
                            <div className="filmstrip__header"><Film size={14} /><span className="filmstrip__title">Story Flow</span><span className="filmstrip__count">{doneSceneCount}/{scenes.length}</span></div>
                            <div className="filmstrip__row"><span className="filmstrip__row-label">🖼️</span>
                                <div className="filmstrip__track">
                                    {scenes.map((scene, i) => {
                                        const st = sceneGenStatus[scene.id]; return (
                                            <div key={scene.id} className={`filmstrip__frame ${selectedScene === scene.id ? 'filmstrip__frame--active' : ''} ${st !== 'done' ? 'filmstrip__frame--generating' : ''}`} onClick={() => setSelectedScene(scene.id)}>
                                                <div className="filmstrip__frame-img" style={{ backgroundImage: st === 'done' && scene.imageUrl ? `url(${scene.imageUrl})` : getSceneGradient(i), backgroundSize: 'cover', backgroundPosition: 'center' }}>
                                                    <span className="filmstrip__frame-num">{String(i + 1).padStart(2, '0')}</span>
                                                    {st === 'generating' && <div className="filmstrip__frame-spinner"><Loader size={12} className="animate-spin" /></div>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="sb-bottom-actions">
                        <button className="btn-secondary" onClick={() => setPhase('script-review')}><ChevronLeft size={14} /> 이전</button>
                        {allVideosDone ? (
                            <><span className="sb-bottom-actions__info" style={{ color: '#10b981' }}><CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />모든 이미지 및 영상 생성 완료!</span>
                                <button className="btn-primary sb-bottom-actions__btn" onClick={() => navigate('/project/timeline')}>타임라인으로 이동 <ArrowRight size={14} /></button></>
                        ) : allImagesDone ? (
                            <><span className="sb-bottom-actions__info" style={{ color: '#10b981' }}><CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />모든 이미지 생성 완료! ({doneVideoCount}/{scenes.length} 영상)</span>
                                <button className="btn-primary sb-bottom-actions__btn" onClick={generateAllVideos}><Video size={14} /> 5초 영상 일괄 생성</button></>
                        ) : (
                            <><span className="sb-bottom-actions__info">{doneSceneCount}/{scenes.length} 이미지</span>
                                <button className="btn-primary sb-bottom-actions__btn" onClick={generateAllScenes}><Zap size={14} /> 일괄 이미지 생성</button></>
                        )}
                    </div>
                </div>
            )}


            {/* generating-video / complete 블록 제거됨 — 영상 생성은 seed-check에서 인라인으로 처리 */}
        </div>
    );
};

export default StoryboardPage;
