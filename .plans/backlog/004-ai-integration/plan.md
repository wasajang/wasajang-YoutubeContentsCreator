# 004 - AI 실 연동 + 듀얼 모드 구현 계획

> **버전:** v1.0
> **작성:** CTO 일론 | 2026-02-28
> **상태:** CEO 검토 대기
> **리서치:** `research.md` 참조
> **범위:** Gemini API 연동 + 시네마틱/나레이션 듀얼 모드

---

## 개요

**목표 2가지:**
1. Mock AI를 Gemini 실 API로 교체 (이미지 + 텍스트)
2. 프로젝트 모드 선택 (시네마틱 / 나레이션) 추가

**수정 파일:** ~12개 | **신규 파일:** 0~1개
**사용 모델:** Sonnet 4.6 (구현) | 에이전트: 린(FE), 카이(AI), 누리(CSS), 타로(QA)

---

## Phase 1: Gemini 텍스트 Provider (`ai-llm.ts`)

> 담당: 카이(AI) | 난이도: 중

### 1.1 geminiProvider 추가

**파일:** `src/services/ai-llm.ts`

`anthropicProvider` 아래(191줄 이후)에 추가:

```typescript
// ── Gemini Provider ──

const geminiProvider: LLMProvider = {
    name: 'gemini',
    generateScript: async (req) => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error('VITE_GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');

        const start = Date.now();
        const systemPrompt = buildSystemPrompt(req);
        const userPrompt = buildUserPrompt(req);

        const model = req.model || 'gemini-2.5-flash';
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: userPrompt }] }],
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 4000,
                        responseMimeType: 'application/json',
                    },
                }),
            }
        );

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Gemini API 에러: ${err.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return parseScriptResponse(content, 'gemini', Date.now() - start, req);
    },
};
```

### 1.2 providers 맵에 등록

**파일:** `src/services/ai-llm.ts` (280줄)

```typescript
const providers: Record<string, LLMProvider> = {
    mock: mockProvider,
    openai: openaiProvider,
    anthropic: anthropicProvider,
    gemini: geminiProvider,   // ← 추가
};
```

### 1.3 CORS 테스트

- `?key=` URL 파라미터 방식 → simple request로 CORS 우회
- 실패 시 → mock 폴백 유지, 에러 토스트 표시
- **중요:** 테스트 시 Rate Limit (10 RPM) 주의

---

## Phase 2: Gemini 이미지 Provider (`ai-image.ts`)

> 담당: 카이(AI) | 난이도: 중

### 2.1 geminiProvider 추가

**파일:** `src/services/ai-image.ts`

`replicateProvider` 아래(129줄 이후)에 추가:

