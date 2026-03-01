# Round 1 영향도 분석 (Impact Analysis)

> 작성: 린 (FE Architect, 2026-02-28)
> 근거: plan-round1.md 6건 수정 사항에 대한 코드 읽기 분석
> 원칙: 코드만 읽고 분석. 수정하지 않음.

---

## 분석 대상 파일 목록

| 파일 | 역할 |
|------|------|
| `src/pages/StoryboardPage.tsx` | handleAiAnalysis, 제목 하드코딩 |
| `src/pages/IdeaPage.tsx` | selectedPreset null 초기화, 모달 재표시 |
| `src/pages/TimelinePage.tsx` | TTS 크레딧 타입, handleNarrativeTTS |
| `src/pages/HomePage.tsx` | handlePresetSelect |
| `src/data/stylePresets.ts` | style 값 대소문자 |
| `src/hooks/useCredits.ts` | tts 타입 처리 |
| `src/hooks/useDeck.ts` | MAX_AI_SLOTS 상수 |
| `src/services/prompt-builder.ts` | capitalize 함수, stylePromptPrefix |
| `src/data/mockData.ts` | stylePromptPrefix, artStyles |
| `src/store/projectStore.ts` | selectedStyle 기본값 |
| `src/components/PresetInfoModal.tsx` | handleApply 내 setSelectedStyle |
| `src/components/storyboard/SeedCheckPhase.tsx` | stylePromptPrefix 참조 |

---

## 수정 1: recommendedCast 연결 (StoryboardPage handleAiAnalysis)

### 현재 코드 상태 확인

**`selectedPreset`** — StoryboardPage L23에서 이미 destructuring하고 있음:
```typescript
const { selectedStyle, scenes: storeScenes, cardLibrary, addToCardLibrary,
    aiModelPreferences, setAiModelPreference, mode,
    narrationStep, setNarrationStep, narrationClips, setNarrationClips,
    selectedPreset, aspectRatio,
} = useProjectStore();
```
→ 이미 읽고 있음. 추가 import 불필요.

**`getPresetById`** — StoryboardPage 상단 import 목록 확인:
```typescript
import { mockStoryboardScenes, mockScript, aiSuggestedCards } from '../data/mockData';
```
→ `getPresetById`는 현재 import되어 있지 **않음**. plan.md에서 추가 import 필요하다고 명시되어 있음. 이건 올바른 판단.

**`MAX_AI_SLOTS`** — StoryboardPage L11에서 이미 import됨:
```typescript
import { useDeck, MAX_AI_SLOTS } from '../hooks/useDeck';
```
→ `useDeck.ts`에서 `export const MAX_AI_SLOTS = 5`로 정의. 스킵 케이스(L64)에서 현재 사용 중.

**렌더링 사이클 영향 분석:**
- `handleAiAnalysis`는 클릭 이벤트 핸들러 내부의 `setTimeout` 콜백에서 실행됨
- `preset = getPresetById(selectedPreset)`은 렌더링 중에 호출되는 것이 아닌, 이벤트 핸들러 내부에서 호출됨
- `getPresetById`는 localStorage 읽기 + 배열 검색만 하므로 순수 함수. 렌더링 사이클에 영향 없음.

**`MAX_AI_SLOTS` 상수 변경 시 영향:**
- plan.md는 MAX_AI_SLOTS 상수를 변경하지 않음. 단지 `castConfig`를 통해 실제 슬롯 수를 동적으로 계산하는 것
- 스킵 케이스의 `aiSuggestedCards.slice(0, MAX_AI_SLOTS)` → `aiSuggestedCards.slice(0, totalSlots)`로 변경
- `useDeck.ts`의 `MAX_AI_SLOTS = 5`는 덱 최대 AI 슬롯 제한으로 여전히 사용됨. **충돌 없음**
- 단, totalSlots(castConfig 합계)이 MAX_AI_SLOTS(5)를 초과할 수 있는 경우가 존재:
  - 예: martial-arts-cinematic의 recommendedCast = `{ characters: 3, backgrounds: 2, items: 2 }` → totalSlots = 7
  - `aiSuggestedCards`는 현재 5개(ai-c1, ai-c2, ai-c3, ai-b1, ai-i1)뿐이므로, slice(0, 7)은 실질적으로 slice(0, 5)와 동일. 에러는 없으나, 충분한 카드가 없을 수 있음.

