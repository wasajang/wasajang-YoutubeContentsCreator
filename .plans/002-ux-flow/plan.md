# 002 - UX 플로우 개선 계획

> 작성일: 2026-02-27
> 상태: 🔍 사용자 검토 대기
> 근거: research.md (코드 분석 + 사용자 피드백 9개 + CTO 발견 10개)

---

## 작업 범위 & 접근 방식

이 작업은 **5+개 파일, 아키텍처 변경 포함** → 풀 파이프라인 적용.
하지만 한 번에 전부 하면 위험하므로 **5개 Phase로 쪼개서** 각 Phase를 독립적으로 구현 + 검증합니다.

```
Phase 0: 즉시 수정 (5분)         ← 1줄~3줄 수정, 바로 가능
Phase A: 메뉴 구조 개편 (핵심)    ← 가장 큰 변경, UX 뼈대
Phase B: 스타일 프리셋 팝업       ← 새 기능
Phase C: StoryboardPage UI 개선  ← 비주얼 변경
Phase D: 데이터 안정성            ← 뒷단 안정화
Phase E: 페이지 정리              ← 마무리
```

**추천 순서:** Phase 0 → A → C → B → E → D
(이유: A가 뼈대, C가 사용자 체감 큼, B는 A 완료 후 자연스러움, D는 MVP 이후도 OK)

---

## Phase 0: 즉시 수정 (바로 구현 OK)

### 0-1. 기본 크레딧 50 → 100 상향
- **파일:** `src/store/projectStore.ts`
- **변경:** `credits: 50` → `credits: 100`
- **이유:** 10씬 풀 워크플로우에 51크레딧 필요, 50이면 부족

```typescript
// projectStore.ts, line 126
credits: 100,  // was: 50
// ...
resetCredits: () => set({ credits: 100 }),  // was: 50
```

### 0-2. NavBar "New Project" 클릭 시 startNewProject() 호출
- **파일:** `src/components/NavBar.tsx`
- **변경:** `<Link to="/project/idea">` → 클릭 이벤트에 startNewProject 추가

```tsx
// NavBar.tsx — Link를 onClick 핸들러가 있는 요소로 변경
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';

// NavBar 컴포넌트 안:
const navigate = useNavigate();
const startNewProject = useProjectStore((s) => s.startNewProject);

const handleNewProject = () => {
    startNewProject('Untitled Project');
    navigate('/project/idea');
};

// JSX:
<button className="btn-primary" onClick={handleNewProject}
    style={{ fontSize: '0.75rem', padding: '6px 16px' }}>
    <Plus size={14} />
    New Project
</button>
```

---

## Phase A: 메뉴 구조 개편 + Cast 분리 (핵심 — 가장 큰 변경)

> 사용자 피드백: U2, U3, U3-1, U4 + **추가 피드백: Cast 별도 페이지 분리, 상단 메뉴 통일**
> 목표: (1) 전체 워크플로우 네비게이션을 2레벨로 통일 (2) Cast를 독립 페이지로 분리

### 현재 구조 (문제)
```
IdeaPage:       [1 Idea → 2 Storyboard → 3 이미지/비디오 → 4 영상편집]
                + [SCRIPT > STYLE > CAST] ← 한 줄 텍스트 탭 (StoryboardPage와 스타일 다름!)
StoryboardPage: [1 Idea → 2 Storyboard → 3 이미지/비디오 → 4 영상편집] + [Export] + [?]
                + [1 카드선택 → 2 컷분할 → 3 시드매칭] ← Phase Bar
TimelinePage:   [1 Idea → 2 Storyboard → 3 이미지/비디오 → 4 영상편집]
```
문제점:
- **IdeaPage 상단 메뉴가 StoryboardPage와 시각적으로 다름** (한 줄 텍스트 vs Phase Bar)
- CAST 탭이 IdeaPage에 있어서 어색 + StoryboardPage Phase 1과 중복
- 하위 단계(카드선택, 컷분할 등)가 상위 단계에 종속됨이 안 보임
- WorkflowSteps 이름이 직관적이지 않음

