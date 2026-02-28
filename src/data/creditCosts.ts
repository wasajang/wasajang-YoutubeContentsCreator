/**
 * 크레딧 비용 데이터 (2계층)
 *
 * platformFee: 플랫폼 이용료 (항상 차감)
 * apiCost:     AI API 비용 (BYOK 사용 시 면제)
 * total:       기본 사용자 비용 (platformFee + apiCost)
 * totalByok:   BYOK 사용자 비용 (platformFee만)
 */

export interface CreditCostItem {
    platformFee: number;
    apiCost: number;
    total: number;
    totalByok: number;
}

/** GenerationType별 비용 상세 */
export const CREDIT_COST_TABLE: Record<string, CreditCostItem> = {
    script: { platformFee: 1, apiCost: 1,  total: 2,  totalByok: 1 },
    image:  { platformFee: 1, apiCost: 2,  total: 3,  totalByok: 1 },
    video:  { platformFee: 2, apiCost: 8,  total: 10, totalByok: 2 },
    tts:    { platformFee: 1, apiCost: 1,  total: 2,  totalByok: 1 },
    card:   { platformFee: 1, apiCost: 2,  total: 3,  totalByok: 1 },
};