```typescript
// ── Gemini Image Provider ──

const geminiProvider: ImageProvider = {
    name: 'gemini',
    generate: async (req) => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error('VITE_GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');

        const startTime = Date.now();

        // Gemini 이미지 생성: generateContent + responseModalities: IMAGE
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-0514:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: req.prompt }] }],
                    generationConfig: {
                        responseModalities: ['IMAGE'],
                        imageConfig: {
                            aspectRatio: req.width && req.height
                                ? (req.width > req.height ? '16:9' : req.width < req.height ? '9:16' : '1:1')
                                : '16:9',
                        },
                    },
                }),
            }
        );

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Gemini Image API 에러: ${err.error?.message || response.statusText}`);
        }

        const data = await response.json();

        // base64 이미지 추출
        const parts = data.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find((p: Record<string, unknown>) => p.inline_data);
        if (!imagePart?.inline_data?.data) {
            throw new Error('Gemini 응답에 이미지 데이터가 없습니다.');
        }

        const mimeType = imagePart.inline_data.mime_type || 'image/png';
        const base64Data = imagePart.inline_data.data;
        const imageUrl = `data:${mimeType};base64,${base64Data}`;

        return {
            imageUrl,
            seed: req.seed ?? Math.floor(Math.random() * 99999),
            provider: 'gemini',
            durationMs: Date.now() - startTime,
        };
    },
};
```

### 2.2 providers 맵에 등록

**파일:** `src/services/ai-image.ts` (133줄)

```typescript
const providers: Record<string, ImageProvider> = {
    mock: mockProvider,
    replicate: replicateProvider,
    gemini: geminiProvider,   // ← 추가
};
```

### 2.3 주의사항

- Gemini 이미지는 **base64 PNG**로 반환됨 (URL이 아님)
- `<img src="data:image/png;base64,...">` 형태로 바로 렌더링 가능
- base64 이미지는 localStorage에 저장 시 크기가 클 수 있음 → 나중에 Supabase Storage 업로드 고려
- **Rate Limit:** ~100회 남음, 테스트 시 아껴 쓸 것

---

## Phase 3: AI 모델 레지스트리 + Settings 업데이트

> 담당: 카이(AI) | 난이도: 낮

### 3.1 aiModels.ts — Gemini Image 모델 등록

**파일:** `src/data/aiModels.ts` (34줄 아래에 추가)

```typescript
// 🔓 이미지 AI (사용자 선택) — 기존 항목 아래에 추가
{ id: 'gemini-image', name: 'Gemini Image', provider: 'google', category: 'image', creditCost: 1 },
```

### 3.2 settingsStore.ts — Google Provider 추가

**파일:** `src/store/settingsStore.ts`

```typescript
// 11줄: ApiProvider 타입 확장
export type ApiProvider = 'openai' | 'anthropic' | 'replicate' | 'runway' | 'fishSpeech' | 'google';

// 14줄: ACTION_PROVIDER_MAP에 google 매핑 추가 (대본+이미지 모두 google 가능)
// ⚠️ 이 맵은 BYOK용. 환경변수 Gemini 키를 사용하므로 현 단계에서는 맵 변경 불필요.
// 나중에 BYOK에서 Google 선택 시 사용.
```

### 3.3 DEFAULT_AI_MODELS 변경

**파일:** `src/store/projectStore.ts` (47줄)

```typescript
const DEFAULT_AI_MODELS: AiModelPreferences = {
    script: 'gemini-flash',     // ← gpt-4o-mini → gemini-flash
    image: 'gemini-image',      // ← flux-schnell → gemini-image
    video: 'runway-gen3',       // 그대로 (영상 Gemini 미지원)
    tts: 'fish-speech',         // 그대로
};
```

---

## Phase 4: Store v5 — 듀얼 모드 지원

> 담당: 린(FE) | 난이도: 중

### 4.1 타입 추가

**파일:** `src/store/projectStore.ts` (Scene 인터페이스 아래, 30줄 부근)

```typescript
/** 프로젝트 모드 */
export type ProjectMode = 'cinematic' | 'narration';

/** 나레이션 모드 — 문장별 타이밍 정보 */
export interface SentenceTiming {
    index: number;
    text: string;          // 해당 문장
    startTime: number;     // 초
    endTime: number;       // 초
}
```

### 4.2 ProjectState 인터페이스 확장

**파일:** `src/store/projectStore.ts` (114줄 이전, v4 필드 다음에 추가)

```typescript
// ── v5 신규: 듀얼 모드 ──
mode: ProjectMode;
setMode: (mode: ProjectMode) => void;

// 나레이션 모드 전용
narrativeAudioUrl: string;        // TTS 생성된 오디오 URL
setNarrativeAudioUrl: (url: string) => void;
sentenceTimings: SentenceTiming[];  // 문장별 타이밍
setSentenceTimings: (timings: SentenceTiming[]) => void;
```

### 4.3 초기값 & 액션 구현

**파일:** `src/store/projectStore.ts` (create 블록 내부)

```typescript
mode: 'cinematic',
setMode: (mode) => set({ mode }),

