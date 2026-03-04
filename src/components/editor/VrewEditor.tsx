/**
 * VrewEditor — Vrew 스타일 편집기 메인 컨테이너
 *
 * 3단 레이아웃:
 *   상단: 미리보기(60%) + 대본 패널(40%)
 *   중간: 재생 컨트롤 + 편집 도구
 *   하단: 3트랙 타임라인 (영상/음성/자막)
 *
 * 시네마틱 + 나레이션 양쪽 모드 지원
 */
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useProjectStore } from '../../store/projectStore';
import type { NarrationClip, AssetCard } from '../../store/projectStore';
import { useEditorPlayback } from '../../hooks/useEditorPlayback';
import {
  scenesToEditorClips,
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
  splitClipAtTime,
  findCurrentWord,
} from '../../utils/narration-sync';
import { enrichWithWordTimings } from '../../utils/word-timing';
import EditorPreview from './EditorPreview';
import ScriptPanel from './ScriptPanel';
import EditorTimeline from './EditorTimeline';
import EditorControls from './EditorControls';
import ClipDetailPanel from './ClipDetailPanel';
import VrewClipList from './VrewClipList';
import { useVideoRegeneration } from '../../hooks/useVideoRegeneration';
import { useImageRegeneration } from '../../hooks/useImageRegeneration';
import { useNarrationClipGeneration } from '../../hooks/useNarrationClipGeneration';
import { buildImagePrompt, buildVideoPrompt } from '../../services/prompt-builder';

interface VrewEditorProps {
  onNext?: () => void;
  onPrev?: () => void;
}

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