### 결론

| 항목 | 상태 |
|------|------|
| 사이드 이펙트 | **없음** |
| 추가 수정 필요 | `getPresetById` import 추가 (plan.md에 이미 명시됨) |
| 주의 사항 | totalSlots > MAX_AI_SLOTS인 프리셋에서 aiSuggestedCards 부족 가능 (현재 5개 고정). 기능적 버그가 아닌 UX 제한 사항 |

---

## 수정 2: selectedPreset null 초기화 제거 (IdeaPage)

### 핵심 질문: 모달이 반복 표시되는가?

**현재 useEffect (IdeaPage L90~94):**
```typescript
useEffect(() => {
    if (selectedPreset) {
        setShowPresetModal(true);
    }
}, [selectedPreset]);
```

**수정 후:** `setSelectedPreset(null)` 제거 → `selectedPreset`이 유지된 상태로 페이지에 머묾.

**시나리오 분석:**

1. **모달 적용 후 IdeaPage 내에서 탭 전환 (script → style → script):**
   - `selectedPreset`은 store에 유지됨 (소문자 변경 없음)
   - useEffect 의존성 `[selectedPreset]`은 값이 변하지 않으므로 재실행되지 않음
   - 모달이 다시 뜨지 않음. 안전함.

2. **IdeaPage → StoryboardPage → IdeaPage 뒤로가기:**
   - `selectedPreset`은 store(persist)에 유지됨
   - IdeaPage 재마운트 시 useEffect가 실행됨
   - `selectedPreset`이 truthy이면 `setShowPresetModal(true)` → **모달이 다시 표시됨**
   - 이것이 plan.md에서 `hasShownPresetModal` 로컬 상태를 추가하는 이유

3. **다른 프리셋을 STYLE 탭에서 선택할 때:**
   - IdeaPage STYLE 탭 L458~460:
     ```typescript
     onClick={() => {
         setSelectedPreset(preset.id);
         setSelectedStyle(preset.style);
     }}
     ```
   - 새 preset.id로 변경되면 useEffect가 다시 실행됨 → 새 프리셋의 모달 표시
   - **이건 의도된 동작.** 단, `hasShownPresetModal`이 추가되면 최초 1회만 표시되므로 두 번째 선택은 모달이 안 뜸
   - 이는 사용자가 프리셋을 바꿀 때 모달을 다시 볼 수 없게 되는 문제. **주의 필요**.

### `hasShownPresetModal`: useState vs useRef 판단

**plan.md 제안: `useState(false)`**

- **페이지 이탈 후 재진입 시 리셋 여부:**
  - `useState`는 컴포넌트 언마운트 시 초기화됨. 재진입(재마운트) 시 `false`로 리셋됨
  - 즉, StoryboardPage → IdeaPage 뒤로가기 시 모달이 다시 뜸
  - plan.md 코멘트 "페이지 이탈 후 재진입 시 상태가 리셋되는 것이 맞는지" → **질문이 맞음**

- **useRef 선택 시:**
  - 마찬가지로 컴포넌트 언마운트 시 초기화됨. `useState`와 동일한 라이프사이클
  - 차이점: `useRef`로 상태 변경 시 리렌더링이 발생하지 않음. 이 경우 `showPresetModal` 상태가 `setShowPresetModal`로 별도로 관리되므로 `useRef`를 써도 무방함
  - 하지만 useEffect 의존성 배열에 ref를 넣을 수 없으므로, `useState`가 더 안전한 선택

**결론: `useState` 선택이 올바름**

- 재진입 시 리셋되어 모달이 다시 표시되는 것은 **의도된 동작**으로 수용 가능
- 사용자가 "적용" 후 다시 아이디어 페이지로 돌아오면, 프리셋 설정을 다시 확인할 수 있음. 오히려 UX에 도움이 될 수 있음.

