# 005 나레이션 모드 — UX 설계 + 기술 구현 계획

> 작성: CPO 유나 (Opus 4.6)
> 작성일: 2026-02-28
> 상태: CEO 검토 대기
> 입력 자료: Vrew 리서치 + 이지비디오 워크플로우 + 현재 코드 분석 + UX 리뷰
> CEO 결정: **옵션 B 확정** — Beta 라벨로 나레이션 모드를 MVP에 포함

---

## 섹션 1: 경쟁사 워크플로우 비교 분석

### 1.1 3사 비교표

| 항목 | Vrew | 이지비디오 (EasyVideo) | AntiGravity (현재) |
|------|------|----------------------|-------------------|
| **타겟** | 영상 편집 초보자 전체 | YouTube 나레이션 크리에이터 | YouTube 시네마틱 크리에이터 |
| **핵심 패러다임** | "문서 편집 = 영상 편집" | "1~9번 순서대로 누르면 완성" | "4단계 파이프라인" (Idea-Storyboard-Generate-Animate) |
| **시작점** | 4가지 (영상/텍스트/사진/녹화) | 1가지 (대본 입력) | 3가지 (대본/스타일/Cast) |
| **TTS 위치** | 2단계 (텍스트 입력 직후) | 1단계 (최우선) | 4단계 (마지막) |
| **씬 분할** | AI 자동 (문맥+글자수) | 문장 단위 (1~5문장) + 수동 미세조정 | 문단/타이밍 기반 자동 |
| **이미지 생성** | AI 이미지 자동삽입 (10개씩 배치) | 엔진 선택 + 일괄 생성 | AI 이미지 씬별 생성 |
| **프롬프트 생성** | 내부 AI (자막 분석) | 외부 AI (Gemini Gems) | 내부 프롬프트 빌더 (예정) |
| **영상 변환** | 이미지 애니메이션 (Ken Burns) | 이미지->영상 (Grok) + 씬효과 | AI 영상 (Runway/Kling) |
| **타임라인** | 텍스트 중심 2층 (영상줄+자막줄) | 2층 (재생시간+대본) | 클립 스트립 (영상+TTS) |
| **오디오-영상 싱크** | TTS 길이 = 클립 듀레이션 (자동) | TTS 타임스탬프 = 씬 배치 (자동) | **미구현** |
| **캐릭터 일관성** | 없음 (스톡 이미지 위주) | 위스크 (AI 캐릭터 세팅) | Cast 시스템 (시드 매칭) |
| **수동 미세조정** | Enter/Backspace 클립 나누기/합치기 | Enter 나누기 / 화살표 합치기 | Split/Join + 순서 변경 |
| **보기 모드** | 자막 에디터 + 타임라인 | 갤러리/대본/프롬프트 체크박스 토글 | 단일 뷰 |
| **플랫폼** | 데스크톱 앱 (Win/Mac) | 웹 앱 | 웹 앱 |
| **가격** | 월 9,900원~ | 월 19,900원~ | 무료 100크레딧 + Pro 19,900원 |

### 1.2 나레이션형 영상 제작 워크플로우 단계별 비교

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Vrew (6단계)                                │
│  대본입력 → TTS선택 → 자동분할+타이밍 → 이미지매칭 → 편집 → Export  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                      이지비디오 (9단계)                                          │
│  TTS → 자막타임스탬프 → 씬분할 → 연출(프롬프트) → 이미지 → 영상 → 씬효과 → 합본 → 편집  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                   AntiGravity 현재 (나레이션 모드)                         │
│  대본 → TTS → 자동분할 → 스토리보드(이미지생성) → 타임라인(???) → Export   │
│                                                     ↑ 여기가 빈 상태     │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.3 핵심 차이점과 배울 점

#### Vrew에서 배울 점

| 패턴 | 설명 | AntiGravity 적용 |
|------|------|-----------------|
| **텍스트 중심 편집** | 대본 수정 = 영상 편집. 학습 곡선 극히 낮음 | 나레이션 모드에서 "대본 에디터 = 타임라인 편집기" 패턴 차용 |
| **클립 2층 구조** | 영상줄 + 자막줄이 하나의 단위 | NarrationClip = 이미지 + 대본 텍스트 + TTS 오디오 |
| **TTS가 타이밍 결정** | TTS 음성 길이가 클립 듀레이션을 자동 계산 | TTS 생성 후 sentenceTimings로 씬별 duration 자동 설정 |
| **Enter/Backspace 나누기/합치기** | 직관적 텍스트 기반 분할 | 나레이션 타임라인에서 동일 패턴 적용 |

#### 이지비디오에서 배울 점

| 패턴 | 설명 | AntiGravity 적용 |
|------|------|-----------------|
| **1~9 순서대로 완성** | 번호를 따라가면 영상 완성. 인지 부하 최소화 | 나레이션 워크플로우를 명확한 순서형 스텝으로 재설계 |
| **씬 분할 후 수동 미세조정** | 자동 분할 후 엔터/화살표로 수정 | 자동 분할 후 씬 경계 조절 UI |
| **프롬프트 일괄 적용** | 스타일 프롬프트를 모든 씬에 일괄 적용 | AntiGravity 프롬프트 빌더 + 스타일 프리셋으로 동일 구현 |
| **보기 모드 토글** | 갤러리/대본/프롬프트를 체크박스로 전환 | 나레이션 타임라인의 뷰 모드 토글 |
| **10초 이상 씬은 분할 권고** | UX 가이드라인 | 분할 시 duration 경고 표시 |

#### AntiGravity만의 차별점 (경쟁사에 없는 것)

