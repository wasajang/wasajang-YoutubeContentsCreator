/**
 * useGeneration — 씬 이미지/영상 생성 상태 관리 훅
 *
 * StoryboardPage의 seed-check 단계에서 사용하는 생성 관련 상태와 액션을 담당합니다.
 */
import { useState, useCallback } from 'react';
import type { AssetCard, Scene } from '../store/projectStore';
import { useProjectStore } from '../store/projectStore';
import { mockScenePrompts } from '../data/mockData';
import { generateImage } from '../services/ai-image';
import { generateVideo } from '../services/ai-video';
import { buildImagePrompt, buildVideoPrompt, getNegativePrompt, aspectRatioToSize } from '../services/prompt-builder';
import type { GenerationType } from './useCredits';

type SceneGenStatus = 'idle' | 'generating' | 'done';

interface UseGenerationParams {
    scenes: Scene[];
    deck: AssetCard[];
    artStyleId: string;
    canAfford: (type: GenerationType, count?: number) => boolean;
    spend: (type: GenerationType) => boolean;
    creditsRemaining: number;
    CREDIT_COSTS: Record<GenerationType, number>;
    imageModel?: string;
    videoModel?: string;
    templateId?: string;
    aspectRatio?: string;
    onCreditShortage?: (required: number, label: string) => void;
}

