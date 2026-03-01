# 011-B: 홈 단순화 + IdeaPage 통합 + seed-check 버그 수정

> CEO 결정:
> 1. 3진입점 → "대본 작성으로 시작하기" 단일화
> 2. IdeaPage SCRIPT/STYLE 탭 분리 → 단일 화면 통합
> 3. 프리셋 선택 후 수동 변경 시 프리셋 하이라이트 해제
> 4. 모든 입력 완료 시에만 "다음" 활성화

---

## 고객 여정 (수정 후)

### 전체 흐름
```
홈페이지
  ├── [대본 작성으로 시작하기] 버튼 → 모드 선택 오버레이 → IdeaPage
  ├── [템플릿 카드] 클릭 → 바로 IdeaPage (설정 자동 적용)
  ├── My Cast 미리보기 → /cast 페이지
  └── My Projects → 기존 프로젝트 열기
```

### IdeaPage 고객 여정 (핵심 변경)

```
IdeaPage 진입 (모드 이미 선택됨)
│
├── 화면 좌측: 대본 작성 영역
│   ├── 프로젝트 제목 (편집 가능)
│   ├── 입력 모드 선택 (아이디어 / 대본 직접입력)
│   ├── 텍스트 입력 → [생성] 버튼
│   └── 생성 결과: Script Breakdown (씬 목록, 편집/체크)
│
├── 화면 우측: 스타일 설정 패널
│   ├── 섹션 1: 프리셋 (현재 모드에 맞는 템플릿 카드)
│   │   └── 선택 시 → 아트스타일 + 비율 자동 설정
│   ├── 섹션 2: 아트 스타일 (시네마틱 / 수묵화 / 다크 카툰)
│   │   └── 수동 변경 시 → 프리셋 하이라이트 해제
│   └── 섹션 3: 화면 비율 (16:9 / 9:16 / 1:1)
│       └── 수동 변경 시 → 프리셋 하이라이트 해제
│
└── 하단 바: [다음: 스토리보드 →]
    └── 활성화 조건: 대본 생성됨(씬 ≥ 1) AND 아트스타일 선택됨
```

### 프리셋 ↔ 수동 설정 상호작용

```
유저가 프리셋 "무협지1" 선택
  → templateId = 'martial-arts-narration'
  → artStyleId = 'ink-wash' (자동)
  → aspectRatio = '16:9' (자동)
  → 프리셋 카드 하이라이트 ON

유저가 아트스타일을 "다크 카툰"으로 수동 변경
  → artStyleId = 'dark-cartoon'
  → templateId = null ← 프리셋 해제!
  → 프리셋 카드 하이라이트 OFF

유저가 비율을 "9:16"으로 수동 변경
  → aspectRatio = '9:16'
  → templateId = null ← 프리셋 해제!
  → 프리셋 카드 하이라이트 OFF
```

### 템플릿에서 진입한 경우

```
홈 → 템플릿 카드 "해골 쇼츠" 클릭
  → IdeaPage 진입
  → 우측 패널: 프리셋 "해골 쇼츠" 하이라이트, 아트스타일=다크카툰, 비율=9:16
  → 좌측: 대본 작성 (아이디어 placeholder에 sampleIdea 표시)
```

---

## 수정 파일 목록

| # | 파일 | 변경 내용 |
|---|------|----------|
| 1 | `src/pages/IdeaPage.tsx` | SCRIPT/STYLE 탭 제거, 좌우 분할 레이아웃, 프리셋 해제 로직 |
| 2 | `src/pages/HomePage.tsx` | 3 entry-cards → 단일 CTA, 스타일 프리셋 그리드 제거 |
| 3 | `src/hooks/useGeneration.ts` | allImagesDone/allVideosDone 빈 배열 방어 (2줄) |
| 4 | `src/index.css` | 좌우 분할 레이아웃 CSS, 홈 CTA CSS |

---

## 수정 상세

### 수정 1: IdeaPage.tsx 통합 레이아웃

#### 1-A: 탭 시스템 제거

