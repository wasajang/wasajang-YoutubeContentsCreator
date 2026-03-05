/**
 * useCinematicEditor — 시네마틱 편집기 로직 훅
 *
 * VrewCinematicView에서 추출한 상태와 핸들러.
 * VrewEditor가 이 훅을 호출하여 레이아웃을 직접 제어합니다.
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useProjectStore } from '../store/projectStore';
import type { AssetCard } from '../store/projectStore';
import {
  scenesToEditorClips,
  type EditorClip,
  type AudioItem,
  type SubtitleItem,
} from '../components/editor/types';
import { buildImagePrompt, buildVideoPrompt } from '../services/prompt-builder';
import { generateTTS } from '../services/ai-tts';
import { useVideoRegeneration } from './useVideoRegeneration';
import { useImageRegeneration } from './useImageRegeneration';

/** 클립 배열의 label + order 재정렬 */
function relabel(clips: EditorClip[]): EditorClip[] {
  return clips.map((c, i) => ({
    ...c,
    order: i,
    label: `씬 ${String(i + 1).padStart(2, '0')}`,
  }));
}

interface UseCinematicEditorOptions {
  currentClipIndex: number;
  setCurrentClipIndex: (index: number) => void;
  currentTime: number;
  totalDuration: number;
  seekToClip: (index: number) => void;
  seekToTime: (time: number) => void;
  /** 클립 편집 전 상태를 히스토리에 저장하는 콜백 */
  onBeforeEdit?: (snapshot: { clips: EditorClip[] }) => void;
}

