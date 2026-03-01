# 007 UX 여정 정밀 검토 리서치

> 작성: CTO 일론 | 2026-02-28
> 리서치 범위: 전체 유저 여정 추적, 스타일 시스템 분석, 크레딧 플로우, 데이터 영속성

---

## 1. 진입점별 유저 여정 추적

### 1A. "대본부터" 시작

```
HomePage → handleScriptStart() → 모드 선택 오버레이
→ handleModeSelect(mode) → startNewProject('Untitled', mode)
→ setEntryPoint('script') → navigate('/project/idea')
```

**설정되는 상태:**
- `mode: 'cinematic' | 'narration'`
- `selectedPreset: null` (프리셋 미선택)
- `selectedStyle: 'Cinematic'` (기본값)
- `entryPoint: 'script'`

**이후 경로:**
- 시네마틱: IdeaPage → StoryboardPage → TimelinePage
- 나레이션: IdeaPage → TimelinePage(Voice→Split) → StoryboardPage(Direct→Image) → TimelinePage(Video→Edit)

**문제 없음** — 정상 동작

---

### 1B. "스타일부터" 시작

```
HomePage → handleStyleStart() → 프리셋 그리드 펼침 (5개)
→ handlePresetSelect(preset) → startNewProject(preset.name, preset.mode)
→ setEntryPoint('style'), setSelectedPreset(preset.id)
→ setSelectedStyle(preset.style), setAspectRatio(preset.aspectRatio)
→ navigate('/project/idea')
```

**설정되는 상태:**
- `mode: preset.mode` (프리셋에 따라 cinematic/narration)
- `selectedPreset: preset.id`
- `selectedStyle: preset.style` (예: `'cinematic'`)
- `aspectRatio: preset.aspectRatio`
- `title: preset.name` (예: '해외감동사연')

**IdeaPage 진입 후:**
- PresetInfoModal 자동 표시 (selectedPreset 존재 시)
- 모달에서 "적용" 클릭 → AI 모델 기본값도 설정 (`setAiModelPreference`)
- STYLE 탭: 모드별 프리셋 칩 + artStyles 12개 그리드 **둘 다 표시** ← 혼란

---

### 1C. "Cast부터" 시작

```
HomePage → handleCastStart() → navigate('/cast?mode=project')
→ CastPage (isProjectMode = true 하드코드)
→ 카드 5개 선택 → "스타일 선택하기" 버튼
→ showStyleSelect 오버레이 → handlePresetSelect(preset)
→ setEntryPoint('cast'), startNewProject(preset.name, preset.mode)
→ setSelectedPreset, setSelectedStyle, setAspectRatio
→ navigate('/project/idea')
```

**⚠️ 문제 발견:** `startNewProject()` 호출 시 `selectedDeck`이 리셋됨!

```typescript
// projectStore.ts startNewProject():
selectedDeck: [],  // ← 빈 배열로 리셋!
```

CastPage에서 선택한 카드 ID 목록이 `startNewProject()` 호출로 날아감.
`handlePresetSelect`에서 `startNewProject()` → `navigate()` 순서이므로,
카드 선택이 프로젝트에 반영되지 않는 **심각한 버그**.

---

### 1D. "My Cast" 전체보기

```
HomePage → <Link to="/cast"> → CastPage
```

CastPage의 `isProjectMode = true` 하드코드로 인해,
"My Cast 전체보기"도 프로젝트 모드로 동작함.
사용자는 카드를 단순히 관리(삭제/생성)하고 싶은데, 프로젝트 선택 UI가 강제됨.

**⚠️ 문제:** `/cast`(단순 관리)와 `/cast?mode=project`(프로젝트 시작)를 구분해야 함.

---

### 1E. 템플릿에서 시작

```
HomePage → 템플릿 카드 클릭 → onClick={handleScriptStart}
→ 모드 선택 오버레이 (대본부터와 동일)
```

**❌ 심각한 문제:**
- 클릭된 템플릿 객체(title, genre, imageUrl)가 **완전히 무시됨**
- "Mars Colony"를 선택해도 store에 아무것도 저장 안 됨
- 사실상 "대본부터"와 동일한 기능 → 템플릿 그리드가 장식용

---

## 2. 스타일 시스템 이중 구조 분석

### 현재 구조 (2개의 "스타일" 개념이 공존)

#### 개념 A: StylePreset (stylePresets.ts)
```
5개 프리셋: 시네마틱 드라마, 해외감동사연, 무협지, 무협지2, 해골 쇼츠
각 프리셋 포함 필드:
  - mode: 'cinematic' | 'narration'
  - style: 'cinematic' (문자열)
  - promptPrefix: { image, video, script } ← 프롬프트 접두사
  - defaultModels: { script, image, video, tts }
  - recommendedCast: { characters, backgrounds, items }
  - aspectRatio: '16:9' | '9:16'
```

#### 개념 B: artStyles (mockData.ts)
```
12개 아트 스타일: Cinematic, Sketch, Oil Painting, Cartoon, etc.
각 스타일 포함 필드:
  - id: 'cinematic'
  - name: 'Cinematic' (표시명)
  - color, imageUrl
  → 프롬프트 영향 없음! 단순 시각적 선택지
```

