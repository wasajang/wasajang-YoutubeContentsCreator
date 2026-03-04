// useNarrationClipGeneration — 나레이션 클립 이미지/영상 개별·일괄 생성 훅
import { useState, useCallback } from 'react';
import { useProjectStore } from '../store/projectStore';
import { generateImage } from '../services/ai-image';
import { generateVideo } from '../services/ai-video';
import { buildImagePrompt, buildVideoPrompt } from '../services/prompt-builder';
import { useCredits } from './useCredits';

type GenStatus = 'idle' | 'generating' | 'done';

export interface UseNarrationClipGenerationReturn {
  generateClipImage: (clipId: string) => Promise<void>;
  generateClipVideo: (clipId: string) => Promise<void>;
  generateSceneImage: (sceneId: string) => Promise<void>;
  generateSceneVideo: (sceneId: string) => Promise<void>;
  generateAllClipImages: () => Promise<void>;
  generateAllClipVideos: () => Promise<void>;
  clipGenStatus: Record<string, GenStatus>;
  clipVideoGenStatus: Record<string, GenStatus>;
}

// 영상 일괄 생성 배치 크기 (API 부하 제한)
const IMAGE_BATCH_SIZE = 7;
const VIDEO_BATCH_SIZE = 3;

function aspectRatioToSize(ratio: string): { width: number; height: number } {
  switch (ratio) {
    case '9:16':
      return { width: 720, height: 1280 };
    case '1:1':
      return { width: 1024, height: 1024 };
    default:
      return { width: 1280, height: 720 }; // 16:9
  }
}

