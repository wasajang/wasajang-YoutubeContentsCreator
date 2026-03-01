# 011: StylePreset → Template 교체 + 데이터 정리

> 작성: CTO 일론 | 2026-02-28
> 기반: CPO 유나 ux-design.md + CEO 4가지 결정사항
> 상태: CEO 검토 대기

---

## CEO 결정사항 (확정)

1. **StylePreset → Template 완전 교체** (공존 아님)
2. **아트 스타일: 5개 템플릿에 맞는 것만** (12개 전부 유지 X)
3. **비율(aspectRatio): 프로젝트별 고정** (씬별 변경 없음)
4. **defaultModels: 템플릿에 포함** (사용자가 Settings에서 변경 가능)

---

## 현재 상태 → 목표

```
현재:
  stylePresets.ts    → StylePreset 인터페이스 + 5개 프리셋 (간단한 prompts)
  mockData.ts        → 13개 export (artStyles 12개, stylePromptPrefix, 미사용 데이터 다수)
  prompt-builder.ts  → stylePromptPrefix import + getPresetById 사용
  projectStore.ts    → selectedPreset(string), selectedStyle(string), v8

목표:
  templates.ts       → Template 인터페이스 + 5개 템플릿 (상세 promptRules + castPreset)
  artStyles.ts       → ArtStyle 인터페이스 + 템플릿 매칭 아트 스타일만
  mockData.ts        → 미사용 데이터 삭제, 남은 mock만 유지
  prompt-builder.ts  → Template promptRules + ArtStyle prefix 조합
  projectStore.ts    → templateId, artStyleId 추가, v9
```

---

## CEO 확인 필요: 아트 스타일 배정

현재 ux-design.md에서 5개 템플릿 모두 `artStyleId: 'cinematic'`으로 되어있습니다.
하지만 CEO가 "5개 템플릿에 맞는 아트스타일 카드만 생성"이라고 하셨으므로,
아래와 같이 차별화된 아트 스타일을 제안합니다:

| # | 템플릿 | 제안 아트 스타일 | 이유 |
|---|--------|-----------------|------|
| 1 | 타임슬립 시네마틱 드라마 | **Cinematic** | 영화적 포토리얼 |
| 2 | 해외감동사연 | **Cinematic** | 다큐 느낌, 실사 기반 |
| 3 | 무협지1 (나레이션) | **Ink Wash** (수묵화) | 동양 판타지 서사 + 수묵화 미학 |
| 4 | 무협지2 (시네마틱) | **Cinematic** | 무협 영화 액션, 실사 기반 |
| 5 | 해골 쇼츠 | **Dark Cartoon** (다크 카툰) | 쇼츠 특화, 눈에 띄는 스타일 |

**결과: 3개 아트 스타일** — Cinematic, Ink Wash, Dark Cartoon

> CEO: 이 배정이 맞는지, 또는 다르게 하고 싶으신 부분이 있으면 알려주세요.
> "모두 cinematic으로 통일"도 가능합니다 (그 경우 아트 스타일 1개).

---

## 수정 파일 목록 (영향 분석 기반)

| # | 파일 | 변경 내용 | 영향도 |
|---|------|-----------|--------|
| 1 | `src/data/templates.ts` | **신규 생성** — Template 인터페이스 + 5개 데이터 + 헬퍼 함수 | 핵심 |
| 2 | `src/data/artStyles.ts` | **신규 생성** — ArtStyle 인터페이스 + 3개 아트 스타일 데이터 | 핵심 |
| 3 | `src/data/stylePresets.ts` | **삭제** — Template로 완전 교체 | 삭제 |
| 4 | `src/data/mockData.ts` | 미사용 export 삭제, artStyles를 artStyles.ts로 이전 | 정리 |
| 5 | `src/store/projectStore.ts` | v8→v9, templateId·artStyleId 추가, selectedPreset→templateId 교체 | 핵심 |
| 6 | `src/services/prompt-builder.ts` | Template promptRules + ArtStyle 조합으로 리팩토링 | 핵심 |
| 7 | `src/components/PresetInfoModal.tsx` | Template 타입으로 변경 (이름은 TemplateInfoModal로) | 보통 |
| 8 | `src/pages/HomePage.tsx` | templates import + 프리셋→템플릿 용어 변경 | 보통 |
| 9 | `src/pages/IdeaPage.tsx` | artStyles import 경로 변경 + 템플릿 참조 변경 | 보통 |
| 10 | `src/pages/StoryboardPage.tsx` | getPresetById → getTemplateById, castPreset 사용 | 보통 |
| 11 | `src/pages/CastPage.tsx` | mockCardLibrary → 템플릿 castPreset 기반 초기화 | 낮음 |
| 12 | `src/pages/AdminPage.tsx` | stylePresets import 제거/변경 | 낮음 |
| 13 | `src/components/storyboard/SeedCheckPhase.tsx` | stylePromptPrefix → artStyles 참조 | 낮음 |

