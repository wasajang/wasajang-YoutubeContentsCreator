/**
 * AI TTS (Text-to-Speech) 서비스
 *
 * Provider 패턴으로 Mock / Fish Speech / Gemini TTS / Edge TTS 교체 가능.
 * 환경변수 VITE_TTS_API_PROVIDER로 전환:
 *   - 'mock'        → 가짜 딜레이 + placeholder 오디오 (기본값)
 *   - 'fish-speech'  → Fish Speech API (클라우드 or 셀프호스팅)
 *   - 'gemini-tts'   → Google Gemini TTS (무료, API 키 필요)
 *   - 'edge-tts'     → Microsoft Edge TTS (무료, 개발 서버에서만)
 *
 * BYOK: 설정 페이지에서 입력한 키 우선 사용, 없으면 .env 키 사용
 * 테스트 쿼터: ai-quota.ts에서 호출 횟수 제한 (비용 안전장치)
 */

import { useSettingsStore } from '../store/settingsStore';
import { consumeQuota } from './ai-quota';

// ── 타입 정의 ──

export interface TTSRequest {
    /** 음성으로 변환할 텍스트 */
    text: string;
    /** 클립 ID (추적용) */
    clipId?: string;
    /** 음성 모델 ID (Fish Speech reference_id) */
    voiceId?: string;
    /** 오디오 포맷 (기본: mp3) */
    format?: 'mp3' | 'wav' | 'opus';
    /** 말하기 속도 (0.5~2.0, 기본 1.0) */
    speed?: number;
    /**
     * TTS 엔진 모델 ID. Phase 6에서 유저 선택 지원.
     * ⚠️ voiceId(=화자 ID)와 별개: model은 엔진, voiceId는 해당 엔진 내 특정 화자.
     */
    model?: string;
}

export interface TTSResult {
    /** 생성된 오디오 URL (Blob URL 또는 원격 URL) */
    audioUrl: string;
    /** 오디오 길이 (초, 추정) */
    estimatedDuration: number;
    /** 사용된 provider */
    provider: string;
    /** 처리 시간 (ms) */
    durationMs: number;
}

interface TTSProvider {
    name: string;
    generate: (req: TTSRequest) => Promise<TTSResult>;
}

// ── Mock Provider ──

/** Mock: 실제 오디오 대신 무음 Blob URL 반환 */
const mockProvider: TTSProvider = {
    name: 'mock',
    generate: async (req) => {
        const start = Date.now();
        // 1~2초 랜덤 딜레이 (API 호출 시뮬레이션)
        await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));

        // 텍스트 길이 기반 오디오 길이 추정 (한국어: ~4자/초)
        const estimatedDuration = Math.max(2, Math.round(req.text.length / 4));

        // 무음 WAV Blob 생성 (1초짜리 → 반복 재생 가능)
        const silentWav = createSilentWav(1);
        const blob = new Blob([silentWav], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);

        return {
            audioUrl,
            estimatedDuration,
            provider: 'mock',
            durationMs: Date.now() - start,
        };
    },
};

/** 무음 WAV 파일 생성 (PCM 16bit, 22050Hz, mono) */
function createSilentWav(durationSec: number): ArrayBuffer {
    const sampleRate = 22050;
    const numSamples = sampleRate * durationSec;
    const byteRate = sampleRate * 2; // 16bit = 2 bytes
    const dataSize = numSamples * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);      // chunk size
    view.setUint16(20, 1, true);       // PCM
    view.setUint16(22, 1, true);       // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, 2, true);       // block align
    view.setUint16(34, 16, true);      // bits per sample

    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    // 나머지는 0 (무음) → ArrayBuffer 기본값

    return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

// ── Fish Speech Provider ──

/** BYOK 우선, 없으면 .env 키 사용 */
function getFishSpeechApiKey(): string {
    const byokKey = useSettingsStore.getState().apiKeys.fishSpeech;
    if (byokKey) return byokKey;
    return import.meta.env.VITE_FISH_SPEECH_API_KEY || '';
}

/** 자체 서버 사용 여부 (VITE_FISH_SPEECH_API_URL이 설정되면 자체 서버) */
function isSelfHosted(): boolean {
    return !!import.meta.env.VITE_FISH_SPEECH_API_URL;
}

/**
 * API URL 결정:
 * - 자체 서버: VITE_FISH_SPEECH_API_URL 직접 사용 (Vite proxy 경유)
 * - 클라우드:  개발 시 Vite proxy, 프로덕션은 직접 호출
 */
function getFishSpeechApiUrl(): string {
    if (import.meta.env.DEV) return '/api/fish-speech';
    return import.meta.env.VITE_FISH_SPEECH_API_URL || 'https://api.fish.audio';
}

/** Audio element로 실제 오디오 길이(초) 측정 */
function getAudioDuration(blobUrl: string): Promise<number> {
    return new Promise((resolve) => {
        const audio = new Audio();
        audio.addEventListener('loadedmetadata', () => {
            // Infinity가 반환되면 (스트리밍 blob) 0으로 처리
            resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
        });
        audio.addEventListener('error', () => resolve(0));
        audio.src = blobUrl;
    });
}

