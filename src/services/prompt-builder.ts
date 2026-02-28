/**
 * 프롬프트 빌더
 *
 * 스타일 prefix + 씬 대본 + 캐릭터 시드 → 완성 프롬프트 조립
 *
 * 구조: [프리셋 prefix 우선 → artStyle prefix 폴백] + [씬 설명] + [캐릭터/배경 시드 참조] + [네거티브]
 */
import { stylePromptPrefix } from '../data/mockData';
import { getPresetById } from '../data/stylePresets';
import type { AssetCard } from '../store/projectStore';

export interface PromptContext {
    /** 선택된 아트 스타일 (예: 'Cinematic') */
    style: string;
    /** 씬 대본 텍스트 */
    sceneText: string;
    /** 이 씬에 배정된 카드 목록 */
    seedCards: AssetCard[];
    /** 커스텀 이미지 프롬프트 (있으면 대본 대신 사용) */
    customImagePrompt?: string;
    /** 카메라 앵글 (예: 'Wide Angle') */
    cameraAngle?: string;
    /** 로케이션 */
    location?: string;
    /** 선택된 프리셋 ID (있으면 프리셋 prompts 우선 적용) */
    presetId?: string;
}

// ── 헬퍼 함수 ──

/**
 * 문자열 첫 글자를 대문자로 변환
 * 빈 문자열이나 이미 대문자인 경우도 안전하게 처리
 */
function capitalize(s: string): string {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * 화면 비율 문자열을 픽셀 크기로 변환
 */
export function aspectRatioToSize(ratio: string): { width: number; height: number } {
    switch (ratio) {
        case '9:16': return { width: 768, height: 1344 };
        case '1:1':  return { width: 1024, height: 1024 };
        case '16:9':
        default:     return { width: 1344, height: 768 };
    }
}

/**
 * 네거티브 프롬프트 반환
 * 프리셋에 negativePrompt가 있으면 우선 사용, 없으면 기본값 반환
 */
export function getNegativePrompt(presetId?: string): string {
    if (presetId) {
        const preset = getPresetById(presetId);
        if (preset?.prompts.negativePrompt) return preset.prompts.negativePrompt;
    }
    return 'blurry, low quality, distorted, deformed, ugly, watermark, text, logo, oversaturated';
}

/**
 * 이미지 생성용 프롬프트 조립
 *
 * 우선순위: 프리셋 imagePrefix > stylePromptPrefix[style] > 빈 문자열
 *
 * @returns 완성된 프롬프트 문자열
 */
export function buildImagePrompt(ctx: PromptContext): string {
    const parts: string[] = [];

    // 1. 스타일 prefix (프리셋 우선, artStyle 폴백)
    let prefix = '';
    if (ctx.presetId) {
        const preset = getPresetById(ctx.presetId);
        if (preset?.prompts.imagePrefix) {
            prefix = preset.prompts.imagePrefix;
        }
    }
    if (!prefix) {
        // stylePromptPrefix 키는 'Cinematic' 대문자로 저장되어 있음
        prefix = stylePromptPrefix[capitalize(ctx.style)] || stylePromptPrefix['Cinematic'] || '';
    }
    if (prefix) parts.push(prefix);

    // 2. 씬 설명 (커스텀 프롬프트 우선)
    const sceneDesc = ctx.customImagePrompt || ctx.sceneText;
    if (sceneDesc) parts.push(sceneDesc);

    // 3. 카메라/로케이션
    if (ctx.cameraAngle && ctx.cameraAngle !== 'Wide Angle') {
        parts.push(`${ctx.cameraAngle} shot`);
    }
    if (ctx.location) {
        parts.push(`location: ${ctx.location}`);
    }

    // 4. 캐릭터/배경 시드 참조
    const charDescs = ctx.seedCards
        .filter((c) => c.type === 'character' && c.description)
        .map((c) => c.description);
    const bgDescs = ctx.seedCards
        .filter((c) => c.type === 'background' && c.description)
        .map((c) => c.description);
    const itemDescs = ctx.seedCards
        .filter((c) => c.type === 'item' && c.description)
        .map((c) => c.description);

    if (charDescs.length > 0) {
        parts.push(`Characters: ${charDescs.join(', ')}`);
    }
    if (bgDescs.length > 0) {
        parts.push(`Background: ${bgDescs.join(', ')}`);
    }
    if (itemDescs.length > 0) {
        parts.push(`Props: ${itemDescs.join(', ')}`);
    }

    return parts.join('. ').replace(/\.\./g, '.').trim();
}

/**
 * 영상 생성용 프롬프트 조립 (이미지 프롬프트보다 간결)
 *
 * 우선순위: 프리셋 videoPrefix > stylePromptPrefix[style] > 빈 문자열
 */
export function buildVideoPrompt(ctx: PromptContext): string {
    const parts: string[] = [];

    // 스타일 (프리셋 우선, artStyle 폴백)
    let prefix = '';
    if (ctx.presetId) {
        const preset = getPresetById(ctx.presetId);
        if (preset?.prompts.videoPrefix) {
            prefix = preset.prompts.videoPrefix;
        }
    }
    if (!prefix) {
        prefix = stylePromptPrefix[capitalize(ctx.style)] || '';
    }
    if (prefix) parts.push(prefix);

    // 모션/액션 중심 설명
    const sceneDesc = ctx.sceneText;
    if (sceneDesc) parts.push(sceneDesc);

    // 카메라 무브먼트 힌트
    if (ctx.cameraAngle) {
        parts.push(`Camera: ${ctx.cameraAngle}, slow cinematic movement`);
    }

    return parts.join('. ').trim();
}

/**
 * 기본 네거티브 프롬프트 (하위 호환성 유지)
 * @deprecated getNegativePrompt(presetId) 사용 권장
 */
export function getDefaultNegativePrompt(): string {
    return getNegativePrompt();
}
