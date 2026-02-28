# 002 - UX 플로우 개선 계획 v2

> 작성일: 2026-02-27
> 상태: ✅ 승인 완료 → Phase 0 구현 준비 완료
> 변경: v2.2 — 구현 전 CTO 전수점검 반영 (prompt-builder 스킵, NavBar 코드 보완, 인터페이스명 정정, TTS 주석)
> 근거: research.md §1~14

---

## 프로덕트 아키텍처 (목표)

```
┌─────────────────── HomePage (/) ────────────────────┐
│                                                      │
│  [A] 대본부터      [B] 스타일부터     [C] Cast부터     │
│  시작하기          시작하기           시작하기         │
│                                                      │
│  ┌ My Projects ┐  ┌ My Cast ┐                        │
│  └─────────────┘  └─────────┘                        │
└──────────────────────────────────────────────────────┘
         │                │                │
         ▼                ▼                ▼
    ┌─────────┐    ┌──────────┐    ┌──────────┐
    │ Script  │    │  Style   │    │  Cast    │
    │ 대본입력 │    │ 프리셋   │    │ AI 생성  │
    └────┬────┘    └────┬─────┘    │ 5장 선택 │
         │              │          └────┬─────┘
         │              │               │
         ▼              ▼               ▼
    ┌──────── 어떤 경로든 합류 ────────────┐
    │                                      │
    │  ① Idea (대본+스타일)                │
    │  ② Storyboard (카드선택+컷분할)       │
    │  ③ Generate (시드매칭+이미지+영상)     │
    │  ④ Animate (타임라인+TTS+Export)      │
    └──────────────────────────────────────┘

별도 페이지:
  /settings → 크레딧, 구독, BYOK API 키
  /admin    → Dev 전용 프롬프트/프리셋 관리
```

**핵심 원칙:** 어떤 진입점에서 시작하든 선택한 옵션(스타일, 캐스트, 비율, AI 모델)이 store에 저장되어 이후 모든 AI 프롬프트에 자동 반영.

---

## 전체 라우팅 구조 (목표)

```
/                    → HomePage (3가지 시작점 + My Projects + My Cast 섹션)
/cast                → CastPage (AI 생성 스튜디오 + 5장 선택)
/project/idea        → IdeaPage (대본 작성 + 스타일 선택)
/project/storyboard  → StoryboardPage (카드선택 + 컷분할 + 시드매칭 + 생성)
/project/timeline    → TimelinePage (편집 + TTS + Export)
/settings            → SettingsPage (크레딧, 구독, BYOK)
/admin               → AdminPage (Dev 전용)
```

제거할 라우트:
- `/project/new` → `/project/idea`로 통합
- `/project/script` → `/project/idea`로 통합
- `/project/style` → `/project/idea`로 통합

---

## Phase 구성 (구현 순서) — CTO 검토 반영 v2.1

```
Phase 0:  즉시 수정 + 기반 정리        ← 크레딧, NavBar, prompt-builder 스텁, AI 모델 파라미터화
Phase 1:  인프라 개편                  ← CSS 분리 + Store v4 마이그레이션 + WorkflowSteps 2레벨 + 라우팅
Phase 2:  HomePage 3진입점 + CastPage  ← 고객 여정의 핵심 (cardLibrary/selectedDeck 이중 구조)
Phase 2.5: StoryboardPage 리팩토링     ← 685줄 → 컴포넌트 분리 (Phase 3 선행 필수)
Phase 3:  StoryboardPage UI 개선       ← 컷분할 카드덱, 서브로우, 미리보기
Phase 4:  SettingsPage + BYOK          ← 매출 기반
Phase 5:  AdminPage (Dev 전용)         ← 프롬프트/프리셋 관리
Phase 6:  AI 모델 선택 시스템           ← 단계별 모델 옵션 (인터페이스는 Phase 0에서 준비됨)
Phase 7:  데이터 안정성 + 페이지 정리   ← 마무리
```

> **v2 → v2.1 변경점 (CTO 검토 결과):**
> - Phase 0: prompt-builder.ts 스텁 + AI 서비스 모델 파라미터화 추가
> - Phase 1: CSS 파일 분리 + Store v4 마이그레이션 통합 (새 필드 한번에)
> - Phase 2: cardLibrary(전역) vs selectedDeck(프로젝트별) 이중 구조 명시
> - Phase 2.5: StoryboardPage 컴포넌트 분리 단계 신설 (Phase 3 품질 보장)
>
> **v2.1 → v2.2 변경점 (구현 전 CTO 전수점검):**
> - 0-3: prompt-builder.ts 이미 존재 확인 → **스킵** (덮어쓰면 빌드 깨짐)
> - 0-2: NavBar `useNavigate`/`useProjectStore` import + `<Link>`→`<button>` JSX 교체 코드 보완
> - 0-4: `LLMRequest` → `ScriptGenerationRequest` 인터페이스명 정정
> - 0-4: ai-tts.ts `model`(TTS 엔진) vs `voiceId`(화자 ID) 역할 구분 주석 추가
> - 0-4: 각 프로바이더별 정확한 변경 행번호 + 변경 전/후 코드 명시
> - 파일 수: 5개 → 4개 (prompt-builder.ts 제외)

---

## Phase 0: 즉시 수정 + 기반 정리 (바로 구현 OK)

### 0-1. 기본 크레딧 50 → 100 상향
```typescript
// src/store/projectStore.ts
credits: 100,           // was: 50
resetCredits: () => set({ credits: 100 }),
```

### 0-2. NavBar "New Project" 클릭 시 startNewProject() 호출

> **CTO 보완 (v2.2):** 원래 스니펫에 import 변경과 JSX 교체가 누락되어 있었음. 아래 전체 코드 참조.

**파일:** `src/components/NavBar.tsx`

**① import 변경 (2줄 수정, 1줄 추가):**
```tsx
// 변경 전:
import { Link, useLocation } from 'react-router-dom';
// 변경 후:
import { Link, useLocation, useNavigate } from 'react-router-dom';

// 추가 (기존 import 블록에):
import { useProjectStore } from '../store/projectStore';
```

**② 컴포넌트 내부 — hook 추가 + 핸들러 정의:**
```tsx
// const { remaining } = useCredits(); 다음 줄에 추가:
const navigate = useNavigate();
const startNewProject = useProjectStore((s) => s.startNewProject);

const handleNewProject = () => {
    startNewProject('Untitled Project');
    navigate('/project/idea');
};
```

