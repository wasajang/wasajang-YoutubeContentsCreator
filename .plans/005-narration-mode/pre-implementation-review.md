# 005 나레이션 모드 — 구현 전 최종 점검 보고서

> 작성: CPO 유나 (Opus 4.6)
> 작성일: 2026-02-28
> 요청자: CTO 일론
> 목적: 구현 착수 전 업무 분담, 리스크, 실행 최적화 최종 점검

---

## 섹션 1: 업무 분담 계획 (에이전트별 Phase 배정)

### 1.1 Phase-에이전트 매핑표

| Phase | 작업 | 담당 에이전트 | 이유 | 예상 시간 |
|-------|------|-------------|------|-----------|
| **A** | Store v6 + WorkflowSteps 8스텝 | **린 (FE)** | Store 마이그레이션 + 컴포넌트 수정은 FE 핵심 역할 | 2-3시간 |
| **A-css** | WorkflowSteps.css 8스텝 레이아웃 | **누리 (CSS)** | CSS 전담. 린과 동시 시작 가능 | 1시간 |
| **B** | NarrationVoiceStep + NarrationSplitStep | **린 (FE)** | 신규 컴포넌트 설계. 기존 TimelinePage 로직 리팩토링 필요 | 4-5시간 |
| **B-css** | Voice/Split 스텝 CSS | **누리 (CSS)** | 린이 마크업 완성 후 즉시 병렬 착수 | 2시간 |
| **C** | NarrationVideoStep (영상화) | **카이 (AI)** | ai-video 서비스 재활용 + 영상화 로직 = AI 엔지니어 영역 | 4-5시간 |
| **C-css** | VideoStep CSS | **누리 (CSS)** | 체크박스 목록 + Ken Burns 드롭다운 스타일링 | 1.5시간 |
| **D** | NarrationEditView + Preview + SceneList | **린 (FE)** | 3개 컴포넌트 레이아웃 설계 = FE 아키텍트 역할 | 4-5시간 |
| **D-css** | EditView 레이아웃 CSS | **누리 (CSS)** | 좌우 패널 레이아웃 + 씬 리스트 스타일 | 2시간 |
| **E** | NarrationTimeline + 오디오-영상 싱크 | **카이 (AI)** + **린 (FE)** | 싱크 로직(카이) + 타임라인 UI(린) 분리 | 6-8시간 |
| **E-css** | 3층 타임라인 CSS + Ken Burns 애니메이션 | **누리 (CSS)** | CSS animation = 전문 영역 | 2.5시간 |
| **F** | 편집 기능 (삭제/순서변경/나누기/합치기) | **린 (FE)** | 기존 TimelinePage 편집 로직 패턴 재활용 | 4-5시간 |
| **G** | StoryboardPage 연동 + 전체 흐름 QA | **타로 (QA)** + **린 (FE)** | 연동은 린, E2E 검증은 타로 | 3-4시간 |

### 1.2 병렬 실행 다이어그램

```
시간 흐름 ──────────────────────────────────────────────────────────>

[린 FE]     ║ Phase A (Store+WF) ║ Phase B (Voice+Split) ║ Phase D (EditView)    ║ Phase E-UI (Timeline) ║ Phase F (편집)  ║ Phase G (연동) ║
            ║   2-3h              ║   4-5h                ║   4-5h                ║   3-4h                ║   4-5h          ║   2h           ║

[누리 CSS]  ║ A-css (WF CSS)     ║ B-css (Voice/Split)   ║ C-css (VideoStep)    ║ D-css (EditView)      ║ E-css (Timeline + Ken Burns) ║
            ║   1h                ║   2h                  ║   1.5h               ║   2h                  ║   2.5h                        ║

[카이 AI]   ║ (대기)              ║ (대기)                ║ Phase C (VideoStep)  ║ Phase E-싱크 (sync util) ║ (대기)         ║
            ║                     ║                       ║   4-5h               ║   3-4h                  ║                ║

[타로 QA]   ║ (대기)              ║ B-QA (빌드 확인)      ║ C-QA (빌드 확인)     ║ D-QA (빌드 확인)       ║ E-QA           ║ Phase G (E2E)  ║
            ║                     ║   0.5h                ║   0.5h               ║   0.5h                 ║   0.5h          ║   2h           ║
```

### 1.3 순차 의존성 (반드시 선행 완료 필요)

| 후행 Phase | 선행 Phase | 이유 |
|-----------|-----------|------|
| **B** (Voice/Split) | **A** (Store v6) | NarrationClip 타입, narrationStep 필드가 Store에 없으면 컴파일 오류 |
| **C** (VideoStep) | **A** (Store v6) | NarrationClip.videoUrl, isVideoEnabled 등 타입 필요 |
| **D** (EditView) | **B** (Voice/Split) | narrationClips 데이터가 있어야 EditView에서 렌더 가능 |
| **E** (Timeline+Sync) | **D** (EditView) | EditView 레이아웃 안에 Timeline이 배치됨 |
| **F** (편집) | **D** (EditView) | SceneList 컴포넌트가 존재해야 편집 기능 추가 가능 |
| **G** (연동+QA) | **B, C, D, E, F** 전부 | 전체 플로우 테스트이므로 모든 Phase 필요 |

**병렬 가능한 조합:**
- **A + A-css**: 동시 시작 가능 (린은 TS, 누리는 CSS)
- **B + C**: A 완료 후 동시 시작 가능 (린은 Voice/Split, 카이는 VideoStep)
- **B-css + C-css**: 각각 B, C 마크업 완성 직후 시작
- **D + D-css**: D 마크업 완성 후 css 병렬
- **E-sync(카이) + E-UI(린)**: 싱크 유틸과 UI를 분리하면 병렬 가능

### 1.4 파일 충돌 위험 분석

| 파일 | 동시 수정 가능 에이전트 | 충돌 확률 | 완화 방법 |
|------|----------------------|----------|----------|
| `projectStore.ts` | 린(A), 카이(C에서 타입 참조) | **낮음** | Phase A에서 린이 모든 타입을 한번에 정의. 카이는 import만 |
| `TimelinePage.tsx` | 린(B,D,E), 카이(C) | **높음** | 린이 B에서 분기 구조를 잡고, 카이는 C에서 해당 분기 내부만 수정. 순차 실행 권장 |
| `index.css` | 누리(모든 Phase-css) | **없음** | 누리 단독 수정. 섹션 주석으로 구분 |
| `WorkflowSteps.tsx` | 린(A) | **없음** | 린 단독 수정 |
| `StoryboardPage.tsx` | 린(G) | **없음** | 마지막 Phase에서만 수정 |
| `IdeaPage.tsx` | 린(B) | **없음** | 린 단독 수정 |

**핵심 충돌 파일: `TimelinePage.tsx`**
- 완화: Phase B에서 린이 분기 구조(`if narrationStep <= 3 ... else if === 6 ... else ...`)를 먼저 잡고, 각 분기 내부를 별도 컴포넌트로 빼서 파일 분리.
- 이후 카이(Phase C)는 `NarrationVideoStep.tsx`만 수정하면 됨.

### 1.5 각 에이전트에게 전달해야 할 컨텍스트

