/**
 * VrewEditor — Vrew 스타일 편집기 메인 컨테이너
 *
 * 레이아웃 (원본 구조 정확히 유지):
 *   vrew-editor (flex-column)
 *     vrew-editor__main (상단, mainFlex%)
 *       vrew-editor__preview-area
 *       vrew-editor__script-area
 *       [시네마틱만] vrew-editor__detail-area
 *     vrew-editor__divider
 *     EditorControls
 *     div (하단, 100-mainFlex%): EditorTimeline
 *     TtsPopupModal (시네마틱만)
 *     vrew-editor__nav
 *
 * 로직은 useCinematicEditor / useNarrationEditor 훅으로 분리.
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { GripHorizontal } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import type { AssetCard } from '../../store/projectStore';
import { useEditorPlayback } from '../../hooks/useEditorPlayback';
import { useResizableDivider } from '../../hooks/useResizableDivider';
import { useCinematicEditor } from '../../hooks/useCinematicEditor';
import { useNarrationEditor } from '../../hooks/useNarrationEditor';
import { useEditorHistory } from '../../hooks/useEditorHistory';
import {
  narrationToEditorClips,
} from './types';
import { enrichWithWordTimings } from '../../utils/word-timing';
import EditorPreview from './EditorPreview';
import ScriptPanel from './ScriptPanel';
import ClipDetailPanel from './ClipDetailPanel';
import VrewClipList from './VrewClipList';
import EditorControls from './EditorControls';
import EditorTimeline from './EditorTimeline';
import SceneNavPanel from './SceneNavPanel';
import TtsPopupModal from './TtsPopupModal';
import AssetRegenerateModal from './AssetRegenerateModal';
import type { MediaRange } from './types';
import { generateImage } from '../../services/ai-image';
import { generateVideo } from '../../services/ai-video';
import { buildImagePrompt, buildVideoPrompt } from '../../services/prompt-builder';
import { useCredits } from '../../hooks/useCredits';

/** 043: Undo/Redo 스냅샷 — 시네마틱/나레이션 통합 union 타입 */
type HistorySnapshot =
  | { type: 'cinematic'; clips: any[] }
  | { type: 'narration'; narrationClips: any[]; mediaRanges: MediaRange[] };

interface VrewEditorProps {
  onNext?: () => void;
  onPrev?: () => void;
}

