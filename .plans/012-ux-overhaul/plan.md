# 012 UX 대규모 개편 — 구현 계획 v2

> 작성: CTO 일론 (2026-03-01)
> 상태: CEO 검토 대기
> 근거: `ceo-feedback.md` (CEO 8항목) + `team-review-summary.md` (팀 4명 검토)
> v2 변경: CTO + CPO(유나) + UXR(하나) + 기술검토 종합 반영

---

## CEO 결정 사항 (확정)

| # | 결정 | 선택 |
|---|------|------|
| 1 | Generate 페이지 분리 | **A안: 별도 `/project/generate`** |
| 2 | 시네마틱 워크플로우 단계 수 | **4단계 유지** (VISION.md 기준, route만 변경) |
| 3 | 나레이션 모드 | **현행 유지** (시네마틱 먼저 개편) |
| 4 | Phase 우선순위 | **의존성 순** (Phase 1→2→3→4→5) |

---

## 개요

CEO 브라우저 테스트 피드백 8항목 + 팀 4명 검토 결과를 종합한 UX 대규모 개편 계획.
총 **5 Phase**로 구현. (v1 대비: Phase 2+3 통합, Animate를 Phase 4에 흡수)

### 범위 요약

| Phase | 내용 | 난이도 | 영향 파일 |
|-------|------|--------|----------|
| **1** | 즉시 버그 수정 (A2~A4) + 데이터 연결 (B2~B6) | 쉬움 | 5~7파일 |
| **2** | IdeaPage 전체 개편 (3분할 + 프리셋 팝업 + 시각화) | 큼 | 2파일 (IdeaPage + CSS) |
| **3** | StoryboardPage AI 분석 + 컷 분할 개편 | 큼 | 5~6파일 |
| **4** | GeneratePage 분리 + 일괄 생성 + Animate 진입 | 큼 | 7~8파일 (신규 포함) |
| **5** | QA + 브라우저 검증 | - | - |

### 의도적 제외 항목 (012 범위 밖)

| 항목 | 사유 | 처리 시점 |
|------|------|----------|
| B1: BYOK 키 → 실제 API 호출 반영 | AI 실 연동 문제 | **004-AI 실 연동**에서 처리 |
| D2: mockData 폴백 프로덕션 부적절 | API 연동 시 일괄 전환 | **004-AI 실 연동**에서 처리 |
| E4: Cast부터 시작 (3번째 진입점) | 별도 기획 필요 | **후순위 백로그** |
| C8: 생성 실패 시 크레딧 롤백 | 결제 시스템 연동 | **006-결제 시스템**에서 처리 |

---

## Phase 1: 즉시 버그 수정 + 데이터 연결 (40분)

> 팀 검토 A2~A4 + B2~B6. Phase 2 시작 전 **반드시 완료** 필수.

### 1-1. A2: IdeaPage 재진입 시 mode 리셋 방지

**문제:** 이미 프로젝트가 있는데 IdeaPage 재진입 시 mode가 초기화됨
**파일:** `src/pages/IdeaPage.tsx`
**수정:**

```tsx
// 현재: startNewProject 호출 시 mode가 항상 'cinematic'으로 리셋
// 수정: IdeaPage 진입 시 기존 mode 유지 (startNewProject에 mode 파라미터 전달)
// HomePage.tsx:61 에서 이미 mode를 전달하고 있으므로,
// IdeaPage 자체에서 startNewProject를 호출하는 경로만 확인
```

### 1-2. A3: StoryboardPage AI 모달 재등장 방지

**문제:** 이미 덱이 구성된 상태에서 StoryboardPage 재진입 시 AI 분석 모달이 다시 뜸
**파일:** `src/pages/StoryboardPage.tsx:35`
**수정:**

```tsx
// 현재
const [showAiAnalysisModal, setShowAiAnalysisModal] = useState(true);

// 수정: 덱이 이미 있으면 false
const { selectedDeck } = useProjectStore();
const [showAiAnalysisModal, setShowAiAnalysisModal] = useState(
    selectedDeck.length === 0  // 덱 비어있을 때만 모달 표시
);
```