#### 린 (FE Architect)
- **필수 읽기:** `projectStore.ts` (현재 v5 구조), `TimelinePage.tsx` (나레이션 분기 + TTS 로직), `WorkflowSteps.tsx` (현재 4스텝 구조)
- **타입 정의:** `NarrationClip` 인터페이스 (plan.md 3.3절)
- **패턴 참조:** 기존 `handleAutoSplit` (L117-158), `handleNarrativeTTS` (L82-114)
- **핵심 지시:** "TimelinePage에서 나레이션 관련 로직을 별도 컴포넌트로 추출하는 것이 첫 번째 임무"

#### 카이 (AI Engineer)
- **필수 읽기:** `ai-video.ts` (generateVideo 인터페이스), `ai-tts.ts` (generateTTS 인터페이스), `useGeneration.ts` (generateSingleVideo 패턴)
- **타입 정의:** `NarrationClip` (plan.md 3.3절), `VideoGenerationRequest/Result`
- **핵심 지시:** "기존 ai-video.ts의 generateVideo를 그대로 호출하되, NarrationClip.isVideoEnabled에 따라 호출 여부를 분기하는 로직"

#### 누리 (CSS)
- **필수 읽기:** `WorkflowSteps.css` (현재 4스텝 스타일), `index.css`의 `.narration-tts-*` 섹션 (L7368-L7565)
- **핵심 지시:** "kebab-case 클래스명 엄수, CSS Variables 사용, 다크 테마 호환"
- **참조 패턴:** 기존 `.tl-clip-strip`, `.tl-clip-card` 스타일 (타임라인 카드 패턴)

#### 타로 (QA)
- **필수 확인:** 매 Phase 완료 후 `npm run build` 실행, TypeScript 에러 0개 확인
- **E2E 시나리오:** 섹션 3의 8스텝 고객 여정대로 실행, 각 스텝 전환 시 store 데이터 콘솔 확인
- **핵심 지시:** "빌드 에러가 있으면 즉시 보고. 런타임 에러는 콘솔 스크린샷과 함께 보고"

---

## 섹션 2: Sonnet 실수 예방 체크리스트

### 2.1 공통 체크리스트 (모든 서브에이전트)

**금지사항:**
- [x] 파일 수정 전 Read 없이 추측으로 코드 작성 금지
- [x] 존재하지 않는 import 경로 작성 금지 (반드시 glob/grep으로 확인)
- [x] `as any` 남용 금지 (기존 패턴: 마이그레이션 코드에서만 허용)
- [x] Tailwind 클래스 사용 금지 (순수 CSS만)
- [x] 기존 코드를 삭제하지 않고 주석 처리 우선
- [x] 한 번에 3개 이상 파일 동시 수정 금지

**필수 확인:**
- [x] 수정할 파일의 현재 내용을 반드시 먼저 읽기
- [x] import 경로가 실제 존재하는지 확인
- [x] store 필드 접근 시 실제 store 타입 확인 (projectStore.ts 참조)
- [x] CSS 클래스명은 kebab-case (예: `narration-voice-step`)
- [x] 컴포넌트 파일명은 PascalCase (예: `NarrationVoiceStep.tsx`)
- [x] 변경 후 `npm run build` 결과 확인

### 2.2 린 (FE) 전용 체크리스트

**Store 관련:**
- [x] `useProjectStore` 사용 시 선택적 구독 패턴 유지: `useProjectStore((s) => s.필드명)`
- [x] 새 필드 추가 시 `partialize`에도 추가 (안 하면 persist 안 됨)
- [x] 마이그레이션 함수에서 버전 번호 정확히 증가 (현재 v5 -> v6)
- [x] `startNewProject` 함수에 새 필드 초기값 추가 필수
- [x] 현재 store 타입:
  ```typescript
  // 현재 존재하는 필드들 (v5)
  mode: ProjectMode;                    // 'cinematic' | 'narration'
  narrativeAudioUrl: string;            // TTS 오디오 URL
  sentenceTimings: SentenceTiming[];    // 문장별 타이밍
  // v6에서 추가할 필드
  narrationClips: NarrationClip[];      // 나레이션 클립 목록
  narrationStep: number;                // 현재 나레이션 스텝 (1~8)
  ```

**WorkflowSteps 관련:**
- [x] 현재 NARRATION_WORKFLOW는 4스텝 (num: 1~4). 이것을 8스텝으로 변경
- [x] `Props.currentMain`이 1~4에서 1~8로 확장됨 -> 기존 시네마틱 모드에 영향 없는지 확인
- [x] 주의: 시네마틱 모드의 onMainClick switch문 (IdeaPage, StoryboardPage, TimelinePage)은 1~4 기준. 나레이션 모드에서만 1~8 사용
- [x] 8스텝이 한 줄에 들어가려면 폰트 크기 축소 또는 축약 라벨 필요

**TimelinePage 관련:**
- [x] 현재 나레이션 분기가 `mode === 'narration'` 조건으로 이미 존재 (L373-450)
- [x] 이 분기를 `narrationStep` 값에 따라 세분화하는 것이 핵심
- [x] 기존 시네마틱 모드 코드 (L452-662)를 절대 건드리지 않기
- [x] 새 컴포넌트는 `src/components/narration/` 디렉토리에 생성

**useCallback 의존성:**
- [x] 모든 useCallback의 의존성 배열을 명시적으로 작성
- [x] store 액션 함수(setNarrationClips 등)는 의존성에 포함 불필요 (Zustand은 stable reference)
- [x] 단, store에서 구독한 state 값(narrationClips 등)은 의존성에 포함 필요

### 2.3 카이 (AI) 전용 체크리스트

**ai-video 서비스:**
- [x] `generateVideo` 함수 시그니처 변경 금지. 기존 인터페이스 그대로 호출
  ```typescript
  // 현재 인터페이스 (변경하지 말 것)
  generateVideo(req: VideoGenerationRequest): Promise<VideoGenerationResult>
  // req.imageUrl, req.prompt, req.duration, req.sceneId, req.model
  ```
- [x] NarrationVideoStep에서 generateVideo를 직접 호출하되, 크레딧 확인 로직 포함
- [x] 기존 `useGeneration` 훅의 `generateSingleVideo` 패턴 참조 (L108-139)
- [x] Mock 프로바이더에서도 동작하는지 확인 (현재 `VITE_VIDEO_API_PROVIDER=mock`)

**Ken Burns 효과:**
- [x] Ken Burns는 CSS animation으로 구현 (JS로 구현하지 않음)
- [x] 효과 타입: `'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right'`
- [x] 이미지에 `animation` 속성으로 적용. duration은 클립의 `duration` 값 사용

**싱크 유틸리티 (narration-sync.ts):**
- [x] HTML5 Audio의 `currentTime` 속성으로 현재 재생 위치 추적
- [x] `requestAnimationFrame` 루프에서 현재 시간에 맞는 NarrationClip 찾기
- [x] 경계 조건: currentTime이 마지막 클립 endTime을 초과할 때 정지 처리
- [x] 브라우저 호환: `audio.play()`는 Promise 반환 -> 에러 핸들링 필수

### 2.4 누리 (CSS) 전용 체크리스트

