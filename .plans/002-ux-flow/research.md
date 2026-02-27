# 002 - UX 플로우 리서치

> 작성일: 2026-02-27
> 목적: 사용자 경험 전체 흐름 파악, Mock vs 실동작 구분, 문제점 발견

---

## 1. 전체 사이트 맵 & 라우팅

```
/                     → HomePage (진입점)
/project/new          → IdeaPage (새 프로젝트)
/project/idea         → IdeaPage (아이디어/대본)
/project/script       → IdeaPage (동일 페이지)
/project/style        → IdeaPage (동일 페이지)
/project/storyboard   → StoryboardPage
/project/timeline     → TimelinePage
```

**App.tsx 구조:**
- `<ErrorBoundary>` (최외곽)
  - `<BrowserRouter>`
    - `<ProjectSync />` — useProject() 훅 → 자동 저장 (보이지 않는 컴포넌트)
    - `<NavBar />` — 상단 고정
    - `<ErrorBoundary>` (라우트 영역만)
      - `<Routes>` — 6개 라우트

**발견 사항:**
- `/project/new`, `/project/script`, `/project/style` 모두 IdeaPage로 감 → 탭 자동 선택이 안 됨 (URL과 탭 상태가 분리됨)
- 별도의 404 페이지 없음

---

## 2. 사용자 여정 (User Journey)

### 2.1 시나리오 A: 완전 신규 방문자 (게스트)

```
1. 사이트 접속 (/)
   → NavBar: 로고 | Home | 크레딧(50) | Upgrade | New Project | Settings | "게스트" 뱃지
   → My Projects 섹션: 안 보임 (게스트라서)
   → Hero 영역: "What story will you tell today?"
   → Filter 탭: MOST POPULAR | ACTION | SCI-FI | HORROR | DRAMA
   → 하단: 3가지 시작 옵션 + 12개 템플릿 그리드

2. 시작 방법 (택 1):
   a. "Generate" 버튼 (Hero 카드 6개 중 하나) → startNewProject(title) → /project/idea
   b. "아이디어로 만들기" → startNewProject('Untitled') → /project/idea
   c. "빈 프로젝트" → startNewProject('Untitled') → /project/idea
   d. 템플릿 카드 클릭 → startNewProject(template.title) → /project/idea
   e. NavBar "New Project" → /project/idea (startNewProject 안 호출!)

3. IdeaPage 진입
   → useEffect: hasActiveProject가 false면 자동 startNewProject()
   → SCRIPT 탭이 기본 선택
   → 아이디어 입력 or 대본 직접 입력
   ...이하 계속
```

### 2.2 시나리오 B: 로그인 사용자 (재방문)

```
1. 사이트 접속 (/)
   → Supabase OAuth 콜백으로 세션 복원
   → NavBar: 아바타 + 로그아웃 버튼
   → My Projects 섹션 표시 (DB에서 로드)
   → useProject 훅: 최근 프로젝트 DB에서 자동 로드 → store에 채움

2. 기존 프로젝트 이어하기:
   → My Projects에서 카드 클릭
   → loadProject(id) → store 전체 채움
   → /project/idea로 이동

3. 새 프로젝트:
   → 시나리오 A와 동일
   → 차이: useProject 훅이 2초마다 DB 자동 저장
```

### 2.3 시나리오 C: 게스트 → 로그인 전환

```
1. 게스트로 작업 진행 (localStorage에 저장됨)
2. NavBar에서 Google/Kakao 로그인 클릭
3. OAuth 리다이렉트 → 로그인 완료 → 사이트로 돌아옴
4. useProject 훅 발동:
   - DB에 프로젝트 있으면 → DB 데이터로 store 덮어씀 (!!!)
   - DB 비어있으면 → localStorage 데이터를 DB로 마이그레이션
```

**⚠️ 심각한 문제:** 게스트로 작업 중 로그인하면, DB에 기존 프로젝트가 있을 경우 **현재 작업이 사라짐** (DB 데이터로 덮어쓰기)

---

## 3. NavBar 상세 분석

### 3.1 항상 보이는 요소
| 요소 | 동작 | 비고 |
|------|------|------|
| AntiGravity 로고 | → `/` (홈) | 정상 |
| Home 링크 | → `/` | 정상 |
| 크레딧 표시 | `remaining` 숫자 표시 | 크레딧 훅에서 읽음 |
| Upgrade 버튼 | **아무 동작 없음** | ❌ Mock (onClick 없음) |
| New Project | → `/project/idea` (Link) | ⚠️ startNewProject() 미호출 |
| Settings 버튼 | **아무 동작 없음** | ❌ Mock (onClick 없음) |