### 1-3. A4: NarrationEditView 다음 버튼 disabled 제거

**문제:** 편집 완료 후 "다음" 버튼이 계속 disabled 상태
**파일:** `src/components/narration/NarrationEditView.tsx:186`
**수정:** disabled 조건 수정 또는 제거

### 1-4. B2: Admin 프리셋 편집 → prompt-builder 반영 (v2 추가)

**문제:** Admin에서 프리셋 편집해도 실제 프롬프트에 미반영
**파일:** `src/services/prompt-builder.ts`
**수정:** getTemplateById()가 이미 localStorage 오버라이드를 병합하지만, prompt-builder에서 호출 시점 확인. Admin 편집이 imagePromptRules/videoPromptRules까지 반영되는지 검증.

### 1-5. B3: template.defaultModels 연동

**문제:** 템플릿 선택 시 defaultModels가 aiModelPreferences에 미반영
**파일:** `src/pages/IdeaPage.tsx` (handlePresetSelect 함수)
**수정:**

```tsx
const handlePresetSelect = (tmpl: Template) => {
    setTemplateId(tmpl.id);
    setArtStyleId(tmpl.artStyleId);
    setAspectRatio(tmpl.aspectRatio);
    // 추가: defaultModels 반영
    if (tmpl.defaultModels) {
        Object.entries(tmpl.defaultModels).forEach(([category, modelId]) => {
            setAiModelPreference(category as any, modelId);
        });
    }
};
```

### 1-6. B4: template.sampleIdea placeholder 표시

**문제:** 템플릿에 sampleIdea가 있지만 아이디어 입력창에 placeholder로 미표시
**파일:** `src/pages/IdeaPage.tsx`
**수정:**

```tsx
const currentTemplate = templateId ? getTemplateById(templateId) : null;
<textarea
    placeholder={currentTemplate?.sampleIdea || "영상 아이디어를 입력하세요..."}
/>
```

### 1-7. B5: template.instruction 프롬프트 반영

**문제:** promptRules.imagePromptRules.instruction이 buildImagePrompt에 미반영
**파일:** `src/services/prompt-builder.ts`
**수정:**

```tsx
// buildImagePrompt 내부
if (template?.promptRules?.imagePromptRules?.instruction) {
    parts.push(template.promptRules.imagePromptRules.instruction);
}
```

### 1-8. B6: template.sceneSplitRules 반영

**문제:** 템플릿의 sceneSplitRules.defaultSceneCount가 씬 개수 선택기에 미반영
**파일:** `src/pages/IdeaPage.tsx`
**수정:**

```tsx
const handlePresetSelect = (tmpl: Template) => {
    // 기존 코드...
    if (tmpl.promptRules?.sceneSplitRules?.defaultSceneCount) {
        setSceneCount(tmpl.promptRules.sceneSplitRules.defaultSceneCount);
    }
};
```

---

## Phase 2: IdeaPage 전체 개편 (CEO 항목 1, 2, 3)

> v1 Phase 2+3 통합. IdeaPage.tsx를 한 번에 완성.
> 내부 3단계: 2-A(레이아웃) → 2-B(프리셋 팝업) → 2-C(시각화)

### 2-A. 3분할 레이아웃 구조 변경

**현재:**
```
┌──────────────────┬─────────────┐
│  대본 작성/결과   │  설정 선택   │
│  (flex:1)        │  (300px)    │
└──────────────────┴─────────────┘
```

**변경 후:**
```
┌─────────────┬──────────────┬─────────────────┐
│ 1. 대본 작성 │ 2. 설정 선택  │ 3. 결과         │
│              │              │                 │
│ - 대본 입력  │ - 프리셋 선택 │ - Script        │
│ - 아이디어   │ - 아트 스타일 │   Breakdown     │
│ - 씬 개수   │ - 화면 비율   │ - 씬 목록       │
│              │              │ - 편집/체크      │
│ [하단: 씬수  │              │                 │
│  = 이미지 N] │              │                 │
└─────────────┴──────────────┴─────────────────┘
```