export function useNarrationClipGeneration(): UseNarrationClipGenerationReturn {
  const narrationClips = useProjectStore((s) => s.narrationClips);
  const setNarrationClips = useProjectStore((s) => s.setNarrationClips);
  const artStyleId = useProjectStore((s) => s.artStyleId);
  const templateId = useProjectStore((s) => s.templateId);
  const aspectRatio = useProjectStore((s) => s.aspectRatio);

  const { spend, canAfford } = useCredits();

  const [clipGenStatus, setClipGenStatus] = useState<Record<string, GenStatus>>(() => {
    const init: Record<string, GenStatus> = {};
    const clips = useProjectStore.getState().narrationClips;
    clips.forEach((c) => { init[c.id] = c.imageUrl ? 'done' : 'idle'; });
    return init;
  });
  const [clipVideoGenStatus, setClipVideoGenStatus] = useState<Record<string, GenStatus>>(() => {
    const init: Record<string, GenStatus> = {};
    const clips = useProjectStore.getState().narrationClips;
    clips.forEach((c) => { init[c.id] = c.videoUrl ? 'done' : 'idle'; });
    return init;
  });

  // ── 상태 업데이트 헬퍼 ──

  const setImageStatus = useCallback((clipId: string, status: GenStatus) => {
    setClipGenStatus((prev) => ({ ...prev, [clipId]: status }));
  }, []);

  const setVideoStatus = useCallback((clipId: string, status: GenStatus) => {
    setClipVideoGenStatus((prev) => ({ ...prev, [clipId]: status }));
  }, []);

  // ── 클립 imageUrl 업데이트 (store) ──
  const updateClipImageUrl = useCallback(
    (clipId: string, imageUrl: string) => {
      // 최신 상태를 getState()로 가져와 stale closure 방지
      const current = useProjectStore.getState().narrationClips;
      const updated = current.map((c) =>
        c.id === clipId ? { ...c, imageUrl } : c
      );
      useProjectStore.getState().setNarrationClips(updated);
    },
    []
  );

  // ── 클립 videoUrl 업데이트 (store) ──
  const updateClipVideoUrl = useCallback(
    (clipId: string, videoUrl: string) => {
      const current = useProjectStore.getState().narrationClips;
      const updated = current.map((c) =>
        c.id === clipId ? { ...c, videoUrl, isVideoEnabled: true } : c
      );
      useProjectStore.getState().setNarrationClips(updated);
    },
    []
  );

  // ── 개별 이미지 생성 ──
  const generateClipImage = useCallback(
    async (clipId: string) => {
      const clip = useProjectStore
        .getState()
        .narrationClips.find((c) => c.id === clipId);
      if (!clip) return;

      if (!spend('image', 1)) {
        console.warn('[useNarrationClipGeneration] 크레딧 부족 — 이미지 생성 불가');
        return;
      }

      setImageStatus(clipId, 'generating');

      try {
        const { width, height } = aspectRatioToSize(aspectRatio);
        const prompt = buildImagePrompt({
          artStyleId,
          sceneText: clip.text,
          seedCards: [],
          templateId: templateId ?? undefined,
        });

        const result = await generateImage({ prompt, width, height });
        updateClipImageUrl(clipId, result.imageUrl);
        setImageStatus(clipId, 'done');
      } catch (err) {
        console.error('[useNarrationClipGeneration] 이미지 생성 실패:', err);
        setImageStatus(clipId, 'idle');
      }
    },
    [artStyleId, aspectRatio, templateId, spend, setImageStatus, updateClipImageUrl]
  );

  // ── 개별 영상 생성 ──
  const generateClipVideo = useCallback(
    async (clipId: string) => {
      const clip = useProjectStore
        .getState()
        .narrationClips.find((c) => c.id === clipId);
      if (!clip || !clip.imageUrl) {
        console.warn('[useNarrationClipGeneration] imageUrl 없음 — 영상 생성 불가');
        return;
      }

      if (!spend('video', 1)) {
        console.warn('[useNarrationClipGeneration] 크레딧 부족 — 영상 생성 불가');
        return;
      }

      setVideoStatus(clipId, 'generating');

      try {
        const prompt = buildVideoPrompt({
          artStyleId,
          sceneText: clip.text,
          seedCards: [],
          templateId: templateId ?? undefined,
        });

        const result = await generateVideo({
          imageUrl: clip.imageUrl,
          prompt,
          duration: 5,
          sceneId: clip.sceneId,
        });
        updateClipVideoUrl(clipId, result.videoUrl);
        setVideoStatus(clipId, 'done');
      } catch (err) {
        console.error('[useNarrationClipGeneration] 영상 생성 실패:', err);
        setVideoStatus(clipId, 'idle');
      }
    },
    [artStyleId, templateId, spend, setVideoStatus, updateClipVideoUrl]
  );

  // ── 씬 단위 이미지 생성 (같은 sceneId의 모든 클립에 동일 이미지 적용) ──
  const generateSceneImage = useCallback(
    async (sceneId: string) => {
      const sceneClips = useProjectStore
        .getState()
        .narrationClips.filter((c) => c.sceneId === sceneId);
      if (sceneClips.length === 0) return;

      if (!spend('image', 1)) {
        console.warn('[useNarrationClipGeneration] 크레딧 부족 — 씬 이미지 생성 불가');
        return;
      }

      // 씬의 모든 클립 텍스트를 합쳐서 프롬프트 생성
      const combinedText = sceneClips.map((c) => c.text).join(' ');
      sceneClips.forEach((c) => setImageStatus(c.id, 'generating'));

      try {
        const { width, height } = aspectRatioToSize(aspectRatio);
        const prompt = buildImagePrompt({
          artStyleId,
          sceneText: combinedText,
          seedCards: [],
          templateId: templateId ?? undefined,
        });

        const result = await generateImage({ prompt, width, height });

        // 같은 sceneId의 모든 클립에 동일한 이미지 적용
        const current = useProjectStore.getState().narrationClips;
        const updated = current.map((c) =>
          c.sceneId === sceneId ? { ...c, imageUrl: result.imageUrl } : c
        );
        useProjectStore.getState().setNarrationClips(updated);
        sceneClips.forEach((c) => setImageStatus(c.id, 'done'));
      } catch (err) {
        console.error('[useNarrationClipGeneration] 씬 이미지 생성 실패:', err);
        sceneClips.forEach((c) => setImageStatus(c.id, 'idle'));
      }
    },
    [artStyleId, aspectRatio, templateId, spend, setImageStatus]
  );

  // ── 씬 단위 영상 생성 (같은 sceneId의 모든 클립에 동일 영상 적용) ──
  const generateSceneVideo = useCallback(
    async (sceneId: string) => {
      const sceneClips = useProjectStore
        .getState()
        .narrationClips.filter((c) => c.sceneId === sceneId);
      if (sceneClips.length === 0) return;

      // 씬의 첫 번째 클립에서 이미지 URL 가져오기
      const imageUrl = sceneClips[0]?.imageUrl;
      if (!imageUrl) {
        console.warn('[useNarrationClipGeneration] 씬 imageUrl 없음 — 영상 생성 불가');
        return;
      }

      if (!spend('video', 1)) {
        console.warn('[useNarrationClipGeneration] 크레딧 부족 — 씬 영상 생성 불가');
        return;
      }

      const combinedText = sceneClips.map((c) => c.text).join(' ');
      sceneClips.forEach((c) => setVideoStatus(c.id, 'generating'));

      try {
        const prompt = buildVideoPrompt({
          artStyleId,
          sceneText: combinedText,
          seedCards: [],
          templateId: templateId ?? undefined,
        });

        const result = await generateVideo({
          imageUrl,
          prompt,
          duration: 5,
          sceneId,
        });

        // 같은 sceneId의 모든 클립에 동일한 영상 적용
        const current = useProjectStore.getState().narrationClips;
        const updated = current.map((c) =>
          c.sceneId === sceneId ? { ...c, videoUrl: result.videoUrl, isVideoEnabled: true } : c
        );
        useProjectStore.getState().setNarrationClips(updated);
        sceneClips.forEach((c) => setVideoStatus(c.id, 'done'));
      } catch (err) {
        console.error('[useNarrationClipGeneration] 씬 영상 생성 실패:', err);
        sceneClips.forEach((c) => setVideoStatus(c.id, 'idle'));
      }
    },
    [artStyleId, templateId, spend, setVideoStatus]
  );

  // ── 일괄 이미지 생성 (imageUrl 없는 클립만) ──
  const generateAllClipImages = useCallback(async () => {
    const targets = useProjectStore
      .getState()
      .narrationClips.filter((c) => !c.imageUrl);

    if (targets.length === 0) return;

    if (!canAfford('image', targets.length)) {
      console.warn('[useNarrationClipGeneration] 크레딧 부족 — 일괄 이미지 생성 불가');
      return;
    }
    spend('image', targets.length);

    // 배치 병렬 처리
    for (let i = 0; i < targets.length; i += IMAGE_BATCH_SIZE) {
      const batch = targets.slice(i, i + IMAGE_BATCH_SIZE);

      // 배치 상태 → generating
      batch.forEach((c) => setImageStatus(c.id, 'generating'));

      const { width, height } = aspectRatioToSize(aspectRatio);

      await Promise.allSettled(
        batch.map(async (clip) => {
          try {
            const prompt = buildImagePrompt({
              artStyleId,
              sceneText: clip.text,
              seedCards: [],
              templateId: templateId ?? undefined,
            });
            const result = await generateImage({ prompt, width, height });
            updateClipImageUrl(clip.id, result.imageUrl);
            setImageStatus(clip.id, 'done');
          } catch (err) {
            console.error(`[일괄이미지] 클립 ${clip.id} 실패:`, err);
            setImageStatus(clip.id, 'idle');
          }
        })
      );
    }
  }, [
    artStyleId,
    aspectRatio,
    templateId,
    canAfford,
    spend,
    setImageStatus,
    updateClipImageUrl,
  ]);

  // ── 일괄 영상 생성 (imageUrl 있고 videoUrl 없는 클립만) ──
  const generateAllClipVideos = useCallback(async () => {
    const targets = useProjectStore
      .getState()
      .narrationClips.filter((c) => c.imageUrl && !c.videoUrl);

    if (targets.length === 0) return;

    if (!canAfford('video', targets.length)) {
      console.warn('[useNarrationClipGeneration] 크레딧 부족 — 일괄 영상 생성 불가');
      return;
    }
    spend('video', targets.length);

    // 배치 병렬 처리
    for (let i = 0; i < targets.length; i += VIDEO_BATCH_SIZE) {
      const batch = targets.slice(i, i + VIDEO_BATCH_SIZE);

      batch.forEach((c) => setVideoStatus(c.id, 'generating'));

      await Promise.allSettled(
        batch.map(async (clip) => {
          try {
            const prompt = buildVideoPrompt({
              artStyleId,
              sceneText: clip.text,
              seedCards: [],
              templateId: templateId ?? undefined,
            });
            const result = await generateVideo({
              imageUrl: clip.imageUrl,
              prompt,
              duration: 5,
              sceneId: clip.sceneId,
            });
            updateClipVideoUrl(clip.id, result.videoUrl);
            setVideoStatus(clip.id, 'done');
          } catch (err) {
            console.error(`[일괄영상] 클립 ${clip.id} 실패:`, err);
            setVideoStatus(clip.id, 'idle');
          }
        })
      );
    }
  }, [
    artStyleId,
    templateId,
    canAfford,
    spend,
    setVideoStatus,
    updateClipVideoUrl,
  ]);

  // setNarrationClips는 직접 사용하지 않고 getState()로 접근 — 경고 억제
  void setNarrationClips;
  void narrationClips;

  return {
    generateClipImage,
    generateClipVideo,
    generateSceneImage,
    generateSceneVideo,
    generateAllClipImages,
    generateAllClipVideos,
    clipGenStatus,
    clipVideoGenStatus,
  };
}
