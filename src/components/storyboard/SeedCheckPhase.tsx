/**
 * SeedCheckPhase — 스토리보드 3단계: 컷별 프롬프트 & 시드 매칭/생성 단계 UI
 */
import React from 'react';
import {
    Zap, Video, CheckCircle2, ChevronLeft, ArrowRight,
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
            />

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