**③ JSX — `<Link>` → `<button>` 교체:**
```tsx
// 변경 전 (48~51행):
<Link to="/project/idea" className="btn-primary" style={{ fontSize: '0.75rem', padding: '6px 16px' }}>
    <Plus size={14} />
    New Project
</Link>

// 변경 후:
<button onClick={handleNewProject} className="btn-primary" style={{ fontSize: '0.75rem', padding: '6px 16px' }}>
    <Plus size={14} />
    New Project
</button>
```

### 0-3. ~~prompt-builder.ts 스텁 파일 생성~~ → ✅ 이미 존재, 스킵

> **CTO 점검 결과 (v2.2):** `src/services/prompt-builder.ts`는 이미 102줄짜리 파일로 존재함.
> - `PromptContext` 인터페이스 (객체 파라미터 패턴)
> - `buildImagePrompt(ctx: PromptContext)`, `buildVideoPrompt(ctx: PromptContext)`
> - `getDefaultNegativePrompt()`, `stylePromptPrefix` import 포함
> - StoryboardPage.tsx가 `buildImagePrompt({...객체...})` 형태로 호출 중
>
> **⛔ 절대 덮어쓰지 말 것** — plan의 구 스텁(개별 파라미터)으로 교체하면 빌드 깨짐.
> **조치:** 이 항목은 스킵. 수정 없음.

### 0-4. AI 서비스 모델 파라미터화 (CTO 추가)

> 현재 모든 AI 서비스가 모델을 하드코딩. Phase 6 전에 인터페이스만 미리 준비.
>
> **CTO 보완 (v2.2):** 인터페이스명 정정 + ai-tts.ts model/voiceId 역할 구분 주석 추가.

각 AI 서비스 Request 인터페이스에 `model?: string` 추가:

```typescript
// src/services/ai-image.ts — ImageGenerationRequest에 추가 (19행 style 뒤)
model?: string;  // AI 모델 ID (기본값: 'flux-schnell'). Phase 6에서 유저 선택 지원.

// src/services/ai-llm.ts — ⚠️ 인터페이스명: ScriptGenerationRequest (LLMRequest 아님!)
//   24행 style 뒤에 추가:
model?: string;  // AI 모델 ID (기본값: 'gpt-4o-mini'). Phase 6에서 유저 선택 지원.

// src/services/ai-video.ts — VideoGenerationRequest에 추가 (23행 sceneId 뒤)
model?: string;  // AI 모델 ID (기본값: 'gen3a_turbo'). Phase 6에서 유저 선택 지원.

// src/services/ai-tts.ts — TTSRequest에 추가 (27행 speed 뒤)
// ⚠️ voiceId(=음성 캐릭터 선택)와는 다른 역할!
// model = TTS 엔진/모델 (fish-speech, elevenlabs 등)
// voiceId = 해당 엔진 내 특정 화자 ID (이미 존재)
model?: string;  // TTS 엔진 모델 ID (기본값: 'fish-speech'). voiceId와 별개.
```

각 프로바이더의 generate 함수에서 `req.model`을 사용 (미지정 시 기존 하드코딩 값 폴백):
```typescript
// ai-image.ts — replicateProvider.generate() 내부 (88행)
// 변경 전: model: 'black-forest-labs/flux-schnell',
// 변경 후:
model: req.model || 'black-forest-labs/flux-schnell',

// ai-llm.ts — openaiProvider.generateScript() 내부 (128행)
// 변경 전: model: 'gpt-4o-mini',
// 변경 후:
model: req.model || 'gpt-4o-mini',

// ai-llm.ts — anthropicProvider.generateScript() 내부 (172행)
// 변경 전: model: 'claude-sonnet-4-20250514',
// 변경 후:
model: req.model || 'claude-sonnet-4-20250514',

// ai-video.ts — runwayProvider.generate() 내부 (90행)
// 변경 전: model: 'gen3a_turbo',
// 변경 후:
model: req.model || 'gen3a_turbo',

// ai-tts.ts — fishSpeechProvider는 모델 ID가 URL로 결정되므로, 현재 변경 불필요.
// Phase 6에서 다중 TTS 엔진 지원 시 활용.
```

**기존 동작 변화 없음** — model 미지정 시 기존 하드코딩 값이 기본값으로 사용.

**파일:** 4개 (`ai-image.ts`, `ai-llm.ts`, `ai-video.ts`, `ai-tts.ts`) — prompt-builder.ts는 스킵

---

## Phase 1: 인프라 개편 (CSS + Store + 네비게이션)

> CSS 분리 → Store v4 마이그레이션 → WorkflowSteps 2레벨 → 라우팅 정리

### 1-0. CSS 파일 분리 (CTO 추가)

> index.css 5,853줄 → 컴포넌트별 파일 분리. 이후 Phase에서 CSS 작업 효율 대폭 향상.

**분리 기준:** 페이지/컴포넌트 단위

```
src/index.css (글로벌만 남김 — 변수, 리셋, 유틸리티, 스크롤바)
src/components/NavBar.css
src/components/WorkflowSteps.css
src/pages/HomePage.css
src/pages/IdeaPage.css
src/pages/StoryboardPage.css
src/pages/TimelinePage.css
src/components/Modal.css
```

각 컴포넌트/페이지 파일 상단에 `import './ComponentName.css';` 추가.
Vite가 자동으로 번들링하므로 추가 설정 불필요.

### 1-0b. Store v4 마이그레이션 (CTO 추가)

> 새 필드를 Phase 2~6에서 쓰려면, 지금 한번에 마이그레이션하는 것이 효율적.

**파일:** `src/store/projectStore.ts`

```typescript
// 새 필드 추가 (기본값 포함)
entryPoint: null as 'script' | 'style' | 'cast' | null,
selectedPreset: null as string | null,
selectedDeck: [] as string[],      // 카드 ID 배열 (cardLibrary에서 선택)
aiModelPreferences: {
    script: 'gpt-4o-mini',
    image: 'flux-schnell',
    video: 'runway-gen3',
    tts: 'fish-speech',
},

// startNewProject에 추가:
startNewProject: (title) => set({
    // ...기존 필드...
    entryPoint: null,
    selectedPreset: null,
    selectedDeck: [],
    aiModelPreferences: {
        script: 'gpt-4o-mini',
        image: 'flux-schnell',
        video: 'runway-gen3',
        tts: 'fish-speech',
    },
}),

// 새 액션:
setEntryPoint: (ep) => set({ entryPoint: ep }),
setSelectedPreset: (preset) => set({ selectedPreset: preset }),
setSelectedDeck: (deck) => set({ selectedDeck: deck }),
setAiModelPreference: (category, modelId) =>
    set((s) => ({
        aiModelPreferences: { ...s.aiModelPreferences, [category]: modelId },
    })),

// persist 버전 업그레이드:
version: 4,

// migrate에 v3→v4 추가:
if (version < 4) {
    return {
        ...state,
        entryPoint: null,
        selectedPreset: null,
        selectedDeck: [],
        aiModelPreferences: {
            script: 'gpt-4o-mini',
            image: 'flux-schnell',
            video: 'runway-gen3',
            tts: 'fish-speech',
        },
    };
}

// partialize에 추가:
entryPoint: state.entryPoint,
selectedPreset: state.selectedPreset,
selectedDeck: state.selectedDeck,
aiModelPreferences: state.aiModelPreferences,
```

