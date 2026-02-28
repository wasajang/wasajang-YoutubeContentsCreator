/**
 * AI 모델 레지스트리
 *
 * 4개 카테고리:
 *   🔓 script, image, video, tts  — 사용자 선택 가능
 *   🔒 prompt-builder              — 내부 전용 (Admin에서만 변경)
 */

/** AI 모델 카테고리 */
export type AIModelCategory =
    | 'script'          // 🔓 대본 AI (사용자 선택)
    | 'image'           // 🔓 이미지 AI (사용자 선택)
    | 'video'           // 🔓 영상 AI (사용자 선택)
    | 'tts'             // 🔓 TTS 음성 (사용자 선택, Animate 단계)
    | 'prompt-builder'; // 🔒 프롬프트 생성 AI (내부 전용)

export interface AIModel {
    id: string;
    name: string;
    provider: string;       // 'replicate' | 'openai' | 'anthropic' | ...
    category: AIModelCategory;
    creditCost: number;
    requiresByok?: string;  // BYOK 필요한 프로바이더 (없으면 플랫폼 키 사용)
    isDefault?: boolean;
    isInternal?: boolean;   // true면 사용자 UI에 노출 안 됨
}

export const AI_MODELS: AIModel[] = [
    // 🔓 대본 AI (사용자 선택)
    { id: 'gpt-4o-mini',    name: 'GPT-4o Mini',    provider: 'openai',    category: 'script', creditCost: 1, isDefault: true },
    { id: 'claude-haiku',   name: 'Claude 3 Haiku', provider: 'anthropic', category: 'script', creditCost: 1 },
    { id: 'gemini-flash',   name: 'Gemini Flash',   provider: 'google',    category: 'script', creditCost: 1 },

    // 🔓 이미지 AI (사용자 선택)
    { id: 'flux-schnell',   name: 'Flux Schnell',   provider: 'replicate', category: 'image', creditCost: 1, isDefault: true },
    { id: 'sdxl',           name: 'SDXL',           provider: 'replicate', category: 'image', creditCost: 2 },
    { id: 'dall-e-3',       name: 'DALL-E 3',       provider: 'openai',    category: 'image', creditCost: 2 },
    { id: 'gemini-image',   name: 'Gemini Image',   provider: 'google',    category: 'image', creditCost: 1 },

    // 🔓 영상 AI (사용자 선택)
    { id: 'runway-gen3',    name: 'Runway Gen-3',   provider: 'runway',    category: 'video', creditCost: 3, isDefault: true },
    { id: 'kling-ai',       name: 'Kling AI',       provider: 'kling',     category: 'video', creditCost: 3 },
    { id: 'pika',           name: 'Pika',           provider: 'pika',      category: 'video', creditCost: 3 },

    // 🔓 TTS 음성 (사용자 선택, Animate 단계)
    { id: 'fish-speech',    name: 'Fish Speech',    provider: 'fish',      category: 'tts', creditCost: 1, isDefault: true },
    { id: 'elevenlabs',     name: 'ElevenLabs',     provider: 'elevenlabs', category: 'tts', creditCost: 2 },

    // 🔒 프롬프트 생성 AI (내부 전용 — 사용자 선택 불가)
    { id: 'prompt-builder-default', name: 'GPT-4o Mini (내부)', provider: 'openai', category: 'prompt-builder', creditCost: 0, isInternal: true, isDefault: true },
];

/** 사용자에게 노출되는 모델만 반환 (카테고리별) */
export const getUserSelectableModels = (category: AIModelCategory): AIModel[] =>
    AI_MODELS.filter((m) => m.category === category && !m.isInternal);

/** 프롬프트 생성 AI 모델 목록 (Admin 전용) */
export const getPromptBuilderModels = (): AIModel[] =>
    AI_MODELS.filter((m) => m.category === 'prompt-builder');

/** ID로 모델 조회 */
export const getModelById = (id: string): AIModel | undefined =>
    AI_MODELS.find((m) => m.id === id);