/** Fish Speech API 호출 (재시도 지원) */
async function fishSpeechGenerate(req: TTSRequest, retryCount = 0): Promise<TTSResult> {
    const apiKey = getFishSpeechApiKey();
    const apiUrl = getFishSpeechApiUrl();
    const defaultModelId = import.meta.env.VITE_FISH_SPEECH_MODEL_ID || '';

    // 자체 서버: API 키 불필요 / 클라우드: API 키 필수
    if (!apiKey && !isSelfHosted()) {
        throw new Error(
            'Fish Speech API 키가 필요합니다.\n' +
            '설정 페이지에서 입력하거나 .env에 VITE_FISH_SPEECH_API_KEY를 추가해주세요.\n' +
            'API 키 발급: https://fish.audio/app/api-keys/\n\n' +
            '또는 자체 서버를 사용하려면 .env에 VITE_FISH_SPEECH_API_URL=http://localhost:8080 을 추가하세요.'
        );
    }

    const start = Date.now();

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'model': 's1',  // 최신 모델 (한국어 지원)
    };
    // 클라우드 API일 때만 인증 헤더 추가 (자체 서버는 불필요)
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const body: Record<string, unknown> = {
        text: req.text,
        format: req.format || 'mp3',
        mp3_bitrate: 128,
        normalize: true,
        latency: 'normal',
    };

    // 음성 모델(화자) 지정
    const voiceId = req.voiceId || defaultModelId;
    if (voiceId) {
        body.reference_id = voiceId;
    }

    // 속도 조절 (prosody)
    if (req.speed && req.speed !== 1.0) {
        body.prosody = { speed: req.speed };
    }

    const response = await fetch(`${apiUrl}/v1/tts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    // 429 Rate Limit → 자동 재시도 (최대 3회, 10/20/30초 backoff)
    if (response.status === 429 && retryCount < 3) {
        const waitSec = (retryCount + 1) * 10;
        console.warn(`[Fish Speech] Rate limit 도달, ${waitSec}초 후 재시도... (${retryCount + 1}/3)`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        return fishSpeechGenerate(req, retryCount + 1);
    }

    if (!response.ok) {
        let errMsg: string;
        try {
            const errData = await response.json();
            errMsg = (errData as Record<string, string>).message
                || (errData as Record<string, string>).detail
                || response.statusText;
        } catch {
            errMsg = response.statusText;
        }
        throw new Error(`Fish Speech API 에러 (${response.status}): ${errMsg}`);
    }

    // Fish Speech는 오디오 바이너리를 스트림으로 반환
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    // 실제 오디오 길이 측정 (실패 시 텍스트 기반 추정)
    const realDuration = await getAudioDuration(audioUrl);
    const estimatedDuration = realDuration > 0
        ? Math.round(realDuration * 10) / 10
        : Math.max(2, Math.round(req.text.length / 4));

    return {
        audioUrl,
        estimatedDuration,
        provider: 'fish-speech',
        durationMs: Date.now() - start,
    };
}

const fishSpeechProvider: TTSProvider = {
    name: 'fish-speech',
    generate: (req) => fishSpeechGenerate(req),
};

// ── Gemini TTS Provider ──

/** Gemini API 키: BYOK 우선, 없으면 .env */
function getGeminiApiKey(): string {
    const byokKey = useSettingsStore.getState().apiKeys.google;
    if (byokKey) return byokKey;
    return import.meta.env.VITE_GEMINI_API_KEY || '';
}

/** base64 문자열 → ArrayBuffer */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/** raw PCM → WAV 변환 (WAV 헤더 씌우기) */
function pcmToWav(
    pcmData: ArrayBuffer,
    sampleRate: number,
    bitsPerSample: number,
    channels: number,
): ArrayBuffer {
    const dataSize = pcmData.byteLength;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);                 // chunk size
    view.setUint16(20, 1, true);                  // PCM
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    new Uint8Array(buffer, 44).set(new Uint8Array(pcmData));

    return buffer;
}

/** Gemini TTS API 호출 (재시도 지원) */
async function geminiTTSGenerate(req: TTSRequest, retryCount = 0): Promise<TTSResult> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        throw new Error(
            'Gemini API 키가 필요합니다.\n' +
            '설정 페이지에서 Google API 키를 입력하거나,\n' +
            '.env에 VITE_GEMINI_API_KEY를 추가해주세요.\n' +
            'API 키 발급: https://aistudio.google.com/apikey'
        );
    }

    const start = Date.now();
    const model = 'gemini-2.5-flash-preview-tts';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: req.text }],
            }],
            generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: req.voiceId || 'Kore', // 한국어 기본 음성
                        },
                    },
                },
            },
        }),
    });

    // 429 Rate Limit → 자동 재시도 (최대 3회, 10/20/30초 backoff)
    if (response.status === 429 && retryCount < 3) {
        const waitSec = (retryCount + 1) * 10;
        console.warn(`[Gemini TTS] Rate limit 도달, ${waitSec}초 후 재시도... (${retryCount + 1}/3)`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        return geminiTTSGenerate(req, retryCount + 1);
    }

    if (!response.ok) {
        let errMsg: string;
        try {
            const errData = await response.json();
            errMsg = (errData as { error?: { message?: string } }).error?.message
                || response.statusText;
        } catch {
            errMsg = response.statusText;
        }
        throw new Error(`Gemini TTS API 에러 (${response.status}): ${errMsg}`);
    }

    const data = await response.json();

    // 응답 구조: candidates[0].content.parts[0].inlineData
    const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) {
        throw new Error('Gemini TTS 응답에 오디오 데이터가 없습니다.');
    }

    const audioBase64: string = inlineData.data;

    // Gemini TTS는 raw PCM (audio/L16;rate=24000) 반환 → WAV 헤더 추가
    const pcmBytes = base64ToArrayBuffer(audioBase64);
    const wavBuffer = pcmToWav(pcmBytes, 24000, 16, 1);
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(blob);

    // 실제 오디오 길이 측정
    const realDuration = await getAudioDuration(audioUrl);
    const estimatedDuration = realDuration > 0
        ? Math.round(realDuration * 10) / 10
        : Math.max(2, Math.round(req.text.length / 4));

    return {
        audioUrl,
        estimatedDuration,
        provider: 'gemini-tts',
        durationMs: Date.now() - start,
    };
}

const geminiTTSProvider: TTSProvider = {
    name: 'gemini-tts',
    generate: (req) => geminiTTSGenerate(req),
};

// ── Edge TTS Provider (백업, 개발 서버에서만 동작) ──

/**
 * Edge TTS: Microsoft Edge Read Aloud API 기반 (무료, 무제한)
 * Vite dev 미들웨어 `/api/edge-tts`를 통해 서버사이드에서 생성
 * 프로덕션에서는 별도 서버 필요 (비공식 API)
 */
const edgeTTSProvider: TTSProvider = {
    name: 'edge-tts',
    generate: async (req) => {
        const start = Date.now();
        const voice = req.voiceId || 'ko-KR-SunHiNeural'; // 한국어 여성 기본

        const response = await fetch('/api/edge-tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: req.text,
                voice,
                speed: req.speed || 1.0,
            }),
        });

        if (!response.ok) {
            let errMsg: string;
            try {
                const errData = await response.json();
                errMsg = (errData as Record<string, string>).error || response.statusText;
            } catch {
                errMsg = response.statusText;
            }
            throw new Error(`Edge TTS 에러 (${response.status}): ${errMsg}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        // 실제 오디오 길이 측정
        const realDuration = await getAudioDuration(audioUrl);
        const estimatedDuration = realDuration > 0
            ? Math.round(realDuration * 10) / 10
            : Math.max(2, Math.round(req.text.length / 4));

        return {
            audioUrl,
            estimatedDuration,
            provider: 'edge-tts',
            durationMs: Date.now() - start,
        };
    },
};

