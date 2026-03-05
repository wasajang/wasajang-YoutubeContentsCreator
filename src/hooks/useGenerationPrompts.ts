/**
 * useGenerationPrompts — 씬 프롬프트 + 시드 카드 관리
 *
 * sceneSeeds, customPrompts, initPrompts, updatePrompt, toggleSceneSeed 담당
 *
 * 키 규칙:
 *   - 서브씬 없는 씬: "sceneId"
 *   - 서브씬 있는 씬: "sceneId-0", "sceneId-1", ... + "sceneId"(하위호환 = sub-0 복사)
 */
import { useState, useCallback } from 'react';
import type { AssetCard, Scene } from '../store/projectStore';
import { useProjectStore } from '../store/projectStore';
import { buildImagePrompt, buildVideoPrompt } from '../services/prompt-builder';
import React from 'react';

export interface UseGenerationPromptsParams {
    scenes: Scene[];
    deck: AssetCard[];
    artStyleId: string;
    templateId?: string;
    videoCountPerScene: Record<string, number>;
}

export function useGenerationPrompts({
    scenes,
    deck,
    artStyleId,
    templateId,
    videoCountPerScene,
}: UseGenerationPromptsParams) {
    const storeSceneSeeds = useProjectStore((s) => s.sceneSeeds);
    const setStoreSceneSeeds = useProjectStore((s) => s.setSceneSeeds);

    // 초기화: 서브씬 키도 함께 생성
    const [sceneSeeds, _setSceneSeeds] = useState<Record<string, string[]>>(() => {
        const init: Record<string, string[]> = {};
        scenes.forEach((scene) => {
            const vc = videoCountPerScene[scene.id] || 1;
            if (vc <= 1) {
                init[scene.id] = storeSceneSeeds[scene.id] || [];
            } else {
                for (let sub = 0; sub < vc; sub++) {
                    const subKey = `${scene.id}-${sub}`;
                    init[subKey] = storeSceneSeeds[subKey] || storeSceneSeeds[scene.id] || [];
                }
                init[scene.id] = init[`${scene.id}-0`] || [];
            }
        });
        return init;
    });

    // store 동기화 래퍼
    const setSceneSeeds: React.Dispatch<React.SetStateAction<Record<string, string[]>>> = useCallback((action) => {
        _setSceneSeeds((prev) => {
            const next = typeof action === 'function' ? action(prev) : action;
            setStoreSceneSeeds(next);
            return next;
        });
    }, [setStoreSceneSeeds]);

    // 프롬프트 편집 상태
    const [customPrompts, setCustomPrompts] = useState<Record<string, { image: string; video: string }>>({});

    /** 특정 키의 씨드카드 기반 프롬프트를 재생성 */
    const regeneratePromptForKey = useCallback((key: string, seeds: string[]) => {
        // key에서 sceneId와 subIndex 추출
        const match = key.match(/^(.+)-(\d+)$/);
        const sceneId = match ? match[1] : key;
        const subIndex = match ? parseInt(match[2]) : undefined;
        const scene = scenes.find((s) => s.id === sceneId);
        if (!scene) return;

        const seedCards = seeds.map((id) => deck.find((c) => c.id === id)).filter((c): c is AssetCard => !!c);
        const vc = videoCountPerScene[sceneId] || 1;

        const newPrompts: Record<string, { image: string; video: string }> = {};
        if (subIndex !== undefined && vc > 1) {
            newPrompts[key] = {
                image: buildImagePrompt({
                    artStyleId, sceneText: scene.text, seedCards,
                    cameraAngle: scene.cameraAngle, location: scene.location, templateId,
                    subIndex, totalSubScenes: vc,
                }),
                video: buildVideoPrompt({
                    artStyleId, sceneText: scene.text, seedCards,
                    cameraAngle: scene.cameraAngle, templateId,
                    subIndex, totalSubScenes: vc,
                }),
            };
            // sub-0이면 씬 키도 동기화
            if (subIndex === 0) newPrompts[sceneId] = newPrompts[key];
        } else {
            newPrompts[key] = {
                image: buildImagePrompt({ artStyleId, sceneText: scene.text, seedCards, cameraAngle: scene.cameraAngle, location: scene.location, templateId }),
                video: buildVideoPrompt({ artStyleId, sceneText: scene.text, seedCards, cameraAngle: scene.cameraAngle, templateId }),
            };
        }
        setCustomPrompts((prev) => ({ ...prev, ...newPrompts }));
    }, [scenes, deck, artStyleId, templateId, videoCountPerScene]);

    const initPrompts = useCallback(() => {
        // Step 1: 씨드카드가 비어있는 씬/서브씬에 덱에서 랜덤 배정
        const updatedSeeds = { ...sceneSeeds };
        const chars = deck.filter((c) => c.type === 'character');
        const bgs = deck.filter((c) => c.type === 'background');
        const items = deck.filter((c) => c.type === 'item');

        const assignRandom = (): string[] => {
            const assigned: string[] = [];
            const charCount = Math.min(chars.length, 1 + Math.floor(Math.random() * 2));
            const shuffledChars = [...chars].sort(() => Math.random() - 0.5);
            shuffledChars.slice(0, charCount).forEach((c) => assigned.push(c.id));
            if (bgs.length > 0) {
                const bg = bgs[Math.floor(Math.random() * bgs.length)];
                assigned.push(bg.id);
            }
            if (items.length > 0 && Math.random() > 0.4) {
                const item = items[Math.floor(Math.random() * items.length)];
                assigned.push(item.id);
            }
            return assigned;
        };

        scenes.forEach((scene) => {
            const vc = videoCountPerScene[scene.id] || 1;
            if (vc <= 1) {
                if (!updatedSeeds[scene.id] || updatedSeeds[scene.id].length === 0) {
                    updatedSeeds[scene.id] = assignRandom();
                }
            } else {
                const baseSeeds = updatedSeeds[scene.id] || [];
                for (let sub = 0; sub < vc; sub++) {
                    const subKey = `${scene.id}-${sub}`;
                    if (!updatedSeeds[subKey] || updatedSeeds[subKey].length === 0) {
                        updatedSeeds[subKey] = baseSeeds.length > 0 && sub === 0
                            ? [...baseSeeds]
                            : assignRandom();
                    }
                }
                updatedSeeds[scene.id] = updatedSeeds[`${scene.id}-0`] || [];
            }
        });
        setSceneSeeds(updatedSeeds);

        // Step 2: 씨드카드 기반 프롬프트 생성
        const prompts: Record<string, { image: string; video: string }> = {};
        scenes.forEach((scene) => {
            const vc = videoCountPerScene[scene.id] || 1;
            if (vc <= 1) {
                const seeds = updatedSeeds[scene.id] || [];
                const seedCards = seeds.map((id) => deck.find((c) => c.id === id)).filter((c): c is AssetCard => !!c);
                prompts[scene.id] = {
                    image: buildImagePrompt({ artStyleId, sceneText: scene.text, seedCards, cameraAngle: scene.cameraAngle, location: scene.location, templateId }),
                    video: buildVideoPrompt({ artStyleId, sceneText: scene.text, seedCards, cameraAngle: scene.cameraAngle, templateId }),
                };
            } else {
                for (let sub = 0; sub < vc; sub++) {
                    const key = `${scene.id}-${sub}`;
                    const seeds = updatedSeeds[key] || [];
                    const seedCards = seeds.map((id) => deck.find((c) => c.id === id)).filter((c): c is AssetCard => !!c);
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

    /** 씨드 토글 + 씬/서브씬 키 양방향 동기화 + 프롬프트 자동 재생성 */
    const toggleSceneSeed = useCallback((key: string, cardId: string) => {
        setSceneSeeds((prev) => {
            const current = prev[key] || [];
            const has = current.includes(cardId);
            const next = has ? current.filter((id) => id !== cardId) : [...current, cardId];
            const updated = { ...prev, [key]: next };

            // 서브씬-0 ↔ 씬 키 양방향 동기화
            const match = key.match(/^(.+)-(\d+)$/);
            if (match) {
                const baseId = match[1];
                const subIdx = parseInt(match[2]);
                if (subIdx === 0) updated[baseId] = next;
            } else {
                // 씬 키로 토글 → sub-0도 동기화
                const vc = videoCountPerScene[key] || 1;
                if (vc > 1) updated[`${key}-0`] = next;
            }

            // 프롬프트 자동 재생성 (비동기로 다음 렌더에서)
            setTimeout(() => regeneratePromptForKey(key, next), 0);

            return updated;
        });
    }, [setSceneSeeds, videoCountPerScene, regeneratePromptForKey]);

    return {
        sceneSeeds,
        setSceneSeeds,
        customPrompts,
        initPrompts,
        updatePrompt,
        toggleSceneSeed,
    };
}