**컨벤션:**
- [x] 모든 클래스명 kebab-case. BEM 변형 패턴 사용: `.블록__요소--수정자`
- [x] 색상값 하드코딩 금지 -> CSS Variable 사용 (`--accent-primary`, `--bg-secondary` 등)
- [x] `index.css` 내 섹션 주석으로 구분: `/* == Narration Voice Step == */`
- [x] 기존 narration CSS 블록 (L7368-L7565) 바로 아래에 새 스타일 추가
- [x] z-index 사용 시 기존 값 확인 (모달 9999, 오버레이 99 등)

**8스텝 WorkflowSteps:**
- [x] 현재 4스텝은 `gap: 4px`, 번호 원형 `22px`. 8스텝이면 가로폭 부족
- [x] 해결: 번호 원형 18px, gap 2px, 폰트 0.65rem, divider 12px로 축소
- [x] 또는: 스텝 번호만 표시하고 라벨은 active일 때만 보이도록

**Ken Burns CSS 애니메이션:**
- [x] `@keyframes` 정의: `ken-burns-zoom-in`, `ken-burns-zoom-out`, `ken-burns-pan-left`, `ken-burns-pan-right`
- [x] `animation-duration`은 인라인 스타일로 동적 설정 (클립 duration에 맞춤)
- [x] `transform-origin` 랜덤 또는 고정 (줌인은 center, 패닝은 left/right)
- [x] 이미지 컨테이너 `overflow: hidden` 필수

### 2.5 타로 (QA) 전용 체크리스트

**매 Phase 완료 후:**
- [x] `npm run build` 실행 -> TypeScript 에러 0개 확인
- [x] dev 서버에서 해당 Phase의 기능 수동 테스트
- [x] 시네마틱 모드가 깨지지 않았는지 확인 (기존 플로우 한 번 돌려보기)
- [x] 콘솔에 에러/경고 없는지 확인
- [x] localStorage에 저장된 데이터가 v6으로 마이그레이션되는지 확인 (Phase A 후)

**Phase G E2E 테스트 시나리오:**
1. HomePage에서 "대본부터" -> "나레이션" 선택
2. IdeaPage에서 대본 입력 -> "다음"
3. TimelinePage에서 Voice 스텝 -> TTS 생성
4. Split 스텝 -> 씬 분할 확인
5. StoryboardPage -> Cast 선택 -> 이미지 생성
6. TimelinePage -> VideoStep -> 체크박스 선택 -> 영상화
7. EditView -> 씬 리스트 확인 -> 전체 재생
8. 뒤로가기가 정상 작동하는지 확인

---

## 섹션 3: 고객 여정 시뮬레이션 (8스텝 데이터 흐름)

### 3.1 전체 데이터 흐름도

```
Step 1 (IdeaPage)
  INPUT:  사용자 대본 텍스트 + 스타일 선택
  STORE:  scenes[] (텍스트만 있는 씬들), selectedStyle, mode='narration'
  OUTPUT: scenes[].text 채워짐

       |  navigate('/project/timeline')
       |  narrationStep = 2
       v

Step 2 (TimelinePage -> NarrationVoiceStep)
  INPUT:  scenes[].text (전체 대본 합침)
  STORE:  narrativeAudioUrl (TTS Blob URL), sentenceTimings[] (문장별 시간)
  OUTPUT: TTS 오디오 + 타이밍 정보

       |  narrationStep = 3
       v

Step 3 (TimelinePage -> NarrationSplitStep)
  INPUT:  sentenceTimings[]
  STORE:  scenes[] (자동 분할 결과로 갱신), narrationClips[] (초기 생성)
  OUTPUT: 씬 목록 확정 (각 씬의 text + audioStartTime + audioEndTime + duration)

       |  navigate('/project/storyboard')
       |  narrationStep = 4
       v

Step 4 (StoryboardPage -> cast-setup)
  INPUT:  scenes[] (분할된 씬 목록), cardLibrary[]
  STORE:  selectedDeck[], cardLibrary[] (AI 분석으로 카드 추가)
  OUTPUT: Cast 카드 선택 완료

       |  phase: cast-setup -> seed-check (cut-split 스킵)
       |  narrationStep = 5
       v

Step 5 (StoryboardPage -> seed-check)
  INPUT:  scenes[], selectedDeck[], selectedStyle
  STORE:  scenes[].imageUrl (AI 이미지 생성 결과), narrationClips[].imageUrl
  OUTPUT: 각 씬에 이미지 URL 채워짐

       |  navigate('/project/timeline')
       |  narrationStep = 6
       v

Step 6 (TimelinePage -> NarrationVideoStep)
  INPUT:  narrationClips[] (imageUrl 있는 상태)
  STORE:  narrationClips[].videoUrl (영상화된 씬), narrationClips[].isVideoEnabled, narrationClips[].effect
  OUTPUT: 선택된 씬만 영상화, 나머지 Ken Burns 효과 설정

       |  narrationStep = 7
       v

Step 7 (TimelinePage -> NarrationEditView)
  INPUT:  narrationClips[] (이미지/영상 + 오디오 타이밍 완비), narrativeAudioUrl
  STORE:  narrationClips[] (순서변경/삭제/나누기/합치기 편집)
  OUTPUT: 최종 편집된 나레이션 영상 (미리보기)

       |  narrationStep = 8
       v

Step 8 (Export — MVP에서 disabled)
  INPUT:  최종 narrationClips[] + narrativeAudioUrl
  OUTPUT: (미래) MP4 파일
```

### 3.2 각 단계 상세 — Store 필드 매핑

| Step | 라우트 | 컴포넌트 | 읽는 Store 필드 | 쓰는 Store 필드 |
|------|--------|---------|----------------|----------------|
| 1 | `/project/idea` | IdeaPage | title, selectedStyle, aspectRatio, mode | scenes, title, selectedStyle, aspectRatio |
| 2 | `/project/timeline` | NarrationVoiceStep | scenes (텍스트 합침), aiModelPreferences.tts | narrativeAudioUrl, sentenceTimings |
| 3 | `/project/timeline` | NarrationSplitStep | sentenceTimings, narrativeAudioUrl | scenes (재분할), narrationClips (초기화) |
| 4 | `/project/storyboard` | CastSetupPhase | scenes, cardLibrary | cardLibrary, selectedDeck |
| 5 | `/project/storyboard` | SeedCheckPhase | scenes, selectedDeck, selectedStyle | scenes[].imageUrl |
| 6 | `/project/timeline` | NarrationVideoStep | narrationClips, aiModelPreferences.video | narrationClips[].videoUrl, .isVideoEnabled, .effect |
| 7 | `/project/timeline` | NarrationEditView | narrationClips, narrativeAudioUrl, sentenceTimings | narrationClips (편집) |
| 8 | (미래) | - | 전체 | - |

### 3.3 데이터 누락 위험 분석

