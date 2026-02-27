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
  status: 'pending' | 'generating' | 'done';
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
  status: 'pending' | 'generating' | 'done';
  checked: boolean;
}

export interface TimelineClip {
  id: string;
  sceneId: string;
  type: 'video' | 'audio' | 'sfx';
  label: string;
  duration: number; // seconds
}

export interface ProjectState {
  // Project info
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
  startNewProject: (title: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
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
      credits: 50,
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
      resetCredits: () => set({ credits: 50 }),

      hasActiveProject: false,
      startNewProject: (title) =>
        set({
          title,
          hasActiveProject: true,
          currentPhase: 1,
          scenes: [],
          selectedStyle: 'Cinematic',
          aspectRatio: '16:9',
          timelineClips: [],
          // cardLibrary는 리셋하지 않음 — 카드 에셋은 프로젝트 간 유지
        }),
    }),
    {
      name: 'antigravity-project',
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version < 2) {
          // cast → cardLibrary 마이그레이션
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
          return { ...state, cardLibrary: merged };
        }
        return state;
      },
      partialize: (state) => ({
        title: state.title,
        scenes: state.scenes,
        selectedStyle: state.selectedStyle,
        cardLibrary: state.cardLibrary,
        credits: state.credits,
        hasActiveProject: state.hasActiveProject,
        currentPhase: state.currentPhase,
        aspectRatio: state.aspectRatio,
      }),
    }
  )
);