### 3.2 인증 상태별 표시
| 상태 | 표시 |
|------|------|
| 로딩 중 | 아무것도 안 보임 |
| Supabase 미설정 | "게스트" 뱃지 |
| 로그인됨 | 아바타 + 로그아웃 버튼 |
| Supabase 설정됨 + 미로그인 | Google / Kakao 로그인 버튼 |

### 3.3 MY PROJECTS 링크
- 로그인 사용자에게만 표시
- 클릭하면 → `/` (홈)으로 감 (My Projects 섹션으로 스크롤 안 함)

**⚠️ 문제:** MY PROJECTS 클릭해도 그냥 홈으로 갈 뿐, 해당 섹션으로 앵커 이동 안 됨

---

## 4. 페이지별 상세 UX 플로우

### 4.1 HomePage (`/`)

#### 화면 구성
```
┌─────────────────────────────────────────┐
│ NavBar                                   │
├─────────────────────────────────────────┤
│ [My Projects] (로그인 시만)               │
│  프로젝트 카드들 (스타일 뱃지, 상태, 삭제) │
├─────────────────────────────────────────┤
│ Hero: "What story will you tell today?"  │
│ [Hero Cards × 6] (Generate 버튼)         │
├─────────────────────────────────────────┤
│ Filter: POPULAR | ACTION | SCI-FI | ...  │
├─────────────────────────────────────────┤
│ 시작 옵션 3개:                           │
│  [아이디어로 만들기] [빈 프로젝트] [프리셋] │
├─────────────────────────────────────────┤
│ 템플릿 그리드 (12개)                      │
└─────────────────────────────────────────┘
```

#### 동작 상세
| 액션 | 실동작 | Mock | 비고 |
|------|--------|------|------|
| Hero 카드 "Generate" | ✅ `startNewProject(title)` → `/project/idea` | | |
| "아이디어로 만들기" | ✅ `startNewProject('Untitled')` → `/project/idea` | | |
| "빈 프로젝트" | ✅ `startNewProject('Untitled')` → `/project/idea` | | |
| "프리셋 저장" | | ❌ | 클릭만, 기능 없음 |
| 템플릿 카드 클릭 | ✅ `startNewProject(template.title)` → `/project/idea` | | |
| 프로젝트 열기 | ✅ `loadProject(id)` → store 채움 → `/project/idea` | | Supabase |
| 프로젝트 삭제 | ✅ `deleteProject(id)` + confirm | | Supabase |
| 필터 탭 | ✅ 카테고리 필터 (로컬 상태) | | |

#### 자동 동작 (useEffect)
- 로그인 사용자: `listProjects(user.id)` → My Projects 로드

#### 에러 처리
- 프로젝트 로드 실패: console.warn (사용자에게 안 보임)
- 프로젝트 삭제 실패: console.error (사용자에게 안 보임)

---

### 4.2 IdeaPage (`/project/idea`)

#### 화면 구성
```
┌─────────────────────────────────────────┐
│ NavBar                                   │
├─────────────────────────────────────────┤
│ [제목 (인라인 편집)] [WorkflowSteps 1→2→3→4] │
│ [SCRIPT > STYLE > CAST]  [16:9|9:16|1:1]│
├─────────────────────────────────────────┤
│                                          │
│  (탭 내용 — 아래 상세)                    │
│                                          │
├─────────────────────────────────────────┤
│              [다음: 스토리보드 →]          │
└─────────────────────────────────────────┘
```

#### SCRIPT 탭

**입력 모드 2가지:**

**A. 아이디어 입력 모드:**
```
[textarea: 아이디어 설명 입력]
[씬 수: - N +]
[AI로 대본 생성] ← 크레딧 1 차감
```
- ✅ 실동작: `generateScript()` → AI LLM 호출 (Mock 기본)
- 크레딧 부족 시 alert
- 생성 중: 로딩 스피너

**B. 대본 직접 입력 모드:**
```
[textarea: 대본 전체 붙여넣기]
[씬 수: - N +]
[Generate Script] ← 크레딧 소비 없음
```
- ✅ 실동작: `splitScriptIntoScenes()` → 로컬 알고리즘 (문단 기준 분할)