**데이터 안전성:** 기존 사용자의 localStorage v3 데이터 → 자동으로 v4 마이그레이션 (새 필드 기본값 추가). 기존 데이터 손실 없음.

### 1-1. WorkflowSteps 컴포넌트 리라이트

**파일:** `src/components/WorkflowSteps.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  ① Idea ────── ② Storyboard ────── ③ Generate ──── ④ Animate │
│            [대본 작성] · [스타일 선택]                          │
└─────────────────────────────────────────────────────────────┘
```

```tsx
interface MainStep {
    num: number;
    label: string;
    route: string;           // 클릭 시 이동할 경로
    subSteps: SubStep[];
}

interface SubStep {
    key: string;
    label: string;
}

const WORKFLOW: MainStep[] = [
    {
        num: 1, label: 'Idea', route: '/project/idea',
        subSteps: [
            { key: 'script', label: '대본 작성' },
            { key: 'style', label: '스타일 선택' },
        ],
    },
    {
        num: 2, label: 'Storyboard', route: '/project/storyboard',
        subSteps: [
            { key: 'cast-setup', label: '카드 선택' },
            { key: 'cut-split', label: '컷 분할' },
        ],
    },
    {
        num: 3, label: 'Generate', route: '/project/storyboard',
        subSteps: [
            { key: 'seed-match', label: '시드 매칭' },
            { key: 'image-gen', label: '이미지 생성' },
            { key: 'video-gen', label: '영상 생성' },
        ],
    },
    {
        num: 4, label: 'Animate', route: '/project/timeline',
        subSteps: [
            { key: 'timeline', label: '타임라인' },
            { key: 'tts', label: 'TTS' },
            { key: 'export', label: 'Export' },
        ],
    },
];

interface Props {
    currentMain: number;        // 1~4
    currentSub?: string;        // 하위 단계 key
    onMainClick?: (step: number) => void;
    onSubClick?: (key: string) => void;
}
```

### 1-2. IdeaPage — CAST 탭 제거 + 탭 UI 통일

**파일:** `src/pages/IdeaPage.tsx`

변경:
- `activeTab: 'script' | 'style' | 'cast'` → `activeTab: 'script' | 'style'`
- CAST 관련 JSX + 핸들러 전부 삭제
- 기존 SCRIPT>STYLE>CAST 텍스트 탭 UI 삭제 → WorkflowSteps 하위 단계가 대체
- IdeaPage 진입 시 mockCardLibrary 자동 주입은 유지

### 1-3. StoryboardPage — Phase Bar 통합

**파일:** `src/pages/StoryboardPage.tsx`

변경:
- 기존 Phase Bar (① 카드 선택 ② 컷 분할 ③ 시드매칭) 삭제
- WorkflowSteps의 하위 단계가 대체
- 상위 단계 2(Storyboard) ↔ 3(Generate) 전환:
  - cast-setup, cut-split → currentMain = 2
  - seed-match 이후 → currentMain = 3
- Export 버튼 → Phase 4 (Animate)로 이동

### 1-4. TimelinePage — WorkflowSteps props 업데이트

**파일:** `src/pages/TimelinePage.tsx`

변경: `currentStep={4}` → `currentMain={4}` + 하위 단계 연결

### 1-5. 중복 라우트 정리

**파일:** `src/App.tsx`

```tsx
// 제거:
// <Route path="/project/new" element={<IdeaPage />} />
// <Route path="/project/script" element={<IdeaPage />} />
// <Route path="/project/style" element={<IdeaPage />} />

// 추가:
<Route path="/cast" element={<CastPage />} />           // Phase 2에서 구현
<Route path="/settings" element={<SettingsPage />} />    // Phase 4에서 구현
<Route path="/admin" element={<AdminPage />} />          // Phase 5에서 구현
<Route path="*" element={<NotFoundPage />} />            // 404
```

### 1-6. CSS 정리

**파일:** `src/index.css`

- 기존 `.idea-tabs`, `.phase-bar` 스타일 → 삭제 또는 통합
- 새 WorkflowSteps 2레벨 스타일 추가:
  - 상위: 원형 번호 + 연결선 (현재와 유사)
  - 하위: 작은 도트 + 텍스트, 상위 아래에 한 줄

**총 파일:** 6개 (`WorkflowSteps.tsx`, `IdeaPage.tsx`, `StoryboardPage.tsx`, `TimelinePage.tsx`, `App.tsx`, `WorkflowSteps.css`)

> 1-6에서 CSS는 분리된 `WorkflowSteps.css`에 작성 (1-0에서 분리 완료).

---

## Phase 2: HomePage 3진입점 + CastPage (고객 여정의 핵심)

### ⚡ 카드 데이터 이중 구조 (CTO 명시)

> **cardLibrary** = 내 전체 카드 보관함 (프로젝트 간 공유, 전역)
> **selectedDeck** = 이번 프로젝트에 사용하는 카드 ID 목록 (프로젝트별, store에 저장)

```
cardLibrary (전역)                    selectedDeck (프로젝트별)
┌──────────────────────┐             ┌───────────────────┐
│ 🧑 군인A (card-001)   │  ──선택──→  │ ['card-001',      │
│ 🧑 과학자B (card-002) │             │  'card-003',      │
│ 🏔️ 폐허C (card-003)  │  ──선택──→  │  'card-005']      │
│ 🏙️ 도시D (card-004)  │             └───────────────────┘
│ ⚔️ 무기E (card-005)   │  ──선택──→
│ 🚗 차량F (card-006)   │
└──────────────────────┘
```

- CastPage에서 카드 생성 → cardLibrary에 추가
- CastPage에서 5장 선택 → selectedDeck에 ID 저장
- StoryboardPage에서 selectedDeck의 카드를 씬에 배정
- 다른 프로젝트 시작 → selectedDeck만 초기화, cardLibrary는 유지

