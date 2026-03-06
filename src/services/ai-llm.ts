/**
 * AI LLM (대본 생성) 서비스
 *
 * Provider 패턴으로 Mock / OpenAI / Anthropic / Gemini 교체 가능.
 * 환경변수 VITE_LLM_API_PROVIDER로 전환:
 *   - 'mock'      → 템플릿 기반 Mock 대본 (기본값)
 *   - 'openai'    → OpenAI GPT-4o API
 *   - 'anthropic' → Anthropic Claude API
 *   - 'gemini'    → Google Gemini 2.5 Flash (무료)
 *
 * BYOK: 설정 페이지에서 입력한 키 우선 사용, 없으면 .env 키 사용
 * 테스트 쿼터: ai-quota.ts에서 호출 횟수 제한 (비용 안전장치)
 */

import { getTemplateById } from '../data/templates';
import { useSettingsStore } from '../store/settingsStore';
import { consumeQuota } from './ai-quota';

// ── 타입 정의 ──

// ── 대본 분석 (카드 추천 + 씬별 매칭) ──

export interface ScriptAnalysisRequest {
    /** 전체 대본 텍스트 */
    fullScript: string;
    /** 씬 목록 (ID + 텍스트) */
    scenes: Array<{ id: string; text: string }>;
    /** 기존 카드 라이브러리 (매칭 대상) */
    existingCards: Array<{
        id: string;
        name: string;
        type: 'character' | 'background' | 'item';
        description: string;
    }>;
    /** 템플릿 ID (있으면 캐스트 프리셋 참조) */
    templateId?: string;
    /** AI 모델 ID */
    model?: string;
}

export interface ScriptAnalysisResult {
    /** 추천 카드 목록 (기존 매칭 + 신규 제안) */
    recommendedCards: Array<{
        /** 기존 카드 ID (매칭된 경우) 또는 null (신규) */
        matchedCardId: string | null;
        /** 카드 이름 */
        name: string;
        /** 카드 타입 */
        type: 'character' | 'background' | 'item';
        /** 영문 시각 설명 (이미지 프롬프트용) */
        description: string;
        /** 추천 이유 (한국어) */
        reason: string;
    }>;
    /** 씬별 카드 매칭 (sceneId → cardId[]) */
    sceneMatching: Record<string, string[]>;
    /** 사용된 provider */
    provider: string;
    /** 처리 시간 (ms) */
    durationMs: number;
}

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
        const apiKey = getOpenaiApiKey();
        if (!apiKey) throw new Error('OpenAI API 키가 필요합니다. 설정 페이지에서 입력해주세요.');

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
        const apiKey = getAnthropicApiKey();
        if (!apiKey) throw new Error('Anthropic API 키가 필요합니다. 설정 페이지에서 입력해주세요.');

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

/** Gemini API 키: BYOK 우선, 없으면 .env */
function getGeminiApiKey(): string {
    const byokKey = useSettingsStore.getState().apiKeys.google;
    if (byokKey) return byokKey;
    return import.meta.env.VITE_GEMINI_API_KEY || '';
}

/** OpenAI API 키: BYOK 우선, 없으면 .env */
function getOpenaiApiKey(): string {
    const byokKey = useSettingsStore.getState().apiKeys.openai;
    if (byokKey) return byokKey;
    return import.meta.env.VITE_OPENAI_API_KEY || '';
}

/** Anthropic API 키: BYOK 우선, 없으면 .env */
function getAnthropicApiKey(): string {
    const byokKey = useSettingsStore.getState().apiKeys.anthropic;
    if (byokKey) return byokKey;
    return import.meta.env.VITE_ANTHROPIC_API_KEY || '';
}