**생성 후:**
```
Script Breakdown:
[1] 씬 텍스트... [편집✏️] [체크☑️]
[2] 씬 텍스트... [편집✏️] [체크☑️]
...
[다시 입력]
```
- ✅ 인라인 편집 (클릭 → textarea)
- ✅ 씬 체크 토글

#### STYLE 탭
```
12개 스타일 카드 그리드:
[Cinematic] [Anime] [Comic] [3D Render] [Oil Painting] [Watercolor]
[Neon] [Retro] [Vintage Photo] [Steampunk] [Fantasy] [Cyberpunk]
```
- ✅ 클릭 → `setSelectedStyle(name)` → 즉시 저장

#### CAST 탭 (카드 라이브러리)
```
카드 라이브러리 (N장)  [+ 카드 추가]
[전체] [캐릭터(N)] [배경(N)] [아이템(N)]

카드 그리드:
┌──────┐ ┌──────┐ ┌──────┐
│타입뱃지│ │      │ │      │
│이미지  │ │      │ │      │
│이름    │ │      │ │      │
│설명    │ │      │ │      │
│Seed #  │ │      │ │      │
│[X삭제] │ │      │ │      │
└──────┘ └──────┘ └──────┘
```
- ✅ 카드 추가: 모달 → 타입/이름/설명 입력 → `addToCardLibrary()`
- ✅ 카드 삭제: `removeFromCardLibrary(id)`
- ✅ 초기화: cardLibrary 비어있으면 mockCardLibrary 자동 주입

#### 자동 동작 (useEffect)
1. `hasActiveProject` 미설정 시 → `startNewProject(title || 'Untitled Project')`
2. `cardLibrary` 비어있으면 → mockCardLibrary로 채움

#### ⚠️ 발견된 문제
1. **NavBar "New Project"로 진입 시**: Link만으로 이동하여 startNewProject() 미호출 → useEffect에서 보정하지만, 이전 프로젝트의 store 데이터가 잔존할 수 있음
2. **아이디어 탭 ↔ 대본 탭 전환 시**: 입력 내용 초기화 여부 불명확
3. **WorkflowSteps 클릭**: 다른 단계로 바로 이동 가능 (데이터 없이도) → 빈 상태로 StoryboardPage 진입 가능

---

### 4.3 StoryboardPage (`/project/storyboard`)

#### 3개 Phase로 진행

```
Phase Bar: [1. 카드 선택] → [2. 컷 분할] → [3. 시드 매칭 & 생성]
```

#### Phase 1: 카드 선택 (cast-setup)

**진입 시 자동 동작:**
- AI 분석 모달 자동 표시

```
┌──────── AI 대본 분석 모달 ────────┐
│  ✨ AI 대본 분석                   │
│  대본에서 캐릭터3+배경1+아이템1     │
│  자동 추출합니다                    │
│                                    │
│  [네, AI로 분석하기] [기본 카드 사용]│
└────────────────────────────────────┘
```
- "AI로 분석하기": 2.5초 Mock → cardLibrary에서 자동 선택 → 덱 구성
- "기본 카드 사용": aiSuggestedCards에서 5장 자동 선택

**덱 레이아웃:**
```
┌─── 내 덱 (N/8) ──────┬─── 카드 풀 ───────────────┐
│ 캐릭터 그룹            │ [내 라이브러리|AI추천|즐겨찾기|새로만들기] │
│  [카드][카드][카드]     │ [전체|캐릭터|배경|아이템]   │
│ 배경 그룹              │                           │
│  [카드]                │ 카드 그리드...              │
│ 아이템 그룹            │                           │
│  [카드]                │                           │
│                        │                           │
│ [N/M 카드 준비]        │                           │
│ [다음: 컷 분할 →]      │                           │
└────────────────────────┴───────────────────────────┘
```

**덱 규칙:**
- AI 카드: 최대 5장
- 수동 카드: 최대 3장
- 총: 최대 8장

**동작 상세:**
| 액션 | 실동작 | Mock |
|------|--------|------|
| AI 분석 | | ❌ 2.5초 setTimeout Mock |
| 덱에 추가 | ✅ 로컬 상태 (deck[]) | |
| 덱에서 제거 | ✅ 로컬 상태 | |
| 카드 이미지 생성 (✨) | ✅ Replicate API | 기본 Mock |
| 새 카드 만들기 | ✅ deck + cardLibrary 추가 | |

#### Phase 2: 컷 분할 (script-review)

```
┌──────────────────────────────────────┐
│ 컷 리스트:                           │
│ [1] 씬 텍스트... 📍위치 🎬앵글      │
│     영상 개수: [1] [2] [3]           │
│ [2] 씬 텍스트...                     │
│ ...                                  │
│                                      │
│ [← 이전]                [다음 →]     │
└──────────────────────────────────────┘
```

