/**
 * 프롬프트 빌더
 *
 * 스타일 prefix + 씬 대본 + 캐릭터 시드 → 완성 프롬프트 조립
 *
 * 구조: [스타일 prefix] + [씬 설명] + [캐릭터/배경 시드 참조] + [네거티브]
 */
import { stylePromptPrefix } from '../data/mockData';
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
}

/**
 * 이미지 생성용 프롬프트 조립
 *
 * @returns 완성된 프롬프트 문자열
 */
export function buildImagePrompt(ctx: PromptContext): string {
    const parts: string[] = [];

    // 1. 스타일 prefix
    const prefix = stylePromptPrefix[ctx.style] || stylePromptPrefix['Cinematic'] || '';
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
 */
export function buildVideoPrompt(ctx: PromptContext): string {
    const parts: string[] = [];

    // 스타일
    const prefix = stylePromptPrefix[ctx.style] || '';
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
 * 기본 네거티브 프롬프트
 */
export function getDefaultNegativePrompt(): string {
    return 'blurry, low quality, distorted, deformed, ugly, watermark, text, logo, oversaturated';
}