narrativeAudioUrl: '',
setNarrativeAudioUrl: (narrativeAudioUrl) => set({ narrativeAudioUrl }),
sentenceTimings: [],
setSentenceTimings: (sentenceTimings) => set({ sentenceTimings }),
```

### 4.4 startNewProject 변경

**파일:** `src/store/projectStore.ts` (175줄, startNewProject)

```typescript
startNewProject: (title, mode: ProjectMode = 'cinematic') =>
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
        mode,                        // ← v5 추가
        narrativeAudioUrl: '',       // ← v5 추가
        sentenceTimings: [],         // ← v5 추가
    }),
```

⚠️ `startNewProject`의 시그니처가 변경되므로, 호출하는 곳도 업데이트 필요.

### 4.5 persist v5 마이그레이션

**파일:** `src/store/projectStore.ts` (migrate 함수, version: 5)

```typescript
version: 5,  // ← 4 → 5
migrate: (persistedState: unknown, version: number) => {
    let state = persistedState as Record<string, unknown>;
    // ... 기존 v1~v4 마이그레이션 유지 ...
    if (version < 5) {
        state = {
            ...state,
            mode: 'cinematic',
            narrativeAudioUrl: '',
            sentenceTimings: [],
        };
    }
    return state;
},
partialize: (state) => ({
    // ... 기존 필드 유지 ...
    mode: state.mode,                          // ← 추가
    narrativeAudioUrl: state.narrativeAudioUrl, // ← 추가
    sentenceTimings: state.sentenceTimings,     // ← 추가
}),
```

---

## Phase 5: 모드 선택 UI (HomePage)

> 담당: 린(FE) + 누리(CSS) | 난이도: 낮

### 5.1 "대본부터" 클릭 시 모드 선택

**파일:** `src/pages/HomePage.tsx` (54줄, handleScriptStart)

기존: 바로 프로젝트 생성 → IdeaPage 이동
변경: 모드 선택 모달/드롭다운 표시

```typescript
const [showModeSelect, setShowModeSelect] = useState(false);

const handleScriptStart = () => {
    setShowModeSelect(true);   // 모드 선택 UI 표시
};

const handleModeSelect = (mode: ProjectMode) => {
    startNewProject('Untitled Project', mode);
    setEntryPoint('script');
    setSelectedPreset(null);
    setShowModeSelect(false);
    navigate('/project/idea');
};
```

### 5.2 모드 선택 UI (entry-cards 아래에 조건 렌더링)

```tsx
{showModeSelect && (
    <div className="mode-select-overlay" onClick={() => setShowModeSelect(false)}>
        <div className="mode-select" onClick={(e) => e.stopPropagation()}>
            <h3 className="mode-select__title">영상 제작 방식 선택</h3>
            <div className="mode-select__options">
                <div
                    className="mode-select__option"
                    onClick={() => handleModeSelect('cinematic')}
                >
                    <div className="mode-select__icon">🎬</div>
                    <h4>시네마틱</h4>
                    <p>씬별 이미지/영상을 생성하고 마지막에 나레이션 추가</p>
                </div>
                <div
                    className="mode-select__option"
                    onClick={() => handleModeSelect('narration')}
                >
                    <div className="mode-select__icon">🎙️</div>
                    <h4>나레이션</h4>
                    <p>먼저 나레이션 음성을 생성하고 타이밍에 맞춰 영상 배치</p>
                </div>
            </div>
        </div>
    </div>
)}
```

### 5.3 CSS

**파일:** `src/index.css` (새 섹션 추가)

```css
/* ── Mode Select ── */
.mode-select-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000;
}
.mode-select {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 2rem;
    max-width: 500px; width: 90%;
}
.mode-select__title {
    font-size: 1.2rem; margin-bottom: 1.5rem; text-align: center;
}
.mode-select__options { display: flex; gap: 1rem; }
.mode-select__option {
    flex: 1; padding: 1.5rem; border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    cursor: pointer; text-align: center;
    transition: border-color 0.2s, background 0.2s;
}
.mode-select__option:hover {
    border-color: var(--color-primary);
    background: rgba(var(--color-primary-rgb), 0.05);
}
.mode-select__icon { font-size: 2rem; margin-bottom: 0.5rem; }
.mode-select__option h4 { margin-bottom: 0.5rem; }
.mode-select__option p { font-size: 0.8rem; color: var(--color-text-secondary); }
```

---

## Phase 6: 나레이션 워크플로우 분기

> 담당: 린(FE) | 난이도: 중~높

### 6.1 IdeaPage — 모드별 분기

**파일:** `src/pages/IdeaPage.tsx`

변경사항:
- `mode === 'narration'`일 때:
  - 씬 분할 (sceneCount 선택기 + "대본 분할" 버튼) 제거
  - 전체 대본 텍스트만 입력/저장
  - "다음" 버튼이 `/project/timeline`로 이동 (StoryboardPage가 아님)

```typescript
const { mode } = useProjectStore();

