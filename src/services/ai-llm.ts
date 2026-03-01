/**
 * AI LLM (대본 생성) 서비스
 *
 * Provider 패턴으로 Mock / OpenAI / Anthropic 교체 가능.
 * 환경변수 VITE_LLM_API_PROVIDER로 전환:
 *   - 'mock'      → 템플릿 기반 Mock 대본 (기본값)
 *   - 'openai'    → OpenAI GPT-4o API
 *   - 'anthropic' → Anthropic Claude API
 */

import { getTemplateById } from '../data/templates';

// ── 타입 정의 ──

export interface ScriptGenerationRequest {
    /** 사용자 입력 (아이디어 설명) */
    idea: string;
    /** 장르 (예: 'military-sf', 'romance', 'horror') */
    genre?: string;
    /** 원하는 씬 수 */
    sceneCount?: number;
    /** 대상 영상 길이 (초) */
    targetDuration?: number;
    /** 아트 스타일 (프롬프트에 반영) */
    style?: string;
    /** AI 모델 ID (기본값: 'gpt-4o-mini'). Phase 6에서 유저 선택 지원. */
    model?: string;
    /** 선택된 프리셋 ID (있으면 프리셋의 script 지시 우선 적용) */
    presetId?: string;
    /** 제작 모드 */
    mode?: 'cinematic' | 'narration';
}

export interface GeneratedScene {
    id: string;
    text: string;
    location: string;
    cameraAngle: string;
}

export interface ScriptGenerationResult {
    /** 생성된 전체 대본 */
    fullScript: string;
    /** 씬 분할 결과 */
    scenes: GeneratedScene[];
    /** 사용된 provider */
    provider: string;
    /** 처리 시간 (ms) */
    durationMs: number;
}

interface LLMProvider {
    name: string;
    generateScript: (req: ScriptGenerationRequest) => Promise<ScriptGenerationResult>;
}

// ── Mock Provider ──

const CAMERA_ANGLES = ['Wide Angle', 'Close Up', 'Medium Shot', 'Low Angle', 'Extreme Long Shot', 'Pan Up', 'Over The Shoulder'];
const LOCATIONS_MAP: Record<string, string[]> = {
    default: ['도심 거리', '숲 속', '해변', '산 정상', '실내 카페', '지하 벙커'],
    'military-sf': [
        'Frozen Yalu River Battlefield',
        'Trench Interior',
        'Distant Snowy Ridge',
        'Battlefield Center (Time Rift)',
        'Modern Armor Arrival Zone',
    ],
};

function generateMockScript(req: ScriptGenerationRequest): string {
    const count = req.sceneCount || 10;
    const lines: string[] = [];
    lines.push(`# ${req.idea || 'Untitled Script'}\n`);
    lines.push(`장르: ${req.genre || '미정'} | 스타일: ${req.style || 'Cinematic'}\n`);

    for (let i = 1; i <= count; i++) {
        lines.push(`## SCENE ${String(i).padStart(2, '0')}`);
        lines.push(`[Mock 대본] ${req.idea}의 ${i}번째 장면입니다.`);
        lines.push(`이 장면에서는 주인공이 새로운 도전을 마주합니다.\n`);
    }

    return lines.join('\n');
}

function splitMockScenes(req: ScriptGenerationRequest): GeneratedScene[] {
    const count = req.sceneCount || 10;
    const locations = LOCATIONS_MAP[req.genre || 'default'] || LOCATIONS_MAP.default;

    return Array.from({ length: count }, (_, i) => ({
        id: `scene-${i + 1}`,
        text: `[Scene ${i + 1}] ${req.idea}의 ${i + 1}번째 장면 — 주인공이 새로운 도전을 마주하며, 긴장감이 고조되는 순간을 포착합니다. 카메라가 천천히 이동하며 배경과 인물의 감정을 동시에 보여줍니다.`,
        location: locations[i % locations.length],
        cameraAngle: CAMERA_ANGLES[i % CAMERA_ANGLES.length],
    }));
}

const mockProvider: LLMProvider = {
    name: 'mock',
    generateScript: async (req) => {
        const start = Date.now();
        // 1~2초 랜덤 딜레이 (API 호출 시뮬레이션)
        await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));

        const fullScript = generateMockScript(req);
        const scenes = splitMockScenes(req);

        return {
            fullScript,
            scenes,
            provider: 'mock',
            durationMs: Date.now() - start,
        };
    },
};

// ── OpenAI Provider ──