| 차별점 | 설명 |
|--------|------|
| **Cast 시스템** | 시드 매칭으로 캐릭터 일관성 유지 (Vrew에 없음, 이지비디오는 위스크 의존) |
| **3진입점** | 대본/스타일/Cast 어디서든 시작 가능 (이지비디오는 대본만) |
| **스타일 프리셋** | 프리셋 하나로 스타일+프롬프트+AI모델 일괄 설정 |
| **UGC 마켓** | 유저가 만든 프리셋을 공유/판매 (경쟁사에 없음) |
| **듀얼 모드** | 시네마틱 + 나레이션 둘 다 지원 (경쟁사는 하나만) |

---

## 섹션 2: AntiGravity 나레이션 모드 — 개선된 고객 여정 설계

### 2.1 설계 원칙

1. **이지비디오의 "순서대로 누르면 완성" 원칙 차용** — 각 스텝에 번호를 부여하고, 1번부터 순서대로 진행하면 영상 완성
2. **Vrew의 "텍스트 중심 편집" 차용** — 나레이션 타임라인에서 대본 텍스트가 편집의 중심
3. **AntiGravity의 차별점 유지** — Cast 시스템, 스타일 프리셋, 3진입점은 그대로

### 2.2 전체 워크플로우 (8스텝) — CEO 확정 (2026-02-28)

> **CEO 결정:** 이미지 생성과 영상화를 분리. 영상화도 Beta에서 작동하도록 구현.
> **이유:** (1) 이미지 재생성이 필요할 수 있고, (2) 원하는 씬만 선택적으로 영상화하고 싶을 수 있음.

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│              AntiGravity 나레이션 모드 — 개선된 워크플로우 (8스텝)                      │
│                                                                                    │
│  Step 1   Step 2    Step 3   Step 4   Step 5   Step 6    Step 7   Step 8         │
│  ──────   ──────    ──────   ──────   ──────   ──────    ──────   ──────         │
│  대본     음성TTS    분할     연출     이미지    영상화     편집    내보내기        │
│  Script   Voice     Split    Direct   Image    Video     Edit    Export          │
│                                                                                    │
│  [Idea    [Narrate            [Generate                  [Edit                    │
│   Page]    Page]               Page / StoryboardPage]     Page]                   │
│                                                                                    │
│   기존      신규       신규      기존 재활용    신규UI     핵심신규   미래           │
│                                                기존영상생성                         │
│                                                코드 재활용                          │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**핵심 변경:**
- 기존 4페이지(Idea-Storyboard-Timeline) 구조를 유지하되, 나레이션 모드에서는 페이지 내부의 UI와 진행 순서가 달라짐
- **Step 5(이미지)와 Step 6(영상화) 분리** — 이미지 개별 재생성 + 선택적 영상화
- Step 6(영상화): 체크한 씬만 AI 영상 변환, 나머지는 Ken Burns 효과 자동 적용

### 2.3 각 단계 상세 설계

---

#### Step 1: 대본 (Script) — IdeaPage 재활용

**유저 행동:**
- (A) 직접 대본 입력 (textarea)
- (B) AI에게 주제만 알려주고 대본 생성 요청
- (C) 스타일 프리셋 선택 (이미지 스타일 설정)
- (D) 영상 비율 선택 (16:9 / 9:16 / 1:1)

**시스템 자동 처리:**
- AI 대본 생성 시 장르/톤에 맞는 나레이션 스크립트 생성
- 선택된 스타일과 비율을 store에 저장

**기존 코드 변경:** 최소 (IdeaPage 거의 그대로)
- "다음" 버튼 텍스트: "다음: 나레이션 생성 ->" 유지
- 나레이션 모드에서 STYLE 탭 유지 (이미지 생성에 필요)

**UI 모습:**
```
┌──────────────────────────────────────────┐
│  [1] Script  [2] Voice  ...  [7] Export  │  <- 나레이션 전용 워크플로우 스텝
├──────────────────────────────────────────┤
│  [SCRIPT]  [STYLE]                       │
│  ┌────────────────────────────────────┐  │
│  │  대본을 입력하세요...               │  │
│  │                                    │  │
│  │  (또는 AI로 생성)                   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  비율: [16:9] [9:16] [1:1]              │
│                                          │
│  [다음: 음성 생성 ->]                     │
└──────────────────────────────────────────┘
```

---

#### Step 2: 음성 TTS (Voice) — NarratePage (신규 페이지 or TimelinePage 분기)

**유저 행동:**
- TTS AI 모델 선택 (Fish Speech / ElevenLabs / Mock)
- "음성 생성" 버튼 클릭
- 생성된 음성 미리듣기
- 마음에 안 들면 "재생성"

**시스템 자동 처리:**
- 전체 대본을 하나의 TTS 오디오로 생성
- 문장별 타이밍 추출 (sentenceTimings)
- 전체 오디오 duration 계산

**핵심 설계 — "이지비디오 1번: 음성" 패턴 차용:**
이지비디오에서는 TTS가 첫 번째 단계. 음성이 생성되어야 타이밍이 나오고, 타이밍이 있어야 씬을 나눌 수 있음. 이 순서가 핵심.

**UI 모습:**
```
┌──────────────────────────────────────────┐
│  [1] Script  [2] Voice  ...  [7] Export  │
├──────────────────────────────────────────┤
│                                          │
│   전체 대본 (12개 씬, 총 842자)          │
│  ┌────────────────────────────────────┐  │
│  │  "2045년, 한반도 비무장지대.       │  │
│  │   지하 300m에서 발견된 신호는..."   │  │
│  │                   (대본 미리보기)    │  │
│  └────────────────────────────────────┘  │
│                                          │
│   TTS AI:  [Fish Speech ▼]              │
│   음성:    [차분한 남성 ▼]               │
│                                          │
│   [음성 생성]                             │
│                                          │
│   --- 생성 완료 후 ---                    │
│                                          │
│   [▶ 미리듣기]  3:42  [재생성]            │
│                                          │
│   문장별 타이밍:                          │
│   00:00 - 00:03  "2045년, 한반도..."     │
│   00:03 - 00:07  "지하 300m에서..."      │
│   ...                                    │
│                                          │
│   [다음: 씬 분할 ->]                      │
└──────────────────────────────────────────┘
```