// ── Provider 선택 & 공개 API ──

const providers: Record<string, TTSProvider> = {
    mock: mockProvider,
    'fish-speech': fishSpeechProvider,
    'gemini-tts': geminiTTSProvider,
    'edge-tts': edgeTTSProvider,
};

function getCurrentProvider(): TTSProvider {
    const key = import.meta.env.VITE_TTS_API_PROVIDER || 'mock';
    return providers[key] || mockProvider;
}

/**
 * TTS 음성 생성 (Provider에 따라 Mock/Fish Speech/Gemini/Edge 자동 전환)
 * 테스트 쿼터 초과 시 자동으로 Mock으로 전환됩니다.
 *
 * @example
 * const result = await generateTTS({
 *     text: '한국전쟁 중 1950년대에 현대 군대가 타임포탈을 통해 나타나 전세를 바꾼다.',
 *     clipId: 'clip-1',
 * });
 * audioElement.src = result.audioUrl;
 */
export async function generateTTS(req: TTSRequest): Promise<TTSResult> {
    let provider = getCurrentProvider();

    // 테스트 쿼터 체크: 실제 provider인데 쿼터 초과면 → mock 자동 전환
    if (provider.name !== 'mock' && !consumeQuota('tts')) {
        provider = mockProvider;
    }

    console.log(`[TTS] 음성 생성 시작 (provider: ${provider.name}, clip: ${req.clipId || 'unknown'})`);
    const result = await provider.generate(req);
    console.log(`[TTS] 음성 생성 완료: ${result.estimatedDuration}s (${result.durationMs}ms)`);
    return result;
}

/**
 * 현재 활성 TTS provider 이름
 */
export function getTTSProviderName(): string {
    return getCurrentProvider().name;
}