- ✅ 영상 개수 선택 (1~3) → Phase 3에서 서브로우 생성

#### Phase 3: 시드 매칭 & 생성 (seed-check)

```
┌───────────────────────────────────────────────┐
│ 3단계: 컷별 프롬프트 & 시드 매칭               │
│ 진행률: N/M 생성완료  [일괄 이미지 생성]        │
├───────────────────────────────────────────────┤
│ CastStrip: [카드][카드][카드] | [카드] | [+]   │
├───────────────────────────────────────────────┤
│ 6컬럼 씬 행:                                  │
│ 이미지 | 씨드카드 | 대본 | 프롬프트 | 영상     │
│ ──────────────────────────────────────────────│
│ [생성]  [카드들]  텍스트  prefix+...  [대기]   │
│ ...                                           │
├───────────────────────────────────────────────┤
│ FilmStrip: [씬1][씬2][씬3]...[씬10]           │
├───────────────────────────────────────────────┤
│ [← 이전]           [일괄 이미지 생성 / 완료 →] │
└───────────────────────────────────────────────┘
```

**동작 상세:**
| 액션 | 실동작 | Mock | 크레딧 |
|------|--------|------|--------|
| 이미지 개별 생성 | ✅ `generateImage()` | 기본 Mock (Unsplash) | image: 1 |
| 이미지 일괄 생성 | ✅ 모든 씬 순회 | | image × N |
| 영상 개별 생성 | ✅ `generateVideo()` | 기본 Mock (Google TV) | video: 3 |
| 영상 일괄 생성 | ✅ 모든 씬 순회 | | video × N |
| 씬에 씨드 카드 토글 | ✅ 로컬 상태 (sceneSeeds) | | |
| CastStrip 수동 카드 추가 | ✅ 모달 | | |

#### ⚠️ 발견된 문제
1. **Phase 전환 시 데이터 유실**: deck, sceneSeeds 등이 로컬 상태 → 페이지 새로고침 시 사라짐
2. **IdeaPage에서 씬 미생성 시**: mockStoryboardScenes로 폴백 → 사용자는 "내가 만든 씬"이 아닌 Mock 씬을 보게 됨
3. **StoryboardPage의 로컬 상태가 store에 저장 안 됨**: deck, sceneSeeds, videoCountPerScene, sceneGenStatus, videoGenStatus 등 모두 로컬 → DB 저장 안 됨

---

### 4.4 TimelinePage (`/project/timeline`)

```
┌──────────────────────────────────────────────┐
│ [제목]  [WorkflowSteps 1→2→3→ ④]  [Export]   │
├──────────────────────────────────────────────┤
│ ┌──── 프리뷰 ────┬──── 정보 ─────┐           │
│ │                │ 클립 정보      │           │
│ │   이미지/영상   │ 텍스트, 위치   │           │
│ │   프리뷰        │ 카메라, TTS   │           │
│ └────────────────┴───────────────┘           │
├──────────────────────────────────────────────┤
│ 편집 도구: [자르기|이어붙이기|앞으로|뒤로|삭제] │
│           [TTS 전체 생성]                     │
│ N개 클립 · 총 MM:SS · 🔊 M/N                 │
├──────────────────────────────────────────────┤
│ 재생 컨트롤: [◀] [▶/⏸] [▶▶]  00:00/00:50    │
│ 스크러버: ═══════◆══════════                  │
├──────────────────────────────────────────────┤
│ 영상 트랙: [클립1][클립2][클립3]...[클립10]    │
│ TTS 트랙:  [🔊TTS][+추가][⚙️생성중]...        │
└──────────────────────────────────────────────┘
```

**동작 상세:**
| 액션 | 실동작 | Mock | 크레딧 |
|------|--------|------|--------|
| 클립 자르기 (Split) | ✅ 로컬 상태 | | |
| 클립 이어붙이기 (Join) | ✅ 로컬 상태 | | |
| 클립 순서 변경 | ✅ 로컬 상태 | | |
| 클립 삭제 | ✅ 로컬 상태 (최소 1개) | | |
| TTS 개별 생성 | ✅ `generateTTS()` | 기본 Mock (무음 WAV) | tts: 1 |
| TTS 일괄 생성 | ✅ 모든 클립 순회 | | tts × N |
| 재생/일시정지 | | ❌ UI만 (실제 재생 X) | |
| Export | | ❌ 아무 동작 없음 | |