**기존 코드 재활용:** TimelinePage의 나레이션 TTS 섹션 (L373-450)을 그대로 활용하되, 독립된 뷰로 분리.

---

#### Step 3: 분할 (Split) — NarratePage 내 두 번째 단계

**유저 행동:**
- 자동 분할 결과 확인 (TTS 타이밍 기반)
- 원하면 씬 경계 수동 조정 (문장을 다른 씬으로 드래그, 또는 문장 사이 클릭으로 씬 나누기)
- 10초 이상인 씬에 경고 표시 → 분할 추천
- "확인" 클릭으로 씬 목록 확정

**시스템 자동 처리:**
- sentenceTimings 기반으로 씬 자동 분할 (maxDuration 5초 기준)
- 각 씬의 duration 계산 (TTS 타이밍 합산)
- 씬 목록을 store.scenes에 저장

**핵심 설계 — "이지비디오 3번: 분할" 패턴 차용:**
이지비디오는 1~5문장 단위로 분할하고, 10초 이상 씬은 수동 분할을 권고. 이 패턴을 적용.

**UI 모습:**
```
┌──────────────────────────────────────────┐
│  [1] Script  [2] Voice  [3] Split  ...   │
├──────────────────────────────────────────┤
│                                          │
│   씬 분할 결과 (31개 씬)                  │
│   ┌──────────────────────────────────┐   │
│   │ 씬 1 (3.2s)                      │   │
│   │ "2045년, 한반도 비무장지대."      │   │
│   ├────── 씬 경계 ─── [나누기|합치기] │   │
│   │ 씬 2 (4.1s)                      │   │
│   │ "지하 300m에서 발견된 신호는..."   │   │
│   ├────── 씬 경계 ─── [나누기|합치기] │   │
│   │ 씬 3 (11.3s) ⚠️ 10초 초과        │   │
│   │ "그것은 50년 전 실종된..."        │   │
│   │ → [이 씬 나누기] 추천             │   │
│   └──────────────────────────────────┘   │
│                                          │
│   분할 기준: [5초 ▼]                      │
│   총 31개 씬 | 총 3:42                    │
│                                          │
│   [다음: 연출 ->]                         │
└──────────────────────────────────────────┘
```

**기존 코드 재활용:** `handleAutoSplit` 로직 (TimelinePage L117-158)을 리팩토링하여 분리.

---

#### Step 4: 연출 (Direct) — StoryboardPage 재활용

**유저 행동:**
- Cast 카드 선택 (AI 분석 모달 → 캐릭터+배경+아이템 설정)
- 스타일이 이미 선택되어 있으므로 자동 적용
- 각 씬에 프롬프트 자동 생성 (프롬프트 빌더)
- 원하면 개별 씬 프롬프트 수정

**시스템 자동 처리:**
- 프롬프트 빌더가 [스타일 + Cast + 씬 대본]을 조합하여 각 씬의 이미지 프롬프트 자동 생성
- 이지비디오의 "Gemini Gems로 프롬프트 자동 생성 → 일괄 적용" 패턴을 내부 프롬프트 빌더로 구현

**핵심 설계 — "이지비디오 4번: 연출" 패턴 차용:**
이지비디오는 Gemini Gems라는 외부 도구로 프롬프트를 생성하지만, AntiGravity는 내부 "프롬프트 생성 AI" (VISION.md 섹션 4의 내부 전용 AI)가 이 역할을 수행.

**기존 코드 재활용:** StoryboardPage의 cast-setup 단계. 나레이션 모드에서는 cut-split을 스킵하고 cast-setup → seed-check으로 진행 (기존 동작 유지).

---

#### Step 5: 이미지 (Image) — StoryboardPage seed-check 재활용

**유저 행동:**
- AI 이미지 모델 선택
- "전체 이미지 생성" 클릭 → 일괄 생성
- 개별 이미지 확인 + 마음에 안 드는 것만 재생성
- "다음: 편집으로 이동" 클릭

**시스템 자동 처리:**
- 선택된 AI 모델로 모든 씬 이미지 배치 생성
- Cast 시드 매칭으로 캐릭터 일관성 유지
- 생성 완료된 이미지를 각 씬에 연결

**핵심 설계 — "이지비디오 5번: 이미지" + "Vrew의 AI 이미지 자동삽입" 패턴 차용:**
전체 씬에 대해 일괄 생성하되, 개별 교체도 가능.

**기존 코드 재활용:** StoryboardPage의 seed-check 단계 그대로. 이미지 생성 후 "다음: 영상화" 버튼으로 Step 6 이동.

---

#### Step 6: 영상화 (Video) — 신규 UI (CEO 확정)

> **CEO 결정 (2026-02-28):** 이미지와 영상화를 분리. Beta에서도 작동하도록 구현.
> **이유:** 이미지 중 재생성이 필요할 수 있고, 원하는 씬만 선택적으로 영상화하고 싶음.

**유저 행동:**
- 전체 씬 목록에서 영상화할 씬을 **체크박스로 선택** (이지비디오 패턴)
- AI 영상 모델 선택 (Runway / Kling / Gemini 등)
- "선택된 씬 영상화" 클릭 → 체크한 씬만 이미지→영상 변환
- 영상화하지 않은 씬에는 **Ken Burns 효과 자동 적용** (줌인/패닝 등)
- 개별 씬의 Ken Burns 효과 변경 가능
- 영상화 결과 미리보기

**시스템 자동 처리:**
- 체크된 씬: AI 영상 생성 API 호출 (기존 ai-video 서비스 재활용)
- 미체크 씬: Ken Burns 효과 중 랜덤 또는 유저 선택 적용
- 각 영상/이미지의 duration = TTS 타이밍 기반 자동 계산
- 6초 영상이 씬 duration보다 길면 트리밍, 짧으면 슬로우 재생 (이지비디오 패턴)