### 핵심 문제: promptPrefix 체인 분석

**프리셋의 promptPrefix는 실제로 사용되지 않음!**

실제 이미지 생성 흐름:
```
SeedCheckPhase → SceneRow → prompt-builder.ts → stylePromptPrefix[ctx.style]
```

`prompt-builder.ts`에서 사용하는 `stylePromptPrefix`는 **mockData.ts**에서 가져옴:
```typescript
// mockData.ts (line 241-254)
export const stylePromptPrefix: Record<string, string> = {
  'Cinematic': 'cinematic photography, dramatic lighting...',
  'Sketch': 'pencil sketch, hand drawn...',
  'Oil Painting': 'oil painting on canvas...',
  // ...12개
};
```

**한편 stylePresets.ts의 promptPrefix:**
```typescript
// stylePresets.ts (각 프리셋)
promptPrefix: {
  image: 'cinematic photography, dramatic, natural lighting...',
  video: 'cinematic, slow motion, handheld camera...',
  script: '당신은 드라마 영화 각본가입니다...',
}
```

→ 이 두 데이터가 **서로 연결되지 않음**. 프리셋을 선택해도 프리셋의 promptPrefix가 아닌
mockData의 stylePromptPrefix가 사용됨.

### 대소문자 불일치

- 프리셋: `style: 'cinematic'` (소문자)
- artStyles 표시명: `name: 'Cinematic'` (대문자)
- stylePromptPrefix 키: `'Cinematic'` (대문자)

프리셋 선택 시 `setSelectedStyle('cinematic')` → prompt-builder에서 `stylePromptPrefix['cinematic']` → **undefined!**
→ 프롬프트 접두사 누락 버그

### 정리: 무엇이 실제로 반영되는가

| 설정 | store 필드 | 실제 사용처 | 반영 여부 |
|------|-----------|------------|----------|
| 프리셋 선택 | selectedPreset | PresetInfoModal 표시 | ⚠️ 모달만 표시, 이후 null로 리셋 |
| 모드 (cinematic/narration) | mode | WorkflowSteps, IdeaPage 라우팅 | ✅ 반영됨 |
| 스타일 (artStyle) | selectedStyle | prompt-builder prefix 조회 | ⚠️ 대소문자 불일치 시 누락 |
| 비율 | aspectRatio | IdeaPage 비율 버튼 | ✅ 반영됨 |
| 프리셋 promptPrefix | (미연결) | (어디에도 사용 안 됨) | ❌ Dead data |
| 프리셋 defaultModels | (PresetInfoModal에서 설정) | aiModelPreferences | ⚠️ 모달 "적용" 클릭 시에만 |
| 프리셋 recommendedCast | (PresetInfoModal에서 표시) | (참고용) | ⚠️ 표시만 |

---

## 3. 크레딧 부족 시나리오

### 현재 구현

모든 크레딧 체크 포인트에서 동일 패턴:
```typescript
if (!canAfford('image')) {
  alert('크레딧이 부족합니다!');
  return;
}
```

**발생 지점 (9곳):**
| 위치 | 액션 | 크레딧 부족 시 |
|------|------|--------------|
| IdeaPage | AI 대본 생성 | alert → return |
| CastPage | AI 카드 생성 | setGenError 메시지 → return |
| CastSetupPhase | 에셋 이미지 생성 | alert → return |
| SeedCheckPhase | 씬 이미지 (단건) | alert → return |
| SeedCheckPhase | 씬 이미지 (일괄) | alert → break |
| SeedCheckPhase | 씬 영상 (단건) | alert → return |
| SeedCheckPhase | 씬 영상 (일괄) | alert → break |
| TimelinePage | TTS 생성 | alert → return |
| NarrationVideoStep | 영상화 | alert → break |

### 문제점

1. **`/payment` 안내 링크 없음** — alert만 표시하고 끝
2. **일괄 생성 중 크레딧 소진** — 일부만 생성되고 나머지 중단, 부분 완료 상태
3. **복구 경로 없음** — 충전 후 돌아와서 "이어하기" 불가
4. **작업 데이터 보존** — Zustand persist 덕분에 데이터 자체는 보존됨
   - BUT 사용자가 이를 모름 (안내 없음)

### 이상적 플로우

```
크레딧 부족 감지
→ 모달 표시: "크레딧이 부족합니다. (필요: 3, 잔여: 0)"
→ [충전하러 가기] 버튼 → /payment 이동 (router.push, 히스토리 유지)
→ 결제 완료 → [이전 작업으로 돌아가기] 버튼
→ 브라우저 뒤로가기로 복귀 (Zustand persist로 상태 보존)
→ 다시 생성 버튼 클릭 → 정상 진행
```

---

## 4. 데이터 영속성 분석

### localStorage 영속 (Zustand persist)