**삭제:**
- `IdeaTab` 타입
- `activeTab` 상태
- `phase-tabs` UI (SCRIPT > STYLE 탭 버튼)
- `handleSubClick` 핸들러
- `{activeTab === 'script' && ...}`, `{activeTab === 'style' && ...}` 조건부 렌더링

#### 1-B: 좌우 분할 레이아웃

```tsx
<div className="idea-layout">
    {/* ── 좌: 대본 작성 ── */}
    <div className="idea-layout__script">
        {/* 기존 SCRIPT 탭 내용 그대로 (입력 영역 + 결과 영역) */}
    </div>

    {/* ── 우: 스타일 설정 ── */}
    <div className="idea-layout__style">
        {/* 프리셋 섹션 */}
        <div className="idea-style-section">
            <h3 className="idea-style-section__title">프리셋</h3>
            <div className="idea-preset-row">
                {modeTemplates.map((tmpl) => (
                    <div
                        key={tmpl.id}
                        className={`idea-preset-chip ${templateId === tmpl.id ? 'selected' : ''}`}
                        onClick={() => handlePresetSelect(tmpl)}
                    >
                        {tmpl.thumbnail && <img src={tmpl.thumbnail} />}
                        <span>{tmpl.name}</span>
                    </div>
                ))}
            </div>
        </div>

        {/* 아트 스타일 섹션 */}
        <div className="idea-style-section">
            <h3 className="idea-style-section__title">아트 스타일</h3>
            <div className="idea-artstyle-grid">
                {artStyles.map((style) => (
                    <div
                        key={style.id}
                        className={`idea-artstyle-card ${artStyleId === style.id ? 'selected' : ''}`}
                        onClick={() => handleArtStyleChange(style.id)}
                    >
                        <img src={style.thumbnail} />
                        <span>{style.nameKo}</span>
                    </div>
                ))}
            </div>
        </div>

        {/* 화면 비율 섹션 */}
        <div className="idea-style-section">
            <h3 className="idea-style-section__title">화면 비율</h3>
            <div className="idea-ratio-row">
                {aspectOptions.map((opt) => (
                    <button
                        key={opt.ratio}
                        className={`idea-ratio-btn ${aspectRatio === opt.ratio ? 'selected' : ''}`}
                        onClick={() => handleAspectChange(opt.ratio)}
                    >
                        <span>{opt.icon}</span>
                        <span>{opt.label}</span>
                    </button>
                ))}
            </div>
        </div>
    </div>
</div>
```

#### 1-C: 프리셋 해제 로직 (핵심)

```typescript
// 프리셋 선택 → 아트스타일 + 비율 자동 설정
const handlePresetSelect = (tmpl: Template) => {
    setTemplateId(tmpl.id);
    setArtStyleId(tmpl.artStyleId);
    setAspectRatio(tmpl.aspectRatio);
};

// 아트스타일 수동 변경 → 프리셋이 선택되어 있고, 값이 달라지면 해제
const handleArtStyleChange = (styleId: string) => {
    setArtStyleId(styleId);
    if (templateId) {
        const tmpl = getTemplateById(templateId);
        if (tmpl && tmpl.artStyleId !== styleId) {
            setTemplateId(null);  // 프리셋 해제
        }
    }
};

// 비율 수동 변경 → 프리셋이 선택되어 있고, 값이 달라지면 해제
const handleAspectChange = (ratio: string) => {
    setAspectRatio(ratio);
    if (templateId) {
        const tmpl = getTemplateById(templateId);
        if (tmpl && tmpl.aspectRatio !== ratio) {
            setTemplateId(null);  // 프리셋 해제
        }
    }
};
```

#### 1-D: "다음" 버튼 활성화 조건

```typescript
// 다음으로 넘어갈 수 있는 조건
const canProceed = isGenerated && scenes.length > 0 && artStyleId !== '';

// 하단 바
<button
    className="btn-primary"
    onClick={handleNext}
    disabled={!canProceed}
>
    {mode === 'narration' ? '다음: 나레이션 생성 →' : '다음: 스토리보드 →'}
</button>
{!canProceed && (
    <span className="idea-bottom__hint">
        {!isGenerated ? '대본을 먼저 생성하세요' : '아트 스타일을 선택하세요'}
    </span>
)}
```

