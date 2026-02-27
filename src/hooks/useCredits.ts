/**
 * 크레딧 시스템 Hook (2계층)
 *
 * 크레딧 비용 = 플랫폼 이용료(항상) + AI API 비용(BYOK 시 면제)
 *
 * BYOK: 본인 API 키를 settingsStore에 등록하면 해당 작업의 AI API 비용 면제.
 *       플랫폼 이용료는 BYOK여도 항상 차감됩니다.
 */
import { useCallback } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useSettingsStore } from '../store/settingsStore';
import { CREDIT_COST_TABLE } from '../data/creditCosts';

export type GenerationType = 'image' | 'video' | 'script' | 'tts' | 'card';

/** 하위 호환: 기존 코드에서 CREDIT_COSTS[type] 숫자로 접근하는 부분을 위한 기본값 */
export const CREDIT_COSTS: Record<GenerationType, number> = {
    image:  CREDIT_COST_TABLE.image.total,
    video:  CREDIT_COST_TABLE.video.total,
    script: CREDIT_COST_TABLE.script.total,
    tts:    CREDIT_COST_TABLE.tts.total,
    card:   CREDIT_COST_TABLE.card.total,
};

export function useCredits() {
    const credits = useProjectStore((s) => s.credits);
    const spendCredits = useProjectStore((s) => s.spendCredits);
    const addCreditsStore = useProjectStore((s) => s.addCredits);
    const resetCreditsStore = useProjectStore((s) => s.resetCredits);
    const hasApiKeyForAction = useSettingsStore((s) => s.hasApiKeyForAction);

    /** BYOK 여부에 따라 실제 비용 반환 */
    const getCost = useCallback((type: GenerationType, count: number = 1): number => {
        const costItem = CREDIT_COST_TABLE[type];
        if (!costItem) return 0;
        const isByok = hasApiKeyForAction(type);
        return (isByok ? costItem.totalByok : costItem.total) * count;
    }, [hasApiKeyForAction]);

    /** 크레딧이 충분한지 확인 */
    const canAfford = useCallback((type: GenerationType, count: number = 1): boolean => {
        return credits >= getCost(type, count);
    }, [credits, getCost]);

    /** 크레딧 차감 (부족 시 false 반환) */
    const spend = useCallback((type: GenerationType, count: number = 1): boolean => {
        const cost = getCost(type, count);
        return spendCredits(cost);
    }, [getCost, spendCredits]);

    /** 크레딧 충전 */
    const addCredits = useCallback((amount: number) => {
        addCreditsStore(amount);
    }, [addCreditsStore]);

    /** 크레딧 리셋 (테스트용) */
    const resetCredits = useCallback(() => {
        resetCreditsStore();
    }, [resetCreditsStore]);

    return {
        remaining: credits,
        canAfford,
        spend,
        addCredits,
        resetCredits,
        CREDIT_COSTS,
        getCost,
    };
}