const openaiProvider: LLMProvider = {
    name: 'openai',
    generateScript: async (req) => {
        const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
        if (!apiKey) throw new Error('VITE_OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');

        const start = Date.now();
        const systemPrompt = buildSystemPrompt(req);
        const userPrompt = buildUserPrompt(req);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: req.model || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.8,
                max_tokens: 4000,
            }),
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`OpenAI API 에러: ${err.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';

        return parseScriptResponse(content, 'openai', Date.now() - start, req);
    },
};

// ── Anthropic Provider ──

const anthropicProvider: LLMProvider = {
    name: 'anthropic',
    generateScript: async (req) => {
        const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
        if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.');

        const start = Date.now();
        const systemPrompt = buildSystemPrompt(req);
        const userPrompt = buildUserPrompt(req);

        // Anthropic API (브라우저에서 직접 호출 시 CORS 문제 가능 — 프록시 필요할 수 있음)
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
                model: req.model || 'claude-sonnet-4-20250514',
                max_tokens: 4000,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
            }),
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Anthropic API 에러: ${err.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const content = data.content[0]?.text || '';

        return parseScriptResponse(content, 'anthropic', Date.now() - start, req);
    },
};

// ── Gemini Provider ──

const geminiProvider: LLMProvider = {
    name: 'gemini',
    generateScript: async (req) => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error('VITE_GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');

        const start = Date.now();
        const systemPrompt = buildSystemPrompt(req);
        const userPrompt = buildUserPrompt(req);

        const model = req.model || 'gemini-2.5-flash';
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: userPrompt }] }],
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 4000,
                        responseMimeType: 'application/json',
                    },
                }),
            }
        );

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Gemini API 에러: ${err.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return parseScriptResponse(content, 'gemini', Date.now() - start, req);
    },
};

// ── 공통 프롬프트 빌더 ──

function buildSystemPrompt(req: ScriptGenerationRequest): string {
    // 프리셋 script 지시 우선 적용
    let roleInstruction = '당신은 YouTube 영상 시나리오 작가입니다.\n사용자의 아이디어를 기반으로 시네마틱 영상 대본을 작성합니다.';
    if (req.presetId) {
        const template = getTemplateById(req.presetId);
        if (template?.promptRules.scriptSystemPrompt) {
            roleInstruction = template.promptRules.scriptSystemPrompt;
        }
    }

    // 모드별 추가 지시
    const modeInstruction = req.mode === 'narration'
        ? '- 나레이션 형식으로 작성: 시청자에게 직접 이야기하듯 서술\n- 각 씬은 나레이션 문장 단위로 구성'
        : '- 씬별 시각적 장면 묘사에 집중\n- 카메라 앵글과 로케이션을 구체적으로 명시';

    return `${roleInstruction}

규칙:
- 정확히 ${req.sceneCount || 10}개의 씬으로 나누어 작성
- 각 씬은 JSON 형식의 배열로 출력
- 각 씬에는 text(대본), location(촬영장소), cameraAngle(카메라앵글) 포함
- 카메라 앵글: Wide Angle, Close Up, Medium Shot, Low Angle, Extreme Long Shot, Pan Up, Over The Shoulder 중 선택
- 대본은 한국어로, 생동감 있고 시각적 묘사가 풍부하게 작성
${modeInstruction}
- ${req.style ? `아트 스타일: ${req.style}` : ''}
${req.genre ? `- 장르: ${req.genre}` : ''}

출력 형식 (JSON만 출력, 다른 텍스트 없이):
[
  {"text": "씬 대본...", "location": "장소명", "cameraAngle": "앵글명"},
  ...
]`;
}

function buildUserPrompt(req: ScriptGenerationRequest): string {
    let prompt = `다음 아이디어로 ${req.sceneCount || 10}개 씬의 영상 대본을 작성해주세요:\n\n${req.idea}`;
    if (req.targetDuration) {
        prompt += `\n\n목표 영상 길이: 약 ${req.targetDuration}초`;
    }
    return prompt;
}

// ── 응답 파서 ──

function parseScriptResponse(
    content: string,
    provider: string,
    durationMs: number,
    req: ScriptGenerationRequest,
): ScriptGenerationResult {
    try {
        // JSON 배열 추출 (마크다운 코드블록 내부일 수 있음)
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error('JSON 배열을 찾을 수 없습니다.');

        const parsed = JSON.parse(jsonMatch[0]) as Array<{
            text: string;
            location: string;
            cameraAngle: string;
        }>;

        const scenes: GeneratedScene[] = parsed.map((s, i) => ({
            id: `scene-${i + 1}`,
            text: s.text || '',
            location: s.location || '',
            cameraAngle: s.cameraAngle || 'Wide Angle',
        }));

        return {
            fullScript: scenes.map((s, i) => `[Scene ${i + 1}] ${s.text}`).join('\n\n'),
            scenes,
            provider,
            durationMs,
        };
    } catch (parseErr) {
        console.warn(`[LLM] JSON 파싱 실패, Mock 폴백 사용:`, parseErr);
        // 파싱 실패 시 원본 텍스트를 균등 분할
        const count = req.sceneCount || 10;
        const lines = content.split('\n').filter((l) => l.trim());
        const chunkSize = Math.max(1, Math.ceil(lines.length / count));

        const scenes: GeneratedScene[] = Array.from({ length: count }, (_, i) => ({
            id: `scene-${i + 1}`,
            text: lines.slice(i * chunkSize, (i + 1) * chunkSize).join(' ') || `(씬 ${i + 1} 대본)`,
            location: LOCATIONS_MAP[req.genre || 'default']?.[i % 5] || '도심 거리',
            cameraAngle: CAMERA_ANGLES[i % CAMERA_ANGLES.length],
        }));

        return {
            fullScript: content,
            scenes,
            provider: `${provider} (fallback-parse)`,
            durationMs,
        };
    }
}

// ── Provider 선택 & 공개 API ──

const providers: Record<string, LLMProvider> = {
    mock: mockProvider,
    openai: openaiProvider,
    anthropic: anthropicProvider,
    gemini: geminiProvider,
};

function getCurrentProvider(): LLMProvider {
    const key = import.meta.env.VITE_LLM_API_PROVIDER || 'mock';
    return providers[key] || mockProvider;
}

/**
 * 대본 생성 (Provider에 따라 Mock/OpenAI/Anthropic 자동 전환)
 */
export async function generateScript(req: ScriptGenerationRequest): Promise<ScriptGenerationResult> {
    const provider = getCurrentProvider();
    console.log(`[LLM] 대본 생성 시작 (provider: ${provider.name})`);
    const result = await provider.generateScript(req);
    console.log(`[LLM] 대본 생성 완료: ${result.scenes.length}개 씬, ${result.durationMs}ms`);
    return result;
}

/**
 * 현재 활성 provider 이름
 */
export function getLLMProviderName(): string {
    return getCurrentProvider().name;
}
