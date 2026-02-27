/**
 * AI 이미지 생성 서비스
 *
 * Provider 패턴으로 Mock / Replicate / fal.ai 등 교체 가능.
 * 환경변수 VITE_IMAGE_API_PROVIDER로 전환:
 *   - 'mock'      → 가짜 딜레이 + Unsplash 이미지 (기본값)
 *   - 'replicate' → Replicate API (Flux/SDXL)
 *   - 'fal'       → fal.ai API
 */

// ── 타입 정의 ──

export interface ImageGenerationRequest {
    prompt: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    seed?: number;
    style?: string;
    model?: string;  // AI 모델 ID (기본값: 'flux-schnell'). Phase 6에서 유저 선택 지원.
}

export interface ImageGenerationResult {
    imageUrl: string;
    seed: number;
    provider: string;
    durationMs: number;
}

interface ImageProvider {
    name: string;
    generate: (req: ImageGenerationRequest) => Promise<ImageGenerationResult>;
}

// ── Mock Provider (개발용) ──

const MOCK_IMAGES = [
    'https://images.unsplash.com/photo-1534030347209-467a5b0ad3e6?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1590424753858-394a9238e56b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1581450134444-ad5a4bc93c0d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1594132225211-19d20c78a0c2?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80',
];

const mockProvider: ImageProvider = {
    name: 'mock',
    generate: async (req) => {
        // 1.5~3초 랜덤 딜레이 (실제 API 시뮬레이션)
        const delay = 1500 + Math.random() * 1500;
        await new Promise((resolve) => setTimeout(resolve, delay));

        const seed = req.seed ?? Math.floor(Math.random() * 99999);
        const imageIndex = seed % MOCK_IMAGES.length;

        return {
            imageUrl: `${MOCK_IMAGES[imageIndex]}&sig=${seed}`,
            seed,
            provider: 'mock',
            durationMs: delay,
        };
    },
};

// ── Replicate Provider (실제 API) ──

const replicateProvider: ImageProvider = {
    name: 'replicate',
    generate: async (req) => {
        const apiKey = import.meta.env.VITE_IMAGE_API_KEY;
        const apiUrl = import.meta.env.VITE_IMAGE_API_URL || 'https://api.replicate.com/v1';

        if (!apiKey) throw new Error('VITE_IMAGE_API_KEY가 설정되지 않았습니다.');

        const startTime = Date.now();

        // Replicate API - Flux Schnell 모델 (빠르고 저렴)
        const response = await fetch(`${apiUrl}/predictions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: req.model || 'black-forest-labs/flux-schnell',
                input: {
                    prompt: req.prompt,
                    num_outputs: 1,
                    aspect_ratio: req.width && req.height
                        ? (req.width > req.height ? '16:9' : req.width < req.height ? '9:16' : '1:1')
                        : '16:9',
                    seed: req.seed,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Replicate API 오류: ${response.status} - ${error}`);
        }

        const prediction = await response.json();

        // 폴링으로 완료 대기 (최대 60초)
        let result = prediction;
        while (result.status !== 'succeeded' && result.status !== 'failed') {
            await new Promise((r) => setTimeout(r, 1000));
            const pollRes = await fetch(`${apiUrl}/predictions/${result.id}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
            });
            result = await pollRes.json();
        }

        if (result.status === 'failed') {
            throw new Error(`이미지 생성 실패: ${result.error || '알 수 없는 오류'}`);
        }

        return {
            imageUrl: result.output[0],
            seed: req.seed ?? 0,
            provider: 'replicate',
            durationMs: Date.now() - startTime,
        };
    },
};

// ── Gemini Image Provider ──

const geminiProvider: ImageProvider = {
    name: 'gemini',
    generate: async (req) => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error('VITE_GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');

        const startTime = Date.now();

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-0514:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: req.prompt }] }],
                    generationConfig: {
                        responseModalities: ['IMAGE'],
                        imageConfig: {
                            aspectRatio: req.width && req.height
                                ? (req.width > req.height ? '16:9' : req.width < req.height ? '9:16' : '1:1')
                                : '16:9',
                        },
                    },
                }),
            }
        );

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Gemini Image API 에러: ${err.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find((p: { inline_data?: { data: string; mime_type: string } }) => p.inline_data);
        if (!imagePart?.inline_data?.data) {
            throw new Error('Gemini 응답에 이미지 데이터가 없습니다.');
        }

        const mimeType = imagePart.inline_data.mime_type || 'image/png';
        const base64Data = imagePart.inline_data.data;
        const imageUrl = `data:${mimeType};base64,${base64Data}`;

        return {
            imageUrl,
            seed: req.seed ?? Math.floor(Math.random() * 99999),
            provider: 'gemini',
            durationMs: Date.now() - startTime,
        };
    },
};

// ── Provider 선택 ──

const providers: Record<string, ImageProvider> = {
    mock: mockProvider,
    replicate: replicateProvider,
    gemini: geminiProvider,
};

function getProvider(): ImageProvider {
    const providerName = import.meta.env.VITE_IMAGE_API_PROVIDER || 'mock';
    return providers[providerName] || mockProvider;
}

// ── Public API ──

/**
 * AI 이미지 생성
 *
 * @example
 * const result = await generateImage({
 *     prompt: 'Cinematic, a young Korean soldier in 1950s...',
 *     seed: 42891,
 * });
 * console.log(result.imageUrl); // 생성된 이미지 URL
 */
export async function generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const provider = getProvider();
    console.log(`[AI Image] ${provider.name} 프로바이더로 생성 시작...`);
    const result = await provider.generate(req);
    console.log(`[AI Image] 완료 (${result.durationMs}ms, seed: ${result.seed})`);
    return result;
}

/** 현재 사용 중인 프로바이더 이름 */
export function getCurrentProvider(): string {
    return getProvider().name;
}
