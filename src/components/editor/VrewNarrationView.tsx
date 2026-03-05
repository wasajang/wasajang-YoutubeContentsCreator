/**
 * VrewNarrationView — 나레이션 모드 전용 편집 뷰
 *
 * vrew-editor__main 영역의 패널들(preview, clip-list)과
 * Controls / Timeline / Nav를 렌더링합니다.
 *
 * narrationClips, enrichedNarrationClips 등 나레이션 전용 데이터와
 * 핸들러를 모두 내부에서 관리합니다.
 */
import React, { useCallback, useMemo } from 'react';
import { useProjectStore } from '../../store/projectStore';
import type { NarrationClip } from '../../store/projectStore';
import {
  narrationToEditorClips,
  editorClipsToNarration,
  type EditorClip,
} from './types';
import {
  splitClip,
  mergeClips,
  removeClip,
  reorderClips,
  splitClipAtWord,
  findCurrentWord,
} from '../../utils/narration-sync';
import { enrichWithWordTimings } from '../../utils/word-timing';
import { useNarrationClipGeneration } from '../../hooks/useNarrationClipGeneration';
import EditorPreview from './EditorPreview';
import VrewClipList from './VrewClipList';
import EditorControls from './EditorControls';
import EditorTimeline from './EditorTimeline';

/** EditorClip → NarrationClip 변환 (narration-sync 유틸 호환) */
function toNarrationClip(c: EditorClip): NarrationClip {
  return {
    id: c.id,
    sceneId: c.sceneId,
    text: c.text,
    sentences: c.sentences,
    imageUrl: c.imageUrl,
    videoUrl: c.videoUrl,
    isVideoEnabled: c.isVideoEnabled,
    effect: c.effect,
    audioStartTime: c.audioStartTime,
    audioEndTime: c.audioEndTime,
    duration: c.duration,
    order: c.order,
    isModified: false,
  };
}

/** 클립 배열의 label + order 재정렬 */
function relabel(clips: EditorClip[]): EditorClip[] {
  return clips.map((c, i) => ({
    ...c,
    order: i,
    label: `씬 ${String(i + 1).padStart(2, '0')}`,
  }));
}

export interface VrewNarrationViewProps {
  /** 공유 재생 상태 */
  currentClipIndex: number;
  setCurrentClipIndex: (index: number) => void;
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  togglePlay: () => void;
  seekToClip: (index: number) => void;
  seekToTime: (time: number) => void;
  /** GPU 가속 플레이헤드 ref */
  playheadRef: React.RefObject<HTMLDivElement | null>;
  ppsGetterRef: React.MutableRefObject<() => number>;
  /** 네비게이션 */
  onNext?: () => void;
  onPrev?: () => void;
  /** 타임라인 flex 비율 */
  timelineFlex: number;
}