**핵심 설계 — "이지비디오 6번: 비디오 + 7번: 씬효과" 통합:**
이지비디오는 6번(영상화)과 7번(씬효과)이 별도 단계지만, AntiGravity에서는 하나의 화면에서 처리.

**UI 모습:**
```
┌──────────────────────────────────────────────────────────────────┐
│  ... [5] Image  [6] Video  [7] Edit  [8] Export                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  영상화 모델: [Runway Gen-4 ▼]        [선택된 씬 영상화 (3/12)]  │
│                                                                  │
│  ┌───┬────────┬─────────────────────┬──────────────────┐        │
│  │ ☑ │ [img1] │ "2045년, 한반도..." │ 🎬 영상화 완료    │        │
│  ├───┼────────┼─────────────────────┼──────────────────┤        │
│  │ ☑ │ [img2] │ "지하 300m에서..."  │ ⏳ 영상화 중...   │        │
│  ├───┼────────┼─────────────────────┼──────────────────┤        │
│  │ ☐ │ [img3] │ "그것은 50년 전..." │ Ken Burns: [줌인▼]│        │
│  ├───┼────────┼─────────────────────┼──────────────────┤        │
│  │ ☑ │ [img4] │ "신호의 정체는..."  │ 🎬 대기 중       │        │
│  ├───┼────────┼─────────────────────┼──────────────────┤        │
│  │ ☐ │ [img5] │ "어둠 속에서..."    │ Ken Burns: [패닝▼]│        │
│  └───┴────────┴─────────────────────┴──────────────────┘        │
│                                                                  │
│  ☑ 영상화: 3개 (크레딧 15)  |  ☐ Ken Burns: 9개 (무료)          │
│                                                                  │
│  [다음: 편집 ->]                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**기존 코드 재활용:**
- `src/services/ai-video.ts` (Mock/실 영상 생성 API) — 시네마틱 모드용 기존 코드
- StoryboardPage seed-check의 영상 생성 버튼 로직 참고

---

#### Step 7: 편집 (Edit) — NarrationEditPage (신규 레이아웃)

**이것이 나레이션 모드의 핵심 차별 기능.**

**유저 행동:**
- 대본 리스트 뷰에서 씬별 이미지/영상 + 대본 + 타이밍 확인
- 씬 순서 드래그로 변경
- 씬 텍스트 수정 → TTS 자동 재생성 옵션
- 전체 영상 미리보기 (Play/Pause) — 영상화된 씬은 영상 재생, 미영상화 씬은 Ken Burns
- 뷰 모드 토글 (갤러리뷰 / 리스트뷰 / 타임라인뷰)

**시스템 자동 처리:**
- TTS 오디오 + sentenceTimings에 맞춰 씬별 duration 자동 설정
- 영상화된 씬: AI 생성 영상 재생 (duration에 맞춰 트리밍/슬로우)
- 미영상화 씬: 이미지 + Ken Burns 효과 자동 적용
- 씬 전환 시 페이드 효과 자동 적용
- 전체 타임라인 자동 계산

**핵심 설계 — "Vrew 텍스트 편집 = 영상 편집" + "이지비디오 2층 타임라인" 차용:**

```
┌──────────────────────────────────────────────────────────────────┐
│  ... [5] Image  [6] Video  [7] Edit  [8] Export                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┬─────────────────────────────────────────┐  │
│  │  [미리보기]       │  씬 리스트 (텍스트 중심 편집)            │  │
│  │                  │  ┌─────────────────────────────────┐    │  │
│  │  ┌────────────┐  │  │ 1. [이미지] "2045년, 한반도..."  │    │  │
│  │  │            │  │  │    3.2s | Ken Burns: 줌인       │    │  │
│  │  │  현재 씬의  │  │  ├─────────────────────────────────┤    │  │
│  │  │  이미지/영상 │  │  │ 2. [이미지] "지하 300m에서..."  │    │  │
│  │  │  프리뷰     │  │  │    4.1s | Ken Burns: 패닝       │    │  │
│  │  │            │  │  ├─────────────────────────────────┤    │  │
│  │  └────────────┘  │  │ 3. [이미지] "그것은 50년 전..."  │    │  │
│  │                  │  │    5.5s | Ken Burns: 줌아웃      │    │  │
│  │  [▶] 0:03/3:42  │  └─────────────────────────────────┘    │  │
│  │                  │                                         │  │
│  │  뷰: [갤러리]     │  오디오: ━━━━━━━━●━━━━━━━  3:42        │  │
│  │      [리스트]     │  [▶ 전체 재생]  [효과 일괄 적용]         │  │
│  │      [타임라인]   │                                         │  │
│  └─────────────────┴─────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  [하단] 나레이션 타임라인 바                                  │  │
│  │  [이미지] |img1|img2|img3|img4|img5|img6|...               │  │
│  │  [오디오] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  TTS 파형        │  │
│  │  [자막]   |문장1|문장2|문장3|문장4|...                       │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**3층 타임라인 (이지비디오 + Vrew 융합):**

| 층 | 내용 | 연동 |
|----|------|------|
| 이미지 트랙 | 씬별 이미지 썸네일 | 씬 클릭 → 미리보기 패널에 표시 |
| 오디오 트랙 | TTS 전체 파형 | 재생 시 현재 위치 표시 |
| 자막 트랙 | 문장별 텍스트 블록 | 문장 클릭 → 해당 씬 선택 |

**오디오-영상 싱크 메커니즘:**