| 위험 지점 | 설명 | 확률 | 완화 방법 |
|----------|------|------|----------|
| **Step 2 진입 시 scenes가 비어있음** | IdeaPage에서 대본 없이 "다음" 클릭 | 높음 | NarrationVoiceStep에서 scenes 비어있으면 경고 + IdeaPage로 리다이렉트 |
| **Step 3에서 sentenceTimings가 비어있음** | TTS 생성 없이 Split으로 진행 시도 | 중간 | narrationStep 2가 완료되지 않으면 Step 3 버튼 disabled |
| **Step 5 -> Step 6 전환 시 narrationClips 미동기화** | StoryboardPage에서 이미지 생성 후 narrationClips에 imageUrl이 반영 안 됨 | **높음** | **핵심 이슈**: scenes[].imageUrl -> narrationClips[].imageUrl 동기화 로직 필요. StoryboardPage에서 "다음: 영상화" 클릭 시 scenes를 narrationClips로 동기화하는 함수 호출 |
| **Step 3 -> Step 4 전환 시 씬 수 불일치** | Split에서 씬을 추가/삭제한 후 narrationClips 수가 다름 | 중간 | Step 3 "다음" 클릭 시 scenes 기반으로 narrationClips를 재생성 |
| **뒤로가기로 Step 1에서 대본 변경** | Step 3까지 완료 후 뒤로가서 대본을 바꾸면 전체 데이터 무효화 | 낮음 | Step 1에서 대본 변경 시 경고: "TTS와 분할 결과가 초기화됩니다. 계속하시겠습니까?" |
| **narrativeAudioUrl이 Blob URL** | Blob URL은 세션 종료 시 무효화됨 | 중간 | MVP에서는 허용 (세션 내 사용). 향후 Supabase Storage에 업로드 |

### 3.4 가장 위험한 전환: Step 5 -> Step 6

**문제:** 현재 `scenes[].imageUrl`에 이미지가 저장되지만, `narrationClips[].imageUrl`과 별도.
이 두 데이터가 동기화되지 않으면 Step 6에서 이미지가 보이지 않음.

**해결 방법:**
```typescript
// StoryboardPage에서 "다음: 영상화" 클릭 시 실행
function syncScenesToNarrationClips(scenes: Scene[], existingClips: NarrationClip[]): NarrationClip[] {
  return existingClips.map(clip => {
    const scene = scenes.find(s => s.id === clip.sceneId);
    return scene ? { ...clip, imageUrl: scene.imageUrl } : clip;
  });
}
```

### 3.5 뒤로가기 분석

| 현재 Step | 뒤로가기 대상 | 필요한 동작 | 데이터 보존 |
|----------|-------------|-----------|-----------|
| 2 (Voice) | 1 (Script) | navigate('/project/idea') | scenes 유지 |
| 3 (Split) | 2 (Voice) | narrationStep = 2 | sentenceTimings 유지 |
| 4 (Direct) | 3 (Split) | navigate('/project/timeline'), narrationStep = 3 | scenes 유지 |
| 5 (Image) | 4 (Direct) | StoryboardPage phase = 'cast-setup' | selectedDeck 유지 |
| 6 (Video) | 5 (Image) | navigate('/project/storyboard'), phase = 'seed-check' | scenes[].imageUrl 유지 |
| 7 (Edit) | 6 (Video) | narrationStep = 6 | narrationClips 유지 |

**핵심:** 뒤로가기 시 데이터를 파괴하지 않음. narrationStep만 변경하면 해당 UI로 복귀.

---

## 섹션 4: 리스크 매트릭스

### 4.1 Phase별 리스크

#### Phase A: Store + WorkflowSteps

| 리스크 | 확률 | 영향도 | 완화 방법 |
|--------|------|--------|----------|
| v5->v6 마이그레이션 실패 (기존 데이터 소실) | 낮음 | **높음** | 마이그레이션 전 localStorage 백업 코드 추가. 테스트: 기존 v5 데이터로 v6 마이그레이션 확인 |
| 8스텝 WorkflowSteps가 가로로 넘침 | 중간 | 낮음 | 축약 라벨 + 작은 폰트 + 현재 스텝만 라벨 표시 |
| 시네마틱 모드 WorkflowSteps 깨짐 | 낮음 | **높음** | 시네마틱 모드(CINEMATIC_WORKFLOW)는 변경하지 않음. 나레이션만 분기 |

#### Phase B: Voice + Split

| 리스크 | 확률 | 영향도 | 완화 방법 |
|--------|------|--------|----------|
| TTS Mock이 sentenceTimings를 정확히 생성 못함 | 중간 | 중간 | 현재 handleNarrativeTTS (L82-114)의 정규식 기반 타이밍 추정 검증. 한국어 4자/초 기준 정확도 확인 |
| handleAutoSplit 리팩토링 시 기존 로직 손상 | 중간 | **높음** | 기존 코드를 복사-붙여넣기로 새 컴포넌트에 이동. TimelinePage의 원본은 주석 처리 |
| Split 수동 조정 UI 복잡도 | **높음** | 중간 | MVP에서는 "나누기"와 "합치기" 버튼만. 드래그 경계 조정은 Nice-to-have |

#### Phase C: VideoStep (영상화)

| 리스크 | 확률 | 영향도 | 완화 방법 |
|--------|------|--------|----------|
| **기존 ai-video 서비스와 나레이션 모드 호환성** | **중간** | **높음** | `generateVideo`는 `imageUrl`과 `prompt`를 받는 범용 API. 나레이션 모드에서도 동일하게 호출 가능. 단, `imageUrl`이 필수 -- 이미지 없는 씬에서 영상화 시도하면 에러 |
| 체크한 씬만 영상화 시 크레딧 계산 오류 | 낮음 | 중간 | 체크된 씬 수 x CREDIT_COSTS.video로 사전 계산, 확인 대화상자 표시 |
| Ken Burns 효과가 CSS animation으로 부족 | 낮음 | 낮음 | 기본 4종 효과(zoom-in/out, pan-left/right)면 MVP 충분 |
| Mock 영상 URL (Google Storage)이 CORS 이슈 | 중간 | 낮음 | Mock 모드에서는 영상 URL 표시만, 실제 재생은 실 API 연동 후 |

#### Phase D: EditView 레이아웃

| 리스크 | 확률 | 영향도 | 완화 방법 |
|--------|------|--------|----------|
| 좌(미리보기)+우(씬 리스트) 레이아웃 반응형 이슈 | 중간 | 낮음 | 최소 너비 1024px 기준. 모바일은 MVP 범위 외 |
| 씬 리스트 스크롤 + 미리보기 고정 동기화 | 중간 | 중간 | 씬 클릭 시 미리보기만 변경. 자동 스크롤은 Nice-to-have |

#### Phase E: 3층 타임라인 + 싱크

| 리스크 | 확률 | 영향도 | 완화 방법 |
|--------|------|--------|----------|
| **HTML5 Audio + requestAnimationFrame 크로스 브라우저** | **높음** | **높음** | **주요 이슈**: Safari에서 Audio.play() 자동 재생 차단. 해결: 유저 클릭 이벤트 핸들러 내에서만 play() 호출. Firefox에서 requestAnimationFrame 정확도 이슈: 16ms 단위 반올림 허용 |
| Blob URL 오디오가 seek 불가능 | **높음** | **높음** | Mock TTS의 createSilentWav은 아주 짧은(1초) 파일. 전체 대본 길이만큼의 WAV를 생성하도록 수정 필요. 또는 Mock에서도 실제 duration만큼의 무음 WAV 생성 |
| 3층 타임라인 가로 스크롤 동기화 | 중간 | 중간 | 3개 트랙을 하나의 스크롤 컨테이너에 넣기. 개별 스크롤 금지 |
| currentTime과 NarrationClip 매칭 off-by-one | 중간 | 중간 | 이진 탐색으로 효율적 매칭. 경계값(audioEndTime)에서 다음 클립으로 전환 |

