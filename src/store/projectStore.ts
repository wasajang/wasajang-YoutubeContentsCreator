import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── 카드 에셋 라이브러리 타입 (단일 데이터 소스) ──
export type AssetType = 'character' | 'background' | 'item';

export interface AssetCard {
  id: string;
  name: string;
  type: AssetType;
  description: string;
  imageUrl: string;
  seed: number;
  status: 'pending' | 'generating' | 'done' | 'failed';
  isRequired?: boolean;
  isFavorite?: boolean;
  source?: 'ai' | 'manual';
}

export interface Scene {
  id: string;
  text: string;
  location: string;
  cameraAngle: string;
  imageUrl: string;
  characters: string[];
  status: 'pending' | 'generating' | 'done' | 'failed';
  checked: boolean;
}

/** 프로젝트 모드 */
export type ProjectMode = 'cinematic' | 'narration';

/** 나레이션 모드 — 문장별 타이밍 정보 */
export interface SentenceTiming {
  index: number;
  text: string;
  startTime: number;
  endTime: number;
}

export interface NarrationClip {
  id: string;
  sceneId: string;
  text: string;
  sentences: SentenceTiming[];
  imageUrl: string;
  videoUrl: string;
  isVideoEnabled: boolean;
  effect: 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
  audioStartTime: number;
  audioEndTime: number;
  duration: number;
  order: number;
  isModified: boolean;
}

export interface TimelineClip {
  id: string;
  sceneId: string;
  type: 'video' | 'audio' | 'sfx';
  label: string;
  duration: number; // seconds
}

// ── AI 모델 선호도 (Phase 6에서 유저 선택 UI 추가 예정) ──
export interface AiModelPreferences {
  script: string;
  image: string;
  video: string;
  tts: string;
}

const DEFAULT_AI_MODELS: AiModelPreferences = {
  script: 'gemini-flash',
  image: 'gemini-image',
  video: 'runway-gen3',
  tts: 'fish-speech',
};

export interface ProjectState {
  // Project info
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  title: string;
  setTitle: (title: string) => void;

  // Aspect ratio
  aspectRatio: '16:9' | '9:16' | '1:1';
  setAspectRatio: (ratio: '16:9' | '9:16' | '1:1') => void;

  // Current phase
  currentPhase: number;
  setCurrentPhase: (phase: number) => void;

  // Script / Scenes
  scenes: Scene[];
  setScenes: (scenes: Scene[]) => void;
  toggleSceneCheck: (id: string) => void;

  // Style
  selectedStyle: string;
  setSelectedStyle: (style: string) => void;

  // Card Asset Library (모든 카드 에셋 보관 — 단일 데이터 소스)
  cardLibrary: AssetCard[];
  addToCardLibrary: (card: AssetCard) => void;
  removeFromCardLibrary: (id: string) => void;

  // Timeline
  timelineClips: TimelineClip[];
  setTimelineClips: (clips: TimelineClip[]) => void;

  // Credits (크레딧 시스템)
  credits: number;
  spendCredits: (amount: number) => boolean;
  addCredits: (amount: number) => void;
  resetCredits: () => void;

  // Active project flag
  hasActiveProject: boolean;
  startNewProject: (title: string, mode?: ProjectMode) => void;

  // ── v4 신규 필드 ──

  // 진입점 (3가지 시작점 추적 — Phase 2에서 사용)
  entryPoint: 'script' | 'style' | 'cast' | null;
  setEntryPoint: (ep: 'script' | 'style' | 'cast' | null) => void;

  // 선택된 스타일 프리셋 ID (Phase 2에서 사용)
  selectedPreset: string | null;
  setSelectedPreset: (preset: string | null) => void;

  // 프로젝트별 선택 카드 ID 목록 (cardLibrary 중 이 프로젝트에서 사용할 카드)
  selectedDeck: string[];
  setSelectedDeck: (deck: string[]) => void;

  // AI 모델 선호도 (Phase 6에서 유저 선택 지원)
  aiModelPreferences: AiModelPreferences;
  setAiModelPreference: (category: keyof AiModelPreferences, modelId: string) => void;

  // ── v5 신규: 듀얼 모드 ──
  mode: ProjectMode;
  setMode: (mode: ProjectMode) => void;
  narrativeAudioUrl: string;
  setNarrativeAudioUrl: (url: string) => void;
  sentenceTimings: SentenceTiming[];
  setSentenceTimings: (timings: SentenceTiming[]) => void;

  // ── v6 신규: 나레이션 클립 ──
  narrationClips: NarrationClip[];
  setNarrationClips: (clips: NarrationClip[]) => void;
  narrationStep: number;
  setNarrationStep: (step: number) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projectId: null,
      setProjectId: (projectId) => set({ projectId }),
      title: '',
      setTitle: (title) => set({ title }),

      aspectRatio: '16:9',
      setAspectRatio: (aspectRatio) => set({ aspectRatio }),

      currentPhase: 1,
      setCurrentPhase: (currentPhase) => set({ currentPhase }),

      scenes: [],
      setScenes: (scenes) => set({ scenes }),
      toggleSceneCheck: (id) =>
        set((state) => ({
          scenes: state.scenes.map((s) =>
            s.id === id ? { ...s, checked: !s.checked } : s
          ),
        })),

      selectedStyle: 'Cinematic',
      setSelectedStyle: (selectedStyle) => set({ selectedStyle }),