### 추가 발견: PresetInfoModal의 handleApply가 setSelectedStyle을 중복 호출

PresetInfoModal.tsx L36~44:
```typescript
const handleApply = () => {
    setSelectedStyle(preset.style);  // 'cinematic' (소문자) 설정
    setAspectRatio(preset.aspectRatio);
    setAiModelPreference('script', preset.defaultModels.script);
    // ...
    onApply();
};
```
- `handleApply`에서 `setSelectedStyle(preset.style)` → 소문자 'cinematic' 설정
- `onApply`는 모달만 닫음 (수정 후)
- IdeaPage의 STYLE 탭 프리셋 선택에서도 `setSelectedStyle(preset.style)` → 소문자 설정
- **이중 설정이지만 값이 동일하므로 충돌 없음**
- 단, 수정 3(대소문자 통일)과 함께 고려 필요 (후술)

### 결론

| 항목 | 상태 |
|------|------|
| 사이드 이펙트 | **있음 (주의 필요)** |
| 구체적 위치 | 다른 프리셋을 선택했을 때 `hasShownPresetModal`이 true이면 모달이 안 뜸 |
| 추가 수정 필요 | 프리셋 변경 시 `hasShownPresetModal`을 리셋하는 로직 필요할 수 있음 |
| 권장 사항 | `hasShownPresetModal`을 `useRef`가 아닌 `useState`로 선택한 것은 올바름 |

---

## 수정 3: selectedStyle 대소문자 통일

### 대소문자 충돌 지점 전수 조사

**`stylePromptPrefix` 키 (mockData.ts L241~254):**
```typescript
export const stylePromptPrefix: Record<string, string> = {
    'Cinematic': '...',
    'Anime': '...',
    'Oil Painting': '...',
    // ... 모두 대문자로 시작하는 name 형식
};
```
→ 키가 **대문자 시작** (artStyle.name과 동일한 형식)

**`artStyles` (mockData.ts L49~62):**
```typescript
export const artStyles = [
    { id: 'cinematic', name: 'Cinematic', ... },  // id=소문자, name=대문자
    { id: 'sketch', name: 'Sketch', ... },
    ...
];
```
→ `id`는 소문자 kebab-case, `name`은 대문자 시작

**IdeaPage STYLE 탭 스타일 카드 선택 (L487):**
```typescript
className={`style-card ${selectedStyle === style.name ? 'selected' : ''}`}
onClick={() => setSelectedStyle(style.name)}
```
→ `style.name`으로 비교 → **'Cinematic'** (대문자)로 설정됨

**SeedCheckPhase.tsx L180:**
```typescript
promptPrefix={stylePromptPrefix[selectedStyle] || stylePromptPrefix['Cinematic']}
```
→ `selectedStyle`이 'cinematic'(소문자)이면 키 매핑 실패 → 폴백 'Cinematic'으로 작동
→ **현재도 폴백이 있어서 기능이 완전히 깨지진 않지만, 항상 Cinematic 프리픽스만 사용됨**

**prompt-builder.ts의 `capitalize` 함수 (L35~38):**
```typescript
function capitalize(s: string): string {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}
```
사용 위치 (L84):
```typescript
prefix = stylePromptPrefix[capitalize(ctx.style)] || stylePromptPrefix['Cinematic'] || '';
```
→ `ctx.style`이 'cinematic'이면 → `capitalize('cinematic')` = 'Cinematic' → 매핑 성공
→ `ctx.style`이 'Cinematic'이면 → `capitalize('Cinematic')` = 'Cinematic' → **이중 변환 없음**. 안전함.

**수정 방법: stylePresets.ts에서 소문자 → 대문자로 변경**
```typescript
style: 'cinematic' → style: 'Cinematic'
```

**변경 후 영향 체인:**
1. `handlePresetSelect` (HomePage) → `setSelectedStyle('Cinematic')` → store에 'Cinematic' 저장
2. IdeaPage STYLE 탭 하이라이트: `selectedStyle === style.name` → `'Cinematic' === 'Cinematic'` → 매칭 성공
3. SeedCheckPhase: `stylePromptPrefix['Cinematic']` → 매핑 성공. 폴백 불필요
4. prompt-builder.ts: `capitalize('Cinematic')` = 'Cinematic' → 이중 변환 없음. 안전함