// 나레이션 모드: "다음" 버튼 네비게이션 변경
const handleNext = () => {
    if (mode === 'narration') {
        navigate('/project/timeline');  // TTS 먼저
    } else {
        navigate('/project/storyboard');  // 기존
    }
};
```

### 6.2 TimelinePage — 나레이션 모드에서 TTS 단계 추가

**파일:** `src/pages/TimelinePage.tsx`

나레이션 모드일 때 기존 타임라인 UI 대신 "TTS 생성 + 타이밍" 화면 표시:

```typescript
const { mode, scenes, sentenceTimings, setSentenceTimings,
        narrativeAudioUrl, setNarrativeAudioUrl } = useProjectStore();

// 나레이션 모드: TTS 생성
const handleGenerateNarration = async () => {
    const fullText = scenes.map(s => s.text).join(' ') || scriptText;
    const result = await generateTTS({ text: fullText });
    setNarrativeAudioUrl(result.audioUrl);

    // 텍스트 기반 타이밍 추정 (MVP: 한국어 4자/초)
    const sentences = fullText.match(/[^.!?。]+[.!?。]?/g) || [fullText];
    let currentTime = 0;
    const timings: SentenceTiming[] = sentences.map((text, i) => {
        const duration = Math.max(1, text.trim().length / 4);
        const timing = {
            index: i,
            text: text.trim(),
            startTime: Math.round(currentTime * 10) / 10,
            endTime: Math.round((currentTime + duration) * 10) / 10,
        };
        currentTime += duration;
        return timing;
    });
    setSentenceTimings(timings);
};

// 타이밍 기반 → 씬 자동 분할 (5초 단위)
const handleAutoSplitScenes = () => {
    const maxSceneDuration = 5; // 초
    const autoScenes: Scene[] = [];
    let currentScene: SentenceTiming[] = [];
    let sceneStart = 0;

    for (const timing of sentenceTimings) {
        currentScene.push(timing);
        const sceneDuration = timing.endTime - sceneStart;

        if (sceneDuration >= maxSceneDuration) {
            autoScenes.push({
                id: `scene-${autoScenes.length + 1}`,
                text: currentScene.map(t => t.text).join(' '),
                location: '',
                cameraAngle: 'Wide Angle',
                imageUrl: '',
                characters: [],
                status: 'pending',
                checked: false,
            });
            currentScene = [];
            sceneStart = timing.endTime;
        }
    }
    // 남은 문장 처리
    if (currentScene.length > 0) {
        autoScenes.push({
            id: `scene-${autoScenes.length + 1}`,
            text: currentScene.map(t => t.text).join(' '),
            location: '', cameraAngle: 'Wide Angle',
            imageUrl: '', characters: [], status: 'pending', checked: false,
        });
    }

    setScenes(autoScenes);
    navigate('/project/storyboard'); // 씬 생성 후 → 스토리보드로
};
```

### 6.3 StoryboardPage — 나레이션 모드에서 CutSplitPhase 스킵

**파일:** `src/pages/StoryboardPage.tsx`

나레이션 모드에서는 씬이 이미 TimelinePage에서 자동 분할되어 있으므로:
- CutSplitPhase (컷 분할) → **스킵**
- CastSetupPhase (카드 선택) → **그대로**
- SeedCheckPhase (시드 매칭 + 생성) → **그대로**

```typescript
const { mode } = useProjectStore();