#### Phase F: 편집 기능

| 리스크 | 확률 | 영향도 | 완화 방법 |
|--------|------|--------|----------|
| 씬 나누기/합치기 후 narrationClips과 sentenceTimings 불일치 | **높음** | **높음** | 나누기: 해당 클립의 sentences를 두 그룹으로 분할, audioStartTime/audioEndTime 재계산. 합치기: sentences 합치기, duration 합산 |
| 드래그 정렬 구현 복잡도 | 중간 | 낮음 | MVP에서는 화살표 버튼으로 대체 (기존 TimelinePage 패턴: handleMove) |
| 씬 삭제 후 타임라인 전체 duration 불일치 | 중간 | 중간 | 삭제 시 narrationClips를 재정렬하고 order 재할당. 전체 TTS 오디오는 변경 불가 -> 삭제된 구간은 무음으로 표시 |

#### Phase G: 연동 + QA

| 리스크 | 확률 | 영향도 | 완화 방법 |
|--------|------|--------|----------|
| Step 4-5(Storyboard) -> Step 6(Timeline) 전환 시 narrationClips 데이터 유실 | **높음** | **높음** | scenes -> narrationClips 동기화 함수 필수 (3.4절 참조) |
| 전체 플로우에서 narrationStep이 올바르게 증가하지 않음 | 중간 | **높음** | 각 "다음" 버튼에서 setNarrationStep 호출 확인. WorkflowSteps 클릭으로도 step 변경 가능하도록 |
| "Beta" 라벨 UI가 시네마틱 모드에 잘못 표시 | 낮음 | 낮음 | `mode === 'narration'` 조건 분기 |

### 4.2 Top 5 리스크 요약

| 순위 | 리스크 | Phase | 확률x영향 | 상태 |
|------|--------|-------|----------|------|
| 1 | scenes -> narrationClips 데이터 동기화 | G | 높x높 | **plan.md에 명시적 동기화 함수 추가 필요** |
| 2 | HTML5 Audio 크로스 브라우저 + Blob URL seek | E | 높x높 | Safari/Firefox 테스트 필수 |
| 3 | Mock TTS가 실제 duration만큼의 오디오를 생성하지 않음 | E | 높x높 | createSilentWav 개선 또는 Mock에서 estimatedDuration 기반 로직 |
| 4 | 씬 나누기/합치기 후 타이밍 불일치 | F | 높x높 | 나누기/합치기 시 sentenceTimings 기반 재계산 로직 명확히 설계 |
| 5 | v5->v6 마이그레이션 실패 | A | 낮x높 | 기존 패턴(v1~v5) 따라하면 안전. 테스트 필수 |

---

## 섹션 5: 최적 실행 계획

### 5.1 기존 순차 실행 vs 최적화된 병렬 실행

**기존 (순차):**
```
A -> B -> C -> D -> E -> F -> G
3h   5h   5h   5h   8h   5h   4h = 35시간 (약 6일)
```

**최적화 (병렬):**
```
웨이브 1 (동시 시작):
  린:  Phase A (Store + WF)     [3h]
  누리: Phase A-css (WF CSS)    [1h]
  카이: (대기 or 리서치)
  타로: (대기)
  ────────────────────────────────── 3h 경과

웨이브 2 (A 완료 후 동시 시작):
  린:  Phase B (Voice + Split)   [5h]
  누리: Phase B-css              [2h] + Phase C-css [1.5h]
  카이: Phase C (VideoStep)      [5h]
  타로: 웨이브 1 QA              [0.5h]
  ────────────────────────────────── 8h 경과

웨이브 3 (B 완료 후):
  린:  Phase D (EditView)        [5h]
  누리: Phase D-css              [2h]
  카이: Phase E-sync 시작        [3h] (narration-sync.ts 유틸 선행 가능)
  타로: 웨이브 2 QA (B+C)        [1h]
  ────────────────────────────────── 13h 경과

웨이브 4 (D 완료 후):
  린:  Phase E-UI (Timeline)     [4h]
  누리: Phase E-css (Ken Burns)  [2.5h]
  카이: Phase E-sync 마무리      [1h]
  타로: 웨이브 3 QA (D)          [0.5h]
  ────────────────────────────────── 17h 경과

웨이브 5:
  린:  Phase F (편집 기능)        [5h]
  누리: (완료 or 미세 조정)
  타로: 웨이브 4 QA (E)          [0.5h]
  ────────────────────────────────── 22h 경과

웨이브 6:
  린:  Phase G-연동               [2h]
  타로: Phase G-E2E              [2h]
  ────────────────────────────────── 24h 경과 (약 4일)
```

### 5.2 병렬화로 절감되는 시간

| 항목 | 순차 | 병렬 | 절감 |
|------|------|------|------|
| 린 (FE) 총 작업 | 24h | 24h | 0h (크리티컬 패스) |
| 누리 (CSS) 총 작업 | 9h | 9h (린과 병렬) | - |
| 카이 (AI) 총 작업 | 9h | 9h (린과 병렬) | - |
| **전체 소요** | **35h** | **24h** | **11h (31% 절감)** |

**크리티컬 패스:** 린(FE)의 작업 체인 = A -> B -> D -> E-UI -> F -> G = 24h
- 린이 병목. 카이와 누리는 린보다 빨리 완료됨.
- 카이의 Phase C(5h)와 Phase E-sync(4h)는 린의 Phase B/D와 병렬 실행.

### 5.3 최종 실행 일정 (4일 계획)

| 일차 | 린 (FE) | 카이 (AI) | 누리 (CSS) | 타로 (QA) |
|------|---------|-----------|-----------|-----------|
| **Day 1** | Phase A (3h) + Phase B 시작 (2h) | (대기 -> Phase C 준비) | Phase A-css (1h) + Phase B-css (2h) | QA: Phase A |
| **Day 2** | Phase B 마무리 (3h) + Phase D 시작 (2h) | Phase C (5h) | Phase C-css (1.5h) + Phase D-css 시작 | QA: Phase B, C |
| **Day 3** | Phase D 마무리 (3h) + Phase E-UI (4h) | Phase E-sync (4h) | Phase D-css (2h) + Phase E-css (2.5h) | QA: Phase D, E |
| **Day 4** | Phase F (5h) + Phase G-연동 (2h) | (완료) | 미세 조정 | QA: Phase F + Phase G E2E (2h) |

---

## 섹션 6: CTO에게 전달할 "에이전트별 프롬프트 초안"

### 6.1 린 (FE Architect) - Phase A 프롬프트