const VrewNarrationView: React.FC<VrewNarrationViewProps> = ({
  currentClipIndex,
  setCurrentClipIndex,
  isPlaying,
  currentTime,
  totalDuration,
  togglePlay,
  seekToClip,
  seekToTime,
  playheadRef,
  ppsGetterRef,
  onNext,
  onPrev,
  timelineFlex,
}) => {
  // store에서 나레이션 전용 데이터 직접 접근
  const narrationClips = useProjectStore((s) => s.narrationClips);
  const setNarrationClips = useProjectStore((s) => s.setNarrationClips);

  // 나레이션 클립 생성 훅
  const clipGen = useNarrationClipGeneration();

  // enrichedNarrationClips: words 자동 보정
  const enrichedNarrationClips = useMemo(() => {
    return narrationClips.map((clip) => ({
      ...clip,
      sentences: enrichWithWordTimings(clip.sentences),
    }));
  }, [narrationClips]);

  // EditorClip으로 변환
  const clips = useMemo(
    () => narrationToEditorClips(enrichedNarrationClips),
    [enrichedNarrationClips]
  );

  const currentClip = clips[currentClipIndex] ?? null;

  // 현재 재생 단어
  const currentWord = useMemo(() => {
    if (!currentClip) return null;
    return findCurrentWord(currentTime, toNarrationClip(currentClip));
  }, [currentTime, currentClip]);

  // 클립 업데이트 (narration store에 저장)
  const updateClips = useCallback(
    (updated: EditorClip[]) => {
      setNarrationClips(editorClipsToNarration(updated));
    },
    [setNarrationClips]
  );

  // 자르기 (나레이션: 문장 중간점에서 분할)
  const handleSplit = useCallback(() => {
    const clip = clips[currentClipIndex];
    if (!clip || clip.sentences.length < 2) return;
    try {
      const splitIndex = Math.floor(clip.sentences.length / 2) - 1;
      const [a, b] = splitClip(toNarrationClip(clip), splitIndex);
      const clipA: EditorClip = { ...a, label: '', isEdited: true };
      const clipB: EditorClip = { ...b, label: '', isEdited: true };
      const updated = [...clips];
      updated.splice(currentClipIndex, 1, clipA, clipB);
      updateClips(relabel(updated));
    } catch (err) {
      console.error('[VrewNarrationView] split 실패:', err);
    }
  }, [clips, currentClipIndex, updateClips]);

  // 단어 위치에서 분할
  const handleSplitAtWord = useCallback(
    (clipIndex: number, globalWordIndex: number) => {
      const narr = useProjectStore.getState().narrationClips;
      const clip = narr[clipIndex];
      if (!clip) return;

      const enrichedSentences = enrichWithWordTimings(clip.sentences);
      let wordCount = 0;
      for (let si = 0; si < enrichedSentences.length; si++) {
        const words = enrichedSentences[si].words || [];
        for (let wi = 0; wi < words.length; wi++) {
          if (wordCount === globalWordIndex) {
            try {
              const enrichedClip = { ...clip, sentences: enrichedSentences };
              const [clipA, clipB] = splitClipAtWord(enrichedClip, si, wi);
              const newClips = [...narr];
              newClips.splice(clipIndex, 1, clipA, clipB);
              setNarrationClips(reorderClips(newClips));
            } catch (e) {
              console.warn('[VrewNarrationView] 단어 분할 실패:', e);
            }
            return;
          }
          wordCount++;
        }
      }
    },
    [setNarrationClips]
  );

  // 삭제 (컨트롤 버튼)
  const handleDelete = useCallback(() => {
    if (clips.length <= 1) return;
    updateClips(relabel(clips.filter((_, i) => i !== currentClipIndex)));
  }, [clips, currentClipIndex, updateClips]);

  // 타임라인: 클립 순서 드래그 변경
  const handleTimelineReorder = useCallback((fromIndex: number, toIndex: number) => {
    const updated = [...clips];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, { ...moved, isEdited: true });
    updateClips(relabel(updated));
  }, [clips, updateClips]);

  // 타임라인: 클립 삭제
  const handleTimelineDelete = useCallback((index: number) => {
    if (clips.length <= 1) return;
    updateClips(relabel(clips.filter((_, i) => i !== index)));
  }, [clips, updateClips]);

  // 타임라인: 눈금자 클릭 시간 이동
  const handleTimelineSeek = useCallback((time: number) => {
    seekToTime(time);
    let accumulated = 0;
    for (let i = 0; i < clips.length; i++) {
      if (accumulated + clips[i].duration >= time) {
        setCurrentClipIndex(i);
        return;
      }
      accumulated += clips[i].duration;
    }
    if (clips.length > 0) setCurrentClipIndex(clips.length - 1);
  }, [clips, seekToTime, setCurrentClipIndex]);

  // 클립 합치기
  const handleMergeWithPrev = useCallback(
    (idx: number) => {
      if (idx <= 0) return;
      const narr = useProjectStore.getState().narrationClips;
      const merged = mergeClips(narr[idx - 1], narr[idx]);
      const newClips = [...narr];
      newClips.splice(idx - 1, 2, merged);
      setNarrationClips(reorderClips(newClips));
    },
    [setNarrationClips]
  );

  // 클립 삭제 (VrewClipList에서 호출)
  const handleDeleteByIndex = useCallback(
    (idx: number) => {
      const narr = useProjectStore.getState().narrationClips;
      if (narr.length <= 1) return;
      setNarrationClips(removeClip(narr, narr[idx].id));
    },
    [setNarrationClips]
  );

  // 분할 가능 여부 (문장 2개 이상)
  const canSplit = useMemo(() => {
    if (!currentClip) return false;
    return currentClip.sentences.length >= 2;
  }, [currentClip]);

  const canDelete = clips.length > 1;

  // 이전/다음 클립 이동
  const handlePrevClip = useCallback(() => {
    if (currentClipIndex > 0) seekToClip(currentClipIndex - 1);
  }, [currentClipIndex, seekToClip]);

  const handleNextClip = useCallback(() => {
    if (currentClipIndex < clips.length - 1) seekToClip(currentClipIndex + 1);
  }, [currentClipIndex, clips.length, seekToClip]);

  return (
    <>
      {/* ── 상단 패널 영역 (vrew-editor__main 내부) ── */}
      <div className="vrew-editor__preview-area">
        <EditorPreview
          clip={currentClip}
          currentTime={currentTime}
          isPlaying={isPlaying}
          currentWord={currentWord}
        />
      </div>
      <div className="vrew-editor__script-area">
        <VrewClipList
          clips={clips}
          currentClipIndex={currentClipIndex}
          currentTime={currentTime}
          onClipSelect={seekToClip}
          onSplitAtWord={handleSplitAtWord}
          onMergeWithPrev={handleMergeWithPrev}
          onDelete={handleDeleteByIndex}
          onGenerateImage={(clipId) => clipGen.generateClipImage(clipId)}
          onGenerateVideo={(clipId) => clipGen.generateClipVideo(clipId)}
          onGenerateSceneImage={(sceneId) => clipGen.generateSceneImage(sceneId)}
          onGenerateSceneVideo={(sceneId) => clipGen.generateSceneVideo(sceneId)}
          onGenerateAllImages={() => clipGen.generateAllClipImages()}
          onGenerateAllVideos={() => clipGen.generateAllClipVideos()}
          clipGenStatus={clipGen.clipGenStatus}
          clipVideoGenStatus={clipGen.clipVideoGenStatus}
        />
      </div>

      {/* ── 구분선 아래 영역 (vrew-editor__main 밖, 형제 요소) ── */}

      {/* 컨트롤 바 */}
      <EditorControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        totalDuration={totalDuration}
        currentClipIndex={currentClipIndex}
        clipCount={clips.length}
        onTogglePlay={togglePlay}
        onPrev={handlePrevClip}
        onNext={handleNextClip}
        onSplit={handleSplit}
        onDelete={handleDelete}
        canSplit={canSplit}
        canDelete={canDelete}
        mode="narration"
      />

      {/* 타임라인 wrapper */}
      <div
        style={{
          flex: `${100 - timelineFlex} 0 0%`,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <EditorTimeline
          clips={clips}
          currentClipIndex={currentClipIndex}
          currentTime={currentTime}
          totalDuration={totalDuration}
          onClipSelect={seekToClip}
          onReorder={handleTimelineReorder}
          onDeleteClip={handleTimelineDelete}
          onSeek={handleTimelineSeek}
          playheadRef={playheadRef}
          onInsertScene={undefined}
          onPpsChange={(getter) => { ppsGetterRef.current = getter; }}
          mode="narration"
        />
      </div>

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
    </>
  );
};

export default VrewNarrationView;