// 나레이션 모드: 컷 분할 건너뛰고 바로 카드 선택 → 시드 매칭
const phases = mode === 'narration'
    ? ['cast-setup', 'seed-check']  // CutSplitPhase 없음
    : ['cast-setup', 'cut-split', 'seed-check'];  // 기존
```

---

## Phase 7: WorkflowSteps 모드별 분기

> 담당: 린(FE) | 난이도: 낮

### 7.1 모드별 워크플로우 상수

**파일:** `src/components/WorkflowSteps.tsx`

```typescript
import { useProjectStore } from '../store/projectStore';

const CINEMATIC_WORKFLOW: MainStep[] = [
    { num: 1, label: 'Idea', route: '/project/idea',
      subSteps: [{ key: 'script', label: '대본 작성' }, { key: 'style', label: '스타일 선택' }] },
    { num: 2, label: 'Storyboard', route: '/project/storyboard',
      subSteps: [{ key: 'cast-setup', label: '카드 선택' }, { key: 'cut-split', label: '컷 분할' }] },
    { num: 3, label: 'Generate', route: '/project/storyboard',
      subSteps: [{ key: 'seed-match', label: '시드 매칭' }, { key: 'image-gen', label: '이미지 생성' }, { key: 'video-gen', label: '영상 생성' }] },
    { num: 4, label: 'Animate', route: '/project/timeline',
      subSteps: [{ key: 'timeline', label: '타임라인' }, { key: 'tts', label: 'TTS' }, { key: 'export', label: 'Export' }] },
];

