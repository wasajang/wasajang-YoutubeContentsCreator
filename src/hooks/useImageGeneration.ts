/**
 * useImageGeneration — 씬 이미지 생성 상태 관리
 *
 * sceneImages, sceneGenStatus, generateSubImage, generateAllScenes 담당
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import type { AssetCard, Scene } from '../store/projectStore';
import { useProjectStore } from '../store/projectStore';
import { generateImage } from '../services/ai-image';
import { buildImagePrompt, getNegativePrompt, aspectRatioToSize } from '../services/prompt-builder';
import type { GenerationType } from './useCredits';
import { useToastStore } from './useToast';

export type SceneGenStatus = 'idle' | 'generating' | 'done';

export interface UseImageGenerationParams {
    scenes: Scene[];
    deck: AssetCard[];
    artStyleId: string;
    canAfford: (type: GenerationType, count?: number) => boolean;
    spend: (type: GenerationType, count?: number) => boolean;
    CREDIT_COSTS: Record<GenerationType, number>;
    imageModel?: string;
    templateId?: string;
    aspectRatio?: string;
    onCreditShortage?: (required: number, label: string) => void;
    // 외부에서 주입: 씬별 서브씬 수 (videoGeneration에서 관리)
    videoCountPerScene: Record<string, number>;
    // 외부에서 주입: 프롬프트 (prompts 훅에서 관리)
    customPrompts: Record<string, { image: string; video: string }>;
    sceneSeeds: Record<string, string[]>;
}

export function useImageGeneration({
    scenes,
    deck,
    artStyleId,
    canAfford,
    spend,
    CREDIT_COSTS,
    imageModel,
    templateId,
    aspectRatio,
    onCreditShortage,
    videoCountPerScene,
    customPrompts,
    sceneSeeds,
}: UseImageGenerationParams) {
    const updateSceneImage = useProjectStore((s) => s.updateSceneImage);
    const storeSceneImages = useProjectStore((s) => s.sceneImages);
    const setStoreSceneImages = useProjectStore((s) => s.setSceneImages);
    const updateSceneImageAtSub = useProjectStore((s) => s.updateSceneImageAtSub);

    // 씬별 서브이미지 배열 (store에 영구 저장)
    const sceneImages = storeSceneImages;

    // 새 씬이 추가되면 store에 초기값 세팅
    useEffect(() => {
        let changed = false;
        const updated = { ...storeSceneImages };
        scenes.forEach((s) => {
            if (!(s.id in updated)) {
                updated[s.id] = s.imageUrl ? [s.imageUrl] : [];
                changed = true;
            }
        });
        if (changed) setStoreSceneImages(updated);
    }, [scenes]); // eslint-disable-line react-hooks/exhaustive-deps

    const [sceneGenStatus, setSceneGenStatus] = useState<Record<string, SceneGenStatus>>(() => {
        const init: Record<string, SceneGenStatus> = {};
        scenes.forEach((s) => { init[s.id] = s.imageUrl ? 'done' : 'idle'; });
        return init;
    });

    // scenes가 변경되면 sceneGenStatus에 새 씬 추가
    useEffect(() => {
        setSceneGenStatus((prev) => {
            const updated = { ...prev };
            let changed = false;
            scenes.forEach((s) => {
                if (!(s.id in updated)) {
                    updated[s.id] = s.imageUrl ? 'done' : 'idle';
                    changed = true;
                }
            });
            return changed ? updated : prev;
        });
    }, [scenes]);

    // 씬별 done 판정: 해당 씬의 모든 서브이미지가 생성 완료된 경우
    const isSceneDone = useCallback((sceneId: string) => {
        const vc = videoCountPerScene[sceneId] || 1;
        const images = sceneImages[sceneId] || [];
        return images.filter((url) => url && url.length > 0).length >= vc;
    }, [videoCountPerScene, sceneImages]);

    // sceneGenStatus를 sceneImages 기반으로 동기화
    useEffect(() => {
        setSceneGenStatus((prev) => {
            const updated = { ...prev };
            let changed = false;
            scenes.forEach((s) => {
                const done = isSceneDone(s.id);
                if (done && updated[s.id] !== 'done') {
                    updated[s.id] = 'done';
                    changed = true;
                }
            });
            return changed ? updated : prev;
        });
    }, [sceneImages, scenes, isSceneDone]);

    // 씬의 특정 서브인덱스 이미지를 생성하는 내부 함수
    // 크레딧 차감은 generateAllScenes에서 일괄 처리 — 여기서는 차감하지 않음
    const generateSubImage = useCallback(async (sceneId: string, subIndex: number) => {
        // 첫 번째 서브이미지 생성 시 씬 전체 상태를 generating으로 표시
        if (subIndex === 0) {
            setSceneGenStatus((p) => ({ ...p, [sceneId]: 'generating' }));
        }

        try {
            const scene = scenes.find((s) => s.id === sceneId);
            if (!scene) {
                console.warn(`[generateSubImage] scene ${sceneId} not found — skipping`);
                return;
            }
            // 서브씬별 씨드: "sceneId-subIndex" 키 우선, 없으면 "sceneId" fallback
            const vc = videoCountPerScene[sceneId] || 1;
            const seedsKey = vc > 1 ? `${sceneId}-${subIndex}` : sceneId;
            const seeds = sceneSeeds[seedsKey] || sceneSeeds[sceneId] || [];
            const seedCards = seeds
                .map((cardId) => deck.find((c) => c.id === cardId))
                .filter((c): c is AssetCard => !!c);

            // 서브씬별 프롬프트 키: "sceneId-subIndex" 또는 "sceneId"
            const subKey = `${sceneId}-${subIndex}`;
            const prompt = customPrompts[subKey]?.image || customPrompts[sceneId]?.image || buildImagePrompt({
                artStyleId,
                sceneText: scene.text,
                seedCards,
                cameraAngle: scene.cameraAngle,
                location: scene.location,
                templateId,
                subIndex,
                totalSubScenes: vc,
            });

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

            console.log(`[Scene ${sceneId}][sub ${subIndex}] 이미지 생성 완료`);

            // sceneImages 배열에 서브인덱스 위치에 저장 (store 영구 저장)
            updateSceneImageAtSub(sceneId, subIndex, result.imageUrl);

            // subIndex === 0이면 기존 scene.imageUrl도 업데이트 (하위 호환)
            if (subIndex === 0) {
                updateSceneImage(sceneId, result.imageUrl);
            }
        } catch (err) {
            console.error(`[Scene ${sceneId}][sub ${subIndex}] 이미지 생성 실패:`, err);
        }
    }, [scenes, sceneSeeds, deck, artStyleId, templateId, aspectRatio, imageModel, videoCountPerScene, customPrompts, updateSceneImage, updateSceneImageAtSub]);

    // ref로 항상 최신 generateSubImage를 참조 (stale closure 방지)
    const generateSubImageRef = useRef(generateSubImage);
    useEffect(() => { generateSubImageRef.current = generateSubImage; });

    // 기존 generateSingleScene — 서브인덱스 0번만 생성 (단일 호출 및 재생성용)
    const generateSingleScene = useCallback(async (sceneId: string) => {
        if (!canAfford('image')) {
            if (onCreditShortage) onCreditShortage(CREDIT_COSTS.image, '이미지 생성');
            return;
        }
        if (!spend('image')) return;
        setSceneGenStatus((p) => ({ ...p, [sceneId]: 'generating' }));
        await generateSubImage(sceneId, 0);
        setSceneGenStatus((p) => ({ ...p, [sceneId]: 'done' }));
    }, [generateSubImage, canAfford, spend, CREDIT_COSTS, onCreditShortage]);

    // 이미지 일괄 생성 진행률 (null = 미실행)
    const [imageGenProgress, setImageGenProgress] = useState<{ done: number; total: number } | null>(null);
    const isGeneratingAllRef = useRef(false);

    const generateAllScenes = useCallback(async () => {
        // 중복 실행 방지
        if (isGeneratingAllRef.current) {
            console.warn('[generateAllScenes] 이미 생성 중 — 중복 호출 무시');
            return;
        }

        // videoCount 포함해서 총 이미지 수 계산
        let totalImages = 0;
        const tasks: Array<{ sceneId: string; subIndex: number }> = [];

        scenes.forEach((scene) => {
            const vc = videoCountPerScene[scene.id] || 1;
            // 이미 모든 서브이미지가 완료된 씬은 건너뜀
            const existingImages = sceneImages[scene.id] || [];
            const doneCount = existingImages.filter((url) => url && url.length > 0).length;
            if (doneCount >= vc) return;

            for (let sub = 0; sub < vc; sub++) {
                if (!existingImages[sub] || existingImages[sub].length === 0) {
                    tasks.push({ sceneId: scene.id, subIndex: sub });
                    totalImages++;
                }
            }
        });

        if (totalImages === 0) return;

        if (!canAfford('image', totalImages)) {
            if (onCreditShortage) {
                onCreditShortage(totalImages * CREDIT_COSTS.image, `이미지 전체 생성 (${totalImages}장)`);
            } else {
                useToastStore.getState().addToast('크레딧이 부족합니다!', 'warning');
            }
            return;
        }

        // 크레딧 일괄 차감
        if (!spend('image', totalImages)) return;

        isGeneratingAllRef.current = true;
        setImageGenProgress({ done: 0, total: totalImages });
        console.log(`[generateAllScenes] 시작: ${totalImages}장, ${tasks.length} tasks`);

        // 순차 배치: 최대 7개 병렬 → 완료 후 다음 배치 (API 스팸 방지)
        const BATCH_SIZE = 7;
        let completed = 0;
        for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
            const batch = tasks.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            console.log(`[Batch ${batchNum}] ${batch.length}개 시작`);

            const results = await Promise.allSettled(
                batch.map((task) => generateSubImageRef.current(task.sceneId, task.subIndex))
            );

            // 실패 로그
            results.forEach((r, idx) => {
                if (r.status === 'rejected') {
                    console.error(`[Batch ${batchNum}] task ${idx} 실패:`, r.reason);
                }
            });

            completed += batch.length;
            setImageGenProgress({ done: completed, total: totalImages });
            console.log(`[generateAllScenes] 진행: ${completed}/${totalImages}`);
        }

        isGeneratingAllRef.current = false;
        setImageGenProgress(null);
        console.log('[generateAllScenes] 모든 이미지 생성 완료');
    }, [scenes, videoCountPerScene, sceneImages, canAfford, CREDIT_COSTS, onCreditShortage, spend]);

    const doneSceneCount = scenes.filter((s) => isSceneDone(s.id)).length;
    const allImagesDone = scenes.length > 0 && doneSceneCount === scenes.length;

    return {
        sceneImages,
        sceneGenStatus,
        generateSubImage,
        generateSubImageRef,
        generateSingleScene,
        generateAllScenes,
        isSceneDone,
        doneSceneCount,
        allImagesDone,
        imageGenProgress,
    };
}
