/**
 * AI 영상 생성 서비스
 *
 * Provider 패턴으로 Mock / Runway / AnimateDiff 등 교체 가능.
 * 환경변수 VITE_VIDEO_API_PROVIDER로 전환:
 *   - 'mock'        → 가짜 딜레이 + placeholder (기본값)
 *   - 'runway'      → Runway Gen-3 API (I2V)
 *   - 'animatediff' → AnimateDiff Lightning on Replicate (T2V, 테스트용)
 *
 * 향후 확장: veo, seedance, kling, wan 등 (Provider만 추가)
 * 테스트 쿼터: ai-quota.ts에서 호출 횟수 제한 (비용 안전장치)
 */

import { useSettingsStore } from '../store/settingsStore';
import { consumeQuota } from './ai-quota';

// ── 타입 정의 ──

export interface VideoGenerationRequest {
    /** 이미지 → 영상: 입력 이미지 URL (I2V 모델용, T2V 모델은 무시) */
    imageUrl?: string;
    /** 영상 프롬프트 (모션/액션 설명) */
    prompt: string;
    /** 영상 길이 (초, 기본 5) */
    duration?: number;
    /** 카메라 모션 힌트 */
    cameraMotion?: string;
    /** 씬 ID (추적용) */
    sceneId?: string;
    /** AI 모델 ID. Phase 6에서 유저 선택 지원. */
    model?: string;
}

export interface VideoGenerationResult {
    /** 생성된 영상 URL */
    videoUrl: string;
    /** 영상 길이 (초) */
    duration: number;
    /** 사용된 provider */
    provider: string;
    /** 처리 시간 (ms) */
    durationMs: number;
}

interface VideoProvider {
    name: string;
    generate: (req: VideoGenerationRequest) => Promise<VideoGenerationResult>;
}

// ── Mock Provider ──

/** placeholder 비디오 URL 목록 (샘플 비디오들) */
const MOCK_VIDEOS = [
    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
];

const mockProvider: VideoProvider = {
    name: 'mock',
    generate: async (req) => {
        const start = Date.now();
        // 1.5~3초 랜덤 딜레이 (API 호출 시뮬레이션)
        await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));

        const randomVideo = MOCK_VIDEOS[Math.floor(Math.random() * MOCK_VIDEOS.length)];

        return {
            videoUrl: randomVideo,
            duration: req.duration || 5,
            provider: 'mock',
            durationMs: Date.now() - start,
        };
    },
};

// ── Runway Provider (Gen-3 Alpha Turbo, I2V) ──

/** Runway API 키: BYOK 우선, 없으면 .env */
function getRunwayApiKey(): string {
    const byokKey = useSettingsStore.getState().apiKeys.runway;
    if (byokKey) return byokKey;
    return import.meta.env.VITE_RUNWAY_API_KEY || '';
}

const runwayProvider: VideoProvider = {
    name: 'runway',
    generate: async (req) => {
        const apiKey = getRunwayApiKey();
        if (!apiKey) throw new Error('Runway API 키가 필요합니다.');

        const start = Date.now();

        // Runway Gen-3 API 호출
        const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'X-Runway-Version': '2024-11-06',
            },
            body: JSON.stringify({
                model: req.model || 'gen3a_turbo',
                promptImage: req.imageUrl || '',
                promptText: req.prompt,
                duration: req.duration || 5,
                watermark: false,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`Runway API 에러: ${(err as Record<string, string>).message || response.statusText}`);
        }

        const data = await response.json();
        const taskId = data.id;

        // 폴링으로 결과 대기 (최대 120초)
        const maxWait = 120_000;
        const pollInterval = 3_000;
        let elapsed = 0;

        while (elapsed < maxWait) {
            await new Promise((r) => setTimeout(r, pollInterval));
            elapsed += pollInterval;

            const statusRes = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
                headers: { 'Authorization': `Bearer ${apiKey}`, 'X-Runway-Version': '2024-11-06' },
            });

            if (!statusRes.ok) continue;
            const statusData = await statusRes.json();

            if (statusData.status === 'SUCCEEDED') {
                return {
                    videoUrl: statusData.output?.[0] || '',
                    duration: req.duration || 5,
                    provider: 'runway',
                    durationMs: Date.now() - start,
                };
            }

            if (statusData.status === 'FAILED') {
                throw new Error(`Runway 영상 생성 실패: ${statusData.failure || 'Unknown error'}`);
            }
        }

        throw new Error('Runway 영상 생성 시간 초과 (120초)');
    },
};