const NARRATION_WORKFLOW: MainStep[] = [
    { num: 1, label: 'Idea', route: '/project/idea',
      subSteps: [{ key: 'script', label: '대본 작성' }, { key: 'style', label: '스타일 선택' }] },
    { num: 2, label: 'Narrate', route: '/project/timeline',
      subSteps: [{ key: 'tts', label: 'TTS 생성' }, { key: 'timing', label: '타이밍 분석' }] },
    { num: 3, label: 'Generate', route: '/project/storyboard',
      subSteps: [{ key: 'cast-setup', label: '카드 선택' }, { key: 'image-gen', label: '이미지 생성' }] },
    { num: 4, label: 'Edit', route: '/project/timeline',
      subSteps: [{ key: 'timeline', label: '타임라인' }, { key: 'export', label: 'Export' }] },
];
```

### 7.2 모드에 따라 워크플로우 선택

```typescript
const WorkflowSteps: React.FC<Props> = ({ currentMain, currentSub, onMainClick, onSubClick }) => {
    const mode = useProjectStore((s) => s.mode);
    const WORKFLOW = mode === 'narration' ? NARRATION_WORKFLOW : CINEMATIC_WORKFLOW;
    // ... 이하 기존 로직 동일 ...
};
```

---

## Phase 8: 검증 + 에러 처리

> 담당: 타로(QA) | 난이도: 낮

### 8.1 빌드 검증
- `npm run build` — TypeScript 에러 0개 확인

### 8.2 기능 테스트 체크리스트

**Gemini 연동:**
- [ ] 대본 생성 (IdeaPage → "AI로 생성" → Gemini 응답 확인)
- [ ] 이미지 생성 (StoryboardPage → 씬 이미지 생성 → base64 이미지 표시)
- [ ] Rate Limit 에러 시 → 토스트 표시, Mock 폴백 아님
- [ ] API 키 없을 때 → 명확한 에러 메시지

**듀얼 모드:**
- [ ] HomePage → "대본부터" → 모드 선택 UI 표시
- [ ] 시네마틱 선택 → 기존 워크플로우 정상 동작
- [ ] 나레이션 선택 → IdeaPage → TimelinePage(TTS) → StoryboardPage 순서
- [ ] 나레이션 모드 → TTS 생성 → 타이밍 표시 → 자동 씬 분할
- [ ] WorkflowSteps가 모드에 맞게 변경되는지

### 8.3 회귀 테스트
- [ ] 기존 시네마틱 워크플로우 변경 없음
- [ ] localStorage 마이그레이션 (v4 → v5) 정상
- [ ] Mock 모드 여전히 동작 (.env에서 PROVIDER=mock으로 변경 시)

---

## 수정 파일 요약

| Phase | 파일 | 변경 내용 |
|-------|------|----------|
| 1 | `src/services/ai-llm.ts` | geminiProvider 추가 |
| 2 | `src/services/ai-image.ts` | geminiProvider 추가 (base64) |
| 3 | `src/data/aiModels.ts` | gemini-image 모델 등록 |
| 3 | `src/store/settingsStore.ts` | ApiProvider에 'google' 추가 |
| 3 | `src/store/projectStore.ts` | DEFAULT_AI_MODELS → gemini 기본값 |
| 4 | `src/store/projectStore.ts` | v5: mode, narrativeAudioUrl, sentenceTimings |
| 5 | `src/pages/HomePage.tsx` | 모드 선택 UI |
| 5 | `src/index.css` | 모드 선택 CSS |
| 6 | `src/pages/IdeaPage.tsx` | 나레이션 모드 분기 |
| 6 | `src/pages/TimelinePage.tsx` | TTS + 타이밍 + 자동 씬 분할 |
| 6 | `src/pages/StoryboardPage.tsx` | CutSplitPhase 스킵 |
| 7 | `src/components/WorkflowSteps.tsx` | 모드별 워크플로우 |

---

## 실행 전략 (병렬 처리)

```
[카이(AI)] Phase 1~3: Gemini 연동 ─────────────────────┐
                                                        ├→ [타로(QA)] Phase 8: 검증
[린(FE)]   Phase 4~7: 듀얼 모드 + UI ─────────────────┘
[누리(CSS)] Phase 5 CSS: 모드 선택 스타일 ──────────────┘
```

- 카이와 린이 **동시에 작업** 가능 (Phase 1~3과 Phase 4~7은 독립적)
- 카이: ai-llm.ts, ai-image.ts, aiModels.ts
- 린: projectStore.ts, HomePage.tsx, IdeaPage.tsx, TimelinePage.tsx, StoryboardPage.tsx, WorkflowSteps.tsx
- 누리: index.css (모드 선택 CSS)
- 타로: 마지막에 통합 검증

---

## 위험 요소 & 대응

| 위험 | 확률 | 대응 |
|------|------|------|
| CORS 차단 | 중 | `?key=` 파라미터 사용. 실패 시 에러 표시 (mock 폴백 X) |
| 이미지 Rate Limit | 높 | 100회 제한. 개발 중 mock 병행, 최종 테스트만 실 API |
| base64 이미지 크기 | 낮 | localStorage에 저장 시 주의. MVP에서는 허용 |
| TTS 타이밍 정확도 | 중 | MVP: 텍스트 추정(4자/초). 수동 조정 UI는 다음 버전 |
| Store 마이그레이션 | 낮 | v4→v5 기본값 채우기만 하면 됨 |

---

## CEO 검토 포인트

1. **모드 선택 위치** — "대본부터" 클릭 후 모달로 OK? 아니면 다른 위치?
2. **나레이션 TTS 타이밍** — MVP에서 텍스트 기반 추정(4자/초)으로 OK?
3. **Phase 순서** — Gemini 연동 먼저 vs 듀얼 모드 먼저? (현재: 병렬)
4. **Gemini 이미지 모델명** — `gemini-2.5-flash-preview-0514` (최신 확인 필요)