```
TTS 전체 오디오:  |────────────────────────────────────|
                  0s                                  222s

sentenceTimings:  |s1|s2|s3|  s4  |s5|s6|  s7  |...|
                  0  3  7  11    18 22 26    33

씬 분할 결과:     |씬1 |씬2     |씬3    |씬4     |...|
                  0   7       18      33

이미지 배치:      |img1|img2    |img3   |img4    |...|
                  각 이미지 duration = 해당 씬의 sentenceTimings 합산
```

**싱크 원리:**
1. TTS 생성 → sentenceTimings 확보 (각 문장의 startTime, endTime)
2. 씬 분할 → 연속된 문장들을 하나의 씬으로 그룹핑
3. 씬 duration = 해당 씬에 속한 마지막 문장의 endTime - 첫 문장의 startTime
4. 이미지 표시 시간 = 씬 duration (자동 계산)
5. 재생 시: 현재 시간(초) → 해당 시간에 맞는 씬 → 해당 이미지 + 자막 표시

---

#### Step 8: 내보내기 (Export) — 미래 구현

**유저 행동:**
- 해상도 선택 (720p / 1080p)
- "내보내기" 클릭

**시스템 자동 처리:**
- 이미지 시퀀스 + TTS 오디오 + 자막 → 서버사이드 영상 렌더링 (FFmpeg)
- MP4 다운로드 링크 제공

**MVP Beta 범위:** Export 버튼은 disabled. "곧 지원 예정" 라벨. 미리보기(Play)까지만 지원.

---

### 2.4 이지비디오의 "씬 분할 → 프롬프트 → 이미지 → 영상" 패턴 적용

이지비디오 워크플로우 3~6번을 AntiGravity에 다음과 같이 적용:

```
이지비디오                          AntiGravity 나레이션 모드
──────────                          ─────────────────────────
3. 씬 분할 (1~5문장 단위)     →    Step 3: Split (타이밍 기반 자동 + 수동 미세조정)
4. 연출 (Gemini Gems 프롬프트) →    Step 4: Direct (내부 프롬프트 빌더 + Cast 시드 매칭)
5. 이미지 (AI 일괄 생성)       →    Step 5: Image (AI 일괄 생성 + 개별 재생성)
6. 비디오 (이미지→영상)        →    Step 6: Video (선택적 영상화 + Ken Burns 혼합)
7. 씬효과 (애니메이션)         →    Step 6에 통합 (Ken Burns 효과 = 이지비디오의 씬효과)
```

**이지비디오 대비 개선점:**
- 이지비디오는 프롬프트를 Gemini Gems라는 외부 도구에서 만들어야 하지만, AntiGravity는 내부에서 자동 생성
- 이지비디오는 캐릭터 세팅을 별도로 해야 하지만, AntiGravity는 Cast 시스템이 자동 처리
- 이지비디오는 6번(비디오)+7번(씬효과)이 별도 단계지만, AntiGravity는 Step 6 하나로 통합 (체크=영상화, 미체크=Ken Burns)
- 이지비디오는 영상화 프롬프트를 외부(Gemini)에서 만들지만, AntiGravity는 이미지 프롬프트 기반 자동 생성

### 2.5 Vrew의 "텍스트 편집 = 영상 편집" 패턴 적용

**핵심 원칙:** 나레이션 모드의 Step 7 (Edit)에서 대본 텍스트를 수정하면 연관된 모든 것이 자동 조정.

| 유저 행동 | 시스템 자동 처리 |
|-----------|----------------|
| 씬 텍스트 수정 | TTS 재생성 대기열에 추가 (수동 확인 후 재생성) |
| 씬 삭제 | 해당 이미지 + 타이밍 함께 삭제, 전체 타임라인 재계산 |
| 씬 순서 변경 (드래그) | 이미지 순서 + 타이밍 자동 재배치 |
| 씬 나누기 (커서 위치에서 분할) | 이미지 복제 + TTS 타이밍 분할 |
| 씬 합치기 (인접 씬 병합) | 텍스트 합치기 + duration 합산 |

**MVP Beta에서는 부분 적용:**
- 씬 삭제, 순서 변경, 나누기, 합치기: 구현
- 텍스트 수정 → TTS 자동 재생성: "재생성 필요" 뱃지만 표시 (자동 재생성은 Phase 2)

### 2.6 오디오-영상 싱크 UI 상세 설계 (Step 7 핵심)

#### 2.6.1 NarrationClip 데이터 구조

```typescript
interface NarrationClip {
  id: string;
  sceneId: string;

  // 텍스트 레이어
  text: string;                    // 씬 대본
  sentences: SentenceTiming[];     // 이 씬에 속한 문장들의 타이밍

  // 비주얼 레이어
  imageUrl: string;                // AI 생성 이미지
  videoUrl: string;                // AI 생성 영상 (Step 6에서 영상화된 경우)
  isVideoEnabled: boolean;         // true: 영상 재생, false: 이미지 + Ken Burns
  effect: 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';  // Ken Burns 효과 (미영상화 씬용)

  // 오디오 레이어 (전체 TTS에서 이 씬 구간)
  audioStartTime: number;          // 전체 TTS 오디오 내 시작 시간
  audioEndTime: number;            // 전체 TTS 오디오 내 종료 시간
  duration: number;                // audioEndTime - audioStartTime

  // 메타
  order: number;
  isModified: boolean;             // 텍스트 수정됨 (TTS 재생성 필요)
}
```

#### 2.6.2 3층 타임라인 상호작용

```
[이미지 트랙]
┌────────┬──────────────┬───────────┬──────────────┐
│  img1  │    img2      │   img3    │    img4      │
│  3.2s  │    7.1s      │   5.5s    │    8.3s      │
└────────┴──────────────┴───────────┴──────────────┘

[오디오 트랙] — 전체 TTS 파형
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ↑ 현재 재생 위치 (playhead)

[자막 트랙]
┌──────┬──────┬────────┬────┬──────────┬──────┬────┐
│ 문장1 │ 문장2 │  문장3  │문장4│   문장5   │ 문장6 │문장7│
└──────┴──────┴────────┴────┴──────────┴──────┴────┘
```

