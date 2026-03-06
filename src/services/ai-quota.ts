/**
 * 테스트 쿼터 관리자
 *
 * 실제 AI API 호출 횟수를 제한하여 비용 폭탄을 방지합니다.
 * 쿼터 초과 시 자동으로 Mock 모드로 전환됩니다.
 *
 * 환경변수로 제어:
 *   VITE_TEST_QUOTA_LLM=5      → 대본 생성 최대 5회
 *   VITE_TEST_QUOTA_IMAGE=5    → 이미지 생성 최대 5장
 *   VITE_TEST_QUOTA_VIDEO=3    → 영상 생성 최대 3건
 *   VITE_TEST_QUOTA_TTS=10     → TTS 최대 10건
 *   0 = 무제한 (프로덕션 전환 시)
 *
 * 세션(페이지 새로고침) 단위로 카운터 초기화됩니다.
 */

type QuotaCategory = 'llm' | 'image' | 'video' | 'tts';

/** 세션 내 호출 카운터 (새로고침 시 리셋) */
const counters: Record<QuotaCategory, number> = {
    llm: 0,
    image: 0,
    video: 0,
    tts: 0,
};

/** 환경변수 매핑 */
const QUOTA_ENV_MAP: Record<QuotaCategory, string> = {
    llm:   'VITE_TEST_QUOTA_LLM',
    image: 'VITE_TEST_QUOTA_IMAGE',
    video: 'VITE_TEST_QUOTA_VIDEO',
    tts:   'VITE_TEST_QUOTA_TTS',
};

/** 기본 쿼터 (환경변수 미설정 시) */
const DEFAULT_QUOTAS: Record<QuotaCategory, number> = {
    llm: 5,
    image: 5,
    video: 3,
    tts: 10,
};

/** 카테고리별 한국어 이름 (로그용) */
const CATEGORY_NAMES: Record<QuotaCategory, string> = {
    llm: '대본',
    image: '이미지',
    video: '영상',
    tts: 'TTS',
};

/**
 * 쿼터 제한값 조회
 * - 환경변수 '0' → Infinity (무제한)
 * - 환경변수 숫자 → 해당 값
 * - 미설정 → DEFAULT_QUOTAS 사용
 */
function getQuotaLimit(category: QuotaCategory): number {
    const envVal = import.meta.env[QUOTA_ENV_MAP[category]];
    if (envVal === '0') return Infinity;
    if (envVal) return parseInt(envVal, 10);
    return DEFAULT_QUOTAS[category];
}

/**
 * 쿼터 소비 시도
 *
 * @returns true — 쿼터 남아있어 실제 API 호출 가능 (카운터 1 증가)
 * @returns false — 쿼터 초과, Mock으로 전환 필요
 */
export function consumeQuota(category: QuotaCategory): boolean {
    const limit = getQuotaLimit(category);
    const name = CATEGORY_NAMES[category];

    if (counters[category] >= limit) {
        console.warn(
            `[Quota] ${name}(${category}) 테스트 쿼터 초과 (${counters[category]}/${limit})`
            + ` → Mock 모드로 자동 전환됩니다.`
        );
        return false;
    }

    counters[category]++;
    console.log(`[Quota] ${name}(${category}): ${counters[category]}/${limit} 사용`);
    return true;
}

/**
 * 현재 쿼터 상태 조회 (디버깅/관리자 페이지용)
 */
export function getQuotaStatus(): Record<QuotaCategory, { used: number; limit: number }> {
    return Object.fromEntries(
        (Object.keys(counters) as QuotaCategory[]).map(cat => [
            cat, { used: counters[cat], limit: getQuotaLimit(cat) }
        ])
    ) as Record<QuotaCategory, { used: number; limit: number }>;
}