```
## 역할
당신은 린, AntiGravity의 FE Architect입니다. Sonnet 4.6 모델로 작동합니다.

## 임무: Phase A — Store v6 + WorkflowSteps 8스텝

### 작업 1: projectStore.ts 수정
1. 다음 파일을 읽으세요: `D:\wasajang-YoutubeContentsCreator\src\store\projectStore.ts`
2. 다음 변경을 수행하세요:

(a) NarrationClip 인터페이스 추가 (SentenceTiming 아래):
```typescript
export interface NarrationClip {
  id: string;
  sceneId: string;
  text: string;
  sentences: SentenceTiming[];
  imageUrl: string;
  videoUrl: string;
  isVideoEnabled: boolean;
  effect: 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
  audioStartTime: number;
  audioEndTime: number;
  duration: number;
  order: number;
  isModified: boolean;
}
```

(b) ProjectState 인터페이스에 추가:
```typescript
narrationClips: NarrationClip[];
setNarrationClips: (clips: NarrationClip[]) => void;
narrationStep: number;
setNarrationStep: (step: number) => void;
```

(c) store 초기값에 추가:
```typescript
narrationClips: [],
setNarrationClips: (narrationClips) => set({ narrationClips }),
narrationStep: 1,
setNarrationStep: (narrationStep) => set({ narrationStep }),
```

(d) startNewProject에 초기화 추가:
```typescript
narrationClips: [],
narrationStep: 1,
```

(e) migrate 함수에 v5->v6 추가:
```typescript
if (version < 6) {
  state = {
    ...state,
    narrationClips: [],
    narrationStep: 1,
  };
}
```

(f) partialize에 추가:
```typescript
narrationClips: state.narrationClips,
narrationStep: state.narrationStep,
```

(g) version을 5에서 6으로 변경

### 작업 2: WorkflowSteps.tsx 수정
1. 파일을 읽으세요: `D:\wasajang-YoutubeContentsCreator\src\components\WorkflowSteps.tsx`
2. NARRATION_WORKFLOW를 8스텝으로 변경:
```typescript
const NARRATION_WORKFLOW: MainStep[] = [
  { num: 1, label: 'Script', route: '/project/idea', subSteps: [{ key: 'script', label: '대본' }, { key: 'style', label: '스타일' }] },
  { num: 2, label: 'Voice', route: '/project/timeline', subSteps: [{ key: 'tts', label: 'TTS 생성' }] },
  { num: 3, label: 'Split', route: '/project/timeline', subSteps: [{ key: 'split', label: '씬 분할' }] },
  { num: 4, label: 'Direct', route: '/project/storyboard', subSteps: [{ key: 'cast-setup', label: '캐스트' }] },
  { num: 5, label: 'Image', route: '/project/storyboard', subSteps: [{ key: 'image-gen', label: '이미지' }] },
  { num: 6, label: 'Video', route: '/project/timeline', subSteps: [{ key: 'video', label: '영상화' }] },
  { num: 7, label: 'Edit', route: '/project/timeline', subSteps: [{ key: 'edit', label: '편집' }] },
  { num: 8, label: 'Export', route: '/project/timeline', subSteps: [{ key: 'export', label: '내보내기' }] },
];
```

### 금지사항
- 시네마틱 모드(CINEMATIC_WORKFLOW)를 절대 수정하지 마세요
- 기존 Props 인터페이스의 currentMain 타입을 변경하지 마세요 (number 그대로)
- import 추가 시 실제 경로 존재 여부 확인 필수

### 완료 후
- `npm run build` 실행하여 TypeScript 에러 0개 확인
- 시네마틱 모드에서 WorkflowSteps가 여전히 4스텝으로 표시되는지 확인
```

### 6.2 누리 (CSS) - Phase A-css 프롬프트

```
## 역할
당신은 누리, AntiGravity의 CSS 전문가입니다. Haiku 4.5 모델로 작동합니다.

## 임무: Phase A-css — WorkflowSteps 8스텝 CSS

### 작업: WorkflowSteps.css 수정
1. 파일을 읽으세요: `D:\wasajang-YoutubeContentsCreator\src\components\WorkflowSteps.css`
2. 나레이션 모드에서 8스텝이 한 줄에 들어가도록 CSS 추가:

### 변경 사항

(a) .workflow-step 관련 수정 -- 나레이션 전용 모디파이어를 추가하지 않고
    기존 스타일이 8스텝에서도 자연스럽게 보이도록 조정:

```css
/* 나레이션 8스텝 대응: 상위 단계 간격/크기 축소 */
.workflow-steps--narration .workflow-step {
  gap: 4px;
  font-size: 0.65rem;
}

.workflow-steps--narration .workflow-step__num {
  width: 18px;
  height: 18px;
  font-size: 0.6rem;
}

.workflow-steps--narration .workflow-step__divider {
  width: 12px;
}

/* 8스텝일 때 라벨 숨기고 active일 때만 표시 */
.workflow-steps--narration .workflow-step span {
  display: none;
}

.workflow-steps--narration .workflow-step.active span {
  display: inline;
}
```

### 주의: WorkflowSteps.tsx에서 `.workflow-steps--narration` 클래스가 추가되어야 함
- 린(FE)에게 전달: workflow-steps 래퍼에 `mode === 'narration' ? 'workflow-steps--narration' : ''` 클래스 추가 요청

### 금지사항
- 기존 .workflow-step 스타일을 삭제하거나 변경하지 마세요 (추가만)
- Tailwind 클래스 사용 금지
- 색상값 하드코딩 금지 (CSS Variable 사용)
- kebab-case 클래스명 사용

### 완료 후
- 시네마틱 모드에서 기존 스타일이 깨지지 않는지 확인
```

### 6.3 카이 (AI Engineer) - Phase C 프롬프트