**다른 곳에서 style 값을 소문자로 비교하는 코드:**
- `PresetInfoModal.tsx`의 `STYLE_LABEL`:
  ```typescript
  const STYLE_LABEL: Record<string, string> = {
      cinematic: 'Cinematic',  // ← 키가 소문자
  ```
  → `preset.style`이 'Cinematic'(대문자)으로 바뀌면 `STYLE_LABEL['Cinematic']`이 undefined → 표시가 `preset.style` 원본으로 폴백
  → 단, `STYLE_LABEL['Cinematic'] ?? preset.style` 패턴이므로 'Cinematic'이 그대로 표시됨. 기능적 문제 없음. 단 한국어 레이블(STYLE_LABEL 값)이 표시되지 않고 원본 문자열이 표시됨.
  - **추가 수정 필요: PresetInfoModal.tsx의 STYLE_LABEL 키도 대문자로 통일**

- `stylePresets.ts` L14 주석: `// 'cinematic' (artStyles의 id와 매핑)` → 주석 업데이트 필요 (선택사항)

**모드(mode) 필드는 무관:** `mode: 'cinematic' | 'narration'`은 `ProjectMode` 타입으로 별도 필드. `style` 필드와 다름. 영향 없음.

### 결론

| 항목 | 상태 |
|------|------|
| 사이드 이펙트 | **있음 (경미)** |
| 구체적 위치 | `PresetInfoModal.tsx`의 `STYLE_LABEL` 키가 소문자로 정의되어 있어 대소문자 변경 시 키 매핑 실패 |
| 추가 수정 필요 | `PresetInfoModal.tsx` STYLE_LABEL 키를 대문자로 통일: `'Cinematic': 'Cinematic', 'Anime': 'Anime', ...` |
| capitalize 함수 | 이미 대문자이면 첫 글자만 대문자로 변환 → 이중 변환 없음. 안전함 |

---

## 수정 4+5: TTS 크레딧 (TimelinePage)

### useCredits에서 'tts' 타입 처리 확인

**CREDIT_COST_TABLE (creditCosts.ts L18~24):**
```typescript
export const CREDIT_COST_TABLE: Record<string, CreditCostItem> = {
    script: { platformFee: 1, apiCost: 1, total: 2,  totalByok: 1 },
    image:  { platformFee: 1, apiCost: 2, total: 3,  totalByok: 1 },
    video:  { platformFee: 2, apiCost: 8, total: 10, totalByok: 2 },
    tts:    { platformFee: 1, apiCost: 1, total: 2,  totalByok: 1 },  // ← 존재함
    card:   { platformFee: 1, apiCost: 2, total: 3,  totalByok: 1 },
};
```
→ `tts` 항목이 존재하며 비용은 `{ total: 2, totalByok: 1 }`

**GenerationType (useCredits.ts L14):**
```typescript
export type GenerationType = 'image' | 'video' | 'script' | 'tts' | 'card';
```
→ `'tts'`가 타입에 포함되어 있음

**canAfford('tts') 동작:**
```typescript
const canAfford = useCallback((type: GenerationType, count: number = 1): boolean => {
    return credits >= getCost(type, count);
}, [credits, getCost]);
```
- `getCost('tts', 1)` → CREDIT_COST_TABLE.tts.total = 2 (BYOK 없을 때)
- `script`와 비용이 동일(2)하므로 현재 기능이 우연히 같은 결과를 냄. plan.md 진단과 일치.

**spend('tts') 동작:**
```typescript
const spend = useCallback((type: GenerationType, count: number = 1): boolean => {
    const cost = getCost(type, count);
    return spendCredits(cost);
}, [getCost, spendCredits]);
```
- `getCost('tts', 1)` = 2 → 정상 차감

