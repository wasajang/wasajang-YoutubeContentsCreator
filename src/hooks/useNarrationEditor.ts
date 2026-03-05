/**
 * useNarrationEditor — 나레이션 편집기 로직 훅
 *
 * VrewNarrationView에서 추출한 상태와 핸들러.
 * VrewEditor가 이 훅을 호출하여 레이아웃을 직접 제어합니다.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { useProjectStore } from '../store/projectStore';
import type { NarrationClip } from '../store/projectStore';
import type { MediaRange } from '../components/editor/types';
import {
  narrationToEditorClips,
  editorClipsToNarration,
  type EditorClip,
} from '../components/editor/types';
import {
  splitClip,
  mergeClips,
  removeClip,
  reorderClips,
  splitClipAtWord,
  findCurrentWord,
} from '../utils/narration-sync';
import { enrichWithWordTimings } from '../utils/word-timing';
import { useNarrationClipGeneration } from './useNarrationClipGeneration';

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

interface UseNarrationEditorOptions {
  currentClipIndex: number;
  setCurrentClipIndex: (index: number) => void;
  currentTime: number;
  seekToClip: (index: number) => void;
  seekToTime: (time: number) => void;
}

export function useNarrationEditor({
  currentClipIndex,
  setCurrentClipIndex,
  currentTime,
  seekToClip,
  seekToTime,
}: UseNarrationEditorOptions) {
  // store에서 나레이션 전용 데이터 직접 접근
  const narrationClips = useProjectStore((s) => s.narrationClips);
  const setNarrationClips = useProjectStore((s) => s.setNarrationClips);

  // MediaRange 관련 store 구독
  const scenes = useProjectStore((s) => s.scenes);
  const sceneImages = useProjectStore((s) => s.sceneImages);
  const sceneVideos = useProjectStore((s) => s.sceneVideos);
  const mediaRanges = useProjectStore((s) => s.mediaRanges);
  const setMediaRanges = useProjectStore((s) => s.setMediaRanges);

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

  // 디폴트 MediaRange 자동 생성 (최초 1회, narrationClips가 있고 mediaRanges가 비어있을 때)
  useEffect(() => {
    if (mediaRanges.length > 0 || narrationClips.length === 0) return;

    const ranges: MediaRange[] = [];
    let i = 0;
    while (i < narrationClips.length) {
      const sceneId = narrationClips[i].sceneId;
      const start = i;
      while (i < narrationClips.length && narrationClips[i].sceneId === sceneId) i++;
      const end = i - 1;

      const videoUrl =
        (sceneVideos as Record<string, string[]>)[sceneId]?.[0] ||
        scenes.find((s) => s.id === sceneId)?.videoUrl;
      const imageUrl =
        (sceneImages as Record<string, string[]>)[sceneId]?.[0] ||
        scenes.find((s) => s.id === sceneId)?.imageUrl;

      if (videoUrl || imageUrl) {
        ranges.push({
          id: `range-${sceneId}-${Date.now()}-${start}`,
          type: videoUrl ? 'video' : 'image',
          url: videoUrl || imageUrl || '',
          startClipIndex: start,
          endClipIndex: end,
          sceneId,
        });
      }
    }
    if (ranges.length > 0) setMediaRanges(ranges);
  }, [narrationClips.length]); // eslint-disable-line

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
      console.error('[useNarrationEditor] split 실패:', err);
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
              console.warn('[useNarrationEditor] 단어 분할 실패:', e);
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

  // 이전/다음 클립 이동
  const handlePrevClip = useCallback(() => {
    if (currentClipIndex > 0) seekToClip(currentClipIndex - 1);
  }, [currentClipIndex, seekToClip]);

  const handleNextClip = useCallback(() => {
    if (currentClipIndex < clips.length - 1) seekToClip(currentClipIndex + 1);
  }, [currentClipIndex, clips.length, seekToClip]);

  // 분할 가능 여부 (문장 2개 이상)
  const canSplit = useMemo(() => {
    if (!currentClip) return false;
    return currentClip.sentences.length >= 2;
  }, [currentClip]);

  const canDelete = clips.length > 1;

  // MediaRange 리사이즈 핸들러
  const handleMediaRangeResize = useCallback(
    (rangeId: string, newStart: number, newEnd: number) => {
      setMediaRanges(
        mediaRanges.map((r) =>
          r.id === rangeId
            ? { ...r, startClipIndex: newStart, endClipIndex: newEnd }
            : r
        )
      );
    },
    [mediaRanges, setMediaRanges]
  );

  return {
    // 클립 배열
    clips,
    currentClip,
    currentWord,
    canSplit,
    canDelete,
    // 클립 생성 훅
    clipGen,
    // 핸들러
    handleSplit,
    handleSplitAtWord,
    handleDelete,
    handleTimelineReorder,
    handleTimelineDelete,
    handleTimelineSeek,
    handleMergeWithPrev,
    handleDeleteByIndex,
    handlePrevClip,
    handleNextClip,
    // MediaRange
    mediaRanges,
    setMediaRanges,
    handleMediaRangeResize,
  };
}