#### ⚠️ 발견된 문제
1. **클립 데이터 출처**: `storeScenes.length > 0 ? storeScenes : mockStoryboardScenes` → StoryboardPage에서 이미지/영상 URL을 씬에 반영했는지에 따라 다름
2. **편집 결과 미저장**: clips 상태가 모두 로컬 → 페이지 새로고침 시 사라짐
3. **실제 영상/TTS 재생 미구현**: isPlaying 상태만 있고, 실제 미디어 재생 코드 없음
4. **Export 완전 미구현**: 최종 결과물 출력 방법 없음

---

## 5. 보이지 않는 뒷단 동작

### 5.1 인증 흐름 (useAuth)

```
앱 시작
  ├─ Supabase 미설정 → isGuest: true, loading: false (즉시)
  └─ Supabase 설정됨
      ├─ getSession() → 세션 있으면 user 설정
      └─ onAuthStateChange → 실시간 감시 (로그인/로그아웃)

로그인 시:
  NavBar [Google] 클릭
  → supabase.auth.signInWithOAuth({ provider: 'google' })
  → 브라우저 리다이렉트 (Google 로그인)
  → 콜백으로 돌아옴 (window.location.origin)
  → onAuthStateChange 발동 → user 설정 → 앱 리렌더링

에러 시:
  → alert('Google 로그인 실패: [메시지]')
```

### 5.2 자동 저장 (useProject)

```
[게스트 모드]
  → 아무것도 안 함
  → localStorage만 사용 (Zustand persist)

[로그인 모드]
  ┌─ 초기 로드 (1회):
  │   DB 프로젝트 있음 → 최근 프로젝트 store에 로드
  │   DB 비어있음 + localStorage 데이터 있음 → DB로 마이그레이션
  │
  └─ 디바운스 자동 저장:
      store 값 변경 감지 (title, scenes, style, aspect, cards, hasActive)
      → 2초 디바운스
      → saveProject() + saveCards()
      → 실패 시 console.error (사용자에게 안 보임!)
```

**자동 저장 조건:**
- `isGuest === false` (로그인)
- `user !== null`
- `isSupabaseConfigured === true`
- `isLoadingFromDbRef.current === false` (DB 로딩 중 아님)
- `hasActiveProject === true` (활성 프로젝트)

**⚠️ 저장되지 않는 데이터:**
- StoryboardPage: deck, sceneSeeds, videoCountPerScene, sceneGenStatus, videoGenStatus, phase
- TimelinePage: clips (편집 결과), ttsGenerating, isPlaying
- 이 데이터들은 모두 **페이지 로컬 상태** → 새로고침 시 유실

### 5.3 localStorage 영속성 (Zustand persist)

```
키: 'antigravity-project'
버전: 3 (마이그레이션 포함)

저장 항목:
  projectId, title, scenes, selectedStyle, cardLibrary,
  credits, hasActiveProject, currentPhase, aspectRatio

저장 안 함:
  timelineClips (빈 배열로 초기화)
  → 타임라인 편집 결과가 세션 간 유지 안 됨!
```

### 5.4 크레딧 시스템

```
초기값: 50 크레딧
비용:
  대본 AI 생성 = 1
  이미지 생성   = 1
  영상 생성     = 3
  TTS 음성     = 1

저장: localStorage (persist)
충전: addCredits() 있지만 호출하는 UI 없음
리셋: resetCredits() 있지만 호출하는 UI 없음
```

**⚠️ 문제:**
- Upgrade 버튼: 동작 안 함
- 크레딧 0이 되면 복구 방법 없음 (리셋 UI 없음)
- 크레딧이 DB에 저장 안 됨 (localStorage만) → 다른 기기에서 다름

---

## 6. Mock vs 실동작 종합표

### ✅ 실제 동작하는 기능