export function useGeneration({
    scenes,
    deck,
    artStyleId,
    canAfford,
    spend,
    creditsRemaining,
    CREDIT_COSTS,
    imageModel,
    videoModel,
    templateId,
    aspectRatio,
    onCreditShortage,
}: UseGenerationParams) {
    const updateSceneImage = useProjectStore((s) => s.updateSceneImage);
    const updateSceneVideo = useProjectStore((s) => s.updateSceneVideo);

    const [sceneGenStatus, setSceneGenStatus] = useState<Record<string, SceneGenStatus>>(() => {
        const init: Record<string, SceneGenStatus> = {};
        scenes.forEach((s) => { init[s.id] = s.imageUrl ? 'done' : 'idle'; });
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

    // 프롬프트 편집 상태
    const [customPrompts, setCustomPrompts] = useState<Record<string, { image: string; video: string }>>({});

    const initPrompts = useCallback(() => {
        // Step 1: 씨드카드가 비어있는 씬에 덱에서 랜덤 배정
        const updatedSeeds = { ...sceneSeeds };
        const chars = deck.filter((c) => c.type === 'character');
        const bgs = deck.filter((c) => c.type === 'background');
        const items = deck.filter((c) => c.type === 'item');

        scenes.forEach((scene) => {
            if (!updatedSeeds[scene.id] || updatedSeeds[scene.id].length === 0) {
                const assigned: string[] = [];
                // 캐릭터 1~2명 랜덤
                const charCount = Math.min(chars.length, 1 + Math.floor(Math.random() * 2));
                const shuffledChars = [...chars].sort(() => Math.random() - 0.5);
                shuffledChars.slice(0, charCount).forEach((c) => assigned.push(c.id));
                // 배경 1개
                if (bgs.length > 0) {
                    const bg = bgs[Math.floor(Math.random() * bgs.length)];
                    assigned.push(bg.id);
                }
                // 아이템 0~1개
                if (items.length > 0 && Math.random() > 0.4) {
                    const item = items[Math.floor(Math.random() * items.length)];
                    assigned.push(item.id);
                }
                updatedSeeds[scene.id] = assigned;
            }
        });
        setSceneSeeds(updatedSeeds);

        // Step 2: 배정된 씨드카드 기반으로 프롬프트 생성
        const prompts: Record<string, { image: string; video: string }> = {};
        scenes.forEach((scene) => {
            const seeds = updatedSeeds[scene.id] || [];
            const seedCards = seeds.map((id) => deck.find((c) => c.id === id)).filter((c): c is AssetCard => !!c);
            prompts[scene.id] = {
                image: buildImagePrompt({ artStyleId, sceneText: scene.text, seedCards, cameraAngle: scene.cameraAngle, location: scene.location, templateId }),
                video: buildVideoPrompt({ artStyleId, sceneText: scene.text, seedCards, cameraAngle: scene.cameraAngle, templateId }),
            };
        });
        setCustomPrompts(prompts);
    }, [scenes, sceneSeeds, deck, artStyleId, templateId]);

    const updatePrompt = useCallback((sceneId: string, type: 'image' | 'video', value: string) => {
        setCustomPrompts((prev) => ({
            ...prev,
            [sceneId]: { ...prev[sceneId], [type]: value },
        }));
    }, []);

    const toggleSceneSeed = (sceneId: string, cardId: string) => {
        setSceneSeeds((prev) => {
            const current = prev[sceneId] || [];
            const has = current.includes(cardId);
            return { ...prev, [sceneId]: has ? current.filter((id) => id !== cardId) : [...current, cardId] };
        });
    };

    const generateSingleScene = useCallback(async (sceneId: string) => {
        if (!canAfford('image')) {
            if (onCreditShortage) {
                onCreditShortage(CREDIT_COSTS.image, '이미지 생성');
            } else {
                alert(`크레딧이 부족합니다! (이미지 생성 ${CREDIT_COSTS.image} 크레딧 필요, 잔여: ${creditsRemaining})`);
            }
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

            const prompt = customPrompts[sceneId]?.image || buildImagePrompt({
                artStyleId,
                sceneText: scene.text,
                seedCards,
                customImagePrompt: mockScenePrompts[sceneId]?.imagePrompt,
                cameraAngle: scene.cameraAngle,
                location: scene.location,
                templateId,
            });

            // aspectRatio로 width/height 계산
            const { width, height } = aspectRatioToSize(aspectRatio || '16:9');
            const negativePrompt = getNegativePrompt(templateId, artStyleId);

            const result = await generateImage({
                prompt,
                negativePrompt,
                width,
                height,
                seed: seedCards[0]?.seed,
                model: imageModel,
            });
            console.log(`[Scene ${sceneId}] 이미지 생성 완료: ${result.imageUrl}`);
            updateSceneImage(sceneId, result.imageUrl);
            setSceneGenStatus((p) => ({ ...p, [sceneId]: 'done' }));
        } catch (err) {
            console.error(`[Scene ${sceneId}] 이미지 생성 실패:`, err);
            setSceneGenStatus((p) => ({ ...p, [sceneId]: 'idle' }));
        }
    }, [scenes, sceneSeeds, deck, artStyleId, canAfford, spend, creditsRemaining, CREDIT_COSTS, templateId, aspectRatio, imageModel, onCreditShortage, updateSceneImage, customPrompts]);

    const generateAllScenes = useCallback(() => {
        const pending = scenes.filter((s) => sceneGenStatus[s.id] === 'idle');
        if (!canAfford('image', pending.length)) {
            if (onCreditShortage) {
                onCreditShortage(pending.length * CREDIT_COSTS.image, `이미지 전체 생성 (${pending.length}장)`);
            } else {
                alert(`크레딧이 부족합니다! (${pending.length}장 × ${CREDIT_COSTS.image} = ${pending.length * CREDIT_COSTS.image} 크레딧 필요, 잔여: ${creditsRemaining})`);
            }
            return;
        }
        pending.forEach((scene, i) => {
            setTimeout(() => generateSingleScene(scene.id), i * 600);
        });
    }, [scenes, sceneGenStatus, generateSingleScene, canAfford, creditsRemaining, CREDIT_COSTS, onCreditShortage]);

    const generateSingleVideo = useCallback(async (sceneId: string) => {
        if (!canAfford('video')) {
            if (onCreditShortage) {
                onCreditShortage(CREDIT_COSTS.video, '영상 생성');
            } else {
                alert(`크레딧이 부족합니다! (영상 생성 ${CREDIT_COSTS.video} 크레딧 필요, 잔여: ${creditsRemaining})`);
            }
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

            const prompt = customPrompts[sceneId]?.video || buildVideoPrompt({
                artStyleId,
                sceneText: scene.text,
                seedCards,
                cameraAngle: scene.cameraAngle,
                templateId,
            });
            const videoResult = await generateVideo({
                imageUrl: scene.imageUrl || '',
                prompt,
                duration: 5,
                sceneId,
                model: videoModel,
            });
            if (videoResult?.videoUrl) {
                updateSceneVideo(sceneId, videoResult.videoUrl);
            }
            setVideoGenStatus((p) => ({ ...p, [sceneId]: 'done' }));
        } catch (err) {
            console.error(`[Video ${sceneId}] 영상 생성 실패:`, err);
            setVideoGenStatus((p) => ({ ...p, [sceneId]: 'idle' }));
        }
    }, [scenes, sceneSeeds, deck, artStyleId, canAfford, spend, creditsRemaining, CREDIT_COSTS, templateId, videoModel, onCreditShortage, customPrompts]);

    const generateAllVideos = useCallback(() => {
        const pending = scenes.filter((s) => videoGenStatus[s.id] !== 'done');
        if (!canAfford('video', pending.length)) {
            if (onCreditShortage) {
                onCreditShortage(pending.length * CREDIT_COSTS.video, `영상 전체 생성 (${pending.length}편)`);
            } else {
                alert(`크레딧이 부족합니다! (${pending.length}편 × ${CREDIT_COSTS.video} = ${pending.length * CREDIT_COSTS.video} 크레딧 필요, 잔여: ${creditsRemaining})`);
            }
            return;
        }
        pending.forEach((scene, i) => {
            setTimeout(() => generateSingleVideo(scene.id), i * 800);
        });
    }, [scenes, videoGenStatus, canAfford, creditsRemaining, CREDIT_COSTS, generateSingleVideo, onCreditShortage]);

    const regenerateSingleVideo = useCallback((sceneId: string) => {
        generateSingleVideo(sceneId);
    }, [generateSingleVideo]);

    const doneSceneCount = Object.values(sceneGenStatus).filter((s) => s === 'done').length;
    const allImagesDone = scenes.length > 0 && doneSceneCount === scenes.length;
    const doneVideoCount = Object.values(videoGenStatus).filter((s) => s === 'done').length;
    const allVideosDone = scenes.length > 0 && doneVideoCount === scenes.length;

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
        customPrompts,
        initPrompts,
        updatePrompt,
    };
}

export type UseGenerationApi = ReturnType<typeof useGeneration>;
