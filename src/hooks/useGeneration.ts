/**
 * useGeneration — 씬 이미지/영상 생성 상태 관리 훅 (엔트리)
 *
 * 기존 import 호환성 유지:
 *   import { useGeneration } from '../hooks/useGeneration'
 *   import type { UseGenerationApi } from '../hooks/useGeneration'
 *
 * 내부적으로 4개 서브 훅을 조합합니다:
 *   useVideoCountInit    — videoCountPerScene 초기값 (store에서)
 *   useGenerationPrompts — sceneSeeds, customPrompts, initPrompts
 *   useVideoGeneration   — sceneVideos, generateSubVideo (prompts 주입)
 *   useImageGeneration   — sceneImages, sceneGenStatus, generateSubImage
 *   useGenerationStatus  — getVideoStatus, selectedForVideo, 선택 토글
 */
import { useProjectStore } from '../store/projectStore';
import type { AssetCard, Scene } from '../store/projectStore';
import type { GenerationType } from './useCredits';
import { useGenerationPrompts } from './useGenerationPrompts';
import { useVideoGeneration } from './useVideoGeneration';
import { useImageGeneration } from './useImageGeneration';
import { useGenerationStatus } from './useGenerationStatus';

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
    creditsRemaining: _creditsRemaining,
    CREDIT_COSTS,
    imageModel,
    videoModel,
    templateId,
    aspectRatio,
    onCreditShortage,
}: UseGenerationParams) {
    // 1. store에서 videoCountPerScene 초기값을 읽어 prompts 훅에 전달할 값 준비
    //    (videoGen 선언 전에 count가 필요하므로 store를 직접 읽음)
    const storeVideoCount = useProjectStore((s) => s.videoCountPerScene);
    const videoCountForPrompts: Record<string, number> = {};
    scenes.forEach((s) => { videoCountForPrompts[s.id] = storeVideoCount[s.id] || 1; });

    // 2. 프롬프트 + 시드 관리 (videoCountPerScene은 store 초기값 사용)
    const prompts = useGenerationPrompts({
        scenes,
        deck,
        artStyleId,
        templateId,
        videoCountPerScene: videoCountForPrompts,
    });

    // 3. 영상 생성 (prompts 주입 가능)
    const videoGen = useVideoGeneration({
        scenes,
        deck,
        artStyleId,
        canAfford,
        spend,
        CREDIT_COSTS,
        videoModel,
        templateId,
        onCreditShortage,
        customPrompts: prompts.customPrompts,
        sceneSeeds: prompts.sceneSeeds,
    });

    // 4. 이미지 생성 (videoCountPerScene + customPrompts + sceneSeeds 주입)
    const imageGen = useImageGeneration({
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
        videoCountPerScene: videoGen.videoCountPerScene,
        customPrompts: prompts.customPrompts,
        sceneSeeds: prompts.sceneSeeds,
    });

    // 5. 상태 조회 + 선택 관리
    const status = useGenerationStatus({
        scenes,
        videoCountPerScene: videoGen.videoCountPerScene,
        videoGenStatus: videoGen.videoGenStatus,
        allImagesDone: imageGen.allImagesDone,
        canAfford,
        spend,
        CREDIT_COSTS,
        onCreditShortage,
        generateSubVideoRef: videoGen.generateSubVideoRef,
    });

    return {
        // 이미지 생성
        sceneImages: imageGen.sceneImages,
        sceneGenStatus: imageGen.sceneGenStatus,
        generateSubImage: imageGen.generateSubImage,
        generateSingleScene: imageGen.generateSingleScene,
        generateAllScenes: imageGen.generateAllScenes,
        doneSceneCount: imageGen.doneSceneCount,
        allImagesDone: imageGen.allImagesDone,
        imageGenProgress: imageGen.imageGenProgress,

        // 영상 생성
        sceneVideos: videoGen.sceneVideos,
        videoGenStatus: videoGen.videoGenStatus,
        videoCountPerScene: videoGen.videoCountPerScene,
        setVideoCountPerScene: videoGen.setVideoCountPerScene,
        generateSubVideo: videoGen.generateSubVideo,
        generateSingleVideo: videoGen.generateSingleVideo,
        generateAllVideos: videoGen.generateAllVideos,
        regenerateSingleVideo: videoGen.regenerateSingleVideo,
        isSceneVideoDone: videoGen.isSceneVideoDone,
        doneVideoCount: videoGen.doneVideoCount,
        allVideosDone: videoGen.allVideosDone,

        // 상태 조회
        getVideoStatus: status.getVideoStatus,
        selectedForVideo: status.selectedForVideo,
        isSceneSelectedForVideo: status.isSceneSelectedForVideo,
        toggleVideoSelection: status.toggleVideoSelection,
        toggleAllVideoSelection: status.toggleAllVideoSelection,
        generateSelectedVideos: status.generateSelectedVideos,

        // 프롬프트 + 시드
        sceneSeeds: prompts.sceneSeeds,
        setSceneSeeds: prompts.setSceneSeeds,
        toggleSceneSeed: prompts.toggleSceneSeed,
        customPrompts: prompts.customPrompts,
        initPrompts: prompts.initPrompts,
        updatePrompt: prompts.updatePrompt,
    };
}

export type UseGenerationApi = ReturnType<typeof useGeneration>;