**파일:** `src/pages/IdeaPage.tsx`, `src/index.css`

**CSS 변경:**

```css
/* 변경 후 */
.idea-layout {
    display: grid;
    grid-template-columns: 1fr 280px 1fr;
    flex: 1;
    overflow: hidden;
}
.idea-layout__script { /* 1열: 대본 입력 */ }
.idea-layout__settings { /* 2열: 설정 선택 */ }
.idea-layout__result { /* 3열: Script Breakdown */ }

/* 반응형 폴백 (v2 추가) */
@media (max-width: 1024px) {
    .idea-layout {
        grid-template-columns: 1fr 1fr;
        /* 태블릿: 2분할 (대본+설정 / 결과) */
    }
}
@media (max-width: 768px) {
    .idea-layout {
        grid-template-columns: 1fr;
        /* 모바일: 1열 세로 스택 */
    }
}
```

**JSX 변경 핵심:**

```tsx
<div className="idea-layout">
    {/* 1열: 대본 입력 (항상 표시) */}
    <div className="idea-layout__script">
        {/* 탭 (대본 직접 / 아이디어) */}
        {/* textarea */}
        {/* 씬 개수 선택 */}
        {/* 하단: 씬 개수 = 이미지 개수 시각화 (2-C 참조) */}
        {/* Generate 버튼 */}
    </div>

    {/* 2열: 설정 (항상 표시) */}
    <div className="idea-layout__settings">
        {/* 프리셋 선택 (2-B의 확인 팝업 적용) */}
        {/* 아트 스타일 */}
        {/* 화면 비율 */}
    </div>

    {/* 3열: 결과 */}
    <div className="idea-layout__result">
        {isGenerated ? (
            <ScriptBreakdown scenes={scenes} />
        ) : (
            <div className="idea-layout__result-placeholder">
                {/* v2 추가: 빈 상태 플레이스홀더 */}
                <FileText size={32} opacity={0.15} />
                <p>대본을 생성하면 여기에 씬 목록이 표시됩니다</p>
            </div>
        )}
    </div>
</div>
```

**단계별 진행 인디케이터 (상단):**

```tsx
<div className="idea-steps-indicator">
    <div className={`idea-step ${hasScript ? 'done' : 'active'}`}>
        ① 대본 작성
    </div>
    <div className={`idea-step ${hasSettings ? 'done' : hasScript ? 'active' : ''}`}>
        ② 설정 선택
    </div>
    <div className={`idea-step ${isGenerated ? 'done' : hasSettings ? 'active' : ''}`}>
        ③ 결과 확인
    </div>
</div>
```

### 2-B. 프리셋 확인 팝업 + AI 대본 연동

**프리셋 클릭 → 확인 팝업:**

```tsx
const [pendingPreset, setPendingPreset] = useState<Template | null>(null);

const handlePresetClick = (tmpl: Template) => {
    setPendingPreset(tmpl);  // 팝업 표시
};

const handlePresetConfirm = () => {
    if (!pendingPreset) return;
    setTemplateId(pendingPreset.id);
    setArtStyleId(pendingPreset.artStyleId);
    setAspectRatio(pendingPreset.aspectRatio);
    // defaultModels 반영 (Phase 1-5와 연동)
    if (pendingPreset.defaultModels) {
        Object.entries(pendingPreset.defaultModels).forEach(([cat, modelId]) => {
            setAiModelPreference(cat as any, modelId);
        });
    }
    if (pendingPreset.promptRules?.sceneSplitRules?.defaultSceneCount) {
        setSceneCount(pendingPreset.promptRules.sceneSplitRules.defaultSceneCount);
    }
    setPendingPreset(null);
};

// 확인 팝업 JSX
{pendingPreset && (
    <div className="preset-confirm-overlay" onClick={() => setPendingPreset(null)}>
        <div className="preset-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h4>'{pendingPreset.name}' 템플릿 적용</h4>
            <p>이 템플릿의 설정과 프롬프트 규칙을 모두 적용할까요?</p>
            <ul>
                <li>아트 스타일: {getArtStyleById(pendingPreset.artStyleId)?.nameKo}</li>
                <li>화면 비율: {pendingPreset.aspectRatio}</li>
                <li>추천 씬 수: {pendingPreset.promptRules.sceneSplitRules.defaultSceneCount}</li>
            </ul>
            <div className="preset-confirm-modal__actions">
                <button className="btn-secondary" onClick={() => setPendingPreset(null)}>아니요</button>
                <button className="btn-primary" onClick={handlePresetConfirm}>예, 적용</button>
            </div>
        </div>
    </div>
)}
```

