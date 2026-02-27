/**
 * useGeneration — 씬 이미지/영상 생성 상태 관리 훅
 *
 * StoryboardPage의 seed-check 단계에서 사용하는 생성 관련 상태와 액션을 담당합니다.
 */
import { useState, useCallback } from 'react';
import type { AssetCard, Scene } from '../store/projectStore';
import { mockScenePrompts } from '../data/mockData';
import { generateImage } from '../services/ai-image';
import { generateVideo } from '../services/ai-video';
import { buildImagePrompt, buildVideoPrompt } from '../services/prompt-builder';
import type { GenerationType } from './useCredits';

type SceneGenStatus = 'idle' | 'generating' | 'done';

interface UseGenerationParams {
    scenes: Scene[];
    deck: AssetCard[];
    selectedStyle: string;
    canAfford: (type: GenerationType, count?: number) => boolean;
    spend: (type: GenerationType) => boolean;
    creditsRemaining: number;
    CREDIT_COSTS: Record<GenerationType, number>;
    imageModel?: string;
    videoModel?: string;
}

export function useGeneration({
    scenes,
    deck,
    selectedStyle,
    canAfford,
    spend,
    creditsRemaining,
    CREDIT_COSTS,
    imageModel,
    videoModel,
}: UseGenerationParams) {
    const [sceneGenStatus, setSceneGenStatus] = useState<Record<string, SceneGenStatus>>(() => {
        const init: Record<string, SceneGenStatus> = {};
        scenes.forEach((s) => { init[s.id] = 'idle'; });
        return init;
    });

    const [videoGenStatus, setVideoGenStatus] = useState<Record<string, SceneGenStatus>>({});

    const [videoCountPerScene, setVideoCountPerScene] = useState<Record<string, number>>(() => {
        const init: Record<string, number> = {};
        scenes.forEach((s) => { init[s.id] = 1; });
        return init;
    });

    const [sceneSeeds, setSceneSeeds] = useState<Record<string, string[]>>(() => {
        const init: Record<string, string[]> = {};
        scenes.forEach((scene) => { init[scene.id] = []; });
        return init;
    });

    const toggleSceneSeed = (sceneId: string, cardId: string) => {
        setSceneSeeds((prev) => {
            const current = prev[sceneId] || [];
            const has = current.includes(cardId);
            return { ...prev, [sceneId]: has ? current.filter((id) => id !== cardId) : [...current, cardId] };
        });
    };

    const generateSingleScene = useCallback(async (sceneId: string) => {
        if (!canAfford('image')) {
            alert(`크레딧이 부족합니다! (이미지 생성 ${CREDIT_COSTS.image} 크레딧 필요, 잔여: ${creditsRemaining})`);
            return;
        }
        if (!spend('image')) return;
        setSceneGenStatus((p) => ({ ...p, [sceneId]: 'generating' }));
        try {
            const scene = scenes.find((s) => s.id === sceneId);
            if (!scene) return;
            const seedCards = (sceneSeeds[sceneId] || [])
                .map((cardId) => deck.find((c) => c.id === cardId))
                .filter((c): c is AssetCard => !!c);
            const prompt = buildImagePrompt({
                style: selectedStyle,
                sceneText: scene.text,
                seedCards,
                customImagePrompt: mockScenePrompts[sceneId]?.imagePrompt,
                cameraAngle: scene.cameraAngle,
                location: scene.location,
            });
            const result = await generateImage({ prompt, seed: seedCards[0]?.seed, model: imageModel });
            console.log(`[Scene ${sceneId}] 이미지 생성 완료: ${result.imageUrl}`);
            setSceneGenStatus((p) => ({ ...p, [sceneId]: 'done' }));
        } catch (err) {
            console.error(`[Scene ${sceneId}] 이미지 생성 실패:`, err);
            setSceneGenStatus((p) => ({ ...p, [sceneId]: 'idle' }));
        }
    }, [scenes, sceneSeeds, deck, selectedStyle, canAfford, spend, creditsRemaining, CREDIT_COSTS]);

    const generateAllScenes = useCallback(() => {
        const pending = scenes.filter((s) => sceneGenStatus[s.id] === 'idle');
        if (!canAfford('image', pending.length)) {
            alert(`크레딧이 부족합니다! (${pending.length}장 × ${CREDIT_COSTS.image} = ${pending.length * CREDIT_COSTS.image} 크레딧 필요, 잔여: ${creditsRemaining})`);
            return;
        }
        pending.forEach((scene, i) => {
            setTimeout(() => generateSingleScene(scene.id), i * 600);
        });
    }, [scenes, sceneGenStatus, generateSingleScene, canAfford, creditsRemaining, CREDIT_COSTS]);

    const generateSingleVideo = useCallback(async (sceneId: string) => {
        if (!canAfford('video')) {
            alert(`크레딧이 부족합니다! (영상 생성 ${CREDIT_COSTS.video} 크레딧 필요, 잔여: ${creditsRemaining})`);
            return;
        }
        if (!spend('video')) return;
        setVideoGenStatus((p) => ({ ...p, [sceneId]: 'generating' }));
        try {
            const scene = scenes.find((s) => s.id === sceneId);
            if (!scene) return;
            const seedCards = (sceneSeeds[sceneId] || [])
                .map((cardId) => deck.find((c) => c.id === cardId))
                .filter((c): c is AssetCard => !!c);
            const prompt = buildVideoPrompt({
                style: selectedStyle,
                sceneText: scene.text,
                seedCards,
                cameraAngle: scene.cameraAngle,
            });
            await generateVideo({
                imageUrl: scene.imageUrl || '',
                prompt,
                duration: 5,
                sceneId,
                model: videoModel,
            });
            setVideoGenStatus((p) => ({ ...p, [sceneId]: 'done' }));
        } catch (err) {
            console.error(`[Video ${sceneId}] 영상 생성 실패:`, err);
            setVideoGenStatus((p) => ({ ...p, [sceneId]: 'idle' }));
        }
    }, [scenes, sceneSeeds, deck, selectedStyle, canAfford, spend, creditsRemaining, CREDIT_COSTS]);

    const generateAllVideos = useCallback(() => {
        const pending = scenes.filter((s) => videoGenStatus[s.id] !== 'done');
        if (!canAfford('video', pending.length)) {
            alert(`크레딧이 부족합니다! (${pending.length}편 × ${CREDIT_COSTS.video} = ${pending.length * CREDIT_COSTS.video} 크레딧 필요, 잔여: ${creditsRemaining})`);
            return;
        }
        pending.forEach((scene, i) => {
            setTimeout(() => generateSingleVideo(scene.id), i * 800);
        });
    }, [scenes, videoGenStatus, canAfford, creditsRemaining, CREDIT_COSTS, generateSingleVideo]);

    const regenerateSingleVideo = useCallback((sceneId: string) => {
        generateSingleVideo(sceneId);
    }, [generateSingleVideo]);

    const doneSceneCount = Object.values(sceneGenStatus).filter((s) => s === 'done').length;
    const allImagesDone = doneSceneCount === scenes.length;
    const doneVideoCount = Object.values(videoGenStatus).filter((s) => s === 'done').length;
    const allVideosDone = doneVideoCount === scenes.length;

    return {
        sceneGenStatus,
        videoGenStatus,
        videoCountPerScene,
        setVideoCountPerScene,
        sceneSeeds,
        setSceneSeeds,
        toggleSceneSeed,
        generateSingleScene,
        generateAllScenes,
        generateSingleVideo,
        generateAllVideos,
        regenerateSingleVideo,
        doneSceneCount,
        allImagesDone,
        doneVideoCount,
        allVideosDone,
    };
}

export type UseGenerationApi = ReturnType<typeof useGeneration>;