```
## 역할
당신은 카이, AntiGravity의 AI Engineer입니다. Sonnet 4.6 모델로 작동합니다.

## 임무: Phase C — NarrationVideoStep (선택적 영상화 + Ken Burns)

### 선행 조건
Phase A가 완료되어야 합니다 (NarrationClip 타입 + Store v6).

### 작업: 신규 파일 생성
경로: `D:\wasajang-YoutubeContentsCreator\src\components\narration\NarrationVideoStep.tsx`

### 필수 읽기 파일 (작업 전 반드시 읽기)
1. `D:\wasajang-YoutubeContentsCreator\src\store\projectStore.ts` — NarrationClip 타입 확인
2. `D:\wasajang-YoutubeContentsCreator\src\services\ai-video.ts` — generateVideo 인터페이스
3. `D:\wasajang-YoutubeContentsCreator\src\hooks\useCredits.ts` — canAfford, spend 패턴
4. `D:\wasajang-YoutubeContentsCreator\src\hooks\useGeneration.ts` — generateSingleVideo 패턴 참조

### 컴포넌트 구조

```tsx
// NarrationVideoStep.tsx
// 역할: Step 6 — 체크한 씬만 AI 영상 변환, 나머지 Ken Burns 효과 설정
//
// Props: 없음 (store에서 직접 구독)
//
// UI:
// - 상단: AI 영상 모델 선택 드롭다운 + "선택된 씬 영상화" 버튼
// - 중앙: 씬 목록 (체크박스 | 이미지 썸네일 | 대본 | 영상화 상태 or Ken Burns 선택)
// - 하단: 요약 (영상화 N개 / Ken Burns N개) + "다음: 편집" 버튼
//
// 핵심 로직:
// 1. narrationClips에서 imageUrl이 있는 클립만 표시
// 2. 체크된 클립: generateVideo() 호출 -> videoUrl 저장 + isVideoEnabled = true
// 3. 미체크 클립: effect 드롭다운으로 Ken Burns 효과 선택
// 4. "다음" 클릭 시 setNarrationStep(7)
```

### generateVideo 호출 패턴 (useGeneration.ts L108-139 참조)
```typescript
const handleVideoGenerate = async (clipId: string) => {
  const clip = narrationClips.find(c => c.id === clipId);
  if (!clip || !clip.imageUrl) return;

  // 크레딧 확인
  if (!canAfford('video')) {
    alert('크레딧이 부족합니다!');
    return;
  }
  if (!spend('video')) return;

  // 영상 생성
  try {
    const result = await generateVideo({
      imageUrl: clip.imageUrl,
      prompt: clip.text, // 대본을 영상 프롬프트로 사용
      duration: Math.min(6, Math.ceil(clip.duration)), // 최대 6초
      sceneId: clip.sceneId,
      model: aiModelPreferences.video,
    });

    // narrationClips 업데이트
    const updated = narrationClips.map(c =>
      c.id === clipId
        ? { ...c, videoUrl: result.videoUrl, isVideoEnabled: true }
        : c
    );
    setNarrationClips(updated);
  } catch (err) {
    console.error(`[NarrationVideo] ${clipId} 영상화 실패:`, err);
  }
};
```

### Ken Burns 효과 타입
```typescript
type KenBurnsEffect = 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
// 미영상화 씬에 대해 유저가 드롭다운으로 선택
// 기본값: 'zoom-in' (랜덤 배정도 OK)
```

### 금지사항
- ai-video.ts의 인터페이스를 수정하지 마세요 (import해서 사용만)
- store에 새 필드를 추가하지 마세요 (Phase A에서 정의한 것만 사용)
- 시네마틱 모드 코드를 건드리지 마세요
- CSS를 인라인으로 쓰지 말고, className만 부여하세요 (누리가 CSS 작성)

### 완료 후
- `npm run build` 실행하여 TypeScript 에러 0개 확인
- 기존 시네마틱 모드의 영상 생성 기능이 여전히 동작하는지 확인
```

### 6.4 카이 (AI Engineer) - Phase E-sync 프롬프트

```
## 역할
당신은 카이, AntiGravity의 AI Engineer입니다.

## 임무: Phase E-sync — narration-sync.ts 유틸리티

### 작업: 신규 파일 생성
경로: `D:\wasajang-YoutubeContentsCreator\src\utils\narration-sync.ts`

### 필수 읽기 파일
1. `D:\wasajang-YoutubeContentsCreator\src\store\projectStore.ts` — NarrationClip, SentenceTiming 타입

### 유틸리티 함수 목록

```typescript
// narration-sync.ts

import type { NarrationClip, SentenceTiming } from '../store/projectStore';

/**
 * 현재 오디오 재생 시간에 해당하는 클립 찾기
 * @param currentTime 초 단위 현재 시간
 * @param clips 정렬된 클립 배열
 * @returns 현재 클립 또는 null
 */
export function findCurrentClip(currentTime: number, clips: NarrationClip[]): NarrationClip | null;

/**
 * 현재 시간에 해당하는 자막(문장) 찾기
 * @param currentTime 초 단위
 * @param clip 현재 클립
 * @returns 현재 문장 텍스트 또는 null
 */
export function findCurrentSentence(currentTime: number, clip: NarrationClip): SentenceTiming | null;

/**
 * sentenceTimings를 기반으로 씬을 자동 분할하여 NarrationClip 배열 생성
 * @param timings 전체 문장 타이밍
 * @param maxDuration 씬당 최대 시간 (기본 5초)
 * @returns NarrationClip 배열
 */
export function autoSplitToClips(timings: SentenceTiming[], maxDuration?: number): NarrationClip[];

/**
 * 클립을 두 개로 나누기 (지정된 문장 인덱스에서)
 * @param clip 나눌 클립
 * @param splitAfterSentenceIndex 이 인덱스의 문장 이후에서 나누기
 * @returns [앞 클립, 뒤 클립]
 */
export function splitClip(clip: NarrationClip, splitAfterSentenceIndex: number): [NarrationClip, NarrationClip];

/**
 * 두 인접 클립 합치기
 * @param clipA 앞 클립
 * @param clipB 뒤 클립
 * @returns 합쳐진 클립
 */
export function mergeClips(clipA: NarrationClip, clipB: NarrationClip): NarrationClip;

/**
 * 클립 삭제 후 순서 재정렬
 * @param clips 전체 클립 배열
 * @param clipId 삭제할 클립 ID
 * @returns 재정렬된 클립 배열
 */
export function removeClip(clips: NarrationClip[], clipId: string): NarrationClip[];

/**
 * scenes[] -> narrationClips[] 동기화 (Step 5 -> Step 6 전환 시)
 * scenes의 imageUrl을 narrationClips로 복사
 */
export function syncScenesImageToClips(
  scenes: Array<{ id: string; imageUrl: string }>,
  clips: NarrationClip[]
): NarrationClip[];
```

### 크로스 브라우저 주의사항
- `audio.currentTime` 정밀도: 밀리초 단위이지만, 실제로는 10ms~16ms 정도의 오차 허용
- `audio.play()` 반환값은 Promise. Safari에서 reject될 수 있으므로 try-catch 필수
- `requestAnimationFrame`은 탭이 백그라운드일 때 멈출 수 있음 -> 재개 시 currentTime으로 동기화

### 금지사항
- 외부 라이브러리 설치 금지 (순수 TypeScript만)
- React 의존성 금지 (이 파일은 순수 유틸리티)

### 완료 후
- `npm run build` 실행하여 타입 에러 0개 확인
```

### 6.5 타로 (QA) - Phase G E2E 프롬프트

```
## 역할
당신은 타로, AntiGravity의 QA Engineer입니다. Haiku 4.5 모델로 작동합니다.

## 임무: Phase G — 전체 나레이션 플로우 E2E 검증

### 테스트 시나리오

#### 시나리오 1: 나레이션 모드 정상 플로우
1. `npm run build` 실행 -> 에러 0개 확인
2. dev 서버 실행
3. HomePage -> "대본부터" -> "나레이션" 선택
4. IdeaPage -> 대본 입력 (아무 텍스트) -> "다음: 음성 생성"
5. TimelinePage (Step 2: Voice) -> TTS AI 선택 -> "TTS 생성" 클릭 -> 결과 확인
6. Step 3: Split -> 분할 결과 확인 -> "다음: 연출"
7. StoryboardPage (Step 4: Direct) -> AI 분석 모달 -> 카드 선택 완료
8. Step 5: Image -> 이미지 전체 생성 -> "다음: 영상화"
9. TimelinePage (Step 6: Video) -> 씬 체크 -> "선택된 씬 영상화" -> "다음: 편집"
10. Step 7: Edit -> 씬 리스트 확인 -> 전체 재생 -> 오디오-이미지 싱크 확인

#### 시나리오 2: 시네마틱 모드 회귀 테스트
1. HomePage -> "대본부터" -> "시네마틱" 선택
2. IdeaPage -> 대본 입력 -> "다음: 스토리보드"
3. StoryboardPage -> Cast -> 이미지 생성
4. TimelinePage -> 타임라인 확인
5. **나레이션 관련 UI가 표시되지 않는지 확인**

#### 시나리오 3: 빈 상태 처리
1. 대본 없이 "다음" 클릭 -> 경고/리다이렉트 확인
2. TTS 없이 Split 진행 시도 -> disabled 버튼 확인
3. 이미지 없이 영상화 시도 -> 경고 확인

### 확인 사항
- [ ] `npm run build` 에러 0개
- [ ] 콘솔에 빨간 에러 없음
- [ ] 시네마틱 모드 기존 기능 정상
- [ ] 나레이션 모드 8스텝 순서대로 진행 가능
- [ ] 뒤로가기 시 데이터 유지
- [ ] WorkflowSteps 클릭으로 이전 스텝 이동 가능
- [ ] narrationStep이 올바르게 변경됨 (콘솔에서 store 확인)
- [ ] "Beta" 라벨 표시 여부

### 버그 보고 형식
```
[Phase] Phase X
[심각도] 높음/중간/낮음
[재현 경로] Step N에서 -> 어떤 동작 -> 어떤 결과
[기대 결과] 이렇게 되어야 함
[콘솔 에러] (있으면 복사)
```
```