**총 13개 파일** (신규 2개 + 삭제 1개 + 수정 10개)

---

## 구현 계획 (6 Phase)

### Phase 1: 새 데이터 파일 생성 (신규 2개)

#### 1-A. `src/data/templates.ts`

```typescript
// 유나(CPO)의 ux-design.md 기반
// Template 인터페이스 + TemplatePromptRules + TemplateCastPreset + TemplateCastCard

export interface TemplatePromptRules {
  scriptSystemPrompt: string;
  sceneSplitRules: {
    defaultSceneCount: number;
    minSceneCount: number;
    maxSceneCount: number;
    targetDurationPerScene: number;
    splitInstruction: string;
  };
  imagePromptRules: {
    prefix: string;
    suffix: string;
    negativePrompt: string;
    instruction: string;
  };
  videoPromptRules: {
    prefix: string;
    suffix: string;
    defaultDuration: number;
    instruction: string;
  };
}

export interface TemplateCastCard {
  name: string;
  description: string;
  referenceImageUrl?: string;
  isRequired: boolean;
}

export interface TemplateCastPreset {
  characters: TemplateCastCard[];
  backgrounds: TemplateCastCard[];
  items: TemplateCastCard[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  mode: 'cinematic' | 'narration';
  aspectRatio: '16:9' | '9:16' | '1:1';
  artStyleId: string;               // ArtStyle.id 참조
  promptRules: TemplatePromptRules;
  castPreset: TemplateCastPreset;
  defaultModels: {
    script: string;
    image: string;
    video: string;
    tts: string;
  };
  voice?: { speed?: number; tone?: string };
  sampleIdea?: string;
  thumbnail?: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  visibility: 'public' | 'soon' | 'hidden';
  isOfficial: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// 5개 템플릿 데이터 (ux-design.md에서 가져옴)
export const templates: Template[] = [ ... ];

// 헬퍼 함수
export function getTemplateById(id: string): Template | undefined;
export function getPublicTemplates(): Template[];
export function getTemplatesByMode(mode: 'cinematic' | 'narration'): Template[];
```

- ux-design.md의 5개 템플릿 데이터를 그대로 사용
- 기존 `getPresetById()` → `getTemplateById()`
- 기존 `getPublicPresets()` → `getPublicTemplates()`
- localStorage 오버라이드 기능은 유지 (키: `antigravity-template-overrides`)

#### 1-B. `src/data/artStyles.ts`

```typescript
export interface ArtStyle {
  id: string;
  name: string;
  nameKo: string;
  thumbnail: string;
  color: string;
  imagePromptPrefix: string;
  imagePromptSuffix: string;
  negativePrompt: string;
  videoPromptPrefix: string;
  category: 'realistic' | 'illustration' | 'stylized' | 'traditional';
  tags: string[];
  isDefault?: boolean;
}

// 3개 아트 스타일 (CEO 확인 후 확정)
export const artStyles: ArtStyle[] = [
  {
    id: 'cinematic',
    name: 'Cinematic',
    nameKo: '시네마틱',
    // ... 기존 artStyles['cinematic'] + stylePromptPrefix['Cinematic'] 통합
    imagePromptPrefix: 'photorealistic cinematic still, anamorphic lens, dramatic lighting, film grain, 4K,',
    imagePromptSuffix: 'award-winning cinematography, shallow depth of field',
    negativePrompt: 'blurry, low quality, distorted, deformed, ugly, watermark, text, logo, anime, cartoon, oversaturated',
    videoPromptPrefix: 'cinematic, slow motion, dramatic camera movement,',
    category: 'realistic',
    isDefault: true,
  },
  {
    id: 'ink-wash',
    name: 'Ink Wash',
    nameKo: '수묵화',
    imagePromptPrefix: 'ink wash painting, traditional asian brush painting, flowing ink, rice paper texture, monochrome with subtle color,',
    // ...
    category: 'traditional',
  },
  {
    id: 'dark-cartoon',
    name: 'Dark Cartoon',
    nameKo: '다크 카툰',
    imagePromptPrefix: 'dark cartoon style, bold outlines, spooky cute, neon accents on dark background, TikTok viral aesthetic,',
    // ...
    category: 'stylized',
  },
];

// 헬퍼
export function getArtStyleById(id: string): ArtStyle | undefined;
export function getArtStylePromptPrefix(id: string): string;
```

