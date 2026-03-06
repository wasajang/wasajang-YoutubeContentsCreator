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
        // Step 1: 씨드카드 배정 — AI 결과 우선, 없으면 키워드 매칭 폴백
        const updatedSeeds = { ...sceneSeeds };
        const chars = deck.filter((c) => c.type === 'character');
        const bgs = deck.filter((c) => c.type === 'background');
        const items = deck.filter((c) => c.type === 'item');

        /** 씬 텍스트 기반 키워드 매칭 (AI 결과가 없을 때 폴백) */
        const assignSmart = (scene: Scene): string[] => {
            const assigned: string[] = [];
            const sceneTextLower = scene.text.toLowerCase();

            // 1. 캐릭터: 카드 이름이 씬 텍스트에 포함되면 선택
            chars.forEach((c) => {
                const nameParts = c.name.split(/[(/\s]/);
                if (
                    sceneTextLower.includes(c.name.toLowerCase()) ||
                    nameParts.some((part) => part.trim().length >= 2 && sceneTextLower.includes(part.trim().toLowerCase()))
                ) {
                    assigned.push(c.id);
                }
            });

            // 매칭된 캐릭터가 없으면 첫 번째 캐릭터 배정 (주인공 가정)
            if (assigned.length === 0 && chars.length > 0) {
                assigned.push(chars[0].id);
            }

            // 2. 배경: 키워드 매칭 또는 첫 번째 배경
            const matchedBg = bgs.find((c) =>
                sceneTextLower.includes(c.name.toLowerCase())
            );
            if (matchedBg) {
                assigned.push(matchedBg.id);
            } else if (bgs.length > 0) {
                assigned.push(bgs[0].id);
            }

            // 3. 아이템: 키워드 매칭만 (없으면 생략)
            items.forEach((c) => {
                if (sceneTextLower.includes(c.name.toLowerCase())) {
                    assigned.push(c.id);
                }
            });

            return assigned;
        };

        scenes.forEach((scene) => {
            const vc = videoCountPerScene[scene.id] || 1;

            // AI가 이미 매칭한 결과가 있으면 그대로 사용
            if (updatedSeeds[scene.id] && updatedSeeds[scene.id].length > 0) {
                // 서브씬에 전파
                if (vc > 1) {
                    for (let sub = 0; sub < vc; sub++) {
                        const subKey = `${scene.id}-${sub}`;
                        if (!updatedSeeds[subKey] || updatedSeeds[subKey].length === 0) {
                            updatedSeeds[subKey] = [...updatedSeeds[scene.id]];
                        }
                    }
                }
                return; // AI 결과 있으면 스킵
            }

            // AI 결과 없음 → 스마트 폴백 (키워드 매칭)
            if (vc <= 1) {
                updatedSeeds[scene.id] = assignSmart(scene);
            } else {
                for (let sub = 0; sub < vc; sub++) {
                    const subKey = `${scene.id}-${sub}`;
                    if (!updatedSeeds[subKey] || updatedSeeds[subKey].length === 0) {
                        updatedSeeds[subKey] = sub === 0
                            ? assignSmart(scene)
                            : [...(updatedSeeds[`${scene.id}-0`] || [])];
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