const VrewEditor: React.FC<VrewEditorProps> = ({ onNext, onPrev }) => {
  const mode = useProjectStore((s) => s.mode);
  const narrationClips = useProjectStore((s) => s.narrationClips);
  const narrativeAudioUrl = useProjectStore((s) => s.narrativeAudioUrl);

  // 나레이션 클립 (enriched) — 재생 훅용
  const enrichedNarrationClips = useMemo(() => {
    if (mode !== 'narration') return narrationClips;
    return narrationClips.map((clip) => ({
      ...clip,
      sentences: enrichWithWordTimings(clip.sentences),
    }));
  }, [mode, narrationClips]);

  const audioUrl = mode === 'narration' ? narrativeAudioUrl : '';

  // 리사이즈 구분선
  const dividerRef = useRef<HTMLDivElement | null>(null);
  const { mainFlex, containerRef: editorContainerRef, handleDividerMouseDown } =
    useResizableDivider(42, 25, 80);

  // GPU 가속 플레이헤드
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const ppsGetterRef = useRef<() => number>(() => 40);

  // 임시 빈 클립 배열 (재생 훅 초기화용 — 실제 클립은 각 훅이 관리)
  const placeholderClips = useMemo(
    () =>
      mode === 'narration'
        ? narrationToEditorClips(enrichedNarrationClips)
        : [], // 시네마틱은 useCinematicEditor 내부에서 관리
    [mode, enrichedNarrationClips]
  );

  // 시네마틱 클립 기반 총 재생 시간 (cinematic 초기화 후 갱신)
  const cinematicDurationRef = useRef<number>(0);

  const {
    currentClipIndex,
    setCurrentClipIndex,
    isPlaying,
    currentTime,
    totalDuration,
    togglePlay,
    seekToClip,
    seekToTime,
  } = useEditorPlayback({
    clips: placeholderClips,
    audioUrl,
    playheadRef,
    getTimelinePxPerSec: () => ppsGetterRef.current(),
    getDuration: () => cinematicDurationRef.current,
  });

  // 043: Undo/Redo 히스토리 (union 스냅샷 — 시네마틱+나레이션 통합)
  const restoreRef = useRef<((snapshot: HistorySnapshot) => void) | null>(null);
  const handleHistoryRestore = useCallback((snapshot: HistorySnapshot) => {
    restoreRef.current?.(snapshot);
  }, []);
  const history = useEditorHistory<HistorySnapshot>(handleHistoryRestore);

  // 시네마틱 편집기 로직 (항상 호출 — React 훅 규칙)
  const cinematic = useCinematicEditor({
    currentClipIndex,
    setCurrentClipIndex,
    currentTime,
    totalDuration,
    seekToClip,
    seekToTime,
    onBeforeEdit: (snap) => history.pushState({ type: 'cinematic', ...snap }),
  });

  // 나레이션 편집기 로직 (항상 호출 — React 훅 규칙)
  // 043: onBeforeEdit로 나레이션 히스토리 연결
  const narration = useNarrationEditor({
    currentClipIndex,
    setCurrentClipIndex,
    currentTime,
    seekToClip,
    seekToTime,
    onBeforeEdit: (snap) => history.pushState({ type: 'narration', ...snap }),
  });

  // 043: 수평 리사이즈 훅 (나레이션 모드: 프리뷰 ↔ Vrew 에디터)
  const {
    mainFlex: previewFlex,
    containerRef: narrationMainRef,
    handleDividerMouseDown: handleHDividerMouseDown,
  } = useResizableDivider(60, 30, 80, 'column');

  // ── 에셋 교체 모달 상태 (나레이션 모드) ──
  const [assetRegenRange, setAssetRegenRange] = useState<MediaRange | null>(null);
  const [isAssetRegenerating, setIsAssetRegenerating] = useState(false);
  const { spend: creditSpend } = useCredits();

  const aspectRatioForRegen = useProjectStore((s) => s.aspectRatio);
  const artStyleIdForRegen = useProjectStore((s) => s.artStyleId);
  const templateIdForRegen = useProjectStore((s) => s.templateId);

  // 씨드카드 관련 store 데이터 (에셋 교체 모달용)
  const cardLibrary = useProjectStore((s) => s.cardLibrary);
  const selectedDeck = useProjectStore((s) => s.selectedDeck);
  const sceneSeeds = useProjectStore((s) => s.sceneSeeds);

  const regenAvailableCards = useMemo(
    () => selectedDeck.map((id) => cardLibrary.find((c) => c.id === id)).filter(Boolean) as AssetCard[],
    [selectedDeck, cardLibrary]
  );
  const regenInitialSeedIds = useMemo(
    () =>
      assetRegenRange?.sceneId
        ? sceneSeeds[assetRegenRange.sceneId] || selectedDeck
        : selectedDeck,
    [assetRegenRange?.sceneId, sceneSeeds, selectedDeck]
  );

  // 045: 빈 클립에 에셋 추가 → 임시 MediaRange 생성 → 재생성 모달 열기
  const handleAddAssetForClip = useCallback((clipIndex: number) => {
    const clip = narration.clips[clipIndex];
    if (!clip) return;
    // 같은 씬의 전체 클립 범위 계산
    let start = clipIndex;
    let end = clipIndex;
    for (let j = clipIndex - 1; j >= 0 && narration.clips[j].sceneId === clip.sceneId; j--) start = j;
    for (let j = clipIndex + 1; j < narration.clips.length && narration.clips[j].sceneId === clip.sceneId; j++) end = j;
    setAssetRegenRange({
      id: `new-range-${clip.sceneId}-${Date.now()}`,
      type: 'image',
      url: '',
      startClipIndex: start,
      endClipIndex: end,
      sceneId: clip.sceneId,
    });
  }, [narration.clips]);

  const handleAssetRegenerateImage = useCallback(async (prompt: string) => {
    if (!assetRegenRange) return;
    if (!creditSpend('image')) return;
    setIsAssetRegenerating(true);
    try {
      const sizeMap: Record<string, { width: number; height: number }> = {
        '9:16': { width: 720, height: 1280 },
        '1:1': { width: 1024, height: 1024 },
        '16:9': { width: 1280, height: 720 },
      };
      const { width, height } = sizeMap[aspectRatioForRegen] || sizeMap['16:9'];
      const result = await generateImage({ prompt, width, height });
      // 045: 기존 range 있으면 교체, 없으면 새로 추가 (빈 클립에서 + 클릭 시)
      const updatedRange = { ...assetRegenRange, url: result.imageUrl, type: 'image' as const };
      const existing = narration.mediaRanges.find(r => r.id === assetRegenRange.id);
      if (existing) {
        narration.setMediaRanges(
          narration.mediaRanges.map(r => r.id === assetRegenRange.id ? updatedRange : r)
        );
      } else {
        narration.setMediaRanges([...narration.mediaRanges, updatedRange]);
      }
      setAssetRegenRange(updatedRange); // 영상화 단계에서 URL 필요
    } finally {
      setIsAssetRegenerating(false);
    }
  }, [assetRegenRange, narration, aspectRatioForRegen, creditSpend]);

  const handleAssetRegenerateVideo = useCallback(async (prompt: string) => {
    if (!assetRegenRange) return;
    if (!creditSpend('video')) return;
    setIsAssetRegenerating(true);
    try {
      // 045: 모달에서 이미지 생성 후 assetRegenRange가 업데이트되므로 거기서 URL 가져옴
      const currentRange = narration.mediaRanges.find(r => r.id === assetRegenRange.id) || assetRegenRange;
      if (!currentRange?.url) return;
      const result = await generateVideo({
        imageUrl: currentRange.url,
        prompt,
        duration: 5,
        sceneId: currentRange.sceneId || '',
      });
      const updatedRange = { ...currentRange, url: result.videoUrl, type: 'video' as const };
      const existing = narration.mediaRanges.find(r => r.id === assetRegenRange.id);
      if (existing) {
        narration.setMediaRanges(
          narration.mediaRanges.map(r => r.id === assetRegenRange.id ? updatedRange : r)
        );
      } else {
        narration.setMediaRanges([...narration.mediaRanges, updatedRange]);
      }
    } finally {
      setIsAssetRegenerating(false);
    }
  }, [assetRegenRange, narration, creditSpend]);

  // 043: restore 콜백 — 시네마틱/나레이션 분기 복원
  useEffect(() => {
    restoreRef.current = (snapshot: HistorySnapshot) => {
      if (snapshot.type === 'cinematic' && cinematic.restoreClips) {
        cinematic.restoreClips(snapshot.clips);
      } else if (snapshot.type === 'narration') {
        useProjectStore.getState().setNarrationClips(snapshot.narrationClips);
        useProjectStore.getState().setMediaRanges(snapshot.mediaRanges);
      }
    };
  }, [mode, cinematic.restoreClips]);

  // 재생 훅에 올바른 클립 배열이 전달되도록 — 시네마틱은 cinematic.clips 사용
  const activeClips = mode === 'cinematic' ? cinematic.clips : narration.clips;
  const activeTotalDuration =
    activeClips.length > 0
      ? Math.max(...activeClips.map((c) => c.audioEndTime))
      : totalDuration;

  // 시네마틱 재생 시간을 ref에 동기화 (getDuration 콜백용)
  cinematicDurationRef.current = activeTotalDuration;

  // 스페이스바 재생/일시정지
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement).isContentEditable
      )
        return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]);

  if (activeClips.length === 0) {
    return (
      <div className="vrew-editor vrew-editor--empty">
        <p>편집할 클립이 없습니다.</p>
      </div>
    );
  }

  const currentClip = activeClips[currentClipIndex] ?? null;

  return (
    <div className="vrew-editor" ref={editorContainerRef}>
      {/* 상단: 미리보기 + 대본/스크립트 패널 (+ 시네마틱: 클립 상세 패널) */}
      <div
        className="vrew-editor__main"
        style={mode === 'narration' ? { flex: '1 1 auto' } : { flex: `${mainFlex} 0 0%` }}
        ref={mode === 'narration' ? narrationMainRef : undefined}
      >
        <div
          className="vrew-editor__preview-area"
          style={mode === 'narration' ? { flex: `${previewFlex} 0 0%` } : undefined}
        >
          <EditorPreview
            clip={currentClip}
            currentTime={currentTime}
            isPlaying={isPlaying}
            currentWord={mode === 'narration' ? narration.currentWord : null}
            subtitleItems={mode === 'cinematic' ? cinematic.subtitleItems : undefined}
          />
          {/* 나레이션 모드: 프리뷰 아래 간소 클립 상세 */}
          {mode === 'narration' && currentClip && (
            <div className="vrew-editor__narration-detail">
              <span>클립 {currentClipIndex + 1}</span>
              <span className="vrew-editor__narration-detail-sep">|</span>
              <span>{currentClip.imageUrl ? '이미지' : '—'} {currentClip.videoUrl ? '+ 영상' : ''}</span>
              <span className="vrew-editor__narration-detail-sep">|</span>
              <span>{currentClip.duration.toFixed(1)}초</span>
            </div>
          )}
        </div>

        {/* 043: 수평 리사이즈 구분선 (나레이션 모드: 프리뷰 ↔ 에디터) */}
        {mode === 'narration' && (
          <div className="vrew-editor__h-divider" onMouseDown={handleHDividerMouseDown}>
            <GripHorizontal size={14} style={{ transform: 'rotate(90deg)' }} />
          </div>
        )}

        {/* 나레이션 모드: 씬 네비게이션 패널 */}
        {mode === 'narration' && (
          <SceneNavPanel
            clips={narration.clips}
            currentClipIndex={currentClipIndex}
            onClipSelect={seekToClip}
            mediaRanges={narration.mediaRanges}
          />
        )}
        <div
          className="vrew-editor__script-area"
          style={mode === 'narration' ? { flex: `${100 - previewFlex} 0 0%` } : undefined}
        >
          {mode === 'narration' ? (
            <VrewClipList
              clips={narration.clips}
              currentClipIndex={currentClipIndex}
              currentTime={currentTime}
              onClipSelect={seekToClip}
              onSplitAtWord={narration.handleSplitAtWord}
              onMergeWithPrev={narration.handleMergeWithPrev}
              onDelete={narration.handleDeleteByIndex}
              onGenerateImage={(clipId) => narration.clipGen.generateClipImage(clipId)}
              onGenerateVideo={(clipId) => narration.clipGen.generateClipVideo(clipId)}
              onGenerateSceneImage={(sceneId) => narration.clipGen.generateSceneImage(sceneId)}
              onGenerateSceneVideo={(sceneId) => narration.clipGen.generateSceneVideo(sceneId)}
              onGenerateAllImages={() => narration.clipGen.generateAllClipImages()}
              onGenerateAllVideos={() => narration.clipGen.generateAllClipVideos()}
              clipGenStatus={narration.clipGen.clipGenStatus}
              clipVideoGenStatus={narration.clipGen.clipVideoGenStatus}
              mediaRanges={narration.mediaRanges}
              onMediaRangeResize={narration.handleMediaRangeResize}
              onMediaRangeDelete={narration.handleMediaRangeDelete}
              onMediaRangeClick={(rangeId: string) => {
                const range = narration.mediaRanges.find(r => r.id === rangeId);
                if (range) setAssetRegenRange(range);
              }}
              onAddAssetForClip={handleAddAssetForClip}
            />
          ) : (
            <ScriptPanel
              clips={cinematic.clips}
              currentClipIndex={currentClipIndex}
              onClipSelect={seekToClip}
              onTextChange={cinematic.handleTextChange}
              aspectRatio={cinematic.aspectRatio}
              sceneVideos={cinematic.sceneVideos}
              onRegenerateVideo={(sceneId, clipId) => cinematic.handleRegenerateVideo(sceneId, clipId)}
              isRegenerating={(sceneId) => cinematic.isRegenerating(sceneId)}
              onInsertScene={cinematic.handleInsertScene}
            />
          )}
        </div>
        {mode === 'cinematic' && (
          <div className="vrew-editor__detail-area">
            <ClipDetailPanel
              clip={currentClip}
              aspectRatio={cinematic.aspectRatio}
              artStyleId={cinematic.artStyleId}
              videoPrompt={currentClip ? (cinematic.clipPrompts[currentClip.sceneId]?.video || '') : ''}
              imagePrompt={currentClip ? (cinematic.clipPrompts[currentClip.sceneId]?.image || '') : ''}
              onVideoPromptChange={(val) => {
                if (currentClip) {
                  cinematic.setClipPrompts((prev) => ({
                    ...prev,
                    [currentClip.sceneId]: { ...prev[currentClip.sceneId], video: val },
                  }));
                }
              }}
              onImagePromptChange={(val) => {
                if (currentClip) {
                  cinematic.setClipPrompts((prev) => ({
                    ...prev,
                    [currentClip.sceneId]: { ...prev[currentClip.sceneId], image: val },
                  }));
                }
              }}
              isRegenerating={currentClip ? cinematic.isRegenerating(currentClip.sceneId) : false}
              onRegenerateVideo={() => {
                if (currentClip) cinematic.handleRegenerateVideo(currentClip.sceneId, currentClip.id);
              }}
              isRegeneratingImage={currentClip ? cinematic.isRegeneratingImage(currentClip.sceneId) : false}
              onRegenerateImage={() => {
                if (currentClip) cinematic.handleRegenerateImage(currentClip.sceneId, currentClip.id);
              }}
              sceneImageUrl={
                currentClip
                  ? (cinematic.storeSceneImages[currentClip.sceneId]?.[0] || currentClip.imageUrl)
                  : ''
              }
              onDurationChange={(duration) => {
                if (currentClip) cinematic.handleDurationChange(currentClip.sceneId, duration);
              }}
              isEdited={currentClip?.isEdited}
              castNames={cinematic.currentSceneCardIds
                .map((id) => cinematic.cardLibrary.find((c) => c.id === id))
                .filter((c): c is AssetCard => !!c)
                .map((c) => c.name)
                .slice(0, 5)}
              availableCards={cinematic.availableCastCards}
              selectedCardIds={cinematic.currentSceneCardIds}
              onToggleCard={cinematic.handleToggleCard}
            />
          </div>
        )}
      </div>

      {/* 리사이즈 구분선 (시네마틱만) */}
      {mode !== 'narration' && (
        <div
          ref={dividerRef}
          className="vrew-editor__divider"
          onMouseDown={handleDividerMouseDown}
        >
          <GripHorizontal size={14} />
        </div>
      )}

      {/* 컨트롤 바 */}
      <EditorControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        totalDuration={activeTotalDuration}
        currentClipIndex={currentClipIndex}
        clipCount={activeClips.length}
        onTogglePlay={togglePlay}
        onPrev={mode === 'cinematic' ? cinematic.handlePrevClip : narration.handlePrevClip}
        onNext={mode === 'cinematic' ? cinematic.handleNextClip : narration.handleNextClip}
        onSplit={mode === 'cinematic' ? cinematic.handleSplit : narration.handleSplit}
        onDelete={mode === 'cinematic' ? cinematic.handleDelete : narration.handleDelete}
        canSplit={mode === 'cinematic' ? cinematic.canSplit : narration.canSplit}
        canDelete={mode === 'cinematic' ? cinematic.canDelete : narration.canDelete}
        mode={mode}
        onUndo={history.undo}
        onRedo={history.redo}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
      />

      {/* 하단: 타임라인 (시네마틱만) */}
      {mode !== 'narration' && (
        <div
          style={{
            flex: `${100 - mainFlex} 0 0%`,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <EditorTimeline
            clips={activeClips}
            currentClipIndex={currentClipIndex}
            currentTime={currentTime}
            totalDuration={activeTotalDuration}
            onClipSelect={seekToClip}
            onReorder={cinematic.handleTimelineReorder}
            onDeleteClip={cinematic.handleTimelineDelete}
            onSeek={cinematic.handleTimelineSeek}
            playheadRef={playheadRef}
            onInsertScene={cinematic.handleInsertScene}
            onPpsChange={(getter) => { ppsGetterRef.current = getter; }}
            mode={mode}
            audioItems={cinematic.audioItems}
            subtitleItems={cinematic.subtitleItems}
            onAddAudio={cinematic.handleAddAudio}
            onAddSubtitle={cinematic.handleAddSubtitle}
            onDeleteAudio={cinematic.handleDeleteAudio}
            onDeleteSubtitle={cinematic.handleDeleteSubtitle}
            onResizeSubtitle={cinematic.handleResizeSubtitle}
            onEditSubtitleText={cinematic.handleEditSubtitleText}
            onMoveAudio={cinematic.handleMoveAudio}
            onMoveSubtitle={cinematic.handleMoveSubtitle}
            autoEditSubId={cinematic.lastAddedSubId}
            onAutoEditConsumed={() => cinematic.setLastAddedSubId(null)}
          />
        </div>
      )}

      {/* TTS 팝업 (시네마틱 모드) */}
      <TtsPopupModal
        ttsPopup={cinematic.ttsPopup}
        ttsText={cinematic.ttsText}
        isTtsGenerating={cinematic.isTtsGenerating}
        onClose={() => cinematic.setTtsPopup(null)}
        onTextChange={cinematic.setTtsText}
        onGenerate={cinematic.handleGenerateTts}
      />

      {/* 에셋 교체 모달 (나레이션 모드) */}
      {mode === 'narration' && (
        <AssetRegenerateModal
          range={assetRegenRange}
          rangeClips={
            assetRegenRange
              ? narration.clips.slice(assetRegenRange.startClipIndex, assetRegenRange.endClipIndex + 1)
              : []
          }
          initialImagePrompt={
            assetRegenRange
              ? buildImagePrompt({
                  artStyleId: artStyleIdForRegen ?? 'cinematic',
                  sceneText: narration.clips
                    .slice(assetRegenRange.startClipIndex, assetRegenRange.endClipIndex + 1)
                    .map(c => c.text).join(' '),
                  seedCards: regenAvailableCards.filter((c) => regenInitialSeedIds.includes(c.id)),
                  templateId: templateIdForRegen ?? undefined,
                })
              : ''
          }
          initialVideoPrompt={
            assetRegenRange
              ? buildVideoPrompt({
                  artStyleId: artStyleIdForRegen ?? 'cinematic',
                  sceneText: narration.clips
                    .slice(assetRegenRange.startClipIndex, assetRegenRange.endClipIndex + 1)
                    .map(c => c.text).join(' '),
                  seedCards: regenAvailableCards.filter((c) => regenInitialSeedIds.includes(c.id)),
                  templateId: templateIdForRegen ?? undefined,
                })
              : ''
          }
          onClose={() => setAssetRegenRange(null)}
          onRegenerateImage={handleAssetRegenerateImage}
          onRegenerateVideo={handleAssetRegenerateVideo}
          isRegenerating={isAssetRegenerating}
          availableCards={regenAvailableCards}
          initialSeedIds={regenInitialSeedIds}
          artStyleId={artStyleIdForRegen ?? 'cinematic'}
          templateId={templateIdForRegen ?? undefined}
        />
      )}

      {/* 네비게이션 */}
      {(onPrev || onNext) && (
        <div className="vrew-editor__nav">
          {onPrev && (
            <button className="btn-secondary" onClick={onPrev}>
              이전
            </button>
          )}
          <div style={{ flex: 1 }} />
          {onNext && (
            <button className="btn-primary" onClick={onNext}>
              다음 &rarr;
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default VrewEditor;