### 목표 구조 (개선)
```
상위 단계 (항상 표시 — 모든 페이지 동일 스타일):
  ① Idea ──── ② Storyboard ──── ③ Generate ──── ④ Animate
                                 (이미지&비디오)

각 상위 단계의 하위 단계 (해당 단계에서만 표시):
  ① Idea:       [대본 작성] → [스타일 선택]
  ② Storyboard: [카드 선택] → [컷 분할]
  ③ Generate:   [시드 매칭] → [이미지 생성] → [영상 생성]
  ④ Animate:    [타임라인 편집] → [TTS] → [Export]

별도 페이지 (프로젝트 워크플로우 밖):
  /my-cast → "나의 배우 · 장소 · 아이템" 카드 라이브러리 관리
  (메인 페이지 NavBar 또는 HomePage에서 접근)
```

### Cast 별도 페이지 분리 설명

**왜 분리하는가:**
- Cast(카드 라이브러리)는 **프로젝트에 종속된 기능이 아님** — 여러 프로젝트에서 재사용하는 "내 에셋 라이브러리"
- IdeaPage에 있으면 "대본→스타일→캐스트" 순서가 강제되어 유저 흐름이 어색
- StoryboardPage Phase 1과 100% 중복

**분리 후 흐름:**
- **MyCastPage** (`/my-cast`): 카드 추가/삭제/편집의 "메인 관리 페이지"
  - NavBar에 "My Cast" 링크 추가 (MY PROJECTS 옆)
  - HomePage에도 "나의 배우 · 장소 · 아이템" 섹션 추가 가능
- **StoryboardPage Phase 1**: 기존대로 덱 구성 (라이브러리에서 선택)
- **IdeaPage**: SCRIPT + STYLE 2개만 (CAST 제거)

### A-1. WorkflowSteps 컴포넌트 리디자인

**파일:** `src/components/WorkflowSteps.tsx`

```tsx
// 현재: 단순 flat 구조
const steps = [
    { num: 1, label: 'Idea' },
    { num: 2, label: 'Storyboard' },
    { num: 3, label: '이미지/비디오 생성' },
    { num: 4, label: '영상 편집 및 추출하기' },
];

// 변경: 2레벨 구조
interface MainStep {
    num: number;
    label: string;
    subSteps: SubStep[];
}

interface SubStep {
    key: string;
    label: string;
}

const mainSteps: MainStep[] = [
    {
        num: 1, label: 'Idea',
        subSteps: [
            { key: 'script', label: '대본 작성' },
            { key: 'style', label: '스타일 선택' },
        ],
    },
    {
        num: 2, label: 'Storyboard',
        subSteps: [
            { key: 'cast-setup', label: '카드 선택' },
            { key: 'cut-split', label: '컷 분할' },
        ],
    },
    {
        num: 3, label: 'Generate',
        subSteps: [
            { key: 'seed-match', label: '시드 매칭' },
            { key: 'image-gen', label: '이미지 생성' },
            { key: 'video-gen', label: '영상 생성' },
        ],
    },
    {
        num: 4, label: 'Animate',
        subSteps: [
            { key: 'timeline', label: '타임라인' },
            { key: 'tts', label: 'TTS' },
            { key: 'export', label: 'Export' },
        ],
    },
];

// Props:
interface WorkflowStepsProps {
    currentMainStep: number;       // 1~4
    currentSubStep?: string;       // 하위 단계 key
    onMainStepClick?: (step: number) => void;
    onSubStepClick?: (key: string) => void;
}
```

**UI 레이아웃:**
```
┌─────────────────────────────────────────────────────────┐
│  ① Idea ────── ② Storyboard ────── ③ Generate ── ④ Animate │  ← 상위 (항상)
│         [대본 작성] → [스타일 선택]                        │  ← 하위 (해당 단계만)
└─────────────────────────────────────────────────────────┘
```

### A-2. IdeaPage 탭 구조 변경

**파일:** `src/pages/IdeaPage.tsx`

