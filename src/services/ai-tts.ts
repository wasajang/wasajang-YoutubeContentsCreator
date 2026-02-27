/**
 * AI TTS (Text-to-Speech) 서비스
 *
 * Provider 패턴으로 Mock / Fish Speech 교체 가능.
 * 환경변수 VITE_TTS_API_PROVIDER로 전환:
 *   - 'mock'       → 가짜 딜레이 + placeholder 오디오 (기본값)
 *   - 'fish-speech' → Fish Speech API (클라우드 or 셀프호스팅)
 *
 * Fish Speech 환경변수:
 *   - VITE_FISH_SPEECH_API_KEY  → API 키 (클라우드 사용 시)
 *   - VITE_FISH_SPEECH_API_URL  → API 엔드포인트 (셀프호스팅 시, 기본: https://api.fish.audio)
 *   - VITE_FISH_SPEECH_MODEL_ID → 음성 모델 ID (reference_id)
 */

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

const fishSpeechProvider: TTSProvider = {
    name: 'fish-speech',
    generate: async (req) => {
        const apiKey = import.meta.env.VITE_FISH_SPEECH_API_KEY;
        const apiUrl = import.meta.env.VITE_FISH_SPEECH_API_URL || 'https://api.fish.audio';
        const defaultModelId = import.meta.env.VITE_FISH_SPEECH_MODEL_ID || '';

        const start = Date.now();

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        // 클라우드 API 사용 시 Bearer 토큰 필요 (셀프호스팅은 불필요할 수 있음)
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

        // 음성 모델 지정
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

        if (!response.ok) {
            let errMsg: string;
            try {
                const errData = await response.json();
                errMsg = (errData as Record<string, string>).message || (errData as Record<string, string>).detail || response.statusText;
            } catch {
                errMsg = response.statusText;
            }
            throw new Error(`Fish Speech API 에러 (${response.status}): ${errMsg}`);
        }

        // Fish Speech는 오디오 바이너리를 스트림으로 반환
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        // 텍스트 길이 기반 오디오 길이 추정
        const estimatedDuration = Math.max(2, Math.round(req.text.length / 4));

        return {
            audioUrl,
            estimatedDuration,
            provider: 'fish-speech',
            durationMs: Date.now() - start,
        };
    },
};

// ── Provider 선택 & 공개 API ──

const providers: Record<string, TTSProvider> = {
    mock: mockProvider,
    'fish-speech': fishSpeechProvider,
};

function getCurrentProvider(): TTSProvider {
    const key = import.meta.env.VITE_TTS_API_PROVIDER || 'mock';
    return providers[key] || mockProvider;
}

/**
 * TTS 음성 생성 (Provider에 따라 Mock/Fish Speech 자동 전환)
 *
 * @example
 * const result = await generateTTS({
 *     text: '한국전쟁 중 1950년대에 현대 군대가 타임포탈을 통해 나타나 전세를 바꾼다.',
 *     clipId: 'clip-1',
 * });
 * audioElement.src = result.audioUrl;
 */
export async function generateTTS(req: TTSRequest): Promise<TTSResult> {
    const provider = getCurrentProvider();
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