export function useCinematicEditor({
  currentClipIndex,
  setCurrentClipIndex,
  currentTime,
  totalDuration,
  seekToClip,
  seekToTime,
  onBeforeEdit,
}: UseCinematicEditorOptions) {
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
  const videoCountPerScene = useProjectStore((s) => s.videoCountPerScene);

  // 씬별 영상 길이 (기본 5초)
  const [sceneDurations, setSceneDurations] = useState<Record<string, number>>({});

  // 로컬 클립 상태 (서브씬 확장)
  const [cinematicClips, setCinematicClips] = useState<EditorClip[]>(() =>
    scenesToEditorClips(scenes, sceneDurations, videoCountPerScene, storeSceneImages, sceneVideos)
  );

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

  // 자막 추가 후 자동 편집 모드 진입
  const [lastAddedSubId, setLastAddedSubId] = useState<string | null>(null);

  const currentClip = cinematicClips[currentClipIndex] ?? null;

  // sceneDurations 변경 시 cinematicClips 재계산
  useEffect(() => {
    setCinematicClips(scenesToEditorClips(scenes, sceneDurations, videoCountPerScene, storeSceneImages, sceneVideos));
  }, [sceneDurations]); // eslint-disable-line react-hooks/exhaustive-deps

  // scenes/sceneVideos/sceneImages 변경 시 미디어 URL 동기화 (로컬 편집 유지)
  useEffect(() => {
    setCinematicClips(prev => {
      // 서브씬 수가 변했으면 전체 재생성
      const expectedCount = scenes.reduce((sum, s) => sum + (videoCountPerScene[s.id] || 1), 0);
      if (prev.length !== expectedCount) {
        return scenesToEditorClips(scenes, sceneDurations, videoCountPerScene, storeSceneImages, sceneVideos);
      }
      // 같은 수면 미디어 URL만 업데이트
      return prev.map(clip => {
        const scene = scenes.find(s => s.id === clip.sceneId);
        if (!scene) return clip;
        // 클립 ID에서 서브인덱스 추출: "editor-sceneId-subIdx"
        const parts = clip.id.split('-');
        const subIdx = parseInt(parts[parts.length - 1]) || 0;
        const videoUrl = sceneVideos[clip.sceneId]?.[subIdx] || (subIdx === 0 ? scene.videoUrl || '' : '');
        const imageUrl = storeSceneImages[clip.sceneId]?.[subIdx] || (subIdx === 0 ? scene.imageUrl || '' : clip.imageUrl);
        if (videoUrl === clip.videoUrl && imageUrl === clip.imageUrl) return clip;
        return { ...clip, imageUrl, videoUrl, isVideoEnabled: Boolean(videoUrl) };
      });
    });
  }, [scenes, sceneVideos, storeSceneImages, videoCountPerScene]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setCinematicClips((prev) =>
        prev.map((c) =>
          c.sceneId === sceneId
            ? { ...c, videoUrl: newVideoUrl, isVideoEnabled: true }
            : c
        )
      );
    }
  }, [clipPrompts, storeSceneImages, scenes, regenerateVideo]);

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
      setCinematicClips((prev) =>
        prev.map((c) =>
          c.sceneId === sceneId ? { ...c, imageUrl: newImageUrl } : c
        )
      );
    }
  }, [clipPrompts, aspectRatio, regenerateImage]);

  // 대본 텍스트 편집
  const handleTextChange = useCallback((clipId: string, text: string) => {
    setCinematicClips((prev) =>
      prev.map((c) => (c.id === clipId ? { ...c, text } : c))
    );
  }, []);

  /** 편집 전 히스토리 저장 래퍼 */
  const saveHistory = useCallback(() => {
    onBeforeEdit?.({ clips: cinematicClips });
  }, [onBeforeEdit, cinematicClips]);

  // 자르기 (시네마틱: 플레이헤드 위치에서 분할)
  const handleSplit = useCallback(() => {
    saveHistory();
    const clip = cinematicClips[currentClipIndex];
    if (!clip) return;
    try {
      const localTime = currentTime - clip.audioStartTime;
      if (localTime <= 0.01 || localTime >= clip.duration - 0.01) return;
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
      const updated = [...cinematicClips];
      updated.splice(currentClipIndex, 1, clipA, clipB);
      setCinematicClips(relabel(updated));
    } catch (err) {
      console.error('[useCinematicEditor] split 실패:', err);
    }
  }, [cinematicClips, currentClipIndex, currentTime, saveHistory]);

  // 타임라인: 클립 순서 드래그 변경
  const handleTimelineReorder = useCallback((fromIndex: number, toIndex: number) => {
    saveHistory();
    setCinematicClips((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, { ...moved, isEdited: true });
      return relabel(updated);
    });
  }, [saveHistory]);

  // 타임라인: 클립 삭제
  const handleTimelineDelete = useCallback((index: number) => {
    saveHistory();
    setCinematicClips((prev) => {
      if (prev.length <= 1) return prev;
      return relabel(prev.filter((_, i) => i !== index));
    });
  }, []);

  // 삭제 (컨트롤 버튼)
  const handleDelete = useCallback(() => {
    saveHistory();
    setCinematicClips((prev) => {
      if (prev.length <= 1) return prev;
      return relabel(prev.filter((_, i) => i !== currentClipIndex));
    });
  }, [currentClipIndex]);

  // 타임라인: 눈금자 클릭 시간 이동
  const handleTimelineSeek = useCallback((time: number) => {
    seekToTime(time);
    let accumulated = 0;
    for (let i = 0; i < cinematicClips.length; i++) {
      if (accumulated + cinematicClips[i].duration >= time) {
        setCurrentClipIndex(i);
        return;
      }
      accumulated += cinematicClips[i].duration;
    }
    if (cinematicClips.length > 0) setCurrentClipIndex(cinematicClips.length - 1);
  }, [cinematicClips, seekToTime, setCurrentClipIndex]);

  // 씬 삽입
  const handleInsertScene = useCallback((afterIndex: number) => {
    saveHistory();
    const insertIndex = afterIndex + 1;
    setCinematicClips((prev) => {
      const prevClip = prev[afterIndex];
      if (!prevClip) return prev;
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
      const newClips = [...prev];
      newClips.splice(insertIndex, 0, newClip);
      for (let i = insertIndex + 1; i < newClips.length; i++) {
        newClips[i] = {
          ...newClips[i],
          audioStartTime: newClips[i].audioStartTime + defaultDuration,
          audioEndTime: newClips[i].audioEndTime + defaultDuration,
        };
      }
      return relabel(newClips);
    });
    setCurrentClipIndex(insertIndex);
  }, [setCurrentClipIndex]);

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
    const newId = `sub-${Date.now()}`;
    const newItem: SubtitleItem = {
      id: newId,
      startTime,
      endTime: Math.min(startTime + 3, totalDuration),
      text: '',
    };
    setSubtitleItems((prev) =>
      [...prev, newItem].sort((a, b) => a.startTime - b.startTime)
    );
    setLastAddedSubId(newId);
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
      console.error('[useCinematicEditor] TTS 생성 실패:', err);
    } finally {
      setIsTtsGenerating(false);
    }
  }, [ttsPopup, ttsText]);

  // 이전/다음 클립 이동
  const handlePrevClip = useCallback(() => {
    if (currentClipIndex > 0) seekToClip(currentClipIndex - 1);
  }, [currentClipIndex, seekToClip]);

  const handleNextClip = useCallback(() => {
    if (currentClipIndex < cinematicClips.length - 1) seekToClip(currentClipIndex + 1);
  }, [currentClipIndex, cinematicClips.length, seekToClip]);

  // 분할 가능 여부 (플레이헤드가 클립 시작~끝 사이, 0.01초 버퍼)
  const canSplit = useMemo(() => {
    if (!currentClip) return false;
    return (
      currentTime > currentClip.audioStartTime + 0.01 &&
      currentTime < currentClip.audioEndTime - 0.01
    );
  }, [currentClip, currentTime]);

  const canDelete = cinematicClips.length > 1;

  // 히스토리 복원용
  const restoreClips = useCallback((clips: EditorClip[]) => {
    setCinematicClips(clips);
  }, []);

  return {
    // 클립 배열
    clips: cinematicClips,
    restoreClips,
    currentClip,
    canSplit,
    canDelete,
    // 패널 props
    aspectRatio,
    artStyleId,
    sceneVideos,
    cardLibrary,
    availableCastCards,
    currentSceneCardIds,
    storeSceneImages,
    clipPrompts,
    setClipPrompts,
    isRegenerating,
    isRegeneratingImage,
    // 음성/자막 아이템
    audioItems,
    subtitleItems,
    // TTS
    ttsPopup,
    ttsText,
    isTtsGenerating,
    setTtsPopup,
    setTtsText,
    // 자막 자동 편집
    lastAddedSubId,
    setLastAddedSubId,
    // 핸들러
    handleTextChange,
    handleSplit,
    handleDelete,
    handleTimelineReorder,
    handleTimelineDelete,
    handleTimelineSeek,
    handleInsertScene,
    handleRegenerateVideo,
    handleRegenerateImage,
    handleDurationChange,
    handleToggleCard,
    handleAddAudio,
    handleDeleteAudio,
    handleMoveAudio,
    handleAddSubtitle,
    handleDeleteSubtitle,
    handleMoveSubtitle,
    handleResizeSubtitle,
    handleEditSubtitleText,
    handleGenerateTts,
    handlePrevClip,
    handleNextClip,
  };
}