변경 사항:
1. **SCRIPT > STYLE > ~~CAST~~ 에서 CAST 탭 완전 제거**
2. 기존 SCRIPT → "대본 작성" (WorkflowSteps 하위 단계 1)
3. 기존 STYLE → "스타일 선택" (WorkflowSteps 하위 단계 2)
4. 기존 IdeaPage 내부 탭 UI(SCRIPT>STYLE>CAST 텍스트 탭) 제거 → WorkflowSteps의 하위 단계로 대체
5. "다음" 버튼: script → style → storyboard (CAST 거치지 않음)
6. **상단 메뉴가 StoryboardPage와 동일한 시각적 스타일**로 통일

```tsx
// 현재: activeTab = 'script' | 'style' | 'cast'
// 변경: WorkflowSteps subStep = 'script' | 'style' (cast 완전 제거)

// 기존 탭 영역(SCRIPT > STYLE > CAST) → 삭제
// WorkflowSteps 하위 단계가 탭 역할을 대신함
```

**CAST 기능은 어디로?**
→ **새 페이지 MyCastPage** (`/my-cast`)로 독립
→ StoryboardPage Phase 1에도 카드 선택 기능 존재 (덱 구성)
→ IdeaPage 진입 시 mockCardLibrary 자동 주입 로직은 유지 (cardLibrary가 비어있을 때)

### A-2b. MyCastPage 신규 생성 (Cast 별도 페이지)

**파일:** `src/pages/MyCastPage.tsx` (신규)

기존 IdeaPage의 CAST 탭 코드를 그대로 이동:
- 카드 라이브러리 (N장) + 카드 추가 버튼
- 타입 필터: 전체 | 캐릭터(배우) | 배경(장소) | 아이템
- 카드 그리드: 타입 뱃지, 이미지, 이름, 설명, Seed, 삭제
- 카드 추가 모달

**변경점 (IdeaPage 대비):**
- 페이지 타이틀: "나의 배우 · 장소 · 아이템"
- WorkflowSteps 미표시 (프로젝트 워크플로우 밖이므로)
- 타입 라벨 한국어화: character→"배우", background→"촬영 장소", item→"소품/아이템"
- NavBar에 "My Cast" 링크 추가

**라우팅:**
```tsx
// App.tsx에 추가:
<Route path="/my-cast" element={<MyCastPage />} />
```

**NavBar 링크:**
```tsx
// NavBar.tsx — MY PROJECTS 옆에:
<Link to="/my-cast" className="navbar__nav-item">
    <Users size={14} />
    My Cast
</Link>
```

### A-3. StoryboardPage 하위 단계 재매핑

**파일:** `src/pages/StoryboardPage.tsx`

현재 Phase:
```
cast-setup → script-review → seed-check
```

변경:
```
상위 단계 2 (Storyboard):
  cast-setup (카드 선택) → cut-split (컷 분할)

상위 단계 3 (Generate):
  seed-match (시드 매칭) → image-gen → video-gen
```

- Phase Bar (하위 단계 바)는 WorkflowSteps 컴포넌트의 하위 레벨로 대체
- `currentMainStep`이 2→3으로 넘어가는 시점: 컷 분할 완료 → 시드 매칭 시작
- Export 버튼: 현재 위치(헤더)에서 제거, Animate 단계로 이동

### A-4. CSS 수정

**파일:** `src/index.css`

- WorkflowSteps 2레벨 스타일 추가
  - 상위: 기존 스타일 유지 (원형 번호 + 선)
  - 하위: 작은 텍스트, 밑줄 or 도트 표시
- IdeaPage SCRIPT>STYLE>CAST 탭 스타일 → 제거 (CAST 관련)
- Phase Bar 스타일 → WorkflowSteps 하위로 통합