**프리셋 선택 시 AI 대본 안내 (인라인 — v2 변경: 팝업 → 인라인):**

```tsx
// v1: 별도 팝업이었으나, UXR 하나 검토 후 인라인 알림으로 변경 (팝업 피로 방지)
{templateId && (
    <div className="preset-script-notice">
        '{currentTemplate?.name}' 템플릿의 대본 작성 규칙이 적용됩니다
    </div>
)}
```

**프리셋 + 직접 대본 입력 시 (인라인 확인 — v2 변경: 팝업 → 인라인):**

```tsx
// v1: 별도 팝업이었으나, 팝업 피로 방지를 위해 인라인 배너로 변경
const handleGenerateScript = () => {
    if (templateId && currentTemplate) {
        // 프리셋 규칙 안내 배너 표시 (인라인)
        setShowPresetHint(true);
        // 자동으로 프리셋 추천 씬 수 적용
        const recommended = currentTemplate.promptRules?.sceneSplitRules?.defaultSceneCount;
        if (recommended && recommended !== sceneCount) {
            setSceneCount(recommended);
        }
    }
    const generated = splitScriptIntoScenes(rawScript, sceneCount);
    setScenes(generated);
    setIsGenerated(true);
};

// 인라인 배너 (팝업 대신)
{showPresetHint && (
    <div className="preset-hint-banner">
        '{currentTemplate?.name}' 규칙에 따라 {sceneCount}씬으로 분할했습니다.
        <button onClick={() => setShowPresetHint(false)}>확인</button>
    </div>
)}
```

### 2-C. 씬 개수 = 이미지 개수 시각화 (CEO 항목 1)

**위치:** 1열 하단 (Generate 버튼 위)

```tsx
<div className="scene-image-preview">
    <div className="scene-image-preview__title">
        씬 {sceneCount}개 = 시작 이미지 {sceneCount}장
    </div>
    <div className="scene-image-preview__boxes">
        {Array.from({ length: Math.min(sceneCount, 12) }, (_, i) => (
            <div key={i} className="scene-image-preview__box">
                {String(i + 1).padStart(2, '0')}
            </div>
        ))}
        {sceneCount > 12 && (
            <span className="scene-image-preview__more">+{sceneCount - 12}</span>
        )}
    </div>
    <p className="scene-image-preview__desc">
        각 씬마다 1장의 시작 이미지가 생성됩니다
    </p>
</div>
```

---

## Phase 3: StoryboardPage AI 분석 + 컷 분할 개편 (CEO 항목 4, 4-2, 5)

### 3-1. AI 분석 모달: 템플릿 유무 분기 (CEO 항목 4)

**현재:** 동일한 모달 내용
**변경:** 템플릿 선택 유무에 따라 다른 내용

**파일:** `src/components/storyboard/AiAnalysisModal.tsx`

```tsx
interface AiAnalysisModalProps {
    templateId: string | null;
    template: Template | null;
    onAiAnalysis: (doAnalysis: boolean) => void;
    isAnalyzing: boolean;
}

// 렌더링
{template ? (
    // 4-A: 템플릿 선택한 유저
    <>
        <h3>'{template.name}' 템플릿 카드 추천</h3>
        <p>선택한 템플릿에 저장된 캐릭터
           ({template.castPreset.characters.map(c => c.name).join(', ')})
           등을 자동 추천합니다.</p>
        <div className="cast-preview">
            {/* 캐릭터/배경/아이템 미리보기 카드 */}
        </div>
        <button onClick={() => onAiAnalysis(true)}>예, AI로 분석하기</button>
        <button onClick={() => onAiAnalysis(false)}>아니오, 기본 카드 사용</button>
    </>
) : (
    // 4-B: 템플릿 미선택 유저
    <>
        <h3>AI 대본 분석</h3>
        <p>대본 분석을 통해 캐릭터/배경/아이템 카드를 추천합니다.</p>
        {/* TODO: 실제 AI 프롬프트 추후 입력 필요 */}
        <button onClick={() => onAiAnalysis(true)}>예, AI로 분석하기</button>
        <button onClick={() => onAiAnalysis(false)}>아니오, 직접 선택</button>
    </>
)}
```

