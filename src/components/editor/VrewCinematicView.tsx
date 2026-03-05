/**
 * VrewCinematicView — 시네마틱 모드 전용 패널 콘텐츠
 *
 * vrew-editor__main 영역 안의 패널들(preview, script, detail)을 렌더링합니다.
 * Controls / Timeline / Nav는 부모 VrewEditor에서 렌더링합니다.
 *
 * 시네마틱 전용 상태(sceneDurations, audioItems, subtitleItems, clipPrompts,
 * ttsPopup)와 핸들러를 내부에서 관리합니다.
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useProjectStore } from '../../store/projectStore';
import type { AssetCard } from '../../store/projectStore';
import {
  scenesToEditorClips,
  type EditorClip,
  type AudioItem,
  type SubtitleItem,
} from './types';
import { buildImagePrompt, buildVideoPrompt } from '../../services/prompt-builder';
import { generateTTS } from '../../services/ai-tts';
import { useVideoRegeneration } from '../../hooks/useVideoRegeneration';
import { useImageRegeneration } from '../../hooks/useImageRegeneration';
import EditorPreview from './EditorPreview';
import ScriptPanel from './ScriptPanel';
import ClipDetailPanel from './ClipDetailPanel';
import EditorControls from './EditorControls';
import EditorTimeline from './EditorTimeline';
import TtsPopupModal from './TtsPopupModal';

/** 클립 배열의 label + order 재정렬 */
function relabel(clips: EditorClip[]): EditorClip[] {
  return clips.map((c, i) => ({
    ...c,
    order: i,
    label: `씬 ${String(i + 1).padStart(2, '0')}`,
  }));
}

export interface VrewCinematicViewProps {
  /** 공유 재생 상태 (useEditorPlayback에서 온 값) */
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
  /** 클립 배열 (부모와 공유) */
  clips: EditorClip[];
  onClipsChange: (clips: EditorClip[]) => void;
  /** 타임라인 flex 비율 */
  timelineFlex: number;
}

