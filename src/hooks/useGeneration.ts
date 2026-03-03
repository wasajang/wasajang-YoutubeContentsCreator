/**
 * useGeneration — 씬 이미지/영상 생성 상태 관리 훅
 *
 * StoryboardPage의 seed-check 단계에서 사용하는 생성 관련 상태와 액션을 담당합니다.
 */
import { useState, useCallback, useEffect } from 'react';
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
    spend: (type: GenerationType, count?: number) => boolean;
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
    const storeSceneImages = useProjectStore((s) => s.sceneImages);
    const setStoreSceneImages = useProjectStore((s) => s.setSceneImages);
    const updateSceneImageAtSub = useProjectStore((s) => s.updateSceneImageAtSub);

    const [sceneGenStatus, setSceneGenStatus] = useState<Record<string, SceneGenStatus>>(() => {
        const init: Record<string, SceneGenStatus> = {};
        scenes.forEach((s) => { init[s.id] = s.imageUrl ? 'done' : 'idle'; });
        return init;
    });

    // 씬별 서브이미지 배열 (store에 영구 저장)
    // key: sceneId, value: string[] (서브인덱스 순서대로 imageUrl)
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

    // 씬의 특정 서브인덱스 이미지를 생성하는 내부 함수
    // 크레딧 차감은 generateAllScenes에서 일괄 처리 — 여기서는 차감하지 않음
    const generateSubImage = useCallback(async (sceneId: string, subIndex: number) => {

        // 첫 번째 서브이미지 생성 시 씬 전체 상태를 generating으로 표시
        if (subIndex === 0) {
            setSceneGenStatus((p) => ({ ...p, [sceneId]: 'generating' }));
        }

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

            console.log(`[Scene ${sceneId}][sub ${subIndex}] 이미지 생성 완료: ${result.imageUrl}`);

            // sceneImages 배열에 서브인덱스 위치에 저장 (store 영구 저장)
            updateSceneImageAtSub(sceneId, subIndex, result.imageUrl);

            // subIndex === 0이면 기존 scene.imageUrl도 업데이트 (하위 호환)
            if (subIndex === 0) {
                updateSceneImage(sceneId, result.imageUrl);
            }
        } catch (err) {
            console.error(`[Scene ${sceneId}][sub ${subIndex}] 이미지 생성 실패:`, err);
        }
    }, [scenes, sceneSeeds, deck, artStyleId, canAfford, spend, creditsRemaining, CREDIT_COSTS, templateId, aspectRatio, imageModel, onCreditShortage, updateSceneImage, updateSceneImageAtSub, customPrompts]);

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

    const generateAllScenes = useCallback(() => {
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
                alert(`크레딧이 부족합니다! (${totalImages}장 × ${CREDIT_COSTS.image} = ${totalImages * CREDIT_COSTS.image} 크레딧 필요, 잔여: ${creditsRemaining})`);
            }
            return;
        }

        // 크레딧 일괄 차감
        if (!spend('image', totalImages)) return;

        // 동시 요청 제한: 최대 4개씩 순차 배치 (실제 API 대비)
        const BATCH_SIZE = 4;
        const BATCH_DELAY = 2500;
        tasks.forEach((task, i) => {
            const batchIndex = Math.floor(i / BATCH_SIZE);
            const withinBatch = i % BATCH_SIZE;
            const delay = batchIndex * BATCH_DELAY + withinBatch * 400;
            setTimeout(() => generateSubImage(task.sceneId, task.subIndex), delay);
        });
    }, [scenes, videoCountPerScene, sceneImages, generateSubImage, canAfford, creditsRemaining, CREDIT_COSTS, onCreditShortage]);

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

    const doneSceneCount = scenes.filter((s) => isSceneDone(s.id)).length;
    const allImagesDone = scenes.length > 0 && doneSceneCount === scenes.length;
    const doneVideoCount = scenes.filter((s) => videoGenStatus[s.id] === 'done').length;
    const allVideosDone = scenes.length > 0 && doneVideoCount === scenes.length;

    // 영상 생성 대상 선택 상태 — 키: "sceneId-subIndex" 형태
    const [selectedForVideo, setSelectedForVideo] = useState<Set<string>>(new Set());

    // 이미지 전부 완료 시 자동으로 전체 선택 (sceneId-subIndex 키로)
    useEffect(() => {
        if (allImagesDone && selectedForVideo.size === 0) {
            const allKeys = new Set<string>();
            scenes.forEach((s) => {
                const vc = videoCountPerScene[s.id] || 1;
                for (let i = 0; i < vc; i++) {
                    allKeys.add(`${s.id}-${i}`);
                }
            });
            setSelectedForVideo(allKeys);
        }
    }, [allImagesDone]); // eslint-disable-line react-hooks/exhaustive-deps

    // 씬 단위 선택 여부 판정 (SceneRow isSelectedForVideo 호환용)
    const isSceneSelectedForVideo = useCallback((sceneId: string) => {
        const vc = videoCountPerScene[sceneId] || 1;
        for (let i = 0; i < vc; i++) {
            if (selectedForVideo.has(`${sceneId}-${i}`)) return true;
        }
        return false;
    }, [selectedForVideo, videoCountPerScene]);

    const toggleVideoSelection = useCallback((sceneId: string) => {
        setSelectedForVideo((prev) => {
            const next = new Set(prev);
            const vc = videoCountPerScene[sceneId] || 1;
            const allSelected = Array.from({ length: vc }, (_, i) => `${sceneId}-${i}`).every((k) => next.has(k));
            for (let i = 0; i < vc; i++) {
                const key = `${sceneId}-${i}`;
                if (allSelected) next.delete(key);
                else next.add(key);
            }
            return next;
        });
    }, [videoCountPerScene]);

    const generateSelectedVideos = useCallback(() => {
        // selectedForVideo 키에서 sceneId 추출 (중복 제거)
        const targetSceneIds = new Set<string>();
        selectedForVideo.forEach((key) => {
            const sceneId = key.split('-').slice(0, -1).join('-');
            if (videoGenStatus[sceneId] !== 'done' && videoGenStatus[sceneId] !== 'generating') {
                targetSceneIds.add(sceneId);
            }
        });
        const targets = scenes.filter((s) => targetSceneIds.has(s.id));
        if (!canAfford('video', targets.length)) {
            if (onCreditShortage) {
                onCreditShortage(targets.length * CREDIT_COSTS.video, `선택 영상 생성 (${targets.length}편)`);
            }
            return;
        }
        targets.forEach((scene, i) => {
            setTimeout(() => generateSingleVideo(scene.id), i * 800);
        });
    }, [selectedForVideo, scenes, videoGenStatus, canAfford, CREDIT_COSTS, onCreditShortage, generateSingleVideo]);

    return {
        sceneGenStatus,
        videoGenStatus,
        videoCountPerScene,
        setVideoCountPerScene,
        sceneSeeds,
        setSceneSeeds,
        toggleSceneSeed,
        generateSingleScene,
        generateSubImage,
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
        selectedForVideo,
        toggleVideoSelection,
        isSceneSelectedForVideo,
        generateSelectedVideos,
        sceneImages,
    };
}

export type UseGenerationApi = ReturnType<typeof useGeneration>;