### 2-1. HomePage 레이아웃 변경

**파일:** `src/pages/HomePage.tsx`

현재:
```
Hero → Filter → Hero Cards → Generate 옵션 3개 → 템플릿 그리드
```

변경:
```
┌─────────────────────────────────────────────────────┐
│ Hero: "What story will you tell today?"              │
├─────────────────────────────────────────────────────┤
│ 시작 방법 3가지 (메인 CTA):                          │
│                                                      │
│ ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│ │ ✍️ 대본   │  │ 🎨 스타일 │  │ 🎭 Cast  │           │
│ │  부터     │  │  부터     │  │  부터     │           │
│ │ 시작하기  │  │ 시작하기  │  │ 시작하기  │           │
│ └──────────┘  └──────────┘  └──────────┘            │
│                                                      │
│ [B] 스타일 선택 시 → 프리셋 그리드 확장:              │
│ ┌─────┐┌─────┐┌─────┐┌─────┐                        │
│ │Sci-Fi││Horror││Anime ││Drama │ ...                  │
│ └─────┘└─────┘└─────┘└─────┘                        │
├─────────────────────────────────────────────────────┤
│ [My Projects] (로그인 시)                             │
├─────────────────────────────────────────────────────┤
│ [My Cast] 미리보기 (카드 몇 장 + "전체 보기" 링크)    │
└─────────────────────────────────────────────────────┘
```

각 시작 버튼의 동작:
```
[A] 대본부터 시작:
  → startNewProject('Untitled')
  → navigate('/project/idea')  (Script 하위 단계)

[B] 스타일부터 시작:
  → 프리셋 그리드 표시/확장
  → 프리셋 클릭 → startNewProject(preset.name) + setSelectedStyle(preset.style) + ...
  → navigate('/project/idea')  (Script 하위 단계 — 스타일은 이미 선택됨)
  → IdeaPage 진입 시 프리셋 정보 팝업 표시

[C] Cast부터 시작:
  → navigate('/cast')  (CastPage)
  → AI로 배우/장소/아이템 생성 + 5장 선택
  → 선택 완료 → startNewProject('Untitled') + navigate('/project/idea')
```

### 2-2. CastPage 신규 생성

**파일:** `src/pages/CastPage.tsx` (신규)

```
┌─────────────────────────────────────────────────────┐
│ NavBar                                               │
├─────────────────────────────────────────────────────┤
│ 🎭 나의 배우 · 장소 · 아이템                          │
│                                                      │
│ [배우] [촬영 장소] [소품/아이템]  ← 타입 필터          │
├─────────────────────────────────────────────────────┤
│ 카드 그리드:                                          │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                  │
│ │ 😊 │ │ 🏔️ │ │ ⚔️ │ │ 😎 │ │ 🌃 │ ...             │
│ │이름 │ │이름 │ │이름 │ │이름 │ │이름 │                │
│ │선택☑│ │    │ │선택☑│ │    │ │선택☑│                │
│ └────┘ └────┘ └────┘ └────┘ └────┘                  │
│                                                      │
│ 선택됨: 3/5  ← 최대 5장 선택 가능                     │
├─────────────────────────────────────────────────────┤
│ [+ AI로 새 카드 생성]                                 │
│                                                      │
│ ┌──────── AI 생성 패널 ────────┐                      │
│ │ 타입: [배우] [장소] [소품]    │                      │
│ │ 이름: [입력]                  │                      │
│ │ 프롬프트: [textarea]          │                      │
│ │ AI 모델: [Flux ▼]            │                      │
│ │ [✨ 생성하기]                 │                      │
│ └──────────────────────────────┘                      │
├─────────────────────────────────────────────────────┤
│         [5장 선택 완료 → 프로젝트 시작하기]            │
│         (또는 "라이브러리만 관리하기")                  │
└─────────────────────────────────────────────────────┘
```

**2가지 모드:**
1. **프로젝트 시작 모드** (HomePage [C]에서 진입): 5장 선택 → "프로젝트 시작하기" 버튼 → IdeaPage
2. **라이브러리 관리 모드** (NavBar "My Cast"에서 진입): 카드 생성/삭제/편집만, 프로젝트 시작 불필요

모드 구분: URL 파라미터 또는 store 플래그 (`?mode=project` vs 기본)

**핵심 기능:**
- ✅ 기존 IdeaPage CAST 탭 코드 이동 (카드 그리드, 필터, 삭제)
- ✅ **AI 이미지 생성** (기존 `generateImage()` 서비스 활용)
  - 타입 선택 + 이름 + 프롬프트 → AI 이미지 생성 → 카드로 추가
  - 크레딧 차감 (image: 1)
- ✅ **5장 선택** 기능 (체크박스 + 카운터)
- ✅ cardLibrary store와 동기화

### 2-3. Store 변경 — 선택 옵션 영속화

**파일:** `src/store/projectStore.ts`

새 상태 추가:
```typescript
// 프로젝트 시작 시 선택한 옵션들 (어떤 진입점이든 저장)
entryPoint: 'script' | 'style' | 'cast' | null;  // 어디서 시작했는지
selectedPreset: string | null;                     // 선택한 스타일 프리셋 이름
selectedDeck: string[];                            // Cast에서 선택한 5장의 카드 ID
aiModelPreferences: {                              // 단계별 AI 모델 선택 (사용자 선택 가능한 3+1개만)
    script: string;   // 🔓 대본 AI: 'gpt-4o-mini' | 'claude-3-haiku' | ...
    image: string;    // 🔓 이미지 AI: 'flux-schnell' | 'sdxl' | ...
    video: string;    // 🔓 영상 AI: 'runway-gen3' | 'kling' | ...
    tts: string;      // 🔓 TTS: 'fish-speech' | 'elevenlabs' | ...
    // 🔒 promptBuilder는 여기에 포함하지 않음 — Admin 전용, settingsStore에서 관리
};

// partialize에 추가 (persist 대상):
entryPoint, selectedPreset, selectedDeck, aiModelPreferences
```

### 2-4. 프리셋 팝업 (스타일 시작 시)

**파일:** `src/components/PresetInfoModal.tsx` (신규)