const VrewCinematicView: React.FC<VrewCinematicViewProps> = ({
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
  clips,
  onClipsChange,
  timelineFlex,
}) => {
  // store에서 시네마틱 전용 데이터 직접 접근
  const scenes = useProjectStore((s) => s.scenes);
  const artStyleId = useProjectStore((s) => s.artStyleId);
  const templateId = useProjectStore((s) => s.templateId);
  const aspectRatio = useProjectStore((s) => s.aspectRatio);
  const cardLibrary = useProjectStore((s) => s.cardLibrary);
  const selectedDeck = useProjectStore((s) => s.selectedDeck);
  const storeSceneImages = useProjectStore((s) => s.sceneImages);
  const sceneSeeds = useProjectStore((s) => s.sceneSeeds);
  const updateSceneSeeds = useProjectStore((s) => s.updateSceneSeeds);
  const sceneVideos = useProjectStore((s) => s.sceneVideos);

  // 씬별 영상 길이 (기본 5초)
  const [sceneDurations, setSceneDurations] = useState<Record<string, number>>({});

  // 독립 음성/자막 아이템
  const [audioItems, setAudioItems] = useState<AudioItem[]>([]);
  const [subtitleItems, setSubtitleItems] = useState<SubtitleItem[]>([]);

  // 프롬프트 상태 + 재생성 훅
  const [clipPrompts, setClipPrompts] = useState<Record<string, { image: string; video: string }>>({});
  const { isRegenerating, regenerateVideo } = useVideoRegeneration();
  const { isRegenerating: isRegeneratingImage, regenerateImage } = useImageRegeneration();

  // TTS 팝업 상태
  const [ttsPopup, setTtsPopup] = useState<{ startTime: number } | null>(null);
  const [ttsText, setTtsText] = useState('');
  const [isTtsGenerating, setIsTtsGenerating] = useState(false);

  const currentClip = clips[currentClipIndex] ?? null;

  // sceneDurations 변경 시 clips 재계산 → 부모에 알림
  useEffect(() => {
    onClipsChange(scenesToEditorClips(scenes, sceneDurations));
  }, [sceneDurations]); // eslint-disable-line react-hooks/exhaustive-deps

  // 씬 수가 바뀔 때 프롬프트 초기화
  useEffect(() => {
    if (scenes.length === 0) return;
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

  // 재생성 핸들러 — 영상
  const handleRegenerateVideo = useCallback(async (sceneId: string) => {
    const prompt = clipPrompts[sceneId]?.video || '';
    const imageUrl =
      storeSceneImages[sceneId]?.[0] ||
      scenes.find((s) => s.id === sceneId)?.imageUrl ||
      '';
    const newVideoUrl = await regenerateVideo(sceneId, prompt, imageUrl);
    if (newVideoUrl) {
      onClipsChange(
        clips.map((c) =>
          c.sceneId === sceneId
            ? { ...c, videoUrl: newVideoUrl, isVideoEnabled: true }
            : c
        )
      );
    }
  }, [clipPrompts, storeSceneImages, scenes, regenerateVideo, clips, onClipsChange]);

  // 영상 길이 변경 핸들러
  const handleDurationChange = useCallback((sceneId: string, duration: number) => {
    setSceneDurations((prev) => ({ ...prev, [sceneId]: duration }));
  }, []);

  // 캐스트 카드 토글 핸들러
  const handleToggleCard = useCallback((cardId: string) => {
    if (!currentClip) return;
    const sceneId = currentClip.sceneId;
    const currentSeeds = sceneSeeds[sceneId] ?? [...selectedDeck];
    const newSeeds = currentSeeds.includes(cardId)
      ? currentSeeds.filter((id) => id !== cardId)
      : [...currentSeeds, cardId];
    updateSceneSeeds(sceneId, newSeeds);

    const seedCards: AssetCard[] = newSeeds
      .map((id) => cardLibrary.find((c) => c.id === id))
      .filter((c): c is AssetCard => !!c);
    const scene = scenes.find((s) => s.id === sceneId);
    if (scene) {
      setClipPrompts((prev) => ({
        ...prev,
        [sceneId]: {
          ...prev[sceneId],
          image: buildImagePrompt({
            artStyleId,
            sceneText: scene.text,
            seedCards,
            templateId: templateId ?? undefined,
          }),
        },
      }));
    }
  }, [currentClip, sceneSeeds, selectedDeck, updateSceneSeeds, cardLibrary, scenes, artStyleId, templateId]);

  // 사용 가능한 캐스트 카드 목록
  const availableCastCards = useMemo(() => {
    return selectedDeck
      .map((id) => cardLibrary.find((c) => c.id === id))
      .filter((c): c is AssetCard => !!c);
  }, [selectedDeck, cardLibrary]);

  // 현재 씬의 선택된 캐스트 카드 IDs
  const currentSceneCardIds = useMemo(() => {
    if (!currentClip) return [];
    return sceneSeeds[currentClip.sceneId] ?? [...selectedDeck];
  }, [currentClip, sceneSeeds, selectedDeck]);

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
      onClipsChange(
        clips.map((c) =>
          c.sceneId === sceneId ? { ...c, imageUrl: newImageUrl } : c
        )
      );
    }
  }, [clipPrompts, aspectRatio, regenerateImage, clips, onClipsChange]);

  // 대본 텍스트 편집
  const handleTextChange = useCallback((clipId: string, text: string) => {
    onClipsChange(clips.map((c) => (c.id === clipId ? { ...c, text } : c)));
  }, [clips, onClipsChange]);

  // 자르기 (시네마틱: 플레이헤드 위치에서 분할)
  const handleSplit = useCallback(() => {
    const clip = clips[currentClipIndex];
    if (!clip) return;
    try {
      const localTime = currentTime - clip.audioStartTime;
      if (localTime <= 0.1 || localTime >= clip.duration - 0.1) return;
      const durA = localTime;
      const durB = clip.duration - localTime;
      const clipA: EditorClip = {
        ...clip,
        duration: durA,
        audioEndTime: clip.audioStartTime + durA,
        sentences: [{
          index: 0,
          text: clip.text,
          startTime: clip.audioStartTime,
          endTime: clip.audioStartTime + durA,
        }],
        label: '',
        isEdited: true,
      };
      const clipB: EditorClip = {
        ...clip,
        id: `${clip.id}-b-${Date.now()}`,
        sceneId: `${clip.sceneId}-b-${Date.now()}`,
        duration: durB,
        audioStartTime: clip.audioStartTime + durA,
        audioEndTime: clip.audioEndTime,
        sentences: [{
          index: 0,
          text: clip.text,
          startTime: clip.audioStartTime + durA,
          endTime: clip.audioEndTime,
        }],
        label: '',
        isEdited: true,
      };
      const updated = [...clips];
      updated.splice(currentClipIndex, 1, clipA, clipB);
      onClipsChange(relabel(updated));
    } catch (err) {
      console.error('[VrewCinematicView] split 실패:', err);
    }
  }, [clips, currentClipIndex, currentTime, onClipsChange]);

  // 타임라인: 클립 순서 드래그 변경
  const handleTimelineReorder = useCallback((fromIndex: number, toIndex: number) => {
    const updated = [...clips];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, { ...moved, isEdited: true });
    onClipsChange(relabel(updated));
  }, [clips, onClipsChange]);

  // 타임라인: 클립 삭제
  const handleTimelineDelete = useCallback((index: number) => {
    if (clips.length <= 1) return;
    onClipsChange(relabel(clips.filter((_, i) => i !== index)));
  }, [clips, onClipsChange]);

  // 삭제 (컨트롤 버튼)
  const handleDelete = useCallback(() => {
    if (clips.length <= 1) return;
    onClipsChange(relabel(clips.filter((_, i) => i !== currentClipIndex)));
  }, [clips, currentClipIndex, onClipsChange]);

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

  // 씬 삽입
  const handleInsertScene = useCallback((afterIndex: number) => {
    const insertIndex = afterIndex + 1;
    const prevClip = clips[afterIndex];
    if (!prevClip) return;
    const defaultDuration = 5;
    const newSceneId = `scene-new-${Date.now()}`;
    const newClip: EditorClip = {
      id: newSceneId,
      sceneId: newSceneId,
      text: '',
      sentences: [],
      imageUrl: '',
      videoUrl: '',
      isVideoEnabled: false,
      effect: 'none',
      audioStartTime: prevClip.audioEndTime,
      audioEndTime: prevClip.audioEndTime + defaultDuration,
      duration: defaultDuration,
      order: insertIndex,
      label: '',
    };
    const newClips = [...clips];
    newClips.splice(insertIndex, 0, newClip);
    for (let i = insertIndex + 1; i < newClips.length; i++) {
      newClips[i] = {
        ...newClips[i],
        audioStartTime: newClips[i].audioStartTime + defaultDuration,
        audioEndTime: newClips[i].audioEndTime + defaultDuration,
      };
    }
    onClipsChange(relabel(newClips));
    setCurrentClipIndex(insertIndex);
  }, [clips, onClipsChange, setCurrentClipIndex]);

  // 음성 아이템 핸들러
  const handleAddAudio = useCallback((startTime: number) => {
    setTtsPopup({ startTime });
    setTtsText('');
  }, []);

  const handleDeleteAudio = useCallback((id: string) => {
    setAudioItems((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleMoveAudio = useCallback((id: string, newStartTime: number) => {
    setAudioItems((prev) =>
      prev
        .map((a) => {
          if (a.id !== id) return a;
          const dur = a.endTime - a.startTime;
          return { ...a, startTime: newStartTime, endTime: newStartTime + dur };
        })
        .sort((a, b) => a.startTime - b.startTime)
    );
  }, []);

  // 자막 아이템 핸들러
  const handleAddSubtitle = useCallback((startTime: number) => {
    const newItem: SubtitleItem = {
      id: `sub-${Date.now()}`,
      startTime,
      endTime: Math.min(startTime + 3, totalDuration),
      text: '',
    };
    setSubtitleItems((prev) =>
      [...prev, newItem].sort((a, b) => a.startTime - b.startTime)
    );
  }, [totalDuration]);

  const handleDeleteSubtitle = useCallback((id: string) => {
    setSubtitleItems((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleMoveSubtitle = useCallback((id: string, newStartTime: number) => {
    setSubtitleItems((prev) =>
      prev
        .map((s) => {
          if (s.id !== id) return s;
          const dur = s.endTime - s.startTime;
          return { ...s, startTime: newStartTime, endTime: newStartTime + dur };
        })
        .sort((a, b) => a.startTime - b.startTime)
    );
  }, []);

  const handleResizeSubtitle = useCallback((id: string, startTime: number, endTime: number) => {
    setSubtitleItems((prev) =>
      prev.map((s) => (s.id === id ? { ...s, startTime, endTime } : s))
    );
  }, []);

  const handleEditSubtitleText = useCallback((id: string, text: string) => {
    setSubtitleItems((prev) =>
      prev.map((s) => (s.id === id ? { ...s, text } : s))
    );
  }, []);

  // TTS 생성
  const handleGenerateTts = useCallback(async () => {
    if (!ttsPopup || !ttsText.trim()) return;
    setIsTtsGenerating(true);
    try {
      const result = await generateTTS({
        text: ttsText.trim(),
        clipId: `tts-${Date.now()}`,
      });
      const newItem: AudioItem = {
        id: `audio-${Date.now()}`,
        startTime: ttsPopup.startTime,
        endTime: ttsPopup.startTime + result.estimatedDuration,
        audioUrl: result.audioUrl,
        text: ttsText.trim(),
      };
      setAudioItems((prev) =>
        [...prev, newItem].sort((a, b) => a.startTime - b.startTime)
      );
      setTtsPopup(null);
    } catch (err) {
      console.error('[VrewCinematicView] TTS 생성 실패:', err);
    } finally {
      setIsTtsGenerating(false);
    }
  }, [ttsPopup, ttsText]);

  // 이전/다음 클립 이동
  const handlePrevClip = useCallback(() => {
    if (currentClipIndex > 0) seekToClip(currentClipIndex - 1);
  }, [currentClipIndex, seekToClip]);

  const handleNextClip = useCallback(() => {
    if (currentClipIndex < clips.length - 1) seekToClip(currentClipIndex + 1);
  }, [currentClipIndex, clips.length, seekToClip]);

  // 분할 가능 여부 (플레이헤드가 클립 시작~끝 사이)
  const canSplit = useMemo(() => {
    if (!currentClip) return false;
    return (
      currentTime > currentClip.audioStartTime + 0.1 &&
      currentTime < currentClip.audioEndTime - 0.1
    );
  }, [currentClip, currentTime]);

  const canDelete = clips.length > 1;

  return (
    <>
      {/* ── 상단 패널 영역 (vrew-editor__main 내부) ── */}
      <div className="vrew-editor__preview-area">
        <EditorPreview
          clip={currentClip}
          currentTime={currentTime}
          isPlaying={isPlaying}
          currentWord={null}
          subtitleItems={subtitleItems}
        />
      </div>
      <div className="vrew-editor__script-area">
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
      </div>
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
                [currentClip.sceneId]: { ...prev[currentClip.sceneId], video: val },
              }));
            }
          }}
          onImagePromptChange={(val) => {
            if (currentClip) {
              setClipPrompts((prev) => ({
                ...prev,
                [currentClip.sceneId]: { ...prev[currentClip.sceneId], image: val },
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
          onDurationChange={(duration) => {
            if (currentClip) handleDurationChange(currentClip.sceneId, duration);
          }}
          isEdited={currentClip?.isEdited}
          castNames={currentSceneCardIds
            .map((id) => cardLibrary.find((c) => c.id === id))
            .filter((c): c is AssetCard => !!c)
            .map((c) => c.name)
            .slice(0, 5)}
          availableCards={availableCastCards}
          selectedCardIds={currentSceneCardIds}
          onToggleCard={handleToggleCard}
        />
      </div>

      {/* ── 구분선 아래 영역 (vrew-editor__main 밖, 형제 요소로 렌더링) ── */}

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
        mode="cinematic"
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
          onInsertScene={handleInsertScene}
          onPpsChange={(getter) => { ppsGetterRef.current = getter; }}
          mode="cinematic"
          audioItems={audioItems}
          subtitleItems={subtitleItems}
          onAddAudio={handleAddAudio}
          onAddSubtitle={handleAddSubtitle}
          onDeleteAudio={handleDeleteAudio}
          onDeleteSubtitle={handleDeleteSubtitle}
          onResizeSubtitle={handleResizeSubtitle}
          onEditSubtitleText={handleEditSubtitleText}
          onMoveAudio={handleMoveAudio}
          onMoveSubtitle={handleMoveSubtitle}
        />
      </div>

      {/* TTS 팝업 */}
      <TtsPopupModal
        ttsPopup={ttsPopup}
        ttsText={ttsText}
        isTtsGenerating={isTtsGenerating}
        onClose={() => setTtsPopup(null)}
        onTextChange={setTtsText}
        onGenerate={handleGenerateTts}
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
    </>
  );
};

export default VrewCinematicView;
