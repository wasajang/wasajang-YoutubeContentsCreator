/**
 * useVideoGeneration — 씬 영상 생성 상태 관리
 *
 * sceneVideos, videoGenStatus, videoCountPerScene, generateSubVideo, generateAllVideos 담당
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { AssetCard, Scene } from '../store/projectStore';
import { useProjectStore } from '../store/projectStore';
import { generateVideo } from '../services/ai-video';
import { buildVideoPrompt } from '../services/prompt-builder';
import type { GenerationType } from './useCredits';
import { useToastStore } from './useToast';
import type { SceneGenStatus } from './useImageGeneration';

export interface UseVideoGenerationParams {
    scenes: Scene[];
    deck: AssetCard[];
    artStyleId: string;
    canAfford: (type: GenerationType, count?: number) => boolean;
    spend: (type: GenerationType, count?: number) => boolean;
    CREDIT_COSTS: Record<GenerationType, number>;
    videoModel?: string;
    templateId?: string;
    onCreditShortage?: (required: number, label: string) => void;
    // 외부에서 주입: 프롬프트 (prompts 훅에서 관리)
    customPrompts: Record<string, { image: string; video: string }>;
    sceneSeeds: Record<string, string[]>;
}

export function useVideoGeneration({
    scenes,
    deck,
    artStyleId,
    canAfford,
    spend,
    CREDIT_COSTS,
    videoModel,
    templateId,
    onCreditShortage,
    customPrompts,
    sceneSeeds,
}: UseVideoGenerationParams) {
    const updateSceneVideo = useProjectStore((s) => s.updateSceneVideo);
    const storeSceneVideos = useProjectStore((s) => s.sceneVideos);
    const setStoreSceneVideos = useProjectStore((s) => s.setSceneVideos);
    const updateSceneVideoAtSub = useProjectStore((s) => s.updateSceneVideoAtSub);
    const storeSceneImages = useProjectStore((s) => s.sceneImages);

    const storeVideoCount = useProjectStore((s) => s.videoCountPerScene);
    const setStoreVideoCountBulk = useProjectStore((s) => s.setVideoCountPerSceneBulk);

    // 새 씬이 추가되면 sceneVideos store에 초기값 세팅
    useEffect(() => {
        let changed = false;
        const updated = { ...storeSceneVideos };
        scenes.forEach((s) => {
            if (!(s.id in updated)) {
                updated[s.id] = s.videoUrl ? [s.videoUrl] : [];
                changed = true;
            }
        });
        if (changed) setStoreSceneVideos(updated);
    }, [scenes]); // eslint-disable-line react-hooks/exhaustive-deps

    const [videoCountPerScene, _setVideoCountPerScene] = useState<Record<string, number>>(() => {
        const init: Record<string, number> = {};
        scenes.forEach((s) => { init[s.id] = storeVideoCount[s.id] || 1; });
        return init;
    });

    // store 동기화 래퍼
    const setVideoCountPerScene: React.Dispatch<React.SetStateAction<Record<string, number>>> = useCallback((action) => {
        _setVideoCountPerScene((prev) => {
            const next = typeof action === 'function' ? action(prev) : action;
            setStoreVideoCountBulk(next);
            return next;
        });
    }, [setStoreVideoCountBulk]);

    const [videoGenStatus, setVideoGenStatus] = useState<Record<string, SceneGenStatus>>(() => {
        // storeSceneVideos에서 이미 영상이 있으면 done으로 복원
        const init: Record<string, SceneGenStatus> = {};
        scenes.forEach((s) => {
            const vids = storeSceneVideos[s.id] || [];
            const vc = storeVideoCount[s.id] || 1;
            for (let sub = 0; sub < vc; sub++) {
                const key = `${s.id}-${sub}`;
                if (vids[sub]) init[key] = 'done';
            }
        });
        return init;
    });

    // 서브씬 단위 영상 생성 (크레딧 차감은 호출자가 처리)
    const generateSubVideo = useCallback(async (sceneId: string, subIndex: number) => {
        const statusKey = `${sceneId}-${subIndex}`;
        setVideoGenStatus((p) => ({ ...p, [statusKey]: 'generating' }));
        try {
            const scene = scenes.find((s) => s.id === sceneId);
            if (!scene) {
                console.warn(`[generateSubVideo] scene ${sceneId} not found — skipping`);
                return;
            }
            // 서브씬별 씨드: "sceneId-subIndex" 키 우선, 없으면 "sceneId" fallback
            const vc = videoCountPerScene[sceneId] || 1;
            const seedsKey = vc > 1 ? `${sceneId}-${subIndex}` : sceneId;
            const seeds = sceneSeeds[seedsKey] || sceneSeeds[sceneId] || [];
            const seedCards = seeds
                .map((cardId) => deck.find((c) => c.id === cardId))
                .filter((c): c is AssetCard => !!c);
            const subKey = vc > 1 ? `${sceneId}-${subIndex}` : sceneId;
            const prompt = customPrompts[subKey]?.video || customPrompts[sceneId]?.video || buildVideoPrompt({
                artStyleId,
                sceneText: scene.text,
                seedCards,
                cameraAngle: scene.cameraAngle,
                templateId,
                subIndex,
                totalSubScenes: vc,
            });

            // 서브씬별 이미지를 입력으로 사용
            const inputImage = storeSceneImages[sceneId]?.[subIndex] || scene.imageUrl || '';

            const videoResult = await generateVideo({
                imageUrl: inputImage,
                prompt,
                duration: 5,
                sceneId: statusKey,
                model: videoModel,
            });
            if (videoResult?.videoUrl) {
                updateSceneVideoAtSub(sceneId, subIndex, videoResult.videoUrl);
                // subIndex === 0이면 기존 scene.videoUrl도 업데이트 (하위 호환)
                if (subIndex === 0) {
                    updateSceneVideo(sceneId, videoResult.videoUrl);
                }
            }
            setVideoGenStatus((p) => ({ ...p, [statusKey]: 'done' }));
            console.log(`[Video ${sceneId}][sub ${subIndex}] 영상 생성 완료`);
        } catch (err) {
            console.error(`[Video ${sceneId}][sub ${subIndex}] 영상 생성 실패:`, err);
            setVideoGenStatus((p) => ({ ...p, [statusKey]: 'idle' }));
        }
    }, [scenes, sceneSeeds, deck, artStyleId, templateId, videoModel, videoCountPerScene, customPrompts, storeSceneImages, updateSceneVideo, updateSceneVideoAtSub]);

    // ref로 항상 최신 generateSubVideo를 참조 (stale closure 방지)
    const generateSubVideoRef = useRef(generateSubVideo);
    useEffect(() => { generateSubVideoRef.current = generateSubVideo; });

    // 편의 래퍼: 단일 씬 영상 생성 (크레딧 차감 + sub 0 호출)
    const generateSingleVideo = useCallback(async (sceneId: string) => {
        if (!canAfford('video')) {
            if (onCreditShortage) {
                onCreditShortage(CREDIT_COSTS.video, '영상 생성');
            } else {
                useToastStore.getState().addToast('크레딧이 부족합니다!', 'warning');
            }
            return;
        }
        if (!spend('video')) return;
        await generateSubVideo(sceneId, 0);
    }, [generateSubVideo, canAfford, spend, CREDIT_COSTS, onCreditShortage]);

    const isGeneratingAllVideosRef = useRef(false);

    const generateAllVideos = useCallback(async () => {
        if (isGeneratingAllVideosRef.current) {
            console.warn('[generateAllVideos] 이미 생성 중 — 중복 호출 무시');
            return;
        }

        const tasks: Array<{ sceneId: string; subIndex: number }> = [];
        scenes.forEach((scene) => {
            const vc = videoCountPerScene[scene.id] || 1;
            for (let sub = 0; sub < vc; sub++) {
                const statusKey = `${scene.id}-${sub}`;
                if (videoGenStatus[statusKey] !== 'done') {
                    tasks.push({ sceneId: scene.id, subIndex: sub });
                }
            }
        });

        if (tasks.length === 0) return;

        if (!canAfford('video', tasks.length)) {
            if (onCreditShortage) {
                onCreditShortage(tasks.length * CREDIT_COSTS.video, `영상 전체 생성 (${tasks.length}편)`);
            } else {
                useToastStore.getState().addToast('크레딧이 부족합니다!', 'warning');
            }
            return;
        }

        if (!spend('video', tasks.length)) return;

        isGeneratingAllVideosRef.current = true;
        console.log(`[generateAllVideos] 시작: ${tasks.length} tasks`);

        const BATCH_SIZE = 3;
        for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
            const batch = tasks.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(
                batch.map((t) => generateSubVideoRef.current(t.sceneId, t.subIndex))
            );
        }

        isGeneratingAllVideosRef.current = false;
        console.log('[generateAllVideos] 모든 영상 생성 완료');
    }, [scenes, videoCountPerScene, videoGenStatus, canAfford, CREDIT_COSTS, onCreditShortage, spend]);

    const regenerateSingleVideo = useCallback((sceneId: string) => {
        generateSingleVideo(sceneId);
    }, [generateSingleVideo]);

    // 씬별 영상 done 판정
    const isSceneVideoDone = useCallback((sceneId: string) => {
        const vc = videoCountPerScene[sceneId] || 1;
        for (let sub = 0; sub < vc; sub++) {
            if (videoGenStatus[`${sceneId}-${sub}`] !== 'done') return false;
        }
        return true;
    }, [videoCountPerScene, videoGenStatus]);

    const doneVideoCount = scenes.filter((s) => isSceneVideoDone(s.id)).length;
    const allVideosDone = scenes.length > 0 && doneVideoCount === scenes.length;

    return {
        sceneVideos: storeSceneVideos,
        videoGenStatus,
        videoCountPerScene,
        setVideoCountPerScene,
        generateSubVideo,
        generateSubVideoRef,
        generateSingleVideo,
        generateAllVideos,
        regenerateSingleVideo,
        isSceneVideoDone,
        doneVideoCount,
        allVideosDone,
    };
}