스타일 프리셋에서 시작한 경우 → IdeaPage 진입 시 팝업:
```
┌─────────── 🎬 Sci-Fi Trailer 프리셋 ───────────┐
│                                                  │
│ 📐 영상 비율: 16:9 (변경 가능)                   │
│ 🎨 기본 스타일: Cinematic (변경 가능)            │
│ 👥 추천 캐스트: 캐릭터 3, 배경 2, 아이템 1       │
│ 🤖 AI 모델: GPT-4o / Flux / Runway              │
│ 🖼️ 이미지 프롬프트 프리셋 적용됨                │
│ 🎥 영상 프롬프트 프리셋 적용됨                   │
│                                                  │
│ ℹ️ 모든 설정은 이후 단계에서 변경할 수 있습니다  │
│                                                  │
│ [프리셋 적용하기]      [직접 설정하기]             │
└──────────────────────────────────────────────────┘
```

### 2-5. 프리셋 데이터

**파일:** `src/data/stylePresets.ts` (신규)

```typescript
export interface StylePreset {
    id: string;
    name: string;                    // 'Sci-Fi Trailer'
    category: string;                // 'SCI-FI'
    style: string;                   // 'Cinematic' (스타일 12종 중)
    aspectRatio: '16:9' | '9:16' | '1:1';
    description: string;
    promptPrefix: {
        image: string;               // 이미지 생성 프롬프트 prefix
        video: string;               // 영상 생성 프롬프트 prefix
        script: string;              // 대본 생성 시 AI에게 줄 지시
    };
    recommendedCast: {
        characters: number;
        backgrounds: number;
        items: number;
    };
    defaultModels: {
        script: string;
        image: string;
        video: string;
        tts: string;
    };
    thumbnail?: string;              // 프리셋 썸네일 이미지
    visibility: 'public' | 'soon' | 'hidden';  // Admin에서 관리
}
```

### 2-6. NavBar 업데이트

**파일:** `src/components/NavBar.tsx`

```tsx
// 추가:
<Link to="/cast" className="navbar__nav-item">
    <Users size={14} />
    My Cast
</Link>
// Settings 버튼 → /settings 링크로 변경
<Link to="/settings" className="navbar__nav-item">
    <Settings size={15} />
    Settings
</Link>
```

**총 파일:** ~8개 (`HomePage.tsx`, `CastPage.tsx`(신규), `PresetInfoModal.tsx`(신규), `stylePresets.ts`(신규), `projectStore.ts`, `NavBar.tsx`, `App.tsx`, 각 CSS 파일)

---

## Phase 2.5: StoryboardPage 리팩토링 (CTO 추가 — Phase 3 선행 필수)

> StoryboardPage.tsx 685줄 + 25+ useState → Phase 3에서 UI 추가 시 900줄+ 위험.
> **먼저 분리 → 깨끗한 상태에서 기능 추가.**

### 2.5-1. 컴포넌트 분리

현재 StoryboardPage.tsx의 3개 Phase를 독립 컴포넌트로 추출:

```
src/pages/StoryboardPage.tsx (300줄 → 메인 레이아웃 + Phase 라우팅만)
src/components/storyboard/
  ├ CastSetupPhase.tsx    (~150줄) ← cast-setup 로직 + UI
  ├ CutSplitPhase.tsx     (~120줄) ← cut-split 로직 + UI
  ├ SeedCheckPhase.tsx    (~200줄) ← seed-check + 이미지/영상 생성
  ├ DeckPanel.tsx         (~80줄)  ← 덱 카드 표시 (좌측 패널)
  └ ManualCardModal.tsx   (기존)   ← 카드 추가 모달
```

### 2.5-2. 커스텀 훅 추출

반복되는 로직을 훅으로 분리:

```typescript
// src/hooks/useDeck.ts — 덱 관리 (추가/제거/필터)
export function useDeck() {
    // deck, poolTab, poolFilter, addType, deckChars, deckBgs, deckItems
    // addToDeck, removeFromDeck, ...
}

// src/hooks/useGeneration.ts — 이미지/영상 생성 상태 관리
export function useGeneration() {
    // sceneGenStatus, videoGenStatus, handleGenerateImage, handleGenerateVideo
    // handleBatchGenerate, ...
}
```

### 2.5-3. 검증 기준

- [ ] StoryboardPage.tsx가 350줄 이하
- [ ] 각 Phase 컴포넌트가 독립적으로 렌더 가능
- [ ] 기존 기능(카드 선택, 컷 분할, 시드 매칭, 이미지/영상 생성) 100% 동일 동작
- [ ] `npm run build` 성공

**총 파일:** ~7개 (`StoryboardPage.tsx` 리팩토링, `CastSetupPhase.tsx`(신규), `CutSplitPhase.tsx`(신규), `SeedCheckPhase.tsx`(신규), `DeckPanel.tsx`(신규), `useDeck.ts`(신규), `useGeneration.ts`(신규))

---

## Phase 3: StoryboardPage UI 개선

> 사용자 피드백: U5, U7, U8

### 3-1. Phase 2 (컷 분할)에 카드 덱 좌측 표시

```
┌─── 카드 덱 (5장) ──┬──── 컷 리스트 ──────────────────┐
│ [배우1][배우2]       │ [01] 씬 텍스트... [1][2][3]    │
│ [배우3]              │ [02] 씬 텍스트... [1][2][3]    │
│ ──────              │ [03] ...                        │
│ [장소1]              │                                │
│ ──────              │                                │
│ [소품1]              │                                │
└─────────────────────┴────────────────────────────────┘
```

### 3-2. Phase 3 서브로우 (1-1, 1-2, 1-3 등)

videoCountPerScene에 따라 서브로우 표시:
```
01     [이미지][씨드카드][대본][프롬프트][영상]
01-2   [이미지][씨드카드][  ][프롬프트][영상]
01-3   [이미지][씨드카드][  ][프롬프트][영상]
02     [이미지][씨드카드][대본][프롬프트][영상]
03     [이미지][씨드카드][대본][프롬프트][영상]
03-2   [이미지][씨드카드][  ][프롬프트][영상]
```

### 3-3. 미리보기 박스 2배 + 씨드카드 겹침 + 재생성 오버레이

```css
/* 이미지/영상 박스: 150px → 300px */
.scene-row__image { width: 300px; height: 300px; }

/* 씨드카드: 작은 원형, 겹침 */
.seed-cards-stack .seed-card {
    width: 48px; height: 48px;
    border-radius: 50%;
    margin-left: -12px;
}

/* 재생성: 이미지 hover 시 오버레이 */
.scene-row__image:hover .regenerate-overlay { opacity: 1; }
```

**총 파일:** 2개 (`StoryboardPage.tsx`, `index.css`)

---

## Phase 4: 크레딧 2계층 시스템 + SettingsPage + BYOK

