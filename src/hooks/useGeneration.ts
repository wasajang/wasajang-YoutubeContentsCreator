/**
 * useGeneration — 씬 이미지/영상 생성 상태 관리 훅
 *
 * StoryboardPage의 seed-check 단계에서 사용하는 생성 관련 상태와 액션을 담당합니다.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { AssetCard, Scene } from '../store/projectStore';
import { useProjectStore } from '../store/projectStore';
import { mockScenePrompts } from '../data/mockData';
import { generateImage } from '../services/ai-image';
import { generateVideo } from '../services/ai-video';
import { buildImagePrompt, buildVideoPrompt, getNegativePrompt, aspectRatioToSize } from '../services/prompt-builder';
import type { GenerationType } from './useCredits';
import { useToastStore } from './useToast';

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
    const storeSceneVideos = useProjectStore((s) => s.sceneVideos);
    const setStoreSceneVideos = useProjectStore((s) => s.setSceneVideos);
    const updateSceneVideoAtSub = useProjectStore((s) => s.updateSceneVideoAtSub);

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

    const storeVideoCount = useProjectStore((s) => s.videoCountPerScene);
    const setStoreVideoCountBulk = useProjectStore((s) => s.setVideoCountPerSceneBulk);

    const [videoGenStatus, setVideoGenStatus] = useState<Record<string, SceneGenStatus>>(() => {
        // storeSceneVideos에서 이미 영상이 있으면 done으로 복원
        const init: Record<string, SceneGenStatus> = {};
        scenes.forEach((s) => {
            const vids = storeSceneVideos[s.id] || [];
            const vc = storeVideoCount[s.id] || 1;
            for (let sub = 0; sub < vc; sub++) {
                const key = vc > 1 ? `${s.id}-${sub}` : s.id;
                if (vids[sub]) init[key] = 'done';
            }
        });
        return init;
    });

    const [videoCountPerScene, _setVideoCountPerScene] = useState<Record<string, number>>(() => {
        const init: Record<string, number> = {};
        scenes.forEach((s) => { init[s.id] = storeVideoCount[s.id] || 1; });
        return init;
    });

    // store 동기화 래퍼
    const setVideoCountPerScene: React.Dispatch<React.SetStateAction<Record<string, number>>> = useCallback((action) => {
        _setVideoCountPerScene((prev) => {
            const next = typeof action === 'function' ? action(prev) : action;
            // store에도 동기화
            setStoreVideoCountBulk(next);
            return next;
        });
    }, [setStoreVideoCountBulk]);

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

        // Step 2: 배정된 씨드카드 기반으로 프롬프트 생성 (서브씬별 자동 변형 포함)
        const prompts: Record<string, { image: string; video: string }> = {};
        scenes.forEach((scene) => {
            const seeds = updatedSeeds[scene.id] || [];
            const seedCards = seeds.map((id) => deck.find((c) => c.id === id)).filter((c): c is AssetCard => !!c);
            const vc = videoCountPerScene[scene.id] || 1;

            if (vc <= 1) {
                // 서브씬 없음 — 기존 방식
                prompts[scene.id] = {
                    image: buildImagePrompt({ artStyleId, sceneText: scene.text, seedCards, cameraAngle: scene.cameraAngle, location: scene.location, templateId }),
                    video: buildVideoPrompt({ artStyleId, sceneText: scene.text, seedCards, cameraAngle: scene.cameraAngle, templateId }),
                };
            } else {
                // 서브씬 자동 변형 — 각 서브인덱스별 다른 프롬프트
                for (let sub = 0; sub < vc; sub++) {
                    const key = `${scene.id}-${sub}`;
                    prompts[key] = {
                        image: buildImagePrompt({
                            artStyleId, sceneText: scene.text, seedCards,
                            cameraAngle: scene.cameraAngle, location: scene.location, templateId,
                            subIndex: sub, totalSubScenes: vc,
                        }),
                        video: buildVideoPrompt({
                            artStyleId, sceneText: scene.text, seedCards,
                            cameraAngle: scene.cameraAngle, templateId,
                            subIndex: sub, totalSubScenes: vc,
                        }),
                    };
                }
                // 기본 키도 첫 번째 서브씬과 동일하게 세팅 (하위 호환)
                prompts[scene.id] = prompts[`${scene.id}-0`];
            }
        });
        setCustomPrompts(prompts);
    }, [scenes, sceneSeeds, deck, artStyleId, templateId, videoCountPerScene]);

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
            if (!scene) {
                console.warn(`[generateSubImage] scene ${sceneId} not found — skipping`);
                return;
            }
            const seedCards = (sceneSeeds[sceneId] || [])
                .map((cardId) => deck.find((c) => c.id === cardId))
                .filter((c): c is AssetCard => !!c);

            // 서브씬별 프롬프트 키: "sceneId-subIndex" 또는 "sceneId"
            const subKey = `${sceneId}-${subIndex}`;
            const prompt = customPrompts[subKey]?.image || customPrompts[sceneId]?.image || buildImagePrompt({
                artStyleId,
                sceneText: scene.text,
                seedCards,
                customImagePrompt: mockScenePrompts[sceneId]?.imagePrompt,
                cameraAngle: scene.cameraAngle,
                location: scene.location,
                templateId,
                subIndex,
                totalSubScenes: videoCountPerScene[sceneId] || 1,
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
        // ref를 통해 항상 최신 generateSubImage 호출 (stale closure 방지)
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
    }, [scenes, videoCountPerScene, sceneImages, canAfford, creditsRemaining, CREDIT_COSTS, onCreditShortage, spend]);

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
            const seedCards = (sceneSeeds[sceneId] || [])
                .map((cardId) => deck.find((c) => c.id === cardId))
                .filter((c): c is AssetCard => !!c);

            const vc = videoCountPerScene[sceneId] || 1;
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

        // 모든 씬 × 서브씬을 순회해서 tasks 배열 생성
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

        // 크레딧 일괄 차감
        if (!spend('video', tasks.length)) return;

        isGeneratingAllVideosRef.current = true;
        console.log(`[generateAllVideos] 시작: ${tasks.length} tasks`);

        // 순차 배치: 최대 3개 병렬
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

    // 씬별 영상 done 판정: 해당 씬의 모든 서브영상이 생성 완료된 경우
    const isSceneVideoDone = useCallback((sceneId: string) => {
        const vc = videoCountPerScene[sceneId] || 1;
        for (let sub = 0; sub < vc; sub++) {
            if (videoGenStatus[`${sceneId}-${sub}`] !== 'done') return false;
        }
        return true;
    }, [videoCountPerScene, videoGenStatus]);

    const doneVideoCount = scenes.filter((s) => isSceneVideoDone(s.id)).length;
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

    // 전체 선택/해제 토글
    const toggleAllVideoSelection = useCallback(() => {
        setSelectedForVideo((prev) => {
            const allKeys = new Set<string>();
            scenes.forEach((s) => {
                const vc = videoCountPerScene[s.id] || 1;
                for (let i = 0; i < vc; i++) allKeys.add(`${s.id}-${i}`);
            });
            return prev.size === allKeys.size ? new Set() : allKeys;
        });
    }, [scenes, videoCountPerScene]);

    // Shift+클릭 범위 선택용 마지막 클릭 인덱스
    const [lastClickedSceneIndex, setLastClickedSceneIndex] = useState<number | null>(null);

    const toggleVideoSelection = useCallback((sceneId: string, sceneIndex?: number, shiftKey?: boolean) => {
        // Shift+클릭: 범위 선택
        if (shiftKey && lastClickedSceneIndex !== null && sceneIndex != null) {
            const start = Math.min(lastClickedSceneIndex, sceneIndex);
            const end = Math.max(lastClickedSceneIndex, sceneIndex);
            setSelectedForVideo((prev) => {
                const next = new Set(prev);
                for (let si = start; si <= end; si++) {
                    const s = scenes[si];
                    if (!s) continue;
                    const vc = videoCountPerScene[s.id] || 1;
                    for (let sub = 0; sub < vc; sub++) next.add(`${s.id}-${sub}`);
                }
                return next;
            });
        } else {
            // 일반 클릭: 단일 토글
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
        }
        if (sceneIndex != null) setLastClickedSceneIndex(sceneIndex);
    }, [videoCountPerScene, lastClickedSceneIndex, scenes]);

    const generateSelectedVideos = useCallback(async () => {
        // selectedForVideo 키에서 서브씬 단위 tasks 생성
        const tasks: Array<{ sceneId: string; subIndex: number }> = [];
        selectedForVideo.forEach((key) => {
            const parts = key.split('-');
            const subIndex = parseInt(parts.pop()!, 10);
            const sceneId = parts.join('-');
            const statusKey = `${sceneId}-${subIndex}`;
            if (videoGenStatus[statusKey] !== 'done' && videoGenStatus[statusKey] !== 'generating') {
                tasks.push({ sceneId, subIndex });
            }
        });

        if (tasks.length === 0) return;

        if (!canAfford('video', tasks.length)) {
            if (onCreditShortage) {
                onCreditShortage(tasks.length * CREDIT_COSTS.video, `선택 영상 생성 (${tasks.length}편)`);
            }
            return;
        }

        // 크레딧 일괄 차감
        if (!spend('video', tasks.length)) return;

        // 배치 3개 병렬
        const BATCH_SIZE = 3;
        for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
            const batch = tasks.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(
                batch.map((t) => generateSubVideoRef.current(t.sceneId, t.subIndex))
            );
        }
    }, [selectedForVideo, videoGenStatus, canAfford, CREDIT_COSTS, onCreditShortage, spend]);

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
        toggleAllVideoSelection,
        isSceneSelectedForVideo,
        generateSelectedVideos,
        sceneImages,
        sceneVideos: storeSceneVideos,
        generateSubVideo,
        isSceneVideoDone,
        imageGenProgress,
    };
}

export type UseGenerationApi = ReturnType<typeof useGeneration>;