**상호작용:**
- 이미지 트랙 클릭 → 해당 씬 선택 + 미리보기 패널에 표시
- 오디오 트랙 클릭 → playhead 이동 + 해당 시점의 씬/자막 하이라이트
- 자막 트랙 클릭 → 해당 문장이 속한 씬 선택
- 이미지 트랙 경계 드래그 → 씬 분할/병합 (Vrew의 Enter/Backspace 패턴)

#### 2.6.3 미리보기 재생 로직

```
재생(Play) 클릭 시:
1. 전체 TTS 오디오 재생 시작
2. requestAnimationFrame 루프에서 현재 재생 시간(currentTime) 추적
3. currentTime에 해당하는 NarrationClip 찾기 (audioStartTime <= currentTime < audioEndTime)
4. 해당 클립의 이미지를 미리보기 패널에 표시
5. Ken Burns 효과를 CSS animation으로 적용 (duration = clip.duration)
6. 해당 시점의 자막(sentence) 텍스트를 미리보기 패널 하단에 표시
7. 3층 타임라인의 playhead 위치 업데이트
8. 끝까지 재생 완료 시 정지
```

---

## 섹션 3: 기술 구현 계획

### 3.1 수정해야 할 파일 목록

| 파일 | 변경 내용 | 변경 규모 |
|------|-----------|-----------|
| `src/store/projectStore.ts` | NarrationClip 타입 추가, narrationClips 상태, Store v6 마이그레이션 | 중 |
| `src/components/WorkflowSteps.tsx` | NARRATION_WORKFLOW 8스텝 재정의 | 소 |
| `src/components/WorkflowSteps.css` | 8스텝 레이아웃 조정 | 소 |
| `src/pages/TimelinePage.tsx` | 나레이션 모드 분기 → NarrationEditView 렌더 | 중 |
| `src/pages/StoryboardPage.tsx` | 나레이션 모드에서 "다음" 이동 대상 변경 | 소 |
| `src/pages/IdeaPage.tsx` | 나레이션 "다음" 버튼 텍스트 변경 | 소 |
| `src/index.css` | 나레이션 전용 CSS 추가 | 중 |

### 3.2 새로 만들어야 할 컴포넌트

| 컴포넌트 | 경로 | 역할 | 예상 규모 |
|----------|------|------|-----------|
| `NarrationVoiceStep` | `src/components/narration/NarrationVoiceStep.tsx` | Step 2: TTS 생성 + 미리듣기 | 120줄 |
| `NarrationSplitStep` | `src/components/narration/NarrationSplitStep.tsx` | Step 3: 씬 자동 분할 + 수동 조정 | 180줄 |
| `NarrationVideoStep` | `src/components/narration/NarrationVideoStep.tsx` | Step 6: 선택적 영상화 + Ken Burns 설정 | 200줄 |
| `NarrationEditView` | `src/components/narration/NarrationEditView.tsx` | Step 7: 메인 편집 뷰 (3층 타임라인 포함) | 300줄 |
| `NarrationTimeline` | `src/components/narration/NarrationTimeline.tsx` | 3층 타임라인 바 (이미지/오디오/자막) | 200줄 |
| `NarrationPreview` | `src/components/narration/NarrationPreview.tsx` | 좌측 미리보기 패널 (재생 + Ken Burns) | 150줄 |
| `NarrationSceneList` | `src/components/narration/NarrationSceneList.tsx` | 우측 씬 리스트 (드래그 정렬, 편집) | 200줄 |

**합계: 약 1,350줄 신규 코드** (기존 나레이션 216줄 재활용 포함)

### 3.3 Store 변경 사항

```typescript
// projectStore.ts 추가 필드 (v6)

// NarrationClip — 나레이션 모드 전용 클립
export interface NarrationClip {
  id: string;
  sceneId: string;
  text: string;
  sentences: SentenceTiming[];
  imageUrl: string;
  videoUrl: string;               // AI 영상화된 경우 영상 URL
  isVideoEnabled: boolean;        // true=영상 재생, false=이미지+Ken Burns
  effect: 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
  audioStartTime: number;
  audioEndTime: number;
  duration: number;
  order: number;
  isModified: boolean;
}

// Store에 추가할 필드
interface ProjectState {
  // ... 기존 필드 유지 ...

  // v6 신규: 나레이션 클립 (편집 상태)
  narrationClips: NarrationClip[];
  setNarrationClips: (clips: NarrationClip[]) => void;

  // v6 신규: 나레이션 현재 스텝 (1~8)
  narrationStep: number;
  setNarrationStep: (step: number) => void;
}
```

**마이그레이션 v5 → v6:**
```typescript
if (version < 6) {
  state = {
    ...state,
    narrationClips: [],
    narrationStep: 1,
  };
}
```

### 3.4 라우팅 변경

**변경 없음.** 기존 라우트 구조 유지:
- `/project/idea` → IdeaPage (Step 1)
- `/project/timeline` → TimelinePage (Step 2, 3 나레이션) / (Step 6 영상화) / (Step 7 편집)
- `/project/storyboard` → StoryboardPage (Step 4, 5)

**핵심:** 새 라우트를 추가하지 않고, 기존 페이지 내에서 `narrationStep` 값으로 어떤 UI를 보여줄지 분기.

```typescript
// TimelinePage.tsx 내 분기 로직
if (mode === 'narration') {
  if (narrationStep <= 3) {
    // Step 2 (Voice) 또는 Step 3 (Split) UI 표시
    return <NarrationVoiceAndSplitView />;
  } else if (narrationStep === 6) {
    // Step 6 (Video) — 선택적 영상화 + Ken Burns
    return <NarrationVideoStep />;
  } else {
    // Step 7 (Edit) UI 표시
    return <NarrationEditView />;
  }
}
// 시네마틱 모드는 기존 UI 그대로
```