> 크레딧 비용 = 플랫폼 이용료(항상) + AI API 비용(BYOK 시 면제)
> 상세: `.plans/VISION.md` §5 참조

### 4-1. 크레딧 비용 데이터 구조

**파일:** `src/data/creditCosts.ts` (신규)

```typescript
export interface CreditCost {
    platformFee: number;    // 플랫폼 이용료 (항상 차감)
    apiCost: number;        // AI API 비용 (BYOK 시 면제)
    total: number;          // platformFee + apiCost (기본 사용자)
    totalByok: number;      // platformFee만 (BYOK 사용자)
}

export type GenerationAction =
    | 'script'    // 대본 AI 생성
    | 'image'     // 이미지 생성
    | 'video'     // 영상 생성
    | 'tts'       // TTS 음성
    | 'card';     // Cast 카드 AI 생성

export const CREDIT_COSTS: Record<GenerationAction, CreditCost> = {
    script: { platformFee: 1, apiCost: 1, total: 2, totalByok: 1 },
    image:  { platformFee: 1, apiCost: 2, total: 3, totalByok: 1 },
    video:  { platformFee: 2, apiCost: 8, total: 10, totalByok: 2 },
    tts:    { platformFee: 1, apiCost: 1, total: 2, totalByok: 1 },
    card:   { platformFee: 1, apiCost: 2, total: 3, totalByok: 1 },
};
// Admin 페이지에서 이 값들을 조정 가능하게 설계
```

### 4-2. useCredits 훅 수정

**파일:** `src/hooks/useCredits.ts`

```typescript
// 기존: 단순 비용
// 변경: BYOK 여부에 따라 비용 분기

const getCost = (action: GenerationAction): number => {
    const cost = CREDIT_COSTS[action];
    const hasByok = hasApiKeyForAction(action); // settingsStore에서 확인
    return hasByok ? cost.totalByok : cost.total;
};

const canAfford = (action: GenerationAction, count = 1): boolean => {
    return credits >= getCost(action) * count;
};

const spend = (action: GenerationAction, count = 1): boolean => {
    const cost = getCost(action) * count;
    return spendCredits(cost);
};
```

### 4-3. SettingsPage 신규 생성

**파일:** `src/pages/SettingsPage.tsx` (신규)

```
┌─────────────────────────────────────────────────────┐
│ ⚙️ Settings                                          │
├─────────────────────────────────────────────────────┤
│                                                      │
│ 💰 크레딧                                            │
│ ├ 현재 잔액: 87 크레딧                                │
│ ├ 이번 달 사용량: 13 / 100                            │
│ └ [크레딧 충전하기]                                   │
│                                                      │
│ 📋 구독 플랜                                          │
│ ├ 현재: Free (100 크레딧/월)                          │
│ ├ Pro: ₩19,900/월 (1,000 크레딧)                      │
│ └ Enterprise: ₩99,000/월 (5,000 크레딧)               │
│   [플랜 변경하기]                                     │
│                                                      │
│ 💳 크레딧 비용 안내                                    │
│ ┌──────────┬──────────┬──────────┐                   │
│ │ 작업      │ 기본비용  │ BYOK비용  │                   │
│ │ 대본 생성  │ 2 크레딧 │ 1 크레딧  │                   │
│ │ 이미지 생성│ 3 크레딧 │ 1 크레딧  │                   │
│ │ 영상 생성  │ 10 크레딧│ 2 크레딧  │                   │
│ │ TTS 음성  │ 2 크레딧 │ 1 크레딧  │                   │
│ └──────────┴──────────┴──────────┘                   │
│ ℹ️ BYOK: 본인 API 키 사용 시 AI 비용 면제,            │
│    플랫폼 이용료만 차감됩니다.                          │
│                                                      │
│ 🔑 API 키 (BYOK)                                     │
│ ├ OpenAI: sk-****...****                [수정][삭제]  │
│ ├ Replicate: r8_****                    [수정][삭제]  │
│ ├ Runway: (미설정)                      [추가]        │
│ └ Fish Speech: (미설정)                 [추가]        │
│   ⚠️ API 키는 이 브라우저에만 저장됩니다               │
│                                                      │
│ 👤 계정                                               │
│ ├ 이메일: user@gmail.com                              │
│ ├ 로그인 방식: Google                                 │
│ └ [계정 삭제]                                         │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 4-4. BYOK Store

**파일:** `src/store/settingsStore.ts` (신규)

```typescript
interface SettingsState {
    apiKeys: {
        openai?: string;
        anthropic?: string;
        replicate?: string;
        runway?: string;
        fishSpeech?: string;
        [provider: string]: string | undefined;
    };
    setApiKey: (provider: string, key: string) => void;
    removeApiKey: (provider: string) => void;
    hasApiKey: (provider: string) => boolean;

    // BYOK 여부를 GenerationAction으로 조회
    hasApiKeyForAction: (action: GenerationAction) => boolean;
    // action → provider 매핑 (AI 모델에 따라 달라짐):
    // script → openai | anthropic
    // image  → replicate
    // video  → runway
    // tts    → fishSpeech
}
```

### 4-5. AI 서비스 수정

각 AI 서비스 파일에서 BYOK 체크 + 크레딧 분기:
```typescript
// 예: src/services/ai-image.ts
const settingsStore = useSettingsStore.getState();
const apiKey = settingsStore.apiKeys.replicate || import.meta.env.VITE_REPLICATE_KEY;
// 크레딧 차감은 useCredits.spend('image')에서 자동으로 BYOK 분기됨
```

### 4-6. MVP 보안 노트

- API 키는 클라이언트 localStorage에 저장 (MVP)
- 보안 경고 표시: "API 키는 이 브라우저에만 저장됩니다"
- Phase 2 프로덕트에서 Supabase Edge Functions + 서버사이드 암호화로 이전

**총 파일:** ~7개 (`SettingsPage.tsx`(신규), `settingsStore.ts`(신규), `creditCosts.ts`(신규), `useCredits.ts`, `App.tsx`, `NavBar.tsx`, `index.css`)

---

## Phase 5: AdminPage (Dev 전용)

### 5-1. AdminPage 신규 생성

**파일:** `src/pages/AdminPage.tsx` (신규)

```
┌─────────────────────────────────────────────────────┐
│ 🔧 Admin Panel (Dev Only)                            │
├─────────────────────────────────────────────────────┤
│                                                      │
│ 📝 프롬프트 템플릿 관리                               │
│ ├ 대본 생성 프롬프트: [textarea]     [저장]           │
│ ├ 이미지 생성 프롬프트: [textarea]   [저장]           │
│ ├ 영상 생성 프롬프트: [textarea]     [저장]           │
│ └ TTS 프롬프트: [textarea]           [저장]           │
│                                                      │
│ 🎨 스타일 프리셋 관리                                 │
│ ┌──────────┬──────────┬──────────┐                   │
│ │ Sci-Fi   │ Horror   │ Anime    │ ...               │
│ │ [공개]   │ [Soon]   │ [숨김]   │                   │
│ └──────────┴──────────┴──────────┘                   │
│ 각 프리셋: 이름, 스타일, 프롬프트, 모델, 비율 편집     │
│ 공개상태: [공개 ▼] / [곧 출시 ▼] / [숨김 ▼]          │
│                                                      │
│ 🤖 AI 모델 설정                                       │
│ ├ 사용 가능한 모델 목록 관리                           │
│ ├ 기본 모델 설정 (프리셋별 오버라이드)                  │
│ └ 🔒 프롬프트 생성 AI 모델 선택 + 메타 프롬프트 편집    │
│                                                      │
│ 📊 시스템 현황                                        │
│ ├ 총 사용자: N명                                      │
│ ├ 오늘 생성 이미지: N개                                │
│ └ 크레딧 소비: N 크레딧                                │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### 5-2. 접근 제어