**"아니오" 선택 시:** 최대 5개 카드 직접 선택 + 새 카드 생성 가능

### 3-2. 컷 분할 레이아웃 개편 (CEO 항목 4-2, 5)

**변경:** 좌측 카드 덱 사이드바 + 우측 (컷 + 영상 개수) + **일괄 선택 버튼** + **이미지 박스**

**파일:** `src/components/storyboard/CutSplitPhase.tsx`

```
┌──────────────┬──────────────────────────────────────┐
│ 카드 덱       │ 컷 분할 결과                         │
│ (사이드바)    │                                      │
│              │ [일괄: 모든 컷 2장] [일괄: 모든 컷 3장]│
│ ┌──────────┐ │                                      │
│ │ 캐릭터1  │ │ ┌────┬────────┬──────────┬─────────┐ │
│ │ 캐릭터2  │ │ │ 01 │ 대본   │ 영상개수  │이미지박스│ │
│ │ 배경1    │ │ │    │        │ (1)(2)(3) │ ┌─┐    │ │
│ │ 아이템1  │ │ │    │        │           │ │ │    │ │
│ └──────────┘ │ │    │        │           │ └─┘    │ │
│              │ ├────┼────────┼──────────┼─────────┤ │
│              │ │ 02 │ 대본   │ (1)(2)(3) │ ┌─┬─┐  │ │
│              │ │    │        │           │ │ ││ │  │ │
│              │ └────┴────────┴──────────┴─────────┘ │
└──────────────┴──────────────────────────────────────┘
```

**일괄 영상 개수 선택:**

```tsx
<div className="cut-split-batch">
    <span>일괄 설정:</span>
    <button onClick={() => setBatchVideoCount(1)}>모든 컷 1장</button>
    <button onClick={() => setBatchVideoCount(2)}>모든 컷 2장</button>
    <button onClick={() => setBatchVideoCount(3)}>모든 컷 3장</button>
</div>
```

**이미지 박스 시각화 (CEO 항목 5):**

```tsx
<div className="cut-image-boxes">
    {Array.from({ length: videoCount }, (_, i) => (
        <div key={i} className="cut-image-box">
            <span className="cut-image-box__label">
                {videoCount > 1 ? `${videoCount}-${i + 1}` : '이미지'}
            </span>
        </div>
    ))}
</div>
```

---

## Phase 4: GeneratePage 분리 + 일괄 생성 + Animate 진입 (CEO 항목 6, 7, 8)

> 가장 큰 구조 변경. GeneratePage 신규 생성 + SeedCheckPhase 이전.
> 기술 검토: useGeneration 훅 100% 격리, Store 변경 불필요. 실현 가능성 95%+.

### 4-1. GeneratePage 구조 (신규)

**파일:** `src/pages/GeneratePage.tsx` (신규 생성)