### 3.5 단계별 구현 순서 (Phase 분할)

---

#### Phase A: Store + WorkflowSteps 기반 작업 (0.5일)

**목표:** 나레이션 모드의 데이터 구조와 워크플로우 네비게이션 완성

**작업:**
1. `projectStore.ts` — NarrationClip 타입 정의(videoUrl, isVideoEnabled 포함), narrationClips/narrationStep 추가, v6 마이그레이션
2. `WorkflowSteps.tsx` — NARRATION_WORKFLOW를 8스텝으로 재정의
3. `WorkflowSteps.css` — 8스텝이 한 줄에 들어갈 수 있도록 레이아웃 조정

**수정 파일:** 3개
**예상 공수:** 2-3시간

---

#### Phase B: Voice Step + Split Step (1일)

**목표:** TTS 생성과 씬 분할을 독립된 뷰로 구현

**작업:**
1. `NarrationVoiceStep.tsx` — TTS 생성 UI (기존 TimelinePage L373-450 리팩토링)
2. `NarrationSplitStep.tsx` — 씬 자동 분할 + 수동 조정 UI (기존 handleAutoSplit 리팩토링)
3. `TimelinePage.tsx` — 나레이션 모드 분기 추가 (narrationStep <= 3일 때 Voice/Split 표시)
4. `IdeaPage.tsx` — 나레이션 "다음" 클릭 시 narrationStep=2 설정 후 /project/timeline 이동

**수정 파일:** 4개 (2개 신규, 2개 수정)
**예상 공수:** 4-5시간

---

#### Phase C: NarrationVideoStep 영상화 (1일)

**목표:** Step 6 선택적 영상화 UI — 체크한 씬만 AI 영상 변환, 나머지 Ken Burns

**작업:**
1. `NarrationVideoStep.tsx` — 씬 목록 + 체크박스 + 영상 모델 선택 + 일괄 영상화
2. `TimelinePage.tsx` — narrationStep === 6일 때 NarrationVideoStep 렌더
3. 기존 ai-video 서비스 재활용 (Mock/실 영상 생성)
4. Ken Burns 효과 선택 드롭다운 (미영상화 씬)

**수정 파일:** 3개 (1개 신규, 2개 수정)
**예상 공수:** 4-5시간

---

#### Phase D: NarrationEditView 메인 레이아웃 (1일)

**목표:** Step 7 편집 화면의 기본 레이아웃 (미리보기 + 씬 리스트)

**작업:**
1. `NarrationEditView.tsx` — 메인 레이아웃 (좌: 미리보기, 우: 씬 리스트)
2. `NarrationPreview.tsx` — 현재 선택된 씬의 이미지/영상 표시 + 기본 재생 컨트롤
3. `NarrationSceneList.tsx` — 씬 리스트 (이미지/영상 썸네일 + 대본 텍스트 + duration + 영상화 뱃지)
4. `TimelinePage.tsx` — narrationStep >= 7일 때 NarrationEditView 렌더

**수정 파일:** 4개 (3개 신규, 1개 수정)
**예상 공수:** 4-5시간

---

#### Phase E: 3층 타임라인 + 오디오-영상 싱크 (1.5일)

**목표:** 나레이션 타임라인의 핵심 — 오디오와 이미지 싱크

**작업:**
1. `NarrationTimeline.tsx` — 3층 타임라인 (이미지 트랙 + 오디오 트랙 + 자막 트랙)
2. `NarrationPreview.tsx` 업데이트 — 재생 로직 (HTML5 Audio + requestAnimationFrame)
3. Ken Burns 효과 CSS 추가 (`index.css`)
4. 클립-오디오 싱크 유틸리티 함수 (`src/utils/narration-sync.ts`)

**수정 파일:** 4개 (1개 신규 유틸, 1개 신규 컴포넌트, 2개 수정)
**예상 공수:** 6-8시간

---

#### Phase F: 편집 기능 + 뷰 모드 (1일)

**목표:** 씬 편집 (삭제/순서변경/나누기/합치기) + 뷰 모드 토글

**작업:**
1. `NarrationSceneList.tsx` 업데이트 — 드래그 정렬, 삭제, 나누기, 합치기
2. `NarrationEditView.tsx` 업데이트 — 뷰 모드 토글 (갤러리/리스트), Ken Burns 효과 선택
3. `narrationClips` store 액션 추가 (reorder, delete, split, merge)

**수정 파일:** 3개 (모두 수정)
**예상 공수:** 4-5시간

---

#### Phase G: StoryboardPage 연동 + 전체 흐름 QA (0.5일)

**목표:** Step 4→5→6→7 플로우 연결 + 전체 나레이션 여정 E2E 검증

**작업:**
1. `StoryboardPage.tsx` — 나레이션 모드에서 seed-check 완료 후 narrationStep=6 설정 → TimelinePage 이동
2. 전체 흐름 테스트: Step 1→2→3→4→5→6→7 순서대로 진행
3. "Beta" 라벨 UI 추가 (WorkflowSteps 또는 모드 선택 모달에 뱃지)
4. 빈 상태 처리 (대본 없이 진행, 이미지 없이 편집 등)

**수정 파일:** 2개 수정 + QA
**예상 공수:** 3-4시간

---

### 3.6 전체 공수 요약

| Phase | 작업 | 예상 공수 | 누적 |
|-------|------|-----------|------|
| A | Store v6 + 8스텝 WorkflowSteps | 2-3시간 | 3시간 |
| B | Voice Step + Split Step | 4-5시간 | 8시간 |
| C | **VideoStep 영상화 (신규)** | 4-5시간 | 13시간 |
| D | NarrationEditView 레이아웃 | 4-5시간 | 18시간 |
| E | 3층 타임라인 + 싱크 | 6-8시간 | 26시간 |
| F | 편집 기능 + 뷰 모드 | 4-5시간 | 31시간 |
| G | 연동 + QA | 3-4시간 | 35시간 |
| **합계** | | **27-35시간** | **약 6일** |