```typescript
// AdminPage 상단:
const { user } = useAuth();
const ADMIN_EMAILS = ['wofou7@gmail.com']; // .env에서 관리
if (!user || !ADMIN_EMAILS.includes(user.email)) {
    return <Navigate to="/" />;
}
```

### 5-3. Admin 데이터 저장

- MVP: localStorage 또는 Supabase 테이블 (`admin_settings`)
- 프리셋 공개/비공개 → stylePresets.ts의 `visibility` 필드와 연동

**총 파일:** ~3개 (`AdminPage.tsx`(신규), `App.tsx`, `index.css`)

---

## Phase 6: AI 모델 선택 시스템

> AI 모델은 **4개 카테고리**: 3개 사용자 선택 + 1개 내부 전용
> 상세: `.plans/VISION.md` §4 참조

### 6-1. 4가지 AI 카테고리 구조

```
🔓 사용자 선택 가능 (UI에 드롭다운 노출):
  ├ 대본 AI      → 대본 작성/수정 (GPT-4o Mini, Claude 3 Haiku, ...)
  ├ 이미지 AI    → 씬/카드 이미지 생성 (Flux Schnell, SDXL, ...)
  └ 영상 AI      → 이미지→영상 변환 (Runway Gen-3, Kling AI, ...)

🔒 내부 전용 (사용자에게 노출 안 됨):
  └ 프롬프트 생성 AI → 유저 옵션/프리셋 → 최적화된 프롬프트 자동 생성
                       Admin에서만 모델 변경 가능
```

**프롬프트 생성 AI의 역할:**
- 사용자가 선택한 스타일, 캐스트, 씬 대본, 프리셋 값을 입력받아
- 이미지 AI / 영상 AI / 대본 AI에 전달할 **최적화된 프롬프트를 자동 생성**
- 현재 `stylePromptPrefix` 등이 하드코딩된 것 → 이 AI가 동적으로 생성하는 구조로 전환
- 크레딧: 프롬프트 생성 자체는 별도 크레딧 차감 없음 (플랫폼 내부 비용)

### 6-2. 모델 선택 UI

사용자 선택 가능한 3개 카테고리에만 드롭다운 표시:

```
[대본 생성] 중...
대본 AI: [GPT-4o Mini ▼]  ← 클릭 시 옵션: GPT-4o Mini, Claude 3 Haiku, ...

[이미지 생성] 중...
이미지 AI: [Flux Schnell ▼]  ← 클릭 시 옵션: Flux, SDXL, DALL-E 3, ...

[영상 생성] 중...
영상 AI: [Runway Gen-3 ▼]  ← 클릭 시 옵션: Runway, Kling AI, Pika, ...
```

TTS 음성은 Animate 단계에서 별도 선택 (Fish Speech, ElevenLabs 등).

### 6-3. 모델 레지스트리

**파일:** `src/data/aiModels.ts` (신규)

```typescript
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
    provider: string;          // 'replicate' | 'openai' | 'anthropic' | ...
    category: AIModelCategory;
    creditCost: number;
    requiresByok?: string;     // BYOK 필요한 프로바이더
    isDefault?: boolean;
    isInternal?: boolean;      // true면 사용자 UI에 노출 안 됨
}

export const AI_MODELS: AIModel[] = [
    // 🔓 대본 AI (사용자 선택)
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', category: 'script', creditCost: 1, isDefault: true },
    { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'anthropic', category: 'script', creditCost: 1 },
    { id: 'gemini-flash', name: 'Gemini Flash', provider: 'google', category: 'script', creditCost: 1 },

    // 🔓 이미지 AI (사용자 선택)
    { id: 'flux-schnell', name: 'Flux Schnell', provider: 'replicate', category: 'image', creditCost: 1, isDefault: true },
    { id: 'sdxl', name: 'SDXL', provider: 'replicate', category: 'image', creditCost: 2 },
    { id: 'dall-e-3', name: 'DALL-E 3', provider: 'openai', category: 'image', creditCost: 2 },

    // 🔓 영상 AI (사용자 선택)
    { id: 'runway-gen3', name: 'Runway Gen-3', provider: 'runway', category: 'video', creditCost: 3, isDefault: true },
    { id: 'kling-ai', name: 'Kling AI', provider: 'kling', category: 'video', creditCost: 3 },
    { id: 'pika', name: 'Pika', provider: 'pika', category: 'video', creditCost: 3 },

    // 🔓 TTS (사용자 선택, Animate 단계)
    { id: 'fish-speech', name: 'Fish Speech', provider: 'fish', category: 'tts', creditCost: 1, isDefault: true },
    { id: 'elevenlabs', name: 'ElevenLabs', provider: 'elevenlabs', category: 'tts', creditCost: 2 },

    // 🔒 프롬프트 생성 AI (내부 전용 — 사용자 선택 불가)
    { id: 'prompt-builder-default', name: 'GPT-4o Mini (내부)', provider: 'openai', category: 'prompt-builder', creditCost: 0, isInternal: true, isDefault: true },
];

/** 사용자에게 노출되는 모델만 필터 */
export const getUserSelectableModels = (category: AIModelCategory) =>
    AI_MODELS.filter(m => m.category === category && !m.isInternal);

/** Admin에서 프롬프트 생성 AI 모델 변경 */
export const getPromptBuilderModels = () =>
    AI_MODELS.filter(m => m.category === 'prompt-builder');
```

