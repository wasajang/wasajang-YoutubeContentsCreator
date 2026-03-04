/**
 * useVideoRegeneration — 타임라인에서 영상 재생성 훅
 *
 * 프롬프트 수정 후 "다시 만들기"로 특정 씬의 영상만 재생성.
 * 크레딧 차감 + generateVideo API 호출 + store 업데이트.
 */
import { useState, useCallback } from 'react';
import { generateVideo } from '../services/ai-video';
import { useProjectStore } from '../store/projectStore';
import { useCredits } from './useCredits';

interface UseVideoRegenerationReturn {
  regeneratingScenes: Set<string>;
  isRegenerating: (sceneId: string) => boolean;
  regenerateVideo: (sceneId: string, prompt: string, imageUrl: string) => Promise<string | null>;
}

export function useVideoRegeneration(): UseVideoRegenerationReturn {
  const [regeneratingScenes, setRegeneratingScenes] = useState<Set<string>>(new Set());
  const { canAfford, spend } = useCredits();

  const regenerateVideo = useCallback(async (
    sceneId: string,
    prompt: string,
    imageUrl: string,
  ): Promise<string | null> => {
    if (!canAfford('video')) {
      return null;
    }
    if (!spend('video')) return null;

    setRegeneratingScenes((prev) => new Set([...prev, sceneId]));

    try {
      const result = await generateVideo({
        imageUrl,
        prompt,
        duration: 5,
        sceneId,
      });

      if (result?.videoUrl) {
        // store 업데이트
        useProjectStore.getState().updateSceneVideo(sceneId, result.videoUrl);
        useProjectStore.getState().updateSceneVideoAtSub(sceneId, 0, result.videoUrl);
        return result.videoUrl;
      }

      return null;
    } catch (err) {
      console.error('[useVideoRegeneration] 실패:', err);
      return null;
    } finally {
      setRegeneratingScenes((prev) => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  }, [canAfford, spend]);

  return {
    regeneratingScenes,
    isRegenerating: (sceneId: string) => regeneratingScenes.has(sceneId),
    regenerateVideo,
  };
}
