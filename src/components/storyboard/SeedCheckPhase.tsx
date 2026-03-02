/**
 * SeedCheckPhase — 스토리보드 3단계: 컷별 프롬프트 & 시드 매칭/생성 단계 UI
 */
import React from 'react';
import {
    Zap, Video, CheckCircle2, ChevronLeft, ArrowRight, Sparkles, Loader,
} from 'lucide-react';
import type { AssetCard, Scene } from '../../store/projectStore';
import type { UseDeckApi } from '../../hooks/useDeck';
import { MAX_DECK_SIZE } from '../../hooks/useDeck';
import type { UseGenerationApi } from '../../hooks/useGeneration';
import { mockScenePrompts } from '../../data/mockData';
import { getArtStylePromptPrefix } from '../../data/artStyles';
import { getUserSelectableModels } from '../../data/aiModels';
import CastStrip from './CastStrip';
import ManualAddModal from './ManualAddModal';
import SceneRow from './SceneRow';
import SceneFilmstrip from './SceneFilmstrip';

interface SeedCheckPhaseProps {
    scenes: Scene[];
    deck: AssetCard[];
    artStyleId: string;
    selectedScene: string | null;
    setSelectedScene: (id: string | null) => void;
    genApi: UseGenerationApi;
    deckApi: Pick<UseDeckApi,
        | 'manualCards'
        | 'manualSlotsRemaining'
        | 'showManualAddModal'
        | 'setShowManualAddModal'
        | 'handleManualAddCard'
        | 'removeFromDeck'
    >;
    getSceneGradient: (index: number) => string;
    onPrevPhase: () => void;
    onNavigateToTimeline: () => void;
    imageModel?: string;
    videoModel?: string;
    onImageModelChange?: (modelId: string) => void;
    onVideoModelChange?: (modelId: string) => void;
    /** 타임라인 이동 버튼 레이블 커스터마이즈 (기본값: "타임라인으로 이동") */
    nextLabel?: string;
}