### A-5. 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/components/WorkflowSteps.tsx` | 2레벨 구조로 완전 리라이트 |
| `src/pages/IdeaPage.tsx` | CAST 탭 제거, 탭 UI → WorkflowSteps 하위로 대체 |
| `src/pages/MyCastPage.tsx` | **신규** — Cast 카드 라이브러리 독립 페이지 |
| `src/pages/StoryboardPage.tsx` | Phase 재매핑, Phase Bar → WorkflowSteps 하위로 대체 |
| `src/pages/TimelinePage.tsx` | WorkflowSteps props 업데이트 |
| `src/components/NavBar.tsx` | "My Cast" 링크 추가 |
| `src/App.tsx` | `/my-cast` 라우트 추가 |
| `src/index.css` | 새 WorkflowSteps 스타일 + 기존 탭/Phase Bar 스타일 정리 + MyCastPage 스타일 |

---

## Phase B: 스타일 프리셋 팝업 (신규 기능)

> 사용자 피드백: U1
> 목표: 홈에서 스타일 선택 → IdeaPage 진입 시 프리셋 정보 팝업

### B-1. 프리셋 데이터 구조

**파일:** `src/data/stylePresets.ts` (신규)

```typescript
export interface StylePreset {
    name: string;                    // 'Sci-Fi Trailer'
    style: string;                   // 'Cinematic' (스타일 12종 중 하나)
    aspectRatio: '16:9' | '9:16' | '1:1';
    promptPrefix: string;            // 이미지 생성 프롬프트 prefix
    videoPromptHint: string;         // 영상 생성 프롬프트 힌트
    recommendedCast: {               // 추천 캐스트
        characters: number;          // 추천 캐릭터 수
        backgrounds: number;
        items: number;
    };
    description: string;             // 사용자에게 보여줄 설명
}

export const stylePresets: Record<string, StylePreset> = {
    'Sci-Fi Trailer': {
        name: 'Sci-Fi Trailer',
        style: 'Cinematic',
        aspectRatio: '16:9',
        promptPrefix: 'cinematic sci-fi, dramatic lighting, ...',
        videoPromptHint: 'slow motion, epic camera movement',
        recommendedCast: { characters: 3, backgrounds: 2, items: 1 },
        description: '시네마틱 SF 트레일러 스타일. 극적인 조명과 웅장한 카메라 워크.',
    },
    // ... 12개 템플릿 각각에 대해 정의
};
```

### B-2. 프리셋 정보 팝업 컴포넌트

**파일:** `src/components/PresetInfoModal.tsx` (신규)

```tsx
interface PresetInfoModalProps {
    preset: StylePreset;
    onConfirm: () => void;          // 프리셋 적용
    onCustomize: () => void;        // 직접 설정하기
    onClose: () => void;
}
```

팝업 내용:
```
┌─────────── 프리셋 정보 ───────────┐
│ 🎬 Sci-Fi Trailer                 │
│                                    │
│ 📐 추천 영상 비율: 16:9            │
│ 🎨 기본 스타일: Cinematic          │
│ 👥 추천 캐스트: 캐릭터 3, 배경 2    │
│ 🖼️ 이미지 프롬프트 프리셋:         │
│   "cinematic sci-fi, dramatic..."  │
│ 🎥 영상 프롬프트 프리셋:           │
│   "slow motion, epic camera..."    │
│                                    │
│ ℹ️ 모든 설정은 나중에 변경 가능     │
│                                    │
│ [프리셋 적용하기]  [직접 설정하기]   │
└────────────────────────────────────┘
```

### B-3. IdeaPage에 팝업 연결

**파일:** `src/pages/IdeaPage.tsx`

```tsx
// store에 presetName 추가 (또는 startNewProject의 파라미터로 전달)
// IdeaPage 진입 시 presetName이 있으면 팝업 표시
const [showPresetModal, setShowPresetModal] = useState(false);

useEffect(() => {
    const preset = stylePresets[title];
    if (preset) {
        setShowPresetModal(true);
    }
}, []);
```

### B-4. 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/data/stylePresets.ts` | **신규** — 12개 프리셋 데이터 |
| `src/components/PresetInfoModal.tsx` | **신규** — 팝업 컴포넌트 |
| `src/pages/IdeaPage.tsx` | 팝업 연결 로직 추가 |
| `src/index.css` | 팝업 스타일 추가 |