**현재 TimelinePage의 잘못된 패턴 확인:**
- L288: `canAfford('script', 1)` → `canAfford('tts')` 로 변경 필요
- L305: `spend('script', 1)` → `spend('tts')` 로 변경 필요
- L325: `pendingClips.length * CREDIT_COSTS.script` → `pendingClips.length * CREDIT_COSTS.tts` 로 변경 필요
- L346: `spend('script', 1)` → `spend('tts')` 로 변경 필요

**CREDIT_COSTS.script === CREDIT_COSTS.tts:** 둘 다 2로 동일. 비용 계산 결과는 같음. 즉, 현재 버그는 기능적 손상 없이 논리적 오류만 있는 상태.

**나레이션 TTS (handleNarrativeTTS) 크레딧 체크 부재:**
- L88~127: handleNarrativeTTS 함수 전체에 `canAfford`, `spend` 호출이 **없음**
- plan.md 진단 정확. 추가 필요.
- `canAfford`와 `spend`는 이미 L79에서 destructuring됨: `const { remaining: credits, canAfford, spend } = useCredits();`
- 따라서 추가 import나 선언 없이 바로 사용 가능

### 결론

| 항목 | 상태 |
|------|------|
| 사이드 이펙트 | **없음** |
| tts 타입 처리 | CREDIT_COST_TABLE과 GenerationType 모두 tts를 지원함. 완전히 준비되어 있음 |
| canAfford/spend | 이미 L79에서 destructuring됨. 추가 선언 불필요 |
| 비용 결과 | script와 tts 비용이 동일(2)하므로 현재 기능 손상 없음. 논리적 오류만 수정 |
| CREDIT_COSTS.tts | useCredits.ts L17~23의 CREDIT_COSTS 객체에 tts가 존재함. 바로 사용 가능 |

---

## 수정 6: StoryboardPage 제목 하드코딩

### `title` destructuring 확인

**StoryboardPage L19~24:**
```typescript
const {
    selectedStyle, scenes: storeScenes, cardLibrary, addToCardLibrary,
    aiModelPreferences, setAiModelPreference, mode,
    narrationStep, setNarrationStep, narrationClips, setNarrationClips,
    selectedPreset, aspectRatio,
} = useProjectStore();
```
→ `title`이 현재 destructuring에 **없음**. 추가 필요.

**하드코딩 위치 2곳:**
- L194 (나레이션 모드 헤더): `<h2 className="storyboard-header__title">강철의 북진</h2>`
- L269 (시네마틱 모드 헤더): `<h2 className="storyboard-header__title">강철의 북진</h2>`

**`title`이 빈 문자열일 때:**
- `startNewProject`에서 `title` 파라미터를 받아 설정함 (L223)
- HomePage의 `handlePresetSelect`에서 `startNewProject(preset.name, preset.mode)`로 preset.name이 title로 설정됨
- 빈 문자열 케이스: 직접 URL로 접근하거나 hasActiveProject가 false일 때
- plan.md 제안: `{title || 'Untitled Project'}` — 폴백 처리 적절함

**TimelinePage L463 비교:**
```typescript
<h2 className="storyboard-header__title">{title || '강철의 북진'}</h2>
```
→ TimelinePage는 이미 `title`을 사용하고 폴백으로 '강철의 북진'을 사용 중
→ StoryboardPage는 하드코딩. 일관성 없는 상태

### 결론

| 항목 | 상태 |
|------|------|
| 사이드 이펙트 | **없음** |
| title destructuring | useProjectStore에서 추가 필요 (현재 없음) |
| 수정 위치 | 2곳 (나레이션/시네마틱 헤더 각 1곳) |
| 폴백 처리 | `'Untitled Project'` 적절함 (TimelinePage의 '강철의 북진' 폴백보다 의미 있음) |

---

## 종합 정리: 사이드 이펙트 매트릭스

| # | 수정 항목 | 사이드 이펙트 | 심각도 | 추가 수정 필요 파일 |
|---|-----------|--------------|--------|-------------------|
| 1 | recommendedCast 연결 | 없음 | - | 없음 (import 추가만) |
| 2 | selectedPreset null 초기화 제거 | **있음** | 낮음 | 없음 (동작 자체는 수용 가능) |
| 3 | selectedStyle 대소문자 통일 | **있음** | 낮음 | `PresetInfoModal.tsx` STYLE_LABEL 키 수정 필요 |
| 4 | TTS 크레딧 타입 수정 | 없음 | - | 없음 |
| 5 | 나레이션 TTS 크레딧 체크 추가 | 없음 | - | 없음 |
| 6 | StoryboardPage 제목 | 없음 | - | 없음 (title destructuring 추가만) |

