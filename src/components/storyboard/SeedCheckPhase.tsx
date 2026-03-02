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
// mockScenePrompts는 이제 사용하지 않음 (customPrompts로 대체)
import { getArtStylePromptPrefix, getArtStyleById } from '../../data/artStyles';
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
    /** 영상 비율 (예: "16:9") */
    aspectRatio?: string;
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
    aspectRatio,
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
        selectedForVideo,
        toggleVideoSelection,
        generateSelectedVideos,
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
                {/* 진행 인디케이터 */}
                <div className="sc-progress-indicator">
                    <div className={`sc-progress-step ${Object.keys(customPrompts).length > 0 ? 'sc-progress-step--done' : 'sc-progress-step--active'}`}>
                        ① AI 분석 {Object.keys(customPrompts).length > 0 ? '✓' : ''}
                    </div>
                    <span className="sc-progress-arrow">→</span>
                    <div className={`sc-progress-step ${allImagesDone ? 'sc-progress-step--done' : doneSceneCount > 0 ? 'sc-progress-step--active' : ''}`}>
                        ② 이미지 {doneSceneCount}/{scenes.length}
                    </div>
                    <span className="sc-progress-arrow">→</span>
                    <div className={`sc-progress-step ${allVideosDone ? 'sc-progress-step--done' : allImagesDone ? 'sc-progress-step--active' : ''}`}>
                        ③ 영상 {doneVideoCount}/{scenes.length}
                    </div>
                </div>
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

            {/* 씬 목록 — 프롬프트는 각 SceneRow 내부 박스에서 직접 편집 */}
            <div className="sc-layout">
                <div className="sc-list">
                    {scenes.map((scene, index) => {
                        const seeds = sceneSeeds[scene.id] || [];
                        const chars = seeds.filter((id) => deck.find((c) => c.id === id)?.type === 'character').length;
                        const bgs = seeds.filter((id) => deck.find((c) => c.id === id)?.type === 'background').length;
                        const items = seeds.filter((id) => deck.find((c) => c.id === id)?.type === 'item').length;
                        const seedSummaryText = seeds.length > 0 ? `캐릭터${chars} + 배경${bgs} + 아이템${items}` : '';
                        return (
                            <SceneRow
                                key={scene.id}
                                scene={scene}
                                index={index}
                                videoCount={videoCountPerScene[scene.id] || 1}
                                genStatus={sceneGenStatus[scene.id]}
                                videoGenStatus={videoGenStatus[scene.id] || 'idle'}
                                isSelected={selectedScene === scene.id}
                                sceneSeeds={seeds}
                                deck={deck}
                                promptPrefix={getArtStylePromptPrefix(artStyleId)}
                                imagePrompt={customPrompts[scene.id]?.image || ''}
                                videoPrompt={customPrompts[scene.id]?.video || ''}
                                onImagePromptChange={(val) => updatePrompt(scene.id, 'image', val)}
                                onVideoPromptChange={(val) => updatePrompt(scene.id, 'video', val)}
                                gradientFallback={getSceneGradient(index)}
                                onSelect={() => setSelectedScene(selectedScene === scene.id ? null : scene.id)}
                                onGenerateImage={generateSingleScene}
                                onRegenerateVideo={regenerateSingleVideo}
                                onToggleSeed={toggleSceneSeed}
                                artStyleLabel={getArtStyleById(artStyleId)?.nameKo || artStyleId}
                                aspectRatio={aspectRatio || '16:9'}
                                seedSummary={seedSummaryText}
                                isSelectedForVideo={selectedForVideo.has(scene.id)}
                                onToggleVideoSelection={() => toggleVideoSelection(scene.id)}
                            />
                        );
                    })}
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
                {/* 나레이션/시네마틱 공통: 3단계 순차 */}
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
                    ) : Object.keys(customPrompts).length === 0 ? (
                        /* Step 1: 프롬프트 미작성 → AI 분석 버튼 */
                        <>
                            <span className="sb-bottom-actions__info">프롬프트를 먼저 작성해주세요</span>
                            <button className="btn-primary sb-bottom-actions__btn" onClick={initPrompts}>
                                <Sparkles size={14} /> AI 분석 및 프롬프트 작성
                            </button>
                        </>
                    ) : (
                        /* Step 2: 일괄 이미지 생성 */
                        <>
                            <span className="sb-bottom-actions__info">{doneSceneCount}/{scenes.length} 이미지</span>
                            <button className="btn-primary sb-bottom-actions__btn" onClick={generateAllScenes}>
                                <Zap size={14} /> 일괄 이미지 생성
                            </button>
                        </>
                    )
                ) : (
                    /* 시네마틱 모드: 3단계 순차 */
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
                    ) : Object.keys(customPrompts).length === 0 ? (
                        /* Step 1: 프롬프트 미작성 → AI 분석 버튼 */
                        <>
                            <span className="sb-bottom-actions__info">프롬프트를 먼저 작성해주세요</span>
                            <button className="btn-primary sb-bottom-actions__btn" onClick={initPrompts}>
                                <Sparkles size={14} /> AI 분석 및 프롬프트 작성
                            </button>
                        </>
                    ) : !allImagesDone ? (
                        /* Step 2: 프롬프트 작성됨 → 일괄 이미지 생성 */
                        <>
                            <span className="sb-bottom-actions__info">{doneSceneCount}/{scenes.length} 이미지</span>
                            <button className="btn-primary sb-bottom-actions__btn" onClick={generateAllScenes}>
                                <Zap size={14} /> 일괄 이미지 생성
                            </button>
                        </>
                    ) : (
                        /* Step 3: 이미지 완료 → 영상 생성 (선택/전체) */
                        <>
                            <span className="sb-bottom-actions__info" style={{ color: '#10b981' }}>
                                이미지 완료! 영상 생성할 씬 선택
                            </span>
                            <button className="btn-secondary sb-bottom-actions__btn" onClick={generateSelectedVideos}>
                                <Video size={14} /> 선택한 {selectedForVideo.size}개 영상 생성
                            </button>
                            <button className="btn-primary sb-bottom-actions__btn" onClick={generateAllVideos}>
                                <Video size={14} /> 전체 영상 생성
                            </button>
                        </>
                    )
                )}
            </div>
        </div>
    );
};

export default SeedCheckPhase;