### 6-4. 프리셋별 기본 모델 오버라이드

StylePreset에 `defaultModels` 필드가 있으므로:
- 프리셋 적용 시 → `aiModelPreferences`에 프리셋 기본 모델 세팅
- 유저가 대본 AI / 이미지 AI / 영상 AI를 자유롭게 변경 가능 (드롭다운)
- 프롬프트 생성 AI는 AdminPage에서만 변경 가능

### 6-5. 프롬프트 생성 파이프라인 (내부)

```
사용자 입력                           프롬프트 생성 AI                    최종 AI
──────────────                      ─────────────────                  ───────────
스타일: Sci-Fi                       │                                │
캐스트: [군인, 폐허, 무기]    ──→    │ 최적화된 프롬프트 생성  ──→     │ 이미지 AI
씬 대본: "폐허 속 군인이..."         │ (스타일+캐스트+대본 조합)        │ (Flux 등)
프리셋 프롬프트 prefix               │                                │
```

- 현재: `stylePromptPrefix + 씬 대본` 단순 결합
- 목표: 프롬프트 생성 AI가 컨텍스트를 분석하여 더 높은 품질의 프롬프트 생성
- Admin에서 프롬프트 생성 AI의 시스템 프롬프트(메타 프롬프트) 편집 가능

**총 파일:** ~6개 (`aiModels.ts`(신규), `IdeaPage.tsx`, `StoryboardPage.tsx`, `TimelinePage.tsx`, `projectStore.ts`, `AdminPage.tsx`)

---

## Phase 7: 데이터 안정성 + 페이지 정리 (마무리)

### 7-1. 데이터 안정성

| 항목 | 현재 | 목표 |
|------|------|------|
| 게스트→로그인 데이터 병합 | DB로 덮어씀 | 충돌 시 선택 모달 |
| StoryboardPage 상태 | 로컬 state만 | store + DB 영속 |
| TimelinePage 상태 | 로컬 state만 | store + DB 영속 |
| 자동 저장 실패 | console만 | 토스트 알림 |

### 7-2. 페이지 정리

- Upgrade 버튼 → /settings로 링크
- Export 빈 동작 → disabled + "Animate 단계에서 이용 가능"
- 404 페이지 추가
- 전체 레이아웃 간격/폰트 통일

---

## 구현 순서 & 예상 시간 (v2.1 — CTO 검토 반영)

| 순서 | Phase | 예상 시간 | 파일 수 | 의존성 |
|------|-------|----------|---------|--------|
| 1 | **Phase 0**: 즉시 수정 + 기반 정리 | 30분 | 5개 (1신규) | 없음 |
| 2 | **Phase 1**: 인프라 개편 (CSS+Store+Nav) | 3~4시간 | 10+개 (CSS 분리) | Phase 0 |
| 3 | **Phase 2**: HomePage + CastPage | 3~4시간 | 8개 (3신규) | Phase 1 |
| 4 | **Phase 2.5**: StoryboardPage 리팩토링 | 2~3시간 | 7개 (5신규) | Phase 1 |
| 5 | **Phase 3**: StoryboardPage UI 개선 | 1~2시간 | 3~4개 | Phase 2.5 |
| 6 | **Phase 4**: SettingsPage + BYOK | 2~3시간 | 5개 (2신규) | Phase 0 |
| 7 | **Phase 5**: AdminPage | 1~2시간 | 3개 (1신규) | Phase 2 |
| 8 | **Phase 6**: AI 모델 선택 | 1~2시간 | 5개 (1신규) | Phase 0, 4 |
| 9 | **Phase 7**: 안정성 + 정리 | 2~3시간 | 다수 | 전체 |

**총 예상:** 약 16~23시간

> Phase 6이 v2보다 짧아진 이유: Phase 0에서 AI 모델 인터페이스를 미리 파라미터화하므로 UI만 추가하면 됨.

### 추천: Phase별 독립 커밋 + 검증

각 Phase 완료 후:
1. `npm run build` 통과 확인
2. 브라우저 수동 테스트
3. git commit
4. 다음 Phase로

---

## MVP 범위 확인

### ✅ MVP에 포함 (이 plan에 있는 것)

- 3가지 시작점 (대본/스타일/Cast)
- WorkflowSteps 2레벨 통일
- CastPage (AI 생성 + 5장 선택)
- SettingsPage (크레딧 + BYOK)
- AdminPage (프롬프트/프리셋 관리)
- AI 모델 선택

### ❌ MVP 이후 (이 plan 범위 밖)

- UGC 마켓플레이스 (유저 프리셋 판매)
- 크레딧 수익 공유 시스템
- Stripe/토스 결제 연동 (Phase 4에서 UI만, 결제 로직은 이후)
- 서버사이드 API 키 암호화
- 모니터링 (Sentry, Analytics)

---

## 사용자 결정 사항 (✅ 모두 해결)

| 질문 | 결정 | 날짜 |
|------|------|------|
| CastPage URL | ✅ `/cast` | 2026-02-27 |
| Cast 완료 후 이동 | ✅ IdeaPage (Script) — 대본 작성부터 | 2026-02-27 |
| Phase 실행 순서 | ✅ Phase 0 → 1 → 2 → ... 순서대로 | 2026-02-27 |

---

## 검토 상태

- [x] v2 전면 개편 (3진입점, Cast AI, Settings, Admin)
- [x] 2계층 크레딧 시스템 (플랫폼 이용료 + AI API 비용)
- [x] AI 모델 4카테고리 (3개 유저선택 + 1개 내부 프롬프트 생성)
- [x] Admin 이메일: wofou7@gmail.com
- [x] 사용자 결정 3건 완료
- [x] CTO 검토 6건 반영 (v2 → v2.1):
  - [x] prompt-builder.ts 스텁 (Phase 0)
  - [x] AI 서비스 모델 파라미터화 (Phase 0)
  - [x] CSS 파일 분리 (Phase 1)
  - [x] Store v4 마이그레이션 (Phase 1)
  - [x] cardLibrary/selectedDeck 이중 구조 명시 (Phase 2)
  - [x] StoryboardPage 리팩토링 (Phase 2.5 신설)

**상태: 🟡 최종 승인 대기**

---

*⚠️ 아직 구현하지 않습니다. 사용자 최종 승인 후 Phase 0부터 진행.*