---

## Phase C: StoryboardPage UI 개선

> 사용자 피드백: U5, U7, U8
> 목표: 컷 분할에 카드 덱 표시, 서브로우, 미리보기 확대

### C-1. Phase 2 (컷 분할)에 카드 덱 좌측 표시

**파일:** `src/pages/StoryboardPage.tsx`

현재:
```
[01] 씬 텍스트...  📍위치 🎬앵글  [영상 1/2/3]
```

변경:
```
┌─── 카드 덱 ───┬──── 컷 리스트 ────────────────────────┐
│ 캐릭터          │ [01] 씬 텍스트... [1][2][3]          │
│ [민수][리무]     │ [02] 씬 텍스트... [1][2][3]          │
│ [상호]           │ [03] 씬 텍스트... [1][2][3]          │
│ ──────          │                                      │
│ 배경            │                                      │
│ [얼어붙은]       │                                      │
│ ──────          │                                      │
│ 아이템           │                                      │
│ [성운]           │                                      │
└────────────────┴──────────────────────────────────────┘
```

- 좌측 카드 덱: Phase 1에서 선택한 deck 배열 표시 (읽기 전용)
- 카드 ↔ 컷 사이에 시각적 연결선(점선) 추가는 복잡도 높음 → 1차에서는 좌측 표시만, 연결선은 2차

### C-2. Phase 3 서브로우 정상 작동 확인

**파일:** `src/pages/StoryboardPage.tsx`

현재 코드에 서브로우 로직이 있는지 확인 필요:
- `videoCountPerScene[sceneId]`가 2나 3일 때 → 서브로우 생성
- 코드 분석 결과: Phase 2에서 선택한 `videoCountPerScene`이 Phase 3에서 반영됨
- **하지만** 기본값이 1이어서 Phase 2를 건너뛰면 모두 1개 행으로 표시

수정:
- Phase 2 → Phase 3 전환 시 `videoCountPerScene` 값 확인
- 서브로우 번호 표시: `01`, `01-2`, `01-3` 형식

### C-3. 미리보기 박스 2배 확대 + 씨드카드 겹침 + 재생성 오버레이

**파일:** `src/index.css` + `src/pages/StoryboardPage.tsx`

변경 사항:

**이미지 미리보기:**
```css
/* 현재 */
.scene-row__image { width: 150px; height: 150px; }
/* 변경 */
.scene-row__image { width: 300px; height: 300px; }
```

**씨드 카드 겹침:**
```css
.seed-cards-stack {
    display: flex;
}
.seed-cards-stack .seed-card {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    margin-left: -12px;    /* 겹침 */
    border: 2px solid var(--bg-primary);
    z-index: 1;
}
.seed-cards-stack .seed-card:first-child {
    margin-left: 0;
}
```

**재생성 버튼 오버레이:**
```css
/* 현재: 별도 열에 재생성 버튼 */
/* 변경: 이미지/영상 박스 hover 시 오버레이 */
.scene-row__image-wrapper {
    position: relative;
}
.scene-row__regenerate-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    opacity: 0;
    transition: opacity 0.2s;
}
.scene-row__image-wrapper:hover .scene-row__regenerate-overlay {
    opacity: 1;
}
```

### C-4. 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/pages/StoryboardPage.tsx` | Phase 2 카드덱 좌측 추가, 서브로우 확인, 재생성 위치 변경 |
| `src/index.css` | 이미지 크기 2배, 씨드카드 겹침, 재생성 오버레이 |

---

## Phase D: 데이터 안정성 (MVP 이후도 가능)

> CTO 발견: C1, C2, C3, C6
> 이 Phase는 복잡도 높음 → 별도 계획 문서 추천

### D-1. 개요만 정리

| 항목 | 현재 | 목표 | 난이도 |
|------|------|------|--------|
| 게스트→로그인 데이터 병합 | DB로 덮어씀 | 충돌 시 선택 모달 | 중 |
| StoryboardPage 상태 영속 | 로컬 state | store + DB | 높 |
| TimelinePage 상태 영속 | 로컬 state | store + DB | 높 |
| 자동 저장 실패 알림 | console만 | 토스트 UI | 낮 |

