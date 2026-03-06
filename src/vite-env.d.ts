/// <reference types="vite/client" />

interface ImportMetaEnv {
    // AI Image Generation
    readonly VITE_IMAGE_API_PROVIDER: 'mock' | 'stability' | 'midjourney' | 'dall-e' | 'gemini';
    readonly VITE_IMAGE_API_KEY?: string;
    readonly VITE_IMAGE_API_URL?: string;
    readonly VITE_GEMINI_API_KEY?: string;

    // AI Script Generation
    readonly VITE_LLM_API_PROVIDER: 'mock' | 'openai' | 'anthropic' | 'gemini';
    readonly VITE_LLM_API_KEY?: string;
    readonly VITE_LLM_API_URL?: string;

    // AI Video Generation
    readonly VITE_VIDEO_API_PROVIDER?: 'mock' | 'runway' | 'animatediff';
    readonly VITE_REPLICATE_API_KEY?: string;

    // AI TTS Generation
    readonly VITE_TTS_API_PROVIDER?: 'mock' | 'fish-speech' | 'gemini-tts' | 'edge-tts';
    readonly VITE_FISH_SPEECH_API_KEY?: string;
    readonly VITE_FISH_SPEECH_API_URL?: string;

    // Test Quotas
    readonly VITE_TEST_QUOTA_LLM?: string;
    readonly VITE_TEST_QUOTA_IMAGE?: string;
    readonly VITE_TEST_QUOTA_VIDEO?: string;
    readonly VITE_TEST_QUOTA_TTS?: string;

    // Backend
    readonly VITE_API_BASE_URL?: string;
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;

    // App
    readonly VITE_APP_NAME: string;
    readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