### 6.6 린 (FE) - Phase B 프롬프트 (핵심)

```
## 역할
당신은 린, AntiGravity의 FE Architect입니다.

## 임무: Phase B — NarrationVoiceStep + NarrationSplitStep + TimelinePage 분기

### 선행 조건
Phase A가 완료되어야 합니다.

### 필수 읽기 파일 (작업 전 반드시 읽기)
1. `D:\wasajang-YoutubeContentsCreator\src\pages\TimelinePage.tsx` — 기존 나레이션 TTS 로직 (L82-158)
2. `D:\wasajang-YoutubeContentsCreator\src\store\projectStore.ts` — v6 Store 구조
3. `D:\wasajang-YoutubeContentsCreator\src\services\ai-tts.ts` — generateTTS 인터페이스
4. `D:\wasajang-YoutubeContentsCreator\src\data\aiModels.ts` — getUserSelectableModels

### 작업 1: NarrationVoiceStep.tsx 생성
경로: `D:\wasajang-YoutubeContentsCreator\src\components\narration\NarrationVoiceStep.tsx`

핵심:
- TimelinePage L82-114의 handleNarrativeTTS 로직을 이 컴포넌트로 이동
- TimelinePage L373-450의 JSX를 이 컴포넌트로 이동
- Props: `onNext: () => void` (다음 스텝으로 이동)
- store에서 구독: scenes, aiModelPreferences, narrativeAudioUrl, sentenceTimings
- store에 쓰기: setNarrativeAudioUrl, setSentenceTimings

### 작업 2: NarrationSplitStep.tsx 생성
경로: `D:\wasajang-YoutubeContentsCreator\src\components\narration\NarrationSplitStep.tsx`

핵심:
- TimelinePage L117-158의 handleAutoSplit 로직을 이 컴포넌트로 이동
- 추가: maxDuration 조절 드롭다운 (3/5/7/10초)
- 추가: 10초 초과 씬 경고 표시
- Props: `onNext: () => void` (스토리보드로 이동)
- store에서 구독: sentenceTimings
- store에 쓰기: setScenes, setNarrationClips (autoSplitToClips 사용), setNarrationStep

### 작업 3: TimelinePage.tsx 분기 추가
기존 나레이션 분기(L373-450)를 narrationStep 값에 따라 세분화:

```typescript
// TimelinePage.tsx 내부 (mode === 'narration' 분기)
if (mode === 'narration') {
  if (narrationStep <= 2) {
    return <NarrationVoiceStep onNext={() => setNarrationStep(3)} />;
  }
  if (narrationStep === 3) {
    return <NarrationSplitStep onNext={() => {
      setNarrationStep(4);
      navigate('/project/storyboard');
    }} />;
  }
  if (narrationStep === 6) {
    return <NarrationVideoStep />; // Phase C에서 카이가 구현
  }
  // narrationStep >= 7
  return <NarrationEditView />; // Phase D에서 구현
}
```

### 작업 4: IdeaPage.tsx 수정
나레이션 "다음" 클릭 시:
```typescript
onClick={() => {
  if (mode === 'narration') {
    setNarrationStep(2); // Voice 스텝으로
    navigate('/project/timeline');
  } else {
    navigate('/project/storyboard');
  }
}}
```

### 주의사항
- NarrationVideoStep과 NarrationEditView는 아직 존재하지 않으므로, import만 하고
  해당 Phase 전까지는 placeholder 컴포넌트를 만들어두세요:
  ```typescript
  // placeholder (Phase C/D에서 교체)
  const NarrationVideoStep = () => <div>Step 6: 영상화 (구현 예정)</div>;
  const NarrationEditView = () => <div>Step 7: 편집 (구현 예정)</div>;
  ```
- 기존 TimelinePage의 시네마틱 모드 코드(L452-662)를 절대 수정하지 마세요
- 기존 narration-tts CSS 클래스를 재활용하세요

### 금지사항
- store에 Phase A에서 정의하지 않은 필드 추가 금지
- 기존 handleAutoSplit의 로직을 변경하지 말고 복사하세요
- useCallback 의존성 배열 누락 금지
```

---

## 부록: CTO에게 전달하는 최종 권고

### 즉시 조치 필요 사항

1. **plan.md에 syncScenesImageToClips 함수 추가 명시 필요**
   - Step 5 -> Step 6 전환 시 scenes[].imageUrl -> narrationClips[].imageUrl 동기화가 누락되면 영상화 화면에서 이미지가 보이지 않습니다.
   - narration-sync.ts에 이 함수를 포함시키세요.

2. **Mock TTS의 오디오 duration 문제**
   - 현재 `createSilentWav(1)`은 1초짜리 무음만 생성. 전체 대본의 estimatedDuration만큼의 WAV를 생성하도록 수정해야 Step 7의 오디오 싱크가 동작합니다.
   - Phase B에서 린이 수정하거나, 카이에게 별도 지시하세요.

3. **Phase E의 크로스 브라우저 테스트를 타로에게 명시적으로 지시**
   - Safari에서 Audio.play() 자동 재생 차단 이슈는 실제 테스트에서만 발견 가능합니다.
   - Chrome + Safari (또는 Firefox) 두 브라우저에서 테스트하세요.

### Go/No-Go 판단

| 항목 | 판단 | 이유 |
|------|------|------|
| plan.md 완성도 | **Go** | 8스텝, 파일 목록, Store 변경, 라우팅 모두 명확 |
| 기술 리스크 | **Go (주의)** | Top 5 리스크 중 3개는 완화 방법이 명확. Phase E만 주의 |
| 업무 분담 | **Go** | 4명 에이전트로 4일 완료 가능 |
| MVP 범위 | **Go** | Nice-to-have 항목이 명확히 분리됨 |
| 시네마틱 모드 영향 | **Go** | 분기 처리로 기존 코드 미접촉 |

**최종 판단: Go -- 구현 착수 승인을 권고합니다.**

---

*이 문서는 CPO 유나가 CTO 일론의 요청에 따라 작성했습니다.*
*구현 전 CEO 최종 확인 후 에이전트별 프롬프트를 실행하세요.*