→ Phase D는 이 plan.md 범위 밖, 별도 `.plans/003-data-stability/` 작업으로 분리 추천

---

## Phase E: 페이지 정리

> 사용자 피드백: U9, CTO: C7, C8

### E-1. 빈 동작 버튼 처리

| 버튼 | 현재 | 변경 |
|------|------|------|
| Upgrade | 아무 동작 없음 | disabled + title="준비 중" |
| Settings | 아무 동작 없음 | disabled + title="준비 중" |
| Export | 아무 동작 없음 | disabled + title="Animate 단계에서 이용 가능" |
| "Create preset" | 클릭만 | 숨기기 또는 disabled |

### E-2. 404 페이지

**파일:** `src/pages/NotFoundPage.tsx` (신규)
```tsx
// 간단한 404 페이지 + 홈으로 돌아가기 버튼
// App.tsx의 Routes에 <Route path="*" element={<NotFoundPage />} /> 추가
```

---

## 구현 순서 & 예상 시간

| 순서 | Phase | 예상 시간 | 파일 수 |
|------|-------|----------|---------|
| 1 | **Phase 0**: 즉시 수정 | 5분 | 2개 |
| 2 | **Phase A**: 메뉴 구조 + Cast 분리 | 3~4시간 | 8개 (1개 신규) |
| 3 | **Phase C**: StoryboardPage UI | 1~2시간 | 2개 |
| 4 | **Phase B**: 프리셋 팝업 | 1~2시간 | 4개 (2개 신규) |
| 5 | **Phase E**: 페이지 정리 | 30분 | 3개 |
| - | Phase D: 데이터 안정성 | 별도 작업 | - |

**총 예상:** 약 6~8시간 (Phase D 제외)

### 추천: Phase A를 단계별로 쪼개기
Phase A가 가장 크므로, 다음처럼 3단계로 나눠서 각각 검증:
1. **A-step1:** WorkflowSteps 컴포넌트 리라이트 + IdeaPage 적용
2. **A-step2:** StoryboardPage + TimelinePage 적용
3. **A-step3:** MyCastPage 신규 생성 + NavBar/App.tsx 라우팅

---

## 사용자 결정 필요 사항

### 질문 1: Phase A 메뉴 시각적 스타일
- **옵션 A:** 상위 4단계를 큰 원형 번호로 (현재와 유사), 하위 단계를 그 아래 한 줄로 작은 도트/텍스트 표시
- **옵션 B:** 상위 단계는 탭 바(가로 막대) 형태, 하위 단계는 현재 StoryboardPage Phase Bar처럼 연결선
- **추천:** 옵션 A (현재 StoryboardPage 스타일을 모든 페이지에 통일)

### 질문 2: MyCastPage 접근 경로
- **옵션 A:** NavBar에 "My Cast" 링크 (항상 접근 가능)
- **옵션 B:** HomePage에 "나의 배우 · 장소 · 아이템" 섹션 (My Projects 아래)
- **옵션 C:** NavBar + HomePage 둘 다
- **추천:** 옵션 C — NavBar로 빠른 접근 + HomePage에서 눈에 보이는 섹션

### 질문 3: MyCastPage에서 카드 타입 라벨
- 현재: character / background / item (영문)
- **변경 제안:** 배우(캐릭터) / 촬영 장소(배경) / 소품(아이템) — 한국어
- **확인:** 이 한국어 라벨이 맞는지?

### 질문 4: Phase D(데이터 안정성) 분리
- 게스트→로그인 데이터 유실, 새로고침 시 상태 유실 → 별도 `.plans/003-data-stability/`로 분리해도 되는지?

### 질문 5: Export 버튼 위치
- 현재 StoryboardPage 헤더에 있음
- Animate(Phase 4) 단계로 옮기는 것이 맞는지?

---

*⚠️ 아직 구현하지 않습니다. 사용자 검토 + 주석 후 진행.*
