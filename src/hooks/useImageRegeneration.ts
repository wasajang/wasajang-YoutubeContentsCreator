/**
 * useImageRegeneration — 타임라인에서 이미지 재생성 훅
 *
 * 프롬프트 수정 후 "이미지 다시 만들기"로 특정 씬의 이미지만 재생성.
 * 크레딧 차감 + generateImage API 호출 + store 업데이트.
 */
import { useState, useCallback } from 'react';
import { generateImage } from '../services/ai-image';
import { useProjectStore } from '../store/projectStore';
import { useCredits } from './useCredits';

interface UseImageRegenerationReturn {
  regeneratingScenes: Set<string>;
  isRegenerating: (sceneId: string) => boolean;
  regenerateImage: (sceneId: string, prompt: string, width: number, height: number) => Promise<string | null>;
}

export function useImageRegeneration(): UseImageRegenerationReturn {
  const [regeneratingScenes, setRegeneratingScenes] = useState<Set<string>>(new Set());
  const { canAfford, spend } = useCredits();

  const regenerateImage = useCallback(async (
    sceneId: string,
    prompt: string,
    width: number,
    height: number,
  ): Promise<string | null> => {
    if (!canAfford('image')) {
      return null;
    }
    if (!spend('image')) return null;

    setRegeneratingScenes((prev) => new Set([...prev, sceneId]));

    try {
      const result = await generateImage({ prompt, width, height });

      if (result?.imageUrl) {
        // store 업데이트 — sceneImages[sceneId][0] 에 저장
        const store = useProjectStore.getState();
        const currentImages = store.sceneImages[sceneId] || [];
        const updated = [...currentImages];
        updated[0] = result.imageUrl;
        store.setSceneImages({ ...store.sceneImages, [sceneId]: updated });

        // scenes의 imageUrl도 업데이트
        const scenes = store.scenes;
        const updatedScenes = scenes.map((s) =>
          s.id === sceneId ? { ...s, imageUrl: result.imageUrl } : s
        );
        store.setScenes(updatedScenes);

        return result.imageUrl;
      }

      return null;
    } catch (err) {
      console.error('[useImageRegeneration] 실패:', err);
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
    regenerateImage,
  };
}