---

## 추가로 함께 수정해야 할 코드

### 필수 추가 수정 (수정 3과 함께)

**`src/components/PresetInfoModal.tsx` L19~29 — STYLE_LABEL 키 대소문자 통일**

현재:
```typescript
const STYLE_LABEL: Record<string, string> = {
    cinematic: 'Cinematic',
    anime: 'Anime',
    'children-illustration': "Children's Illustration",
    ...
};
```

수정 후:
```typescript
const STYLE_LABEL: Record<string, string> = {
    Cinematic: 'Cinematic',
    Anime: 'Anime',
    "Children's Illustration": "Children's Illustration",
    'Comic Book': 'Comic Book',
    'Oil Painting': 'Oil Painting',
    Sketch: 'Sketch',
    Cartoon: 'Cartoon',
    Watercolor: 'Watercolor',
    '3D Render': '3D Render',
};
```

→ `artStyles`의 `name` 값과 동일한 키로 맞춤 (stylePesets.ts 변경의 연쇄 수정)

### 선택적 추가 수정 (권장)

**`src/data/stylePresets.ts` L14 주석 업데이트:**
```typescript
style: string;  // 'Cinematic' (artStyles의 name과 매핑)
```
→ 주석이 현실을 반영하도록 업데이트 (기능에는 영향 없음)

---

## 수정 순서 권장 (의존성 고려)

의존성 분석 결과, 수정들 사이에 강한 순서 의존성은 없음. 단, 다음 순서로 진행하면 안전함:

```
① 수정 6 (StoryboardPage 제목)
   — 가장 단순. 독립적. title destructuring 1줄 + h2 2곳 변경.
   → 빌드 확인 후 진행.

② 수정 3 + PresetInfoModal (대소문자 통일)
   — stylePresets.ts 5개 프리셋 style 값 변경
   — PresetInfoModal.tsx STYLE_LABEL 키 동시 변경 (세트로 묶어야 함)
   → 2개 파일 동시 수정. 빌드 확인.

③ 수정 2 (selectedPreset null 초기화 제거)
   — IdeaPage useEffect + hasShownPresetModal 추가
   — 수정 3 완료 후 진행 (style 값이 올바르게 설정된 상태에서 테스트 가능)
   → 빌드 확인.

④ 수정 1 (recommendedCast 연결)
   — StoryboardPage handleAiAnalysis 수정
   — 수정 2 완료 후 진행 (selectedPreset이 유지되어야 preset 읽기 의미 있음)
   → 빌드 확인. 브라우저에서 AI 분석 모달로 동작 확인.

⑤ 수정 4 + 5 (TTS 크레딧)
   — TimelinePage 2개 함수 수정
   — 독립적이므로 어느 단계에서든 가능. 마지막에 진행.
   → 빌드 확인.
```

**묶어서 처리 금지 파일:** `StoryboardPage.tsx`는 수정 1과 6이 둘 다 해당됨. 단, 동일 파일이므로 한 번에 수정하면 됨 (④와 ①을 함께 처리).

---

## 최종 수정 파일 목록 (plan-round1.md 대비 추가분 포함)

| 파일 | plan-round1.md | 추가 발견 |
|------|---------------|----------|
| `src/pages/StoryboardPage.tsx` | 수정 1 + 6 | — |
| `src/pages/IdeaPage.tsx` | 수정 2 | — |
| `src/data/stylePresets.ts` | 수정 3 | — |
| `src/pages/TimelinePage.tsx` | 수정 4 + 5 | — |
| `src/components/PresetInfoModal.tsx` | **없음** | **추가 필요** (STYLE_LABEL 키 수정) |

---

*분석 완료: 2026-02-28*
*분석자: 린 (FE Architect)*