#### 1-E: checked: false 버그 수정 (L61)

```typescript
// splitScriptIntoScenes 내부
checked: true,  // false → true
```

#### 1-F: 헤더 정리

- `phase-tabs` (SCRIPT > STYLE) 제거
- `phase-header__right` (비율 버튼) 제거 → 우측 패널로 이동
- WorkflowSteps는 유지

#### 1-G: PresetInfoModal 제거

- 프리셋 정보를 별도 모달로 보여줄 필요 없음 (우측 패널에서 바로 확인 가능)
- `showPresetModal`, `hasShownPresetModal` 상태 삭제
- PresetInfoModal import/렌더링 삭제

---

### 수정 2: HomePage.tsx 단순화

#### 2-A: 3 entry-cards → 단일 CTA

**삭제:** L152-198 (3개 entry-card 블록)
**삭제:** L221-257 (스타일 프리셋 그리드)
**삭제:** `activeEntry` 상태, `handleStyleStart`, `handleStyleTemplateSelect`, `handleCastStart`
**삭제:** `Palette`, `Check`, `Star` import (사용처 없으면)

**교체:**
```tsx
<div className="home-cta">
    <button className="home-cta__btn" onClick={handleScriptStart}>
        <FileText size={22} />
        대본 작성으로 시작하기
        <ArrowRight size={16} />
    </button>
</div>
```

나머지 (모드 선택 오버레이, My Cast, My Projects, 템플릿 그리드) 유지.

---

### 수정 3: useGeneration.ts 빈 배열 방어

```typescript
const allImagesDone = scenes.length > 0 && doneSceneCount === scenes.length;
const allVideosDone = scenes.length > 0 && doneVideoCount === scenes.length;
```

---

### 수정 4: CSS (index.css)

```css
/* ── IdeaPage 좌우 분할 레이아웃 ── */
.idea-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
    gap: 0;
}

.idea-layout__script {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px;
    border-right: 1px solid var(--border-subtle);
}

.idea-layout__style {
    width: 320px;
    flex-shrink: 0;
    overflow-y: auto;
    padding: 24px 20px;
    background: var(--bg-secondary);
}

/* 스타일 섹션 */
.idea-style-section {
    margin-bottom: 24px;
}
.idea-style-section__title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 10px;
}

/* 프리셋 카드 */
.idea-preset-chip { ... }
.idea-preset-chip.selected { border-color: var(--accent-primary); }

/* 아트스타일 카드 */
.idea-artstyle-card { ... }
.idea-artstyle-card.selected { border-color: var(--accent-primary); }

/* 비율 버튼 */
.idea-ratio-btn { ... }
.idea-ratio-btn.selected { border-color: var(--accent-primary); }

/* 하단 힌트 */
.idea-bottom__hint { font-size: 0.75rem; color: var(--text-muted); }

/* ── 홈 CTA ── */
.home-cta { ... }
.home-cta__btn { ... }
```

---

## 수정 순서

1. **useGeneration.ts** — 빈 배열 방어 (2줄, 가장 빠름)
2. **IdeaPage.tsx** — 통합 레이아웃 + checked:true + 프리셋 해제 로직
3. **HomePage.tsx** — 3 entry-cards → 단일 CTA + 정리
4. **index.css** — 좌우 분할 + 홈 CTA CSS
5. **빌드 검증** (`npm run build`)

---

## 영향 범위

- WorkflowSteps의 `currentSub` — 기존에 'script'/'style' 탭을 전달했는데, 탭이 없어지므로 단순히 고정값 전달
- `entryPoint` store 필드 — 'style'/'cast' 사용 안 하게 됨 (이번에는 건드리지 않음, scope 최소화)
- PresetInfoModal 컴포넌트 — IdeaPage에서 import 제거. 파일 자체는 삭제하지 않음 (다른 곳에서 사용할 수 있으므로)