```
┌─────────────────────────────────────────────────────────────┐
│ 헤더: 프로젝트 제목 | WorkflowSteps (3/4) | Export          │
├─────────────────────────────────────────────────────────────┤
│ 요약바: "덱: 5개 카드 / 컷: 12개" (v2 추가: 이전 단계 확인) │
├─────────────────────────────────────────────────────────────┤
│ 상단 컨트롤:                                                │
│   [이미지 AI: dropdown] [영상 AI: dropdown]                 │
│   [일괄 이미지 생성] [일괄 영상 생성]                        │
│   진행률: N/M 이미지 · N/M 영상                             │
├─────────────────────────────────────────────────────────────┤
│ 씬별 생성 목록:                                             │
│ ┌───┬──────────┬───────────────┬──────────────────┬───────┐ │
│ │   │ 이미지    │ 이미지 프롬프트 │ 영상 프롬프트    │ 영상  │ │
│ │01 │ ┌──────┐ │ [편집 가능     │ [편집 가능       │┌────┐│ │
│ │   │ │      │ │  textarea]    │  textarea]      ││    ││ │
│ │   │ │ 생성 │ │               │                 ││ 생성││ │
│ │   │ └──────┘ │               │                 │└────┘│ │
│ └───┴──────────┴───────────────┴──────────────────┴───────┘ │
├─────────────────────────────────────────────────────────────┤
│ 하단: [이전: Storyboard] [진행률] [다음: Animate →]         │
│       (v2: 부분 진입 + 전체 진입 2단계)                      │
└─────────────────────────────────────────────────────────────┘
```

### 4-2. 템플릿 유무에 따른 프롬프트 생성 (CEO 항목 6)

**6-A: 템플릿 선택 유저:**
- `buildImagePrompt()` + `buildVideoPrompt()`로 자동 생성
- 템플릿의 promptRules 활용
- 프롬프트 textarea에 미리 채워짐, 유저가 수정 가능

**6-B: 템플릿 미선택 유저:**
- GeneratePage 진입 시: "추가로 반영하고 싶은 내용이 있나요?"
- **있으면** → 내용 입력 → 프롬프트에 추가 반영
- **없으면** → 화면비율 + 아트스타일 + 씨드카드 + 대본 조합으로 자동 생성
- **TODO:** 실제 AI 프롬프트는 추후 입력 (현재는 buildImagePrompt 폴백 활용)

```tsx
const [showAdditionalPrompt, setShowAdditionalPrompt] = useState(!templateId);

{showAdditionalPrompt && (
    <div className="generate-additional-modal">
        <h4>추가로 반영하고 싶은 내용이 있나요?</h4>
        <textarea
            value={additionalInstructions}
            onChange={(e) => setAdditionalInstructions(e.target.value)}
            placeholder="예: 전체적으로 따뜻한 색감, 클로즈업 많이..."
        />
        <button onClick={() => handleGeneratePrompts(additionalInstructions)}>
            반영하여 프롬프트 생성
        </button>
        <button onClick={() => handleGeneratePrompts('')}>
            없음, 자동 생성
        </button>
    </div>
)}
```

### 4-3. 일괄 생성 + 크레딧 사전 안내 (CEO 항목 7 + C7)

**일괄 생성 버튼 (기존 useGeneration 활용):**

```tsx
<button onClick={handleBatchImageGenerate} disabled={allImagesDone}>
    일괄 이미지 생성 ({pendingImageCount}장)
</button>
<button onClick={handleBatchVideoGenerate} disabled={!allImagesDone || allVideosDone}>
    일괄 영상 생성 ({pendingVideoCount}개)
</button>
// v2 추가: 선택 영상 생성
<button onClick={() => generateSelectedVideos(selectedScenes)}>
    선택한 이미지만 영상화 ({selectedScenes.length}개)
</button>
```

**크레딧 사전 안내 모달 (v2 추가 — C7 해결):**

```tsx
const handleBatchImageGenerate = () => {
    const cost = pendingImageCount * CREDIT_COSTS.image;
    setCreditConfirm({
        open: true,
        action: '일괄 이미지 생성',
        count: pendingImageCount,
        cost,
        onConfirm: () => genApi.generateAllScenes(),
    });
};

{creditConfirm.open && (
    <div className="credit-confirm-modal">
        <h4>{creditConfirm.action}</h4>
        <p>{creditConfirm.count}개 생성에 {creditConfirm.cost} 크레딧이 소모됩니다.</p>
        <p>현재 잔여 크레딧: {remaining}</p>
        <button onClick={() => setCreditConfirm({ open: false })}>취소</button>
        <button onClick={() => { creditConfirm.onConfirm(); setCreditConfirm({ open: false }); }}>
            확인, 생성 시작
        </button>
    </div>
)}
```