const VrewEditor: React.FC<VrewEditorProps> = ({ onNext, onPrev }) => {
  const mode = useProjectStore((s) => s.mode);
  const scenes = useProjectStore((s) => s.scenes);
  const narrationClips = useProjectStore((s) => s.narrationClips);
  const setNarrationClips = useProjectStore((s) => s.setNarrationClips);
  const narrativeAudioUrl = useProjectStore((s) => s.narrativeAudioUrl);

  // 시네마틱 모드용 추가 store 데이터
  const artStyleId = useProjectStore((s) => s.artStyleId);
  const templateId = useProjectStore((s) => s.templateId);
  const aspectRatio = useProjectStore((s) => s.aspectRatio);
  const cardLibrary = useProjectStore((s) => s.cardLibrary);
  const selectedDeck = useProjectStore((s) => s.selectedDeck);
  const storeSceneImages = useProjectStore((s) => s.sceneImages);
  const sceneSeeds = useProjectStore((s) => s.sceneSeeds);
  const sceneVideos = useProjectStore((s) => s.sceneVideos);

  // 시네마틱 모드: 로컬 클립 상태
  const [cinematicClips, setCinematicClips] = useState<EditorClip[]>(() =>
    scenesToEditorClips(scenes)
  );

  // 시네마틱 모드: 프롬프트 상태 + 재생성 훅
  const [clipPrompts, setClipPrompts] = useState<Record<string, { image: string; video: string }>>({});
  const { isRegenerating, regenerateVideo } = useVideoRegeneration();
  const { isRegenerating: isRegeneratingImage, regenerateImage } = useImageRegeneration();

  // 나레이션 모드: 이미지/영상 생성 훅 (항상 호출, 모드 무관하게 — React 규칙 준수)
  const clipGen = useNarrationClipGeneration();

  // 나레이션 클립에 words 자동 보정 (enrichWithWordTimings)
  const enrichedNarrationClips = useMemo(() => {
    if (mode !== 'narration') return narrationClips;
    return narrationClips.map((clip) => ({
      ...clip,
      sentences: enrichWithWordTimings(clip.sentences),
    }));
  }, [mode, narrationClips]);

  // 통합 클립 배열
  const clips = useMemo(
    () =>
      mode === 'narration'
        ? narrationToEditorClips(enrichedNarrationClips)
        : cinematicClips,
    [mode, enrichedNarrationClips, cinematicClips]
  );

  const audioUrl = mode === 'narration' ? narrativeAudioUrl : '';

  // GPU 가속 플레이헤드 ref
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const ppsGetterRef = useRef<() => number>(() => 40);

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
    clips,
    audioUrl,
    playheadRef,
    getTimelinePxPerSec: () => ppsGetterRef.current(),
  });

  const currentClip = clips[currentClipIndex] ?? null;

  // currentWord: 현재 재생 시간의 단어를 useMemo로 파생 (useEditorPlayback 훅 수 불변 유지)
  const currentWord = useMemo(() => {
    if (mode !== 'narration' || !currentClip) return null;
    return findCurrentWord(currentTime, toNarrationClip(currentClip));
  }, [mode, currentTime, currentClip]);

  // 씬 수가 바뀔 때 프롬프트 초기화 (시네마틱 모드)
  useEffect(() => {
    if (mode !== 'cinematic' || scenes.length === 0) return;
    const prompts: Record<string, { image: string; video: string }> = {};
    const seedCards: AssetCard[] = selectedDeck
      .map((id) => cardLibrary.find((c) => c.id === id))
      .filter((c): c is AssetCard => !!c);
    scenes.forEach((scene) => {
      prompts[scene.id] = {
        image: buildImagePrompt({
          artStyleId,
          sceneText: scene.text,
          seedCards,
          templateId: templateId ?? undefined,
        }),
        video: buildVideoPrompt({
          artStyleId,
          sceneText: scene.text,
          seedCards,
          templateId: templateId ?? undefined,
        }),
      };
    });
    setClipPrompts(prompts);
  }, [scenes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // 재생성 핸들러
  const handleRegenerateVideo = useCallback(async (sceneId: string) => {
    const prompt = clipPrompts[sceneId]?.video || '';
    const imageUrl =
      storeSceneImages[sceneId]?.[0] ||
      scenes.find((s) => s.id === sceneId)?.imageUrl ||
      '';

    const newVideoUrl = await regenerateVideo(sceneId, prompt, imageUrl);
    if (newVideoUrl) {
      setCinematicClips((prev) =>
        prev.map((c) =>
          c.sceneId === sceneId
            ? { ...c, videoUrl: newVideoUrl, isVideoEnabled: true }
            : c
        )
      );
    }
  }, [clipPrompts, storeSceneImages, scenes, regenerateVideo]);

  // 이미지 재생성 핸들러
  const handleRegenerateImage = useCallback(async (sceneId: string) => {
    const prompt = clipPrompts[sceneId]?.image || '';
    const sizeMap: Record<string, { width: number; height: number }> = {
      '9:16': { width: 720, height: 1280 },
      '1:1': { width: 1024, height: 1024 },
      '16:9': { width: 1280, height: 720 },
    };
    const { width, height } = sizeMap[aspectRatio] || sizeMap['16:9'];

    const newImageUrl = await regenerateImage(sceneId, prompt, width, height);
    if (newImageUrl) {
      setCinematicClips((prev) =>
        prev.map((c) =>
          c.sceneId === sceneId
            ? { ...c, imageUrl: newImageUrl }
            : c
        )
      );
    }
  }, [clipPrompts, aspectRatio, regenerateImage]);

  // 클립 업데이트 (모드별 분기)
  const updateClips = useCallback(
    (updated: EditorClip[]) => {
      if (mode === 'narration') {
        setNarrationClips(editorClipsToNarration(updated));
      } else {
        setCinematicClips(updated);
      }
    },
    [mode, setNarrationClips]
  );

  // 대본 텍스트 편집
  const handleTextChange = useCallback(
    (clipId: string, text: string) => {
      const updated = clips.map((c) =>
        c.id === clipId ? { ...c, text } : c
      );
      updateClips(updated);
    },
    [clips, updateClips]
  );

  // 자르기 — 시네마틱: 플레이헤드 위치, 나레이션: 문장 중간점
  const handleSplit = useCallback(() => {
    const clip = clips[currentClipIndex];
    if (!clip) return;

    try {
      let clipA: EditorClip, clipB: EditorClip;

      if (mode === 'cinematic') {
        // 시네마틱: 플레이헤드 위치(currentTime)에서 분할
        const [a, b] = splitClipAtTime(toNarrationClip(clip), currentTime);
        clipA = { ...a, label: '', isEdited: true };
        clipB = { ...b, label: '', isEdited: true };
      } else {
        // 나레이션: 기존 방식 (문장 중간점)
        if (clip.sentences.length < 2) return;
        const splitIndex = Math.floor(clip.sentences.length / 2) - 1;
        const [a, b] = splitClip(toNarrationClip(clip), splitIndex);
        clipA = { ...a, label: '', isEdited: true };
        clipB = { ...b, label: '', isEdited: true };
      }

      const updated = [...clips];
      updated.splice(currentClipIndex, 1, clipA, clipB);
      updateClips(relabel(updated));
    } catch (err) {
      console.error('[VrewEditor] split 실패:', err);
    }
  }, [clips, currentClipIndex, mode, currentTime, updateClips]);

  // 단어 위치에서 분할 (나레이션 모드 전용)
  const handleSplitAtWord = useCallback(
    (clipIndex: number, globalWordIndex: number) => {
      if (mode !== 'narration') return;

      const narr = useProjectStore.getState().narrationClips;
      const clip = narr[clipIndex];
      if (!clip) return;

      // ★ 핵심 수정: store 클립에 word timing이 없을 수 있으므로 보강
      const enrichedSentences = enrichWithWordTimings(clip.sentences);

      // globalWordIndex를 sentenceIndex + wordIndexInSentence로 변환
      let wordCount = 0;
      for (let si = 0; si < enrichedSentences.length; si++) {
        const words = enrichedSentences[si].words || [];
        for (let wi = 0; wi < words.length; wi++) {
          if (wordCount === globalWordIndex) {
            try {
              // enriched words를 포함한 클립으로 분할
              const enrichedClip = { ...clip, sentences: enrichedSentences };
              const [clipA, clipB] = splitClipAtWord(enrichedClip, si, wi);
              const newClips = [...narr];
              newClips.splice(clipIndex, 1, clipA, clipB);
              setNarrationClips(reorderClips(newClips));
            } catch (e) {
              console.warn('[VrewEditor] 단어 분할 실패:', e);
            }
            return;
          }
          wordCount++;
        }
      }
    },
    [mode, setNarrationClips]
  );

  // 삭제
  const handleDelete = useCallback(() => {
    if (clips.length <= 1) return;
    const updated = clips.filter((_, i) => i !== currentClipIndex);
    updateClips(relabel(updated));
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
    const updated = clips.filter((_, i) => i !== index);
    updateClips(relabel(updated));
  }, [clips, updateClips]);

  // 타임라인: 눈금자 클릭 시간 이동 (정확한 플레이헤드 위치 설정)
  const handleTimelineSeek = useCallback((time: number) => {
    // 정확한 시간 위치 설정 (seekToTime은 currentTime 상태도 업데이트)
    seekToTime(time);
    // 해당 시간에 위치한 클립도 선택
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

  // 씬 삽입 (Part C)
  const handleInsertScene = useCallback((afterIndex: number) => {
    const insertIndex = afterIndex + 1;
    const prevClip = clips[afterIndex];
    if (!prevClip) return;

    const newClip: EditorClip = {
      id: `scene-new-${Date.now()}`,
      sceneId: `scene-new-${Date.now()}`,
      text: '',
      sentences: [],
      imageUrl: '',
      videoUrl: '',
      isVideoEnabled: false,
      effect: 'none',
      audioStartTime: prevClip.audioEndTime,
      audioEndTime: prevClip.audioEndTime + 5,
      duration: 5,
      order: insertIndex,
      label: '',
    };

    const newClips = [...clips];
    newClips.splice(insertIndex, 0, newClip);

    // 삽입 지점 이후 시간 +5초 재조정
    for (let i = insertIndex + 1; i < newClips.length; i++) {
      newClips[i] = {
        ...newClips[i],
        audioStartTime: newClips[i].audioStartTime + 5,
        audioEndTime: newClips[i].audioEndTime + 5,
      };
    }

    updateClips(relabel(newClips));
    setCurrentClipIndex(insertIndex);
  }, [clips, updateClips, setCurrentClipIndex]);

  // 이전/다음 클립 이동
  const handlePrevClip = useCallback(() => {
    if (currentClipIndex > 0) seekToClip(currentClipIndex - 1);
  }, [currentClipIndex, seekToClip]);

  const handleNextClip = useCallback(() => {
    if (currentClipIndex < clips.length - 1) seekToClip(currentClipIndex + 1);
  }, [currentClipIndex, clips.length, seekToClip]);

  // 나레이션 모드: 클립 합치기 (VrewClipList에서 호출)
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

  // 나레이션 모드: 클립 삭제 (VrewClipList에서 호출)
  const handleDeleteByIndex = useCallback(
    (idx: number) => {
      const narr = useProjectStore.getState().narrationClips;
      if (narr.length <= 1) return;
      setNarrationClips(removeClip(narr, narr[idx].id));
    },
    [setNarrationClips]
  );

  // 스페이스바 재생/일시정지
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]);

  // 시네마틱: 플레이헤드가 클립 시작~끝 사이에 있어야 분할 가능
  // 나레이션: 문장 2개 이상
  const canSplit = useMemo(() => {
    if (!currentClip) return false;
    if (mode === 'cinematic') {
      return currentTime > currentClip.audioStartTime + 0.1
          && currentTime < currentClip.audioEndTime - 0.1;
    }
    return currentClip.sentences.length >= 2;
  }, [currentClip, mode, currentTime]);
  const canDelete = clips.length > 1;

  if (clips.length === 0) {
    return (
      <div className="vrew-editor vrew-editor--empty">
        <p>편집할 씬이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="vrew-editor">
      {/* 상단: 미리보기 + 대본 패널 (+ 시네마틱 모드: 클립 상세 패널) */}
      <div className="vrew-editor__main">
        <div className="vrew-editor__preview-area">
          <EditorPreview
            clip={currentClip}
            currentTime={currentTime}
            isPlaying={isPlaying}
            currentWord={currentWord}
          />
        </div>
        <div className="vrew-editor__script-area">
          {mode === 'narration' ? (
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
          ) : (
            <ScriptPanel
              clips={clips}
              currentClipIndex={currentClipIndex}
              onClipSelect={seekToClip}
              onTextChange={handleTextChange}
              aspectRatio={aspectRatio}
              sceneVideos={sceneVideos}
              onRegenerateVideo={(sceneId) => handleRegenerateVideo(sceneId)}
              isRegenerating={(sceneId) => isRegenerating(sceneId)}
              onInsertScene={handleInsertScene}
            />
          )}
        </div>
        {mode === 'cinematic' && (
          <div className="vrew-editor__detail-area">
            <ClipDetailPanel
              clip={currentClip}
              aspectRatio={aspectRatio}
              artStyleId={artStyleId}
              videoPrompt={currentClip ? (clipPrompts[currentClip.sceneId]?.video || '') : ''}
              imagePrompt={currentClip ? (clipPrompts[currentClip.sceneId]?.image || '') : ''}
              onVideoPromptChange={(val) => {
                if (currentClip) {
                  setClipPrompts((prev) => ({
                    ...prev,
                    [currentClip.sceneId]: {
                      ...prev[currentClip.sceneId],
                      video: val,
                    },
                  }));
                }
              }}
              onImagePromptChange={(val) => {
                if (currentClip) {
                  setClipPrompts((prev) => ({
                    ...prev,
                    [currentClip.sceneId]: {
                      ...prev[currentClip.sceneId],
                      image: val,
                    },
                  }));
                }
              }}
              isRegenerating={currentClip ? isRegenerating(currentClip.sceneId) : false}
              onRegenerateVideo={() => {
                if (currentClip) handleRegenerateVideo(currentClip.sceneId);
              }}
              isRegeneratingImage={currentClip ? isRegeneratingImage(currentClip.sceneId) : false}
              onRegenerateImage={() => {
                if (currentClip) handleRegenerateImage(currentClip.sceneId);
              }}
              sceneImageUrl={
                currentClip
                  ? (storeSceneImages[currentClip.sceneId]?.[0] || currentClip.imageUrl)
                  : ''
              }
              isEdited={currentClip?.isEdited}
              castNames={(() => {
                // 씬별 캐스트 씨드가 있으면 해당 씨드 사용, 없으면 전체 덱 사용
                const sceneId = currentClip?.sceneId;
                const seedIds = sceneId && sceneSeeds[sceneId]?.length
                  ? sceneSeeds[sceneId]
                  : selectedDeck;
                return seedIds
                  .map((id) => cardLibrary.find((c) => c.id === id))
                  .filter((c): c is AssetCard => !!c)
                  .map((c) => c.name)
                  .slice(0, 5);
              })()}
            />
          </div>
        )}
      </div>

      {/* 중간: 컨트롤 */}
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
      />

      {/* 하단: 타임라인 */}
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
        onInsertScene={handleInsertScene}
        onPpsChange={(getter) => { ppsGetterRef.current = getter; }}
      />

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
