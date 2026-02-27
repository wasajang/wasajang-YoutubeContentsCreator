/**
 * 크레딧 시스템 Hook
 *
 * Zustand projectStore의 credits를 래핑하는 편의 훅
 * → 전역 상태이므로 모든 컴포넌트에서 동일한 크레딧 공유
 * → localStorage에 자동 저장 (persist 미들웨어)
 *
 * 크레딧 비용:
 *   이미지 생성 = 1 크레딧
 *   영상 생성   = 3 크레딧
 *   대본 AI 생성 = 1 크레딧
 */
import { useCallback } from 'react';
import { useProjectStore } from '../store/projectStore';

export type GenerationType = 'image' | 'video' | 'script';

/** 생성 유형별 크레딧 비용 */
export const CREDIT_COSTS: Record<GenerationType, number> = {
    image: 1,
    video: 3,
    script: 1,
};

export function useCredits() {
    const credits = useProjectStore((s) => s.credits);
    const spendCredits = useProjectStore((s) => s.spendCredits);
    const addCreditsStore = useProjectStore((s) => s.addCredits);
    const resetCreditsStore = useProjectStore((s) => s.resetCredits);

    /** 크레딧이 충분한지 확인 */
    const canAfford = useCallback((type: GenerationType, count: number = 1): boolean => {
        return credits >= CREDIT_COSTS[type] * count;
    }, [credits]);

    /** 크레딧 차감 (부족 시 false 반환) */
    const spend = useCallback((type: GenerationType, count: number = 1): boolean => {
        const cost = CREDIT_COSTS[type] * count;
        return spendCredits(cost);
    }, [spendCredits]);

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
    };
}