---

## 섹션 4: MVP 범위 결정

### 4.1 Must-have (Beta 최소 기능)

| 기능 | 설명 | Phase |
|------|------|-------|
| TTS 생성 | 전체 대본 → 하나의 음성 파일 | B |
| 문장별 타이밍 | sentenceTimings 추출 + 표시 | B |
| 씬 자동 분할 | 타이밍 기반 + 분할 기준(초) 조절 | B |
| 씬 수동 미세조정 | 나누기/합치기 | B, E |
| Cast 선택 + 이미지 생성 | 기존 StoryboardPage 재활용 | 기존 |
| 나레이션 편집 뷰 | 미리보기 + 씬 리스트 기본 레이아웃 | C |
| 3층 타임라인 | 이미지/오디오/자막 트랙 | D |
| 오디오-영상 싱크 재생 | Play 시 오디오에 맞춰 이미지 전환 | D |
| **선택적 영상화** | **체크한 씬만 AI 영상 변환 + 미체크 Ken Burns** | **C** |
| 씬 편집 | 삭제, 순서 변경 | F |
| Beta 라벨 | 모드 선택 시 "Beta" 뱃지 | G |
| 8스텝 워크플로우 | 단계별 진행 네비게이션 | A |

### 4.2 Nice-to-have (Beta 이후 개선)

| 기능 | 설명 | 이유 |
|------|------|------|
| Ken Burns 효과 선택 | 씬별 줌인/줌아웃/패닝 선택 | 기본 효과만으로도 충분 |
| 텍스트 수정 → TTS 자동 재생성 | 대본 수정 시 음성 자동 갱신 | 복잡도 높음, "재생성 필요" 뱃지로 대체 |
| 뷰 모드 토글 (갤러리/타임라인) | 다양한 편집 뷰 | 리스트 뷰 하나면 충분 |
| 드래그 정렬 | 씬 순서를 드래그로 변경 | 화살표 버튼으로 대체 가능 |
| BGM 트랙 | 배경음악 별도 레이어 | Export 미지원 상태에서 불필요 |
| Export (MP4) | 최종 영상 내보내기 | 서버사이드 렌더링 필요, 별도 프로젝트 |
| 영상 프롬프트 자동 생성 | 이미지 프롬프트 기반 영상 프롬프트 AI 생성 | 수동 입력으로 대체 가능 |
| 음성 스타일 선택 | 남성/여성/어린이 등 | TTS API 의존, 추후 |
| 자막 스타일링 | 글꼴, 색상, 위치 | Export 구현 후 의미 |

### 4.3 이지비디오 대비 AntiGravity 차별점

| 항목 | 이지비디오 | AntiGravity |
|------|-----------|-------------|
| **시작 방식** | 대본만 | 대본/스타일/Cast 3진입점 |
| **캐릭터 일관성** | 위스크(외부 의존) | Cast 시스템 (시드 매칭, 내장) |
| **프롬프트 생성** | 외부 AI (Gemini Gems, 수동 복붙) | 내부 프롬프트 빌더 (자동) |
| **듀얼 모드** | 나레이션만 | 시네마틱 + 나레이션 |
| **스타일 프리셋** | 제한적 | 풍부한 프리셋 + UGC 마켓 (미래) |
| **가격** | 월 19,900원~ | 무료 시작 + BYOK 옵션 |
| **영상 생성** | Grok 의존 | 다중 AI 모델 (Runway/Kling/Gemini) |

### 4.4 "Beta" 라벨 기준

Beta 라벨은 다음 조건이 모두 충족되면 제거:
1. 전체 나레이션 여정 (Step 1~8)을 막힘 없이 완주 가능
2. 오디오-영상 싱크가 정확 (1초 이내 오차)
3. Export 기능 구현 완료
4. 최소 10명의 테스터가 "사용할 만하다" 평가

---

## 부록: 파일 경로 요약

### 수정 파일
- `D:\wasajang-YoutubeContentsCreator\src\store\projectStore.ts`
- `D:\wasajang-YoutubeContentsCreator\src\components\WorkflowSteps.tsx`
- `D:\wasajang-YoutubeContentsCreator\src\components\WorkflowSteps.css`
- `D:\wasajang-YoutubeContentsCreator\src\pages\TimelinePage.tsx`
- `D:\wasajang-YoutubeContentsCreator\src\pages\StoryboardPage.tsx`
- `D:\wasajang-YoutubeContentsCreator\src\pages\IdeaPage.tsx`
- `D:\wasajang-YoutubeContentsCreator\src\index.css`

### 신규 파일
- `D:\wasajang-YoutubeContentsCreator\src\components\narration\NarrationVoiceStep.tsx`
- `D:\wasajang-YoutubeContentsCreator\src\components\narration\NarrationSplitStep.tsx`
- `D:\wasajang-YoutubeContentsCreator\src\components\narration\NarrationVideoStep.tsx` ← 신규 (Step 6 영상화)
- `D:\wasajang-YoutubeContentsCreator\src\components\narration\NarrationEditView.tsx`
- `D:\wasajang-YoutubeContentsCreator\src\components\narration\NarrationTimeline.tsx`
- `D:\wasajang-YoutubeContentsCreator\src\components\narration\NarrationPreview.tsx`
- `D:\wasajang-YoutubeContentsCreator\src\components\narration\NarrationSceneList.tsx`
- `D:\wasajang-YoutubeContentsCreator\src\utils\narration-sync.ts`

---

*이 문서는 CPO 유나가 작성했습니다. CTO 일론의 기술 검토를 거쳐 CEO에게 전달됩니다.*
*아직 구현하지 않습니다. CEO 승인 후 구현 단계로 진행합니다.*