// ── AnimateDiff Lightning Provider (T2V, Replicate) ──

/** Replicate API 키: BYOK 우선, 없으면 .env */
function getReplicateApiKey(): string {
    const byokKey = useSettingsStore.getState().apiKeys.replicate;
    if (byokKey) return byokKey;
    return import.meta.env.VITE_REPLICATE_API_KEY || '';
}

const animatediffProvider: VideoProvider = {
    name: 'animatediff',
    generate: async (req) => {
        const apiKey = getReplicateApiKey();
        if (!apiKey) {
            throw new Error(
                'Replicate API 키가 필요합니다.\n' +
                '설정 페이지에서 입력하거나 .env에 VITE_REPLICATE_API_KEY를 추가해주세요.\n' +
                'API 키 발급: https://replicate.com/account/api-tokens'
            );
        }

        const start = Date.now();

        // 1. 예측 생성 요청
        const createRes = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                // AnimateDiff Lightning 4-step (ByteDance)
                version: 'bytedance/animatediff-lightning-4-step',
                input: {
                    prompt: req.prompt,
                    n_prompt: 'bad quality, worst quality, blurry, distorted',
                    width: 576,
                    height: 1024,    // 세로 영상 (9:16)
                    num_frames: 16,  // ~2초
                },
            }),
        });

        if (!createRes.ok) {
            const err = await createRes.json().catch(() => ({}));
            throw new Error(
                `Replicate API 에러 (${createRes.status}): ` +
                `${(err as Record<string, string>).detail || createRes.statusText}`
            );
        }

        const prediction = await createRes.json();
        const pollUrl: string = prediction.urls?.get;
        if (!pollUrl) {
            throw new Error('Replicate 예측 생성 응답에 폴링 URL이 없습니다.');
        }

        // 2. 폴링으로 결과 대기 (최대 120초, 3초 간격)
        const maxWait = 120_000;
        const pollInterval = 3_000;
        let elapsed = 0;

        while (elapsed < maxWait) {
            await new Promise((r) => setTimeout(r, pollInterval));
            elapsed += pollInterval;

            const statusRes = await fetch(pollUrl, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
            });

            if (!statusRes.ok) continue;
            const statusData = await statusRes.json();

            if (statusData.status === 'succeeded') {
                // AnimateDiff output: string (GIF URL) 또는 string[] (MP4 URL)
                const output = Array.isArray(statusData.output)
                    ? statusData.output[0]
                    : statusData.output;

                return {
                    videoUrl: output || '',
                    duration: 2, // ~16 frames
                    provider: 'animatediff',
                    durationMs: Date.now() - start,
                };
            }

            if (statusData.status === 'failed') {
                throw new Error(
                    `AnimateDiff 영상 생성 실패: ${statusData.error || 'Unknown error'}`
                );
            }

            // 'starting' 또는 'processing' → 계속 대기
            console.log(`[Video] AnimateDiff 폴링... (${Math.round(elapsed / 1000)}초, status: ${statusData.status})`);
        }

        throw new Error('AnimateDiff 영상 생성 시간 초과 (120초)');
    },
};

// ── Provider 선택 & 공개 API ──

const providers: Record<string, VideoProvider> = {
    mock: mockProvider,
    runway: runwayProvider,
    animatediff: animatediffProvider,
    // 향후 확장:
    // veo: veoProvider,
    // seedance: seedanceProvider,
    // kling: klingProvider,
    // wan: wanProvider,
};

function getCurrentProvider(): VideoProvider {
    const key = import.meta.env.VITE_VIDEO_API_PROVIDER || 'mock';
    return providers[key] || mockProvider;
}

/**
 * 영상 생성 (Provider에 따라 Mock/Runway/AnimateDiff 자동 전환)
 * 테스트 쿼터 초과 시 자동으로 Mock으로 전환됩니다.
 */
export async function generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
    let provider = getCurrentProvider();

    // 테스트 쿼터 체크: 실제 provider인데 쿼터 초과면 → mock 자동 전환
    if (provider.name !== 'mock' && !consumeQuota('video')) {
        provider = mockProvider;
    }

    console.log(`[Video] 영상 생성 시작 (provider: ${provider.name}, scene: ${req.sceneId || 'unknown'})`);
    const result = await provider.generate(req);
    console.log(`[Video] 영상 생성 완료: ${result.videoUrl.substring(0, 50)}... (${result.durationMs}ms)`);
    return result;
}

/**
 * 현재 활성 provider 이름
 */
export function getVideoProviderName(): string {
    return getCurrentProvider().name;
}