| 카테고리 | 기능 | 조건 |
|----------|------|------|
| **인증** | Google/Kakao 로그인 | Supabase 설정 시 |
| **인증** | 로그아웃 | Supabase 설정 시 |
| **DB** | 프로젝트 생성/로드/삭제/목록 | Supabase 설정 시 |
| **DB** | 카드 저장/로드 | Supabase 설정 시 |
| **DB** | 자동 저장 (2초 디바운스) | 로그인 + hasActiveProject |
| **로컬** | 대본 직접 입력 → 씬 분할 | 항상 |
| **로컬** | 스타일 선택 | 항상 |
| **로컬** | 카드 라이브러리 CRUD | 항상 |
| **로컬** | 덱 구성 | 항상 |
| **로컬** | 타임라인 편집 (자르기/이어붙이기 등) | 항상 |
| **로컬** | 크레딧 차감 | 항상 |
| **AI** | 대본 AI 생성 | API 키 설정 시 (기본 Mock) |
| **AI** | 이미지 생성 | API 키 설정 시 (기본 Mock) |
| **AI** | 영상 생성 | API 키 설정 시 (기본 Mock) |
| **AI** | TTS 음성 생성 | API 키 설정 시 (기본 Mock) |

### ❌ Mock / 미구현

| 카테고리 | 기능 | 상태 |
|----------|------|------|
| **UI** | Upgrade 버튼 | onClick 없음 |
| **UI** | Settings 버튼 | onClick 없음 |
| **UI** | Export 버튼 | onClick 없음 |
| **UI** | "프리셋 저장" | 클릭만 가능 |
| **AI** | StoryboardPage AI 대본 분석 | 2.5초 Mock setTimeout |
| **미디어** | 영상 재생 | UI만, 실제 재생 X |
| **미디어** | TTS 재생 | audioUrl은 Blob, 재생 UI 없음 |
| **출력** | 최종 영상 내보내기 | 완전 미구현 |
| **결제** | 크레딧 구매 | 미구현 |
| **이미지** | 사용자 이미지 업로드 | 미구현 |

---

## 7. 데이터 흐름 다이어그램

```
IdeaPage                    StoryboardPage              TimelinePage
─────────                   ──────────────              ────────────
[SCRIPT 탭]                 [Phase 1]
 아이디어/대본 입력          AI 분석 (Mock)
 → scenes (store)           cardLibrary (store) → deck (local)

[STYLE 탭]                  [Phase 2]
 스타일 선택                 videoCountPerScene (local)
 → selectedStyle (store)

[CAST 탭]                   [Phase 3]
 카드 추가/삭제              sceneSeeds (local)
 → cardLibrary (store)      이미지 생성 → imageUrl (local)
                             영상 생성 → videoUrl (local)

        ↓ store ↓                 ↓ local ↓              ↓ local ↓

        ◆ DB 자동 저장 ◆         ◆ 저장 안 됨 ◆          ◆ 저장 안 됨 ◆
```

**핵심 문제:** StoryboardPage와 TimelinePage의 중요 데이터(생성된 이미지/영상 URL, 덱 구성, 시드 매칭, 타임라인 편집 결과)가 **로컬 상태에만 존재** → DB에 저장되지 않음

---

## 8. WorkflowSteps 네비게이션 분석

```
Step 1: Idea           → IdeaPage에서만 사용
Step 2: Storyboard     → StoryboardPage에서 사용
Step 3: 이미지/비디오 생성 → StoryboardPage에서 사용
Step 4: 영상 편집 및 추출 → TimelinePage에서 사용
```

**onStepClick 동작:** 각 페이지에서 구현
- IdeaPage: `navigate('/project/idea')`, `navigate('/project/storyboard')` 등
- StoryboardPage: Phase 변경 or navigate
- TimelinePage: navigate

**⚠️ 문제:**
- 아무 단계나 클릭 가능 → 데이터 없이 다음 단계 진입 가능
- 이전 단계 미완료 상태 검증 없음

---

## 9. 에러 처리 현황

| 위치 | 에러 종류 | 사용자에게 보이는 피드백 |
|------|----------|------------------------|
| 로그인 실패 | OAuth 에러 | ✅ alert |
| 프로젝트 로드 실패 | Supabase 에러 | ❌ console만 |
| 프로젝트 삭제 실패 | Supabase 에러 | ❌ console만 |
| 자동 저장 실패 | Supabase 에러 | ❌ console만 |
| AI 대본 생성 실패 | API 에러 | ✅ alert |
| 이미지 생성 실패 | API 에러 | ⚠️ 상태만 변경 (UI 표시 불명확) |
| 영상 생성 실패 | API 에러 | ⚠️ 상태만 변경 |
| TTS 생성 실패 | API 에러 | ✅ alert |
| 크레딧 부족 | 잔액 부족 | ✅ alert |
| 네트워크 끊김 | 전반 | ❌ 감지 안 함 |

---

## 10. 발견된 주요 문제 요약

### 🔴 심각 (사용자 경험 파괴)