**진행률 표시 (C5 해결):**

```tsx
<div className="generate-progress">
    <div className="generate-progress__bar">
        <div
            className="generate-progress__fill"
            style={{ width: `${(doneCount / totalCount) * 100}%` }}
        />
    </div>
    <span>{doneCount}/{totalCount} 완료</span>
</div>
```

### 4-4. 라우트 + WorkflowSteps 수정

**파일:** `src/App.tsx`, `src/components/WorkflowSteps.tsx`

```tsx
// App.tsx 라우트 추가
<Route path="/project/generate" element={<GeneratePage />} />

// WorkflowSteps — 4단계 유지, route만 변경 (v2 수정: 5단계 → 4단계)
const CINEMATIC_WORKFLOW = [
    { num: 1, label: 'Idea',       route: '/project/idea' },
    { num: 2, label: 'Storyboard', route: '/project/storyboard' },
    { num: 3, label: 'Generate',   route: '/project/generate' },  // route 변경
    { num: 4, label: 'Animate',    route: '/project/timeline' },
];
```

### 4-5. SeedCheckPhase → GeneratePage 코드 이전

**이전 대상:**
- `useGeneration` 훅 호출 (이미지/영상 생성 상태 + 액션)
- CastStrip 컴포넌트 (씨드 카드 시각화)
- SceneRow → 프롬프트 편집 가능 버전으로 확장
- SceneFilmstrip (진행 상황 필름스트립)
- 일괄 생성 버튼

**StoryboardPage 단순화:**
- seed-check phase 제거 → 2 phase만 남음 (cast-setup → cut-split → 완료)
- "다음" 버튼 클릭 → `/project/generate`로 이동

**컴포넌트 폴더:** 기존 `src/components/storyboard/` 유지 (나레이션 Step 5 호환)

### 4-6. 나레이션 모드 호환 (기술 검토 반영)

```tsx
// GeneratePage에서 나레이션 Step 5도 처리
const GeneratePage: React.FC = () => {
    const { mode, narrationStep } = useProjectStore();

    // 시네마틱 또는 나레이션 Step 5 모두 이 페이지에서 처리
    // 나레이션: 이미지만 생성 후 TimelinePage Step 6으로 이동
    const isNarrationImageStep = mode === 'narration' && narrationStep === 5;
    // ...
};
```

### 4-7. Animate 진입 조건 (CEO 항목 8 + v2 수정)

**v2 변경:** "모든 영상 완료 필수" → 부분/전체 2단계 (UXR 하나 제안 반영)

```tsx
{/* 부분 진입: 이미지만으로도 Animate 가능 */}
<button
    className="btn-secondary"
    onClick={() => navigate('/project/timeline')}
    disabled={doneImageCount === 0}
>
    이미지만으로 Animate 진입
</button>

{/* 전체 진입: 모든 영상 완료 시 */}
<button
    className="btn-primary"
    onClick={() => navigate('/project/timeline')}
    disabled={!allVideosDone}
>
    다음: Animate →
</button>
```

---

## Phase 5: QA + 브라우저 검증

> Phase 1~4 구현 완료 후 타로(QA)와 함께 빌드 검증 + 브라우저 테스트

### 검증 체크리스트

**빌드:**
- [ ] `npm run build` 성공 (TypeScript 0 에러)
- [ ] ESLint 신규 경고 없음

**시네마틱 플로우:**
- [ ] 홈 → "대본부터" → 모드 선택 → IdeaPage 3분할 정상
- [ ] 프리셋 클릭 → 확인 팝업 → 설정 적용
- [ ] 씬 개수 변경 → 이미지 박스 시각화 업데이트
- [ ] Generate Script → 3열에 Breakdown 표시
- [ ] StoryboardPage → AI 모달 (템플릿 유무 분기)
- [ ] 컷 분할 → 일괄 영상 개수 선택
- [ ] GeneratePage → 이미지/영상 생성 + 진행률
- [ ] 크레딧 사전 안내 모달 표시
- [ ] Animate 진입 (부분/전체)

