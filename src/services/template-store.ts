/**
 * template-store.ts — 커스텀 템플릿 CRUD + 공식 템플릿 오버라이드 관리
 *
 * localStorage 기반. 나중에 Supabase로 이전 가능한 구조.
 */

import type { Template } from '../data/templates';

// ── localStorage 키 ──────────────────────────────────────

const TEMPLATE_OVERRIDE_KEY = 'antigravity-template-overrides';
const CUSTOM_TEMPLATES_KEY = 'antigravity-custom-templates';
const LEGACY_PRESET_KEY = 'antigravity-preset-overrides';
const MIGRATION_DONE_KEY = 'antigravity-legacy-migrated';

// ── 커스텀 템플릿 CRUD ──────────────────────────────────

/** localStorage에서 커스텀 템플릿 목록 읽기 */
export function getCustomTemplates(): Template[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_TEMPLATES_KEY) || '[]');
  } catch {
    return [];
  }
}

/** 커스텀 템플릿 저장 (id 기준 upsert) */
export function saveCustomTemplate(template: Template): void {
  const list = getCustomTemplates();
  const idx = list.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    list[idx] = { ...template, updatedAt: new Date().toISOString() };
  } else {
    list.push(template);
  }
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(list));
}

/** 커스텀 템플릿 삭제 */
export function deleteCustomTemplate(id: string): void {
  const list = getCustomTemplates().filter((t) => t.id !== id);
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(list));
}

// ── 공식 템플릿 오버라이드 ──────────────────────────────

/** 공식 템플릿 오버라이드 전체 읽기 */
export function getTemplateOverrides(): Record<string, Partial<Template>> {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATE_OVERRIDE_KEY) || '{}');
  } catch {
    return {};
  }
}

/** 공식 템플릿 오버라이드 저장 */
export function saveTemplateOverride(id: string, overrides: Partial<Template>): void {
  const all = getTemplateOverrides();
  all[id] = overrides;
  localStorage.setItem(TEMPLATE_OVERRIDE_KEY, JSON.stringify(all));
}

/** 공식 템플릿 오버라이드 삭제 (원본 복원) */
export function resetTemplateOverride(id: string): void {
  const all = getTemplateOverrides();
  delete all[id];
  localStorage.setItem(TEMPLATE_OVERRIDE_KEY, JSON.stringify(all));
}

// ── 레거시 마이그레이션 ──────────────────────────────────

interface LegacyPresetEdit {
  script?: string;
  imagePrefix?: string;
  videoPrefix?: string;
  negativePrompt?: string;
}

/** 레거시 antigravity-preset-overrides → template-overrides 변환 (1회성) */
export function migrateLegacyOverrides(): void {
  // 이미 마이그레이션 완료면 스킵
  if (localStorage.getItem(MIGRATION_DONE_KEY)) return;

  try {
    const raw = localStorage.getItem(LEGACY_PRESET_KEY);
    if (!raw) {
      localStorage.setItem(MIGRATION_DONE_KEY, '1');
      return;
    }

    const legacy = JSON.parse(raw) as Record<string, LegacyPresetEdit>;
    if (!legacy || Object.keys(legacy).length === 0) {
      localStorage.setItem(MIGRATION_DONE_KEY, '1');
      return;
    }

    const existing = getTemplateOverrides();

    for (const [id, edit] of Object.entries(legacy)) {
      if (existing[id]) continue; // 이미 새 형식으로 있으면 스킵

      const override: Partial<Template> = {
        promptRules: {
          scriptSystemPrompt: edit.script || '',
          sceneSplitRules: {
            defaultSceneCount: 8,
            minSceneCount: 3,
            maxSceneCount: 20,
            targetDurationPerScene: 5,
            splitInstruction: '',
          },
          imagePromptRules: {
            systemPrompt: '',
            prefix: edit.imagePrefix || '',
            suffix: '',
            negativePrompt: edit.negativePrompt || '',
            instruction: '',
          },
          videoPromptRules: {
            systemPrompt: '',
            prefix: edit.videoPrefix || '',
            suffix: '',
            defaultDuration: 5,
            instruction: '',
          },
        },
      };

      existing[id] = override;
    }

    localStorage.setItem(TEMPLATE_OVERRIDE_KEY, JSON.stringify(existing));
    localStorage.setItem(MIGRATION_DONE_KEY, '1');
  } catch {
    // 마이그레이션 실패 시 무시 — 다음 시도에서 재실행
  }
}

// ── 템플릿 생성/복제 ──────────────────────────────────────

/** 공식 템플릿을 복제하여 커스텀 템플릿으로 변환 */
export function cloneTemplate(source: Template, newName: string): Template {
  return {
    ...JSON.parse(JSON.stringify(source)), // deep clone
    id: `custom-${Date.now()}`,
    name: newName,
    isOfficial: false,
    visibility: 'public' as const,
    authorId: 'local',
    authorName: 'My Template',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** 빈 커스텀 템플릿 생성 (기본값 채움) */
export function createBlankTemplate(mode: 'cinematic' | 'narration'): Template {
  return {
    id: `custom-${Date.now()}`,
    name: '새 템플릿',
    description: '',
    category: 'CUSTOM',
    mode,
    aspectRatio: '16:9',
    artStyleId: 'cinematic',
    promptRules: {
      scriptSystemPrompt: '',
      sceneSplitRules: {
        defaultSceneCount: 8,
        minSceneCount: 3,
        maxSceneCount: 20,
        targetDurationPerScene: 5,
        splitInstruction: '',
      },
      imagePromptRules: {
        systemPrompt: '',
        prefix: '',
        suffix: '',
        negativePrompt: '',
        instruction: '',
      },
      videoPromptRules: {
        systemPrompt: '',
        prefix: '',
        suffix: '',
        defaultDuration: 5,
        instruction: '',
      },
    },
    castPreset: {
      characters: [],
      backgrounds: [],
      items: [],
    },
    defaultModels: {
      script: 'gemini-2.5-flash',
      image: 'gemini-2.0-flash-exp-image-generation',
      video: 'runway-gen3',
      tts: 'fish-speech',
    },
    tags: [],
    difficulty: 'beginner',
    visibility: 'public',
    isOfficial: false,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