1. **게스트 → 로그인 시 작업 유실 가능**: DB에 기존 프로젝트가 있으면 현재 작업 덮어씀
2. **StoryboardPage 로컬 상태 유실**: 이미지/영상 생성 결과, 덱 구성, 시드 매칭이 새로고침 시 사라짐
3. **TimelinePage 편집 결과 유실**: 클립 편집/TTS 결과가 새로고침 시 사라짐
4. **크레딧 복구 불가**: 50 크레딧 소진 후 충전 방법 없음

### 🟡 중간 (혼란 유발)

5. **NavBar "New Project"**: startNewProject() 미호출 → 이전 프로젝트 데이터 잔존 가능
6. **WorkflowSteps 제한 없음**: 데이터 없이 다음 단계 이동 가능
7. **IdeaPage 없이 StoryboardPage 진입**: Mock 씬 표시 → 사용자 혼란
8. **Mock 데이터 자동 주입**: 첫 진입 시 cardLibrary에 Mock 카드 자동 추가 → "내가 만든 건지?" 혼란
9. **자동 저장 실패 무응답**: DB 저장 실패해도 사용자에게 알림 없음
10. **영상 재생 미구현**: Play 버튼이 있지만 아무것도 안 됨

### 🟢 경미 (개선 사항)

11. **Upgrade/Settings/Export 버튼 빈 동작**: 클릭해도 아무 반응 없음
12. **MY PROJECTS 앵커 미연결**: 홈으로만 이동
13. **404 페이지 없음**: 잘못된 URL 접근 시 빈 화면
14. **크레딧 기기 간 불일치**: localStorage만 저장 → 다른 기기에서 다른 값
15. **URL과 탭 상태 불일치**: `/project/script`로 가도 SCRIPT 탭 자동 선택 안 됨

---

## 11. AI 서비스 Provider 현황

| 서비스 | 기본(Mock) | 실제 Provider | 환경변수 |
|--------|-----------|---------------|----------|
| LLM (대본) | Mock 템플릿 | OpenAI GPT-4o Mini / Anthropic Claude | `VITE_LLM_API_PROVIDER` |
| 이미지 | Unsplash URL | Replicate (Flux Schnell) | `VITE_IMAGE_API_PROVIDER` |
| 영상 | Google TV 샘플 | Runway Gen-3 Alpha Turbo | `VITE_VIDEO_API_PROVIDER` |
| TTS | 무음 WAV Blob | Fish Speech | `VITE_TTS_API_PROVIDER` |

모든 서비스: 환경변수 미설정 → 자동 Mock 모드

---

## 12. 크레딧 비용 계산 (전체 워크플로우)

10개 씬, 각 1개 영상 기준:
```
대본 AI 생성:  1 × 1 =  1 크레딧
이미지 생성:   1 × 10 = 10 크레딧
영상 생성:     3 × 10 = 30 크레딧
TTS 음성:      1 × 10 = 10 크레딧
───────────────────────────
합계:                   51 크레딧

초기 제공:              50 크레딧 → 1 크레딧 부족!
```

**⚠️ 기본 크레딧(50)으로는 10씬 풀 워크플로우를 완료할 수 없음**

---

---

## 13. 사용자 피드백 × CTO 리서치 크로스체크

> 사용자 피드백 9개 항목 + CTO 리서치 15개 항목을 대조 분석.
> 일부 항목은 사용자가 이전 버전 로컬호스트를 기준으로 말한 것으로, 현재 코드에서 이미 해결된 것도 있음.

### 🔀 크로스체크 결과

