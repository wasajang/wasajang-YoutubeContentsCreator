/**
 * settingsStore — BYOK API 키 + 앱 설정 전역 상태
 *
 * MVP 보안 노트:
 * API 키는 localStorage에 저장됩니다.
 * 프로덕션에서는 Supabase Edge Functions + 서버사이드 암호화로 이전 예정.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ApiProvider = 'openai' | 'anthropic' | 'replicate' | 'runway' | 'fishSpeech' | 'google';

/** GenerationType → 사용하는 외부 API provider 매핑 */
export const ACTION_PROVIDER_MAP: Record<string, ApiProvider> = {
    script: 'openai',
    image:  'replicate',
    video:  'runway',
    tts:    'fishSpeech',
    card:   'replicate',
};

interface SettingsState {
    apiKeys: Partial<Record<ApiProvider, string>>;

    setApiKey: (provider: ApiProvider, key: string) => void;
    removeApiKey: (provider: ApiProvider) => void;
    hasApiKey: (provider: ApiProvider) => boolean;

    /** GenerationType(action)에 해당하는 API 키가 설정되어 있으면 true (= BYOK) */
    hasApiKeyForAction: (action: string) => boolean;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            apiKeys: {},

            setApiKey: (provider, key) =>
                set((s) => ({ apiKeys: { ...s.apiKeys, [provider]: key.trim() } })),

            removeApiKey: (provider) =>
                set((s) => {
                    const next = { ...s.apiKeys };
                    delete next[provider];
                    return { apiKeys: next };
                }),

            hasApiKey: (provider) => {
                const key = get().apiKeys[provider];
                return !!key && key.length > 0;
            },

            hasApiKeyForAction: (action) => {
                const provider = ACTION_PROVIDER_MAP[action];
                if (!provider) return false;
                return get().hasApiKey(provider);
            },
        }),
        { name: 'antigravity-settings' }
    )
);
