/**
 * AI 영상 생성 서비스
 *
 * Provider 패턴으로 Mock / Runway / Kling / Luma 등 교체 가능.
 * 환경변수 VITE_VIDEO_API_PROVIDER로 전환:
 *   - 'mock'   → 가짜 딜레이 + placeholder (기본값)
 *   - 'runway' → Runway Gen-3 API
 *   - 'kling'  → Kling AI API
 */

// ── 타입 정의 ──

export interface VideoGenerationRequest {
    /** 이미지 → 영상: 입력 이미지 URL */
    imageUrl: string;
    /** 영상 프롬프트 (모션/액션 설명) */
    prompt: string;
    /** 영상 길이 (초, 기본 5) */
    duration?: number;
    /** 카메라 모션 힌트 */
    cameraMotion?: string;
    /** 씬 ID (추적용) */
    sceneId?: string;
    /** AI 모델 ID (기본값: 'gen3a_turbo'). Phase 6에서 유저 선택 지원. */
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

// ── Runway Provider (Gen-3 Alpha Turbo) ──

const runwayProvider: VideoProvider = {
    name: 'runway',
    generate: async (req) => {
        const apiKey = import.meta.env.VITE_RUNWAY_API_KEY;
        if (!apiKey) throw new Error('VITE_RUNWAY_API_KEY 환경변수가 설정되지 않았습니다.');

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
                promptImage: req.imageUrl,
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

// ── Provider 선택 & 공개 API ──

const providers: Record<string, VideoProvider> = {
    mock: mockProvider,
    runway: runwayProvider,
};

function getCurrentProvider(): VideoProvider {
    const key = import.meta.env.VITE_VIDEO_API_PROVIDER || 'mock';
    return providers[key] || mockProvider;
}

/**
 * 영상 생성 (Provider에 따라 Mock/Runway 자동 전환)
 */
export async function generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const provider = getCurrentProvider();
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