      // Card Asset Library
      cardLibrary: [],
      addToCardLibrary: (card) =>
        set((state) => ({
          cardLibrary: state.cardLibrary.some((c) => c.id === card.id)
            ? state.cardLibrary
            : [...state.cardLibrary, card],
        })),
      removeFromCardLibrary: (id) =>
        set((state) => ({
          cardLibrary: state.cardLibrary.filter((c) => c.id !== id),
        })),

      timelineClips: [],
      setTimelineClips: (timelineClips) => set({ timelineClips }),

      // Credits
      credits: 10000,
      spendCredits: (amount) => {
        let success = false;
        set((state) => {
          if (state.credits >= amount) {
            success = true;
            return { credits: state.credits - amount };
          }
          return state;
        });
        return success;
      },
      addCredits: (amount) => set((state) => ({ credits: state.credits + amount })),
      resetCredits: () => set({ credits: 10000 }),

      hasActiveProject: false,
      startNewProject: (title, mode = 'cinematic') =>
        set({
          projectId: null,
          title,
          hasActiveProject: true,
          currentPhase: 1,
          scenes: [],
          selectedStyle: 'Cinematic',
          aspectRatio: '16:9',
          timelineClips: [],
          entryPoint: null,
          selectedPreset: null,
          selectedDeck: [],
          aiModelPreferences: { ...DEFAULT_AI_MODELS },
          mode,
          narrativeAudioUrl: '',
          sentenceTimings: [],
          narrationClips: [],
          narrationStep: 1,
          // cardLibrary는 리셋하지 않음 — 카드 에셋은 프로젝트 간 유지
        }),

      // ── v4 신규 필드 초기값 & 액션 ──
      entryPoint: null,
      setEntryPoint: (entryPoint) => set({ entryPoint }),

      selectedPreset: null,
      setSelectedPreset: (selectedPreset) => set({ selectedPreset }),

      selectedDeck: [],
      setSelectedDeck: (selectedDeck) => set({ selectedDeck }),

      aiModelPreferences: { ...DEFAULT_AI_MODELS },
      setAiModelPreference: (category, modelId) =>
        set((s) => ({
          aiModelPreferences: { ...s.aiModelPreferences, [category]: modelId },
        })),

      // ── v5 신규 필드 초기값 & 액션 ──
      mode: 'cinematic' as ProjectMode,
      setMode: (mode) => set({ mode }),
      narrativeAudioUrl: '',
      setNarrativeAudioUrl: (narrativeAudioUrl) => set({ narrativeAudioUrl }),
      sentenceTimings: [],
      setSentenceTimings: (sentenceTimings) => set({ sentenceTimings }),

      // ── v6 신규 필드 초기값 & 액션 ──
      narrationClips: [],
      setNarrationClips: (narrationClips) => set({ narrationClips }),
      narrationStep: 1,
      setNarrationStep: (narrationStep) => set({ narrationStep }),
    }),
    {
      name: 'antigravity-project',
      version: 6,
      migrate: (persistedState: unknown, version: number) => {
        let state = persistedState as Record<string, unknown>;
        if (version < 2) {
          // v1→v2: cast → cardLibrary 마이그레이션
          const oldCast = (state.cast || []) as Array<Record<string, unknown>>;
          const knownCharIds = ['char-1', 'char-2', 'char-3', 'char-4', 'char-5', 'obj-2'];
          const migratedCards: AssetCard[] = oldCast.map((c) => ({
            id: c.id as string,
            name: c.name as string,
            type: (knownCharIds.includes(c.id as string) ? 'character' : 'item') as AssetType,
            description: c.description as string,
            imageUrl: c.imageUrl as string,
            seed: c.seed as number,
            status: 'done' as const,
            source: 'manual' as const,
          }));
          const existing = (state.cardLibrary || []) as AssetCard[];
          const merged = [...existing];
          for (const card of migratedCards) {
            if (!merged.some((c) => c.id === card.id)) {
              merged.push(card);
            }
          }
          state = { ...state, cardLibrary: merged };
        }
        if (version < 3) {
          // v2→v3: projectId 추가
          state = { ...state, projectId: state.projectId ?? null };
        }
        if (version < 4) {
          // v3→v4: entryPoint, selectedPreset, selectedDeck, aiModelPreferences 추가
          state = {
            ...state,
            entryPoint: null,
            selectedPreset: null,
            selectedDeck: [],
            aiModelPreferences: { ...DEFAULT_AI_MODELS },
          };
        }
        if (version < 5) {
          // v4→v5: 듀얼 모드 필드 추가
          state = {
            ...state,
            mode: 'cinematic',
            narrativeAudioUrl: '',
            sentenceTimings: [],
          };
        }
        if (version < 6) {
          // v5→v6: 나레이션 클립 필드 추가
          state = {
            ...state,
            narrationClips: [],
            narrationStep: 1,
          };
        }
        return state;
      },
      partialize: (state) => ({
        projectId: state.projectId,
        title: state.title,
        scenes: state.scenes,
        selectedStyle: state.selectedStyle,
        cardLibrary: state.cardLibrary,
        credits: state.credits,
        hasActiveProject: state.hasActiveProject,
        currentPhase: state.currentPhase,
        aspectRatio: state.aspectRatio,
        entryPoint: state.entryPoint,
        selectedPreset: state.selectedPreset,
        selectedDeck: state.selectedDeck,
        aiModelPreferences: state.aiModelPreferences,
        mode: state.mode,
        narrativeAudioUrl: state.narrativeAudioUrl,
        sentenceTimings: state.sentenceTimings,
        narrationClips: state.narrationClips,
        narrationStep: state.narrationStep,
      }),
    }
  )
);