| # | 사용자 피드백 | CTO 리서치 매칭 | 현재 상태 | 판정 |
|---|-------------|---------------|----------|------|
| U1 | 홈에서 스타일 선택 → IdeaPage에서 프리셋 정보 팝업 필요 | 리서치에서 미발견 (새 요구사항) | ❌ 미구현 | **신규 기능** |
| U2 | CAST 탭 제거, STYLE → 바로 Storyboard | 리서치 §4.2 탭 구조 | 현재 SCRIPT>STYLE>CAST 3탭 존재 | **수정 필요** |
| U3 | WorkflowSteps 전체 통일 | 리서치 §8 WorkflowSteps | IdeaPage에 이미 있음, 하지만 하위 탭과 혼재 | **구조 개선 필요** |
| U3-1 | Storyboard/Timeline 버튼 어색 | 리서치 §8 | Export 버튼도 빈 동작 | **UI 정리 필요** |
| U4 | 하위 단계가 상위 단계에 종속됨을 표현 | 리서치에서 미발견 (새 요구사항) | 현재 flat 구조 (상위/하위 구분 없음) | **구조 개선 필요** |
| U5 | 컷 분할에 카드 덱 좌측 표시 + 매칭 시각화 | 리서치에서 미발견 (새 요구사항) | Phase 2에 카드 표시 없음 | **신규 기능** |
| U6 | 컷 분할에 씬 수 선택(1~3) 사라짐 | 리서치 §4.3 Phase 2 | ✅ **이미 해결됨** — 현재 코드에 영상 1/2/3 선택 존재 | **해결 완료** |
| U7 | 시드 매칭에서 서브로우 (1-1, 1-2, 1-3) | 리서치 §4.3 Phase 3 | 코드에 서브로우 로직 있으나, 현재 videoCount 기본값 1로 → 모두 단일 행 | **검증 필요** |
| U8 | 미리보기 박스 2배 확대, 씨드카드 겹침, 재생성 버튼 오버레이 | 리서치에서 미발견 (새 요구사항) | 이미지 150~180px, 재생성은 별도 열 | **UI 개선 필요** |
| U9 | 전체 페이지 정리 | 리서치 §10.11 Export/Settings 빈 동작 등 | 미완성 UI 다수 | **정리 필요** |

### 📊 CTO 리서치 고유 발견 (사용자 미언급)

| # | 발견 사항 | 심각도 | 사용자 체감 |
|---|----------|--------|-----------|
| C1 | 게스트→로그인 시 작업 유실 가능 | 🔴 심각 | 높음 — 작업 날아감 |
| C2 | StoryboardPage 로컬 상태 유실 (새로고침) | 🔴 심각 | 높음 — 생성 결과 날아감 |
| C3 | TimelinePage 편집 결과 유실 | 🔴 심각 | 높음 — 편집 날아감 |
| C4 | 크레딧 50으로 풀 워크플로우 불가 (51 필요) | 🔴 심각 | 높음 — 막힘 |
| C5 | NavBar "New Project" startNewProject() 미호출 | 🟡 중간 | 중간 — 이전 데이터 잔존 |
| C6 | 자동 저장 실패 무응답 | 🟡 중간 | 높음 — 데이터 유실 모름 |
| C7 | 영상 재생 미구현 (Play 버튼 빈 동작) | 🟡 중간 | 중간 |
| C8 | Upgrade/Settings/Export 빈 동작 | 🟢 경미 | 낮음 |
| C9 | 404 페이지 없음 | 🟢 경미 | 낮음 |
| C10 | 크레딧 기기 간 불일치 | 🟢 경미 | MVP 이후 |

### 🎯 통합 우선순위 (사용자 피드백 + CTO 발견)

**즉시 해결 (UX 파괴 수준):**
1. C4: 기본 크레딧 50 → 100으로 상향 (1줄 수정)
2. C5: NavBar "New Project"에 startNewProject() 연결

**Phase A — 네비게이션 & 메뉴 구조 개편 (U2, U3, U3-1, U4):**
- CAST 탭 제거 (IdeaPage: SCRIPT > STYLE 2탭만)
- WorkflowSteps 상위/하위 2레벨 구조로 리디자인
- 상위: ① Idea → ② Storyboard → ③ Generate 이미지&비디오 → ④ Animate
- 하위: 각 상위 단계 진입 시 해당 하위 단계 표시

**Phase B — 스타일 프리셋 시스템 (U1):**
- 홈에서 스타일 선택 → IdeaPage 진입 시 프리셋 정보 팝업
- 프롬프트 prefix, 추천 스타일, 추천 캐스트, 추천 비율 표시

**Phase C — StoryboardPage UI 개선 (U5, U7, U8):**
- Phase 2 컷 분할: 좌측 카드 덱 표시 + 매칭 시각화
- Phase 3 시드 매칭: 서브로우 정상 작동 확인
- 미리보기 박스 2배 확대, 씨드카드 겹침, 재생성 오버레이

**Phase D — 데이터 안정성 (C1, C2, C3, C6):**
- 게스트→로그인 데이터 병합 로직 수정
- StoryboardPage 핵심 로컬 상태 → store로 이전
- 자동 저장 실패 시 토스트 알림

**Phase E — 페이지 정리 (U9, C7, C8):**
- 빈 동작 버튼 정리 (disabled + 툴팁 또는 제거)
- 전체적 레이아웃 통일

---

*이 리서치를 기반으로 plan.md에서 구체적 구현 계획을 수립합니다.*