---

### Phase 2: Store 업데이트 (`projectStore.ts`)

**변경 사항:**
- `selectedPreset: string | null` → `templateId: string | null` (이름 변경)
- `selectedStyle: string` → `artStyleId: string` (이름 변경, 값도 id 기반으로)
- `setSelectedPreset()` → `setTemplateId()`
- `setSelectedStyle()` → `setArtStyleId()`
- `AssetCard.source` 타입에 `'template'` 추가
- persist version 8 → 9

**v8→v9 마이그레이션:**
```typescript
if (version < 9) {
  // selectedPreset → templateId
  state = {
    ...state,
    templateId: state.selectedPreset ?? null,
    artStyleId: state.selectedStyle ?? 'cinematic',
  };
  // 기존 필드 삭제 (Zustand persist는 partialize에서 제외하면 됨)
}
```

**`startNewProject()` 업데이트:**
```typescript
startNewProject: (title, mode, options) => set((state) => ({
  // ... 기존 필드
  templateId: null,            // (기존: selectedPreset: null)
  artStyleId: 'cinematic',     // (기존: selectedStyle: 'Cinematic')
  // ...
})),
```

**`partialize` 업데이트:**
- `selectedPreset` → `templateId`
- `selectedStyle` → `artStyleId`

---

### Phase 3: prompt-builder 리팩토링

**현재:** `stylePromptPrefix[capitalize(style)]` + `getPresetById(presetId)`
**변경:** `getArtStylePromptPrefix(artStyleId)` + `getTemplateById(templateId)`

```typescript
// 변경 전
import { stylePromptPrefix } from '../data/mockData';
import { getPresetById } from '../data/stylePresets';

// 변경 후
import { getArtStyleById } from '../data/artStyles';
import { getTemplateById } from '../data/templates';
```

**`PromptContext` 인터페이스 변경:**
```typescript
export interface PromptContext {
  artStyleId: string;        // (기존: style: string)
  sceneText: string;
  seedCards: AssetCard[];
  customImagePrompt?: string;
  cameraAngle?: string;
  location?: string;
  templateId?: string;       // (기존: presetId?: string)
}
```

**프롬프트 우선순위 (변경 없음, 이름만 변경):**
1. Template promptRules.imagePromptRules.prefix
2. ArtStyle.imagePromptPrefix (폴백)
3. 빈 문자열 (기본)

---

### Phase 4: 컴포넌트 업데이트 (7개 파일)

#### 4-A. PresetInfoModal.tsx → TemplateInfoModal.tsx

```diff
- import type { StylePreset } from '../data/stylePresets';
+ import type { Template } from '../data/templates';
+ import { getArtStyleById } from '../data/artStyles';

- interface Props { preset: StylePreset; ... }
+ interface Props { template: Template; ... }

// handleApply 내부:
- setSelectedStyle(preset.style);
+ setArtStyleId(template.artStyleId);

// STYLE_LABEL 삭제 → getArtStyleById(template.artStyleId)?.name 사용

// 추천 캐스트 표시:
- 배우 {preset.recommendedCast.characters}명
+ 배우 {template.castPreset.characters.length}명
```

#### 4-B. HomePage.tsx

```diff
- import { getPublicPresets } from '../data/stylePresets';
- import type { StylePreset } from '../data/stylePresets';
+ import { getPublicTemplates } from '../data/templates';
+ import type { Template } from '../data/templates';

- const stylePresets = getPublicPresets();
+ const templateList = getPublicTemplates();

// "스타일부터" 섹션 → "템플릿" 섹션으로 변경
// handlePresetSelect → handleTemplateSelect

- import { templateCards, genreFilters, mockCardLibrary } from '../data/mockData';
+ // templateCards, genreFilters 삭제 (미사용)
+ // mockCardLibrary → 별도 처리 (Phase 5)
```

#### 4-C. IdeaPage.tsx

```diff
- import { artStyles } from '../data/mockData';
+ import { artStyles } from '../data/artStyles';
- import { getPresetById, getPresetsByMode } from '../data/stylePresets';
+ import { getTemplateById } from '../data/templates';

// STYLE 탭: artStyles 그리드는 유지, import 경로만 변경
// selectedPreset → templateId
// selectedStyle === style.name → artStyleId === style.id
```

#### 4-D. StoryboardPage.tsx

