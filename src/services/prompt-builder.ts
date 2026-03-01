/**
 * 프롬프트 빌더
 *
 * 아트 스타일 prefix + 씬 대본 + 캐릭터 시드 → 완성 프롬프트 조립
 *
 * 구조: [템플릿 prefix 우선 → artStyle prefix 폴백] + [씬 설명] + [캐릭터/배경 시드 참조] + [suffix]
 */
import { getArtStyleById, getArtStylePromptPrefix } from '../data/artStyles';
import { getTemplateById } from '../data/templates';
import type { AssetCard } from '../store/projectStore';

export interface PromptContext {
    /** 선택된 아트 스타일 ID (예: 'cinematic') */
    artStyleId: string;
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
    /** 선택된 템플릿 ID (있으면 템플릿 prompts 우선 적용) */
    templateId?: string;
}

// ── 헬퍼 함수 ──

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
 * 우선순위: 1. 템플릿 negativePrompt → 2. 아트 스타일 negativePrompt → 3. 기본값
 */
export function getNegativePrompt(templateId?: string, artStyleId?: string): string {
    // 1. 템플릿 우선
    if (templateId) {
        const template = getTemplateById(templateId);
        if (template?.promptRules.imagePromptRules.negativePrompt) {
            return template.promptRules.imagePromptRules.negativePrompt;
        }
    }
    // 2. 아트 스타일 폴백
    if (artStyleId) {
        const artStyle = getArtStyleById(artStyleId);
        if (artStyle?.negativePrompt) return artStyle.negativePrompt;
    }
    // 3. 기본값
    return 'blurry, low quality, distorted, deformed, ugly, watermark, text, logo, oversaturated';
}

/**
 * 이미지 생성용 프롬프트 조립
 *
 * 우선순위: 템플릿 prefix > artStyle imagePromptPrefix > 빈 문자열
 *
 * @returns 완성된 프롬프트 문자열
 */
export function buildImagePrompt(ctx: PromptContext): string {
    const parts: string[] = [];

    // 1. 스타일 prefix + suffix (템플릿 우선, artStyle 폴백)
    let prefix = '';
    let suffix = '';
    if (ctx.templateId) {
        const template = getTemplateById(ctx.templateId);
        if (template?.promptRules.imagePromptRules.prefix) {
            prefix = template.promptRules.imagePromptRules.prefix;
            suffix = template.promptRules.imagePromptRules.suffix || '';
        }
    }
    if (!prefix) {
        prefix = getArtStylePromptPrefix(ctx.artStyleId);
        const artStyle = getArtStyleById(ctx.artStyleId);
        suffix = artStyle?.imagePromptSuffix || '';
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

    // 5. suffix (마지막에 추가)
    if (suffix) parts.push(suffix);

    return parts.join('. ').replace(/\.\./g, '.').trim();
}

/**
 * 영상 생성용 프롬프트 조립 (이미지 프롬프트보다 간결)
 *
 * 우선순위: 템플릿 videoPrefix > artStyle videoPromptPrefix > 빈 문자열
 */
export function buildVideoPrompt(ctx: PromptContext): string {
    const parts: string[] = [];

    // 스타일 (템플릿 우선, artStyle 폴백)
    let prefix = '';
    if (ctx.templateId) {
        const template = getTemplateById(ctx.templateId);
        if (template?.promptRules.videoPromptRules.prefix) {
            prefix = template.promptRules.videoPromptRules.prefix;
        }
    }
    if (!prefix) {
        const artStyle = getArtStyleById(ctx.artStyleId);
        prefix = artStyle?.videoPromptPrefix || '';
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
 * @deprecated getNegativePrompt(templateId, artStyleId) 사용 권장
 */
export function getDefaultNegativePrompt(): string {
    return getNegativePrompt();
}