**나레이션 플로우:**
- [ ] 나레이션 모드 전체 8스텝 정상 동작
- [ ] Step 5(이미지 생성) GeneratePage에서 정상

**재진입:**
- [ ] IdeaPage 재진입 시 mode 유지 (A2)
- [ ] StoryboardPage 재진입 시 AI 모달 미표시 (A3)
- [ ] NarrationEditView 다음 버튼 활성화 (A4)

---

## 구현 순서 + 에이전트 배정 (예상)

```
Phase 1 (40분)     → CTO 직접 or 린(FE) — 버그 수정 + 데이터 연결
Phase 2 (3시간)    → 린(FE) + 누리(CSS) 병렬 — IdeaPage 전체 개편
Phase 3 (3시간)    → 린(FE) + 누리(CSS) 병렬 — Storyboard 개편
Phase 4 (5시간)    → 린(FE) + 카이(AI) 병렬 — GeneratePage + 프롬프트
Phase 5 (1시간)    → 타로(QA) — 빌드 + 브라우저 검증
```

**총 예상:** ~12시간 (에이전트 병렬 시 단축 가능)

---

## 수정 파일 목록 (예상)

| 파일 | Phase | 변경 |
|------|-------|------|
| `src/pages/IdeaPage.tsx` | 1, 2 | 3분할, 프리셋 팝업, 데이터 연결, 시각화 |
| `src/index.css` | 2, 3, 4 | 새 레이아웃 + 반응형 CSS |
| `src/pages/StoryboardPage.tsx` | 1, 3, 4 | AI 모달 분기, seed-check 제거 |
| `src/components/storyboard/AiAnalysisModal.tsx` | 3 | 템플릿 유무 분기 |
| `src/components/storyboard/CutSplitPhase.tsx` | 3 | 카드덱 사이드바 + 이미지 박스 + 일괄 선택 |
| `src/pages/GeneratePage.tsx` | 4 | **신규 생성** |
| `src/components/narration/NarrationEditView.tsx` | 1 | disabled 버그 수정 |
| `src/services/prompt-builder.ts` | 1 | instruction + Admin 오버라이드 반영 |
| `src/App.tsx` | 4 | 라우트 추가 |
| `src/components/WorkflowSteps.tsx` | 4 | Step 3 route 변경 |
| `src/pages/TimelinePage.tsx` | 4 | Animate 진입 정리 |

---

## v1 → v2 변경 이력

| # | 변경 | 출처 |
|---|------|------|
| 1 | Phase 1에 B2(Admin→prompt-builder) 추가 | CPO 유나 |
| 2 | B1(BYOK)은 "004에서 처리" 의도적 제외 명시 | CPO 유나 |
| 3 | Phase 2+3 통합 → IdeaPage 한 번에 완성 | CPO 유나 |
| 4 | Phase 4에 C7(크레딧 사전 안내 모달) 추가 | CPO 유나 |
| 5 | 4단계 유지 (5단계 확장 불필요, VISION.md 기준) | CPO 유나 |
| 6 | 프리셋+대본 팝업 → 인라인 배너로 변경 (팝업 피로 방지) | UXR 하나 |
| 7 | 3열 빈 상태 플레이스홀더 + 아이콘 추가 | UXR 하나 |
| 8 | Animate 진입: 부분(이미지만)/전체(영상완료) 2단계 | UXR 하나 |
| 9 | 반응형 CSS 폴백 추가 (1024px, 768px 브레이크포인트) | CPO + 기술검토 |
| 10 | "012 범위 밖" 항목 테이블 추가 | CPO 유나 |
| 11 | GeneratePage 요약바 추가 (이전 단계 확인 불안 해소) | UXR 하나 |
| 12 | Phase 4 공수 3시간 → 5시간 상향 | CPO 유나 |
| 13 | D3(videoGenStatus) Phase 4에서 함께 처리 권장 | CPO 유나 |
| 14 | CEO 결정 4건 확정 반영 | CEO |

---

*이 계획은 CEO 검토/주석 후 구현을 시작합니다.*