```diff
- import { getPresetById } from '../data/stylePresets';
+ import { getTemplateById } from '../data/templates';

// castConfig:
- const preset = selectedPreset ? getPresetById(selectedPreset) : null;
- const castConfig = preset?.recommendedCast ?? { characters: 3, backgrounds: 1, items: 1 };
+ const template = templateId ? getTemplateById(templateId) : null;
+ const castConfig = template
+   ? {
+       characters: template.castPreset.characters.length,
+       backgrounds: template.castPreset.backgrounds.length,
+       items: template.castPreset.items.length,
+     }
+   : { characters: 3, backgrounds: 1, items: 1 };
```

#### 4-E. CastPage.tsx
- `mockCardLibrary` import 제거 또는 경로 변경
- 필요 시 templateId 기반으로 castPreset 카드 초기 로드

#### 4-F. AdminPage.tsx
- `stylePresets` import → `templates` import

#### 4-G. SeedCheckPhase.tsx
- `stylePromptPrefix` → `getArtStylePromptPrefix()` 사용

---

### Phase 5: mockData.ts 정리

**삭제할 export (7개):**
| export | 이유 |
|--------|------|
| `genreFilters` | HomePage 템플릿 그리드에만 사용, 새 templates.ts가 대체 |
| `heroTemplates` | HomePage 히어로 섹션, 미사용 |
| `templateCards` | HomePage 템플릿 카드, 새 templates.ts가 대체 |
| `favoritesPool` | 어디서도 import 안 함 |
| `mockTimelineClips` | 어디서도 import 안 함 |
| `voiceAssignments` | 어디서도 import 안 함 |
| `stylePromptPrefix` | artStyles.ts에 통합됨 |

**삭제할 export (조건부, 2개):**
| export | 조건 |
|--------|------|
| `artStyles` (기존 12개 배열) | artStyles.ts로 이전 완료 후 삭제 |
| `aiSuggestedCards` | 템플릿 castPreset이 대체. StoryboardPage에서 사용 중이면 유지 |

**유지할 export (4개):**
| export | 이유 |
|--------|------|
| `mockScript` | IdeaPage 대본 폴백, 테스트용 |
| `mockCardLibrary` | HomePage 초기 카드 주입 (임시, AI 연동 시 제거 예정) |
| `mockStoryboardScenes` | StoryboardPage mock 씬 데이터 |
| `mockScenePrompts` | StoryboardPage mock 프롬프트 |
| `generateMockScriptFromIdea` | IdeaPage mock AI 생성 |

---

### Phase 6: 빌드 검증 + QA

1. `npm run build` — TypeScript 에러 0개 확인
2. `npm run lint` — ESLint 에러 확인
3. 브라우저 검증:
   - 홈 → 템플릿 카드 5개 표시
   - 템플릿 클릭 → TemplateInfoModal 표시 (모든 필드)
   - "적용" → IdeaPage STYLE 탭에서 artStyleId 반영 확인
   - StoryboardPage → 템플릿 castPreset 기반 카드 수 확인
   - "대본부터" 진입 → 아트 스타일 선택 가능 확인

---

## 실행 순서 & 병렬화

```
Step 1 (병렬):
  [린 FE-A] templates.ts 생성
  [린 FE-B] artStyles.ts 생성

Step 2 (순차, Step 1 완료 후):
  [린 FE-C] projectStore.ts v9 업데이트

Step 3 (순차, Step 2 완료 후):
  [린 FE-D] prompt-builder.ts 리팩토링

Step 4 (병렬, Step 3 완료 후):
  [린 FE-E] PresetInfoModal → TemplateInfoModal
  [린 FE-F] HomePage.tsx 업데이트
  [린 FE-G] IdeaPage.tsx 업데이트
  [린 FE-H] StoryboardPage.tsx + CastPage.tsx + AdminPage.tsx + SeedCheckPhase.tsx

Step 5 (순차, Step 4 완료 후):
  [린 FE-I] mockData.ts 정리 + stylePresets.ts 삭제

Step 6:
  [타로 QA] 빌드 검증 + 전체 점검
```

**예상 에이전트 호출: 5~6회** (병렬 최대 활용)

---

## 리스크 & 대응

| 리스크 | 확률 | 대응 |
|--------|------|------|
| store 마이그레이션 실패 | 낮음 | localStorage 클리어로 복구 |
| import 경로 누락 | 중간 | 타로 QA 빌드 검증에서 잡힘 |
| 아트 스타일 3개가 너무 적음 | 중간 | CEO 판단 후 추가 가능 (데이터만 추가) |
| mockCardLibrary 의존성 | 낮음 | Phase 5에서 안전하게 처리 |

---

*CEO 승인 후 구현 시작합니다.*
*"아트 스타일 배정" 부분에 대한 CEO 피드백이 필요합니다.*
