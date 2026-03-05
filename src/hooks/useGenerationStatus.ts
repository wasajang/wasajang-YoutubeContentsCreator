/**
 * useGenerationStatus — 영상 생성 상태 조회 + 선택 관리
 *
 * getVideoStatus, selectedForVideo, 선택 토글, generateSelectedVideos 담당
 */
import { useState, useCallback, useEffect } from 'react';
import type { Scene } from '../store/projectStore';
import type { GenerationType } from './useCredits';
import type { SceneGenStatus } from './useImageGeneration';

export interface UseGenerationStatusParams {
    scenes: Scene[];
    videoCountPerScene: Record<string, number>;
    videoGenStatus: Record<string, SceneGenStatus>;
    allImagesDone: boolean;
    canAfford: (type: GenerationType, count?: number) => boolean;
    spend: (type: GenerationType, count?: number) => boolean;
    CREDIT_COSTS: Record<GenerationType, number>;
    onCreditShortage?: (required: number, label: string) => void;
    generateSubVideoRef: React.MutableRefObject<(sceneId: string, subIndex: number) => Promise<void>>;
}

export function useGenerationStatus({
    scenes,
    videoCountPerScene,
    videoGenStatus,
    allImagesDone,
    canAfford,
    spend,
    CREDIT_COSTS,
    onCreditShortage,
    generateSubVideoRef,
}: UseGenerationStatusParams) {
    // 씬의 영상 생성 상태를 통합 반환
    const getVideoStatus = useCallback((sceneId: string): SceneGenStatus => {
        const vc = videoCountPerScene[sceneId] || 1;
        let hasGenerating = false;
        let allDone = true;
        for (let sub = 0; sub < vc; sub++) {
            const key = `${sceneId}-${sub}`;
            const status = videoGenStatus[key];
            if (status === 'generating') hasGenerating = true;
            if (status !== 'done') allDone = false;
        }
        if (hasGenerating) return 'generating';
        if (allDone && vc > 0) return 'done';
        return 'idle';
    }, [videoGenStatus, videoCountPerScene]);

    // 영상 생성 대상 선택 상태 — 키: "sceneId-subIndex" 형태
    const [selectedForVideo, setSelectedForVideo] = useState<Set<string>>(new Set());

    // 이미지 전부 완료 시 자동으로 전체 선택
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

    // 씬 단위 선택 여부 판정
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
        if (shiftKey && lastClickedSceneIndex !== null && sceneIndex != null) {
            // Shift 클릭: lastClicked ~ clicked 범위 전체 선택 (양쪽 끝 포함)
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
                // 클릭한 씬을 명시적으로 포함 (안전장치)
                const clickedVc = videoCountPerScene[sceneId] || 1;
                for (let sub = 0; sub < clickedVc; sub++) next.add(`${sceneId}-${sub}`);
                return next;
            });
            setLastClickedSceneIndex(sceneIndex);
        } else {
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
            if (sceneIndex != null) setLastClickedSceneIndex(sceneIndex);
        }
    }, [videoCountPerScene, lastClickedSceneIndex, scenes]);

    const generateSelectedVideos = useCallback(async () => {
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

        if (!spend('video', tasks.length)) return;

        const BATCH_SIZE = 3;
        for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
            const batch = tasks.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(
                batch.map((t) => generateSubVideoRef.current(t.sceneId, t.subIndex))
            );
        }
    }, [selectedForVideo, videoGenStatus, canAfford, CREDIT_COSTS, onCreditShortage, spend, generateSubVideoRef]);

    return {
        getVideoStatus,
        selectedForVideo,
        isSceneSelectedForVideo,
        toggleVideoSelection,
        toggleAllVideoSelection,
        generateSelectedVideos,
    };
}