const geminiProvider: LLMProvider = {
    name: 'gemini',
    generateScript: async (req) => {
        const apiKey = getGeminiApiKey();
        if (!apiKey) throw new Error(
            'Gemini API 키가 필요합니다.\n' +
            '설정 페이지에서 Google API 키를 입력하거나,\n' +
            '.env에 VITE_GEMINI_API_KEY를 추가해주세요.'
        );

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
 * 대본 생성 (Provider에 따라 Mock/OpenAI/Anthropic/Gemini 자동 전환)
 * 테스트 쿼터 초과 시 자동으로 Mock으로 전환됩니다.
 */
export async function generateScript(req: ScriptGenerationRequest): Promise<ScriptGenerationResult> {
    let provider = getCurrentProvider();

    // 테스트 쿼터 체크: 실제 provider인데 쿼터 초과면 → mock 자동 전환
    if (provider.name !== 'mock' && !consumeQuota('llm')) {
        provider = mockProvider;
    }

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

// ── 대본 분석 (카드 추천 + 씬별 매칭) ──

/** Mock 대본 분석: 기존 카드 재사용 또는 기본 3개 제안 */
async function mockAnalyzeScript(req: ScriptAnalysisRequest): Promise<ScriptAnalysisResult> {
    const start = Date.now();
    await new Promise((r) => setTimeout(r, 1500));

    // 기존 카드가 있으면 그대로 추천
    const recommendedCards: ScriptAnalysisResult['recommendedCards'] =
        req.existingCards.length > 0
            ? req.existingCards.slice(0, 5).map((c) => ({
                matchedCardId: c.id,
                name: c.name,
                type: c.type,
                description: c.description,
                reason: '기존 라이브러리에서 매칭됨 (Mock)',
            }))
            : [
                { matchedCardId: null, name: '주인공', type: 'character' as const, description: 'main protagonist, young adult, determined expression, cinematic lighting', reason: 'Mock 기본 캐릭터' },
                { matchedCardId: null, name: '조력자', type: 'character' as const, description: 'supporting character, wise mentor figure, warm expression', reason: 'Mock 기본 캐릭터' },
                { matchedCardId: null, name: '주요 배경', type: 'background' as const, description: 'dramatic landscape, cinematic atmosphere, golden hour lighting', reason: 'Mock 기본 배경' },
            ];

    // 씬별 매칭: 모든 씬에 모든 카드 배정
    const cardIds = recommendedCards.map((c, i) => c.matchedCardId || `ai-new-${i}`);
    const sceneMatching: Record<string, string[]> = {};
    req.scenes.forEach((s) => {
        sceneMatching[s.id] = cardIds.slice(0, Math.min(3, cardIds.length));
    });

    return { recommendedCards, sceneMatching, provider: 'mock', durationMs: Date.now() - start };
}

/** Gemini 대본 분석: 실제 AI로 캐릭터/배경/아이템 추출 + 씬 매칭 */
async function geminiAnalyzeScript(req: ScriptAnalysisRequest): Promise<ScriptAnalysisResult> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error('Gemini API 키가 필요합니다.');

    const start = Date.now();
    const model = req.model || 'gemini-2.5-flash';

    // 기존 카드 목록 텍스트
    const existingCardsText =
        req.existingCards.length > 0
            ? req.existingCards
                .map((c) => `- ${c.id} [${c.type}] "${c.name}": ${c.description}`)
                .join('\n')
            : '(없음 — 모든 카드를 새로 제안해주세요)';

    // 씬 목록 텍스트
    const scenesText = req.scenes
        .map((s) => `- ${s.id}: ${s.text.substring(0, 200)}`)
        .join('\n');

    const systemPrompt = `당신은 영상 제작 AI 어시스턴트입니다.
대본을 분석하여 필요한 시각적 에셋(캐릭터, 배경, 아이템)을 추출하고,
기존 카드 라이브러리와 매칭합니다.

규칙:
1. 대본에서 주요 캐릭터(2~3명), 배경(1~2개), 아이템(1~2개)을 추출. 반드시 배경 1개 이상, 아이템 1개 이상을 포함해야 합니다. 총 5개 이내를 권장합니다.
2. 기존 카드 중 대본에 등장하는 인물/장소/물건과 이름이나 역할이 **직접적으로 일치**하는 경우에만 matchedCardId에 해당 ID 기입. 단순히 "군인", "남성" 같은 넓은 공통점만으로 매칭하지 마세요. 대본의 시대/배경/맥락이 카드와 다르면 매칭하지 마세요.
3. 매칭되는 기존 카드가 없으면(대부분의 경우) matchedCardId를 null로 하고 새 카드를 제안하세요
4. description은 반드시 영문으로, 이미지 생성 AI가 사용할 구체적 시각 묘사 작성
5. reason은 한국어로 추천 이유 간략 설명
6. sceneMatching: 각 씬에 등장하는 카드의 ID 배열 (matchedCardId 또는 "ai-new-{index}")
7. 새 카드의 ID는 "ai-new-0", "ai-new-1" 등으로 순서 부여 (recommendedCards 배열 순서와 일치)

JSON 형식:
{
  "recommendedCards": [
    {
      "matchedCardId": "기존ID" | null,
      "name": "이름",
      "type": "character" | "background" | "item",
      "description": "English visual description for image generation",
      "reason": "한국어 추천 이유"
    }
  ],
  "sceneMatching": {
    "scene-1": ["cardId1", "cardId2"],
    "scene-2": ["cardId1", "ai-new-0"]
  }
}`;

    const userPrompt = `## 대본
${req.fullScript}

## 씬 목록
${scenesText}

## 기존 카드 라이브러리
${existingCardsText}

대본을 분석하여 추천 카드와 씬별 매칭을 JSON으로 반환해주세요.`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: userPrompt }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 4000,
                    responseMimeType: 'application/json',
                },
            }),
        }
    );

    if (response.status === 429) {
        throw new Error('Gemini API 요청 한도 초과 — 잠시 후 다시 시도해주세요.');
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Gemini 분석 에러: ${(err as Record<string, unknown>).error || response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    try {
        const parsed = JSON.parse(content);
        return {
            recommendedCards: parsed.recommendedCards || [],
            sceneMatching: parsed.sceneMatching || {},
            provider: 'gemini',
            durationMs: Date.now() - start,
        };
    } catch (parseErr) {
        console.warn('[AI Analysis] JSON 파싱 실패:', parseErr, 'content:', content);
        throw new Error('AI 분석 결과를 파싱할 수 없습니다. 다시 시도해주세요.');
    }
}

/**
 * 대본 분석 — 카드 추천 + 씬별 매칭
 * LLM 쿼터 1회 소비 (초과 시 Mock 자동 전환)
 */
export async function analyzeScript(req: ScriptAnalysisRequest): Promise<ScriptAnalysisResult> {
    const providerName = import.meta.env.VITE_LLM_API_PROVIDER || 'mock';

    // 쿼터 체크 (실제 provider일 때만)
    if (providerName !== 'mock' && !consumeQuota('llm')) {
        console.log('[AI Analysis] 쿼터 초과 → Mock 분석으로 전환');
        return mockAnalyzeScript(req);
    }

    if (providerName === 'gemini') {
        console.log('[AI Analysis] Gemini 대본 분석 시작');
        try {
            const result = await geminiAnalyzeScript(req);
            console.log(`[AI Analysis] 완료: ${result.recommendedCards.length}개 카드, ${Object.keys(result.sceneMatching).length}개 씬 매칭, ${result.durationMs}ms`);
            return result;
        } catch (err) {
            console.error('[AI Analysis] Gemini 에러, Mock 폴백:', err);
            return mockAnalyzeScript(req);
        }
    }

    // mock 또는 미지원 provider
    return mockAnalyzeScript(req);
}

// ── AI 프롬프트 작성 (씬별 이미지/영상 프롬프트) ──

export interface ScenePromptRequest {
    /** 씬 목록 (ID + 대본 텍스트) */
    scenes: Array<{ id: string; text: string }>;
    /** 씬별 씨드카드 정보 */
    seedCards: Record<string, Array<{ name: string; type: string; description: string }>>;
    /** 아트 스타일 ID */
    artStyleId: string;
    /** 아트 스타일 프롬프트 접두사 */
    artStylePrefix?: string;
    /** 템플릿 ID */
    templateId?: string;
    /** AI 모델 ID */
    model?: string;
}

export interface ScenePromptResult {
    /** 씬별 프롬프트 */
    prompts: Record<string, { image: string; video: string }>;
    /** 사용된 provider */
    provider: string;
    /** 처리 시간 (ms) */
    durationMs: number;
}

/** Gemini로 씬별 고품질 프롬프트 작성 */
async function geminiGenerateScenePrompts(req: ScenePromptRequest): Promise<ScenePromptResult> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error('Gemini API 키가 필요합니다.');

    const start = Date.now();
    const model = req.model || 'gemini-2.5-flash';

    // 씬 + 씨드카드 정보 조합
    const scenesText = req.scenes.map((s) => {
        const cards = req.seedCards[s.id] || [];
        const cardsDesc = cards.length > 0
            ? cards.map((c) => `  - [${c.type}] ${c.name}: ${c.description}`).join('\n')
            : '  (씨드카드 없음)';
        return `### ${s.id}\n대본: ${s.text}\n카드:\n${cardsDesc}`;
    }).join('\n\n');

    const systemPrompt = `You are an expert AI prompt engineer for image and video generation.
Given scene scripts and associated visual asset cards, write high-quality English prompts for each scene.

Style: ${req.artStylePrefix || req.artStyleId}

Rules:
1. Image prompt: Start with the art style, then describe the specific scene composition, character appearances, lighting, atmosphere, and camera angle. Be vivid and specific.
2. Video prompt: Focus on motion, action, camera movement, and cinematic effects. Keep it concise (1-2 sentences).
3. All prompts MUST be in English.
4. Incorporate the seed card descriptions naturally into the scene prompts.
5. Each scene gets exactly 1 image prompt + 1 video prompt.

Return JSON format:
{
  "prompts": {
    "scene-1": { "image": "detailed image prompt...", "video": "motion/action prompt..." },
    "scene-2": { "image": "...", "video": "..." }
  }
}`;

    const userPrompt = `## Scenes\n\n${scenesText}\n\nWrite high-quality image and video generation prompts for each scene in JSON format.`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: userPrompt }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 8000,
                    responseMimeType: 'application/json',
                },
            }),
        }
    );

    if (response.status === 429) {
        throw new Error('Gemini API 요청 한도 초과 — 잠시 후 다시 시도해주세요.');
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Gemini 프롬프트 생성 에러: ${(err as Record<string, unknown>).error || response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    try {
        const parsed = JSON.parse(content);
        return {
            prompts: parsed.prompts || {},
            provider: 'gemini',
            durationMs: Date.now() - start,
        };
    } catch (parseErr) {
        console.warn('[AI Prompt] JSON 파싱 실패:', parseErr, 'content:', content);
        throw new Error('AI 프롬프트 결과를 파싱할 수 없습니다.');
    }
}

/**
 * AI 프롬프트 작성 — 씬별 이미지/영상 프롬프트를 AI가 직접 작성
 * LLM 쿼터 1회 소비
 */
export async function generateScenePrompts(req: ScenePromptRequest): Promise<ScenePromptResult> {
    const providerName = import.meta.env.VITE_LLM_API_PROVIDER || 'mock';

    // 쿼터 체크
    if (providerName !== 'mock' && !consumeQuota('llm')) {
        console.log('[AI Prompt] 쿼터 초과 → 빈 결과 반환');
        return { prompts: {}, provider: 'mock-quota', durationMs: 0 };
    }

    if (providerName === 'gemini') {
        console.log(`[AI Prompt] Gemini 씬 프롬프트 작성 시작 (${req.scenes.length}개 씬)`);
        try {
            const result = await geminiGenerateScenePrompts(req);
            console.log(`[AI Prompt] 완료: ${Object.keys(result.prompts).length}개 씬, ${result.durationMs}ms`);
            return result;
        } catch (err) {
            console.error('[AI Prompt] Gemini 에러:', err);
            throw err;  // 크레딧 이미 소모됨 → 에러를 UI에 표시
        }
    }

    // mock provider: 빈 결과 (프롬프트 자동 생성으로 폴백)
    return { prompts: {}, provider: 'mock', durationMs: 0 };
}