```
projectId, title, scenes, selectedStyle, cardLibrary, credits,
hasActiveProject, currentPhase, aspectRatio, entryPoint, selectedPreset,
selectedDeck, aiModelPreferences, mode, narrativeAudioUrl,
sentenceTimings, narrationClips, narrationStep
```
→ 페이지 이동, 새로고침 시에도 보존됨 ✅

### 유실되는 데이터 (컴포넌트 로컬 state)

| 페이지 | 유실 데이터 | 영향도 |
|--------|-----------|--------|
| IdeaPage | rawScript (직접입력 대본), ideaText (아이디어), inputMode | ⚠️ 높음 |
| CastPage | genName, genPrompt (AI 생성 폼) | 낮음 |
| StoryboardPage | phase (현재 단계) | 중간 |

### 프로젝트 저장/로드 문제

`loadProject()`에서 복원되는 필드:
```typescript
projectId, title, selected_style, aspect_ratio, scenes
```

**복원되지 않는 필드:**
- `mode` ← DB에 `mode` 컬럼 없음!
- `entryPoint`, `selectedPreset`, `selectedDeck`
- `narrationClips`, `narrationStep`, `sentenceTimings`

→ 나레이션 프로젝트를 저장 후 다시 열면 시네마틱 모드로 로드됨 (버그)

---

## 5. CEO 질문에 대한 답변

### Q1: "프리셋 DB는 어떻게 관리되어야 하는가?"

현재: `stylePresets.ts` 하드코드 (프론트엔드 데이터 파일)
미래: Supabase `style_presets` 테이블 (Admin에서 관리)

**MVP 추천:** 현재 하드코드 유지, Phase 2에서 DB 이전
- 5개 프리셋은 고정이므로 코드에 두어도 무방
- VISION.md의 UGC 마켓플레이스 시점에 DB 필수

### Q2: "IdeaPage STYLE 탭의 artStyles는 무슨 역할?"

현재 역할: **이미지 생성 프롬프트의 스타일 접두사 결정**
- 'Cinematic' 선택 → `stylePromptPrefix['Cinematic']` → `"cinematic photography, dramatic lighting..."`
- 이 접두사가 이미지 생성 프롬프트 앞에 붙음

**문제:** 프리셋의 promptPrefix와 artStyles의 stylePromptPrefix가 이중 관리됨
**해결안:** 프리셋 → artStyle 자동 매핑 (프리셋 선택 시 artStyle도 연동)

### Q3: "프리셋 설정이 실제로 AI 생성에 어떻게 영향을 미치는가?"

**현재 실제 영향:**
1. `mode` → 워크플로우 분기 (시네마틱 4스텝 vs 나레이션 8스텝) ✅
2. `aspectRatio` → 이미지/영상 생성 비율 ✅
3. `selectedStyle` → 이미지 프롬프트 접두사 ⚠️ (대소문자 버그)
4. `aiModelPreferences` → AI 모델 선택 ⚠️ (모달 "적용" 시에만)
5. `promptPrefix.image/video/script` → ❌ **아무 데서도 사용 안 됨**

### Q4: "비율 설정은 어디에 반영되는가?"

- `aspectRatio`는 store에 저장됨
- IdeaPage에서 16:9/9:16/1:1 선택 가능
- **BUT 이미지 생성 시 비율이 실제로 전달되는지 확인 필요**
  - `ai-image.ts`의 `generateImage()`: 파라미터에 aspectRatio 없음!
  - Gemini 이미지 생성에 비율 파라미터를 전달하지 않음 ← 미반영

---

## 6. 발견된 문제 우선순위

### P0 (데이터 유실 / 기능 미작동)

| # | 문제 | 위치 | 설명 |
|---|------|------|------|
| 1 | Cast 선택 유실 | CastPage → startNewProject | selectedDeck이 리셋됨 |
| 2 | 프리셋 promptPrefix 미사용 | 전체 | Dead data, AI 생성에 반영 안 됨 |
| 3 | 스타일 대소문자 불일치 | projectStore + prompt-builder | 'cinematic' vs 'Cinematic' |
| 4 | 템플릿 데이터 미저장 | HomePage | 클릭된 템플릿 정보 유실 |

### P1 (UX 혼란)

| # | 문제 | 위치 | 설명 |
|---|------|------|------|
| 5 | 스타일 이중 표시 | IdeaPage STYLE 탭 | 프리셋 칩 + artStyles 그리드 혼재 |
| 6 | 크레딧 부족 복구 없음 | 9개 지점 | alert만, /payment 링크 없음 |
| 7 | CastPage 모드 혼동 | CastPage | isProjectMode 하드코드 |
| 8 | aspectRatio 미반영 | ai-image.ts | 이미지 생성에 비율 전달 안 됨 |

### P2 (개선 가능)

| # | 문제 | 위치 | 설명 |
|---|------|------|------|
| 9 | 프로젝트 로드 시 mode 유실 | loadProject | DB에 mode 컬럼 없음 |
| 10 | 나레이션 워크플로우 비선형 | 페이지 이동 | IdeaPage↔TimelinePage↔StoryboardPage |
| 11 | IdeaPage 입력 데이터 유실 | IdeaPage | rawScript, ideaText 로컬 state |