const SeedCheckPhase: React.FC<SeedCheckPhaseProps> = ({
    scenes,
    deck,
    artStyleId,
    selectedScene,
    setSelectedScene,
    genApi,
    deckApi,
    getSceneGradient,
    onPrevPhase,
    onNavigateToTimeline,
    imageModel,
    videoModel,
    onImageModelChange,
    onVideoModelChange,
    nextLabel,
}) => {
    const {
        sceneGenStatus,
        videoGenStatus,
        videoCountPerScene,
        sceneSeeds,
        toggleSceneSeed,
        generateSingleScene,
        generateAllScenes,
        generateAllVideos,
        regenerateSingleVideo,
        doneSceneCount,
        allImagesDone,
        doneVideoCount,
        allVideosDone,
        customPrompts,
        initPrompts,
        updatePrompt,
    } = genApi;

    const {
        manualCards,
        manualSlotsRemaining,
        showManualAddModal,
        setShowManualAddModal,
        handleManualAddCard,
        removeFromDeck,
    } = deckApi;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div className="sb-phase-title">
                <span>3단계: 컷별 프롬프트 & 시드 매칭</span>
                <span className="sb-phase-title__progress">{doneSceneCount}/{scenes.length} 생성완료</span>
                {/* 이미지/영상 AI 모델 선택 */}
                <div className="sb-model-selectors">
                    <div className="ai-model-row ai-model-row--compact">
                        <label className="ai-model-row__label">이미지 AI</label>
                        <select
                            className="ai-model-select"
                            value={imageModel}
                            onChange={(e) => onImageModelChange?.(e.target.value)}
                        >
                            {getUserSelectableModels('image').map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="ai-model-row ai-model-row--compact">
                        <label className="ai-model-row__label">영상 AI</label>
                        <select
                            className="ai-model-select"
                            value={videoModel}
                            onChange={(e) => onVideoModelChange?.(e.target.value)}
                        >
                            {getUserSelectableModels('video').map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                {!allImagesDone && (
                    <button
                        className="btn-primary"
                        style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={generateAllScenes}
                    >
                        <Zap size={13} /> 일괄 이미지 생성
                    </button>
                )}
                {allImagesDone && !allVideosDone && (
                    <button
                        className="btn-primary"
                        style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={generateAllVideos}
                    >
                        <Video size={13} /> 5초 영상 일괄 생성
                    </button>
                )}
                {allVideosDone && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={13} /> 모든 이미지 및 영상 생성 완료!
                    </span>
                )}
            </div>

            {/* 캐스트 스트립 */}
            <CastStrip
                deck={deck}
                maxDeckSize={MAX_DECK_SIZE}
                selectedScene={selectedScene}
                sceneSeeds={sceneSeeds}
                manualSlotsRemaining={manualSlotsRemaining}
                onToggleSeed={toggleSceneSeed}
                onRemoveFromDeck={removeFromDeck}
                onOpenManualAdd={() => setShowManualAddModal(true)}
            />

            {/* 수동 카드 추가 모달 */}
            {showManualAddModal && (
                <ManualAddModal
                    manualCount={manualCards.length}
                    maxSlots={3}
                    onAdd={handleManualAddCard}
                    onClose={() => setShowManualAddModal(false)}
                />
            )}

            {/* 프롬프트 확인/편집 — 처음에 빈 상태, AI 분석 버튼으로 채움 */}
            <div className="sc-prompt-section">
                <div className="sc-prompt-section__header">
                    <span className="sc-prompt-section__title">씬별 프롬프트</span>
                    {Object.keys(customPrompts).length === 0 ? (
                        <button
                            className="btn-primary"
                            style={{ fontSize: '0.7rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={initPrompts}
                        >
                            <Sparkles size={12} /> AI 분석 및 프롬프트 작성
                        </button>
                    ) : (
                        <button
                            className="btn-secondary"
                            style={{ fontSize: '0.7rem', padding: '4px 10px' }}
                            onClick={initPrompts}
                        >
                            <Sparkles size={12} /> 다시 생성
                        </button>
                    )}
                </div>
                {Object.keys(customPrompts).length > 0 ? (
                    <div className="sc-prompt-list">
                        <div className="sc-prompt-row sc-prompt-row--header">
                            <span className="sc-prompt-row__label"></span>
                            <span className="sc-prompt-row__col-title">참고 씨드카드 + 이미지 프롬프트</span>
                            <span className="sc-prompt-row__col-title">영상 프롬프트</span>
                        </div>
                        {scenes.map((scene, index) => {
                            const seeds = genApi.sceneSeeds[scene.id] || [];
                            const seedCards = seeds.map((id: string) => deck.find((c) => c.id === id)).filter(Boolean);
                            return (
                                <div key={scene.id} className="sc-prompt-row">
                                    <span className="sc-prompt-row__label">씬 {index + 1}</span>
                                    <div className="sc-prompt-row__cell">
                                        {seedCards.length > 0 && (
                                            <div className="sc-prompt-row__seeds">
                                                {seedCards.map((c: any) => (
                                                    <span key={c.id} className="sc-prompt-seed-tag">[{c.type === 'character' ? '캐릭터' : c.type === 'background' ? '배경' : '아이템'}: {c.name}]</span>
                                                ))}
                                            </div>
                                        )}
                                        <textarea
                                            className="sc-prompt-row__input"
                                            value={customPrompts[scene.id]?.image || ''}
                                            onChange={(e) => updatePrompt(scene.id, 'image', e.target.value)}
                                            placeholder="이미지 프롬프트..."
                                            rows={2}
                                        />
                                    </div>
                                    <textarea
                                        className="sc-prompt-row__input"
                                        value={customPrompts[scene.id]?.video || ''}
                                        onChange={(e) => updatePrompt(scene.id, 'video', e.target.value)}
                                        placeholder="영상 프롬프트..."
                                        rows={2}
                                    />
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="sc-prompt-empty">
                        <p>아직 프롬프트가 작성되지 않았습니다.</p>
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            "AI 분석 및 프롬프트 작성" 버튼을 클릭하면 대본 내용 + [씨드카드] + [아트스타일]을 기반으로 자동 생성됩니다.
                        </p>
                    </div>
                )}
            </div>

            {/* 씬 목록 */}
            <div className="sc-layout">
                <div className="sc-list">
                    {scenes.map((scene, index) => (
                        <SceneRow
                            key={scene.id}
                            scene={scene}
                            index={index}
                            videoCount={videoCountPerScene[scene.id] || 1}
                            genStatus={sceneGenStatus[scene.id]}
                            videoGenStatus={videoGenStatus[scene.id] || 'idle'}
                            isSelected={selectedScene === scene.id}
                            sceneSeeds={sceneSeeds[scene.id] || []}
                            deck={deck}
                            promptPrefix={getArtStylePromptPrefix(artStyleId)}
                            prompts={mockScenePrompts[scene.id]}
                            gradientFallback={getSceneGradient(index)}
                            onSelect={() => setSelectedScene(selectedScene === scene.id ? null : scene.id)}
                            onGenerateImage={generateSingleScene}
                            onRegenerateVideo={regenerateSingleVideo}
                            onToggleSeed={toggleSceneSeed}
                        />
                    ))}
                </div>
            </div>

            {/* 필름스트립 */}
            <SceneFilmstrip
                scenes={scenes}
                sceneGenStatus={sceneGenStatus}
                selectedScene={selectedScene}
                doneCount={doneSceneCount}
                getGradient={getSceneGradient}
                onFrameClick={(id) => setSelectedScene(id)}
                videoCountPerScene={videoCountPerScene}
            />

            {/* 영상 미리보기 (이미지 생성 완료 후 표시) */}
            {allImagesDone && (
                <div className="sc-video-filmstrip">
                    <span className="sc-video-filmstrip__label">영상 미리보기</span>
                    <div className="sc-video-filmstrip__list">
                        {scenes.map((scene) => (
                            <div key={scene.id} className="sc-video-filmstrip__item">
                                {scene.videoUrl ? (
                                    <video
                                        src={scene.videoUrl}
                                        className="sc-video-filmstrip__video"
                                        controls
                                        muted
                                    />
                                ) : (
                                    <div className="sc-video-filmstrip__placeholder">
                                        {videoGenStatus[scene.id] === 'generating' ? (
                                            <Loader size={14} className="spinning" />
                                        ) : (
                                            <Video size={14} style={{ opacity: 0.3 }} />
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="sb-bottom-actions">
                <button className="btn-secondary" onClick={onPrevPhase}>
                    <ChevronLeft size={14} /> 이전
                </button>
                {/* nextLabel이 있으면 (나레이션 모드): 이미지 생성 완료 후 바로 다음 단계로 */}
                {nextLabel ? (
                    allImagesDone ? (
                        <>
                            <span className="sb-bottom-actions__info" style={{ color: '#10b981' }}>
                                <CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                모든 이미지 생성 완료!
                            </span>
                            <button className="btn-primary sb-bottom-actions__btn" onClick={onNavigateToTimeline}>
                                {nextLabel} <ArrowRight size={14} />
                            </button>
                        </>
                    ) : (
                        <>
                            <span className="sb-bottom-actions__info">{doneSceneCount}/{scenes.length} 이미지</span>
                            <button className="btn-primary sb-bottom-actions__btn" onClick={generateAllScenes}>
                                <Zap size={14} /> 일괄 이미지 생성
                            </button>
                        </>
                    )
                ) : (
                    /* 시네마틱 모드: 기존 로직 유지 */
                    allVideosDone ? (
                        <>
                            <span className="sb-bottom-actions__info" style={{ color: '#10b981' }}>
                                <CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                모든 이미지 및 영상 생성 완료!
                            </span>
                            <button className="btn-primary sb-bottom-actions__btn" onClick={onNavigateToTimeline}>
                                타임라인으로 이동 <ArrowRight size={14} />
                            </button>
                        </>
                    ) : allImagesDone ? (
                        <>
                            <span className="sb-bottom-actions__info" style={{ color: '#10b981' }}>
                                <CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                모든 이미지 생성 완료! ({doneVideoCount}/{scenes.length} 영상)
                            </span>
                            <button className="btn-primary sb-bottom-actions__btn" onClick={generateAllVideos}>
                                <Video size={14} /> 5초 영상 일괄 생성
                            </button>
                        </>
                    ) : (
                        <>
                            <span className="sb-bottom-actions__info">{doneSceneCount}/{scenes.length} 이미지</span>
                            <button className="btn-primary sb-bottom-actions__btn" onClick={generateAllScenes}>
                                <Zap size={14} /> 일괄 이미지 생성
                            </button>
                        </>
                    )
                )}
            </div>
        </div>
    );
};

export default SeedCheckPhase;
