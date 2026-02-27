/// <reference types="vite/client" />

interface ImportMetaEnv {
    // AI Image Generation
    readonly VITE_IMAGE_API_PROVIDER: 'mock' | 'stability' | 'midjourney' | 'dall-e';
    readonly VITE_IMAGE_API_KEY?: string;
    readonly VITE_IMAGE_API_URL?: string;

    // AI Script Generation
    readonly VITE_LLM_API_PROVIDER: 'mock' | 'openai' | 'anthropic';
    readonly VITE_LLM_API_KEY?: string;
    readonly VITE_LLM_API_URL?: string;

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
