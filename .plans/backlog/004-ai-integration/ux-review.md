# 004 UX Review: 고객 여정 전체 점검 + 시네마틱 vs 나레이션 전략

> 작성: CPO 유나 (Opus)
> 작성일: 2026-02-28
> 요청자: CTO 일론 (CEO 요청 전달)
> 상태: CEO 결정 대기

---

## 섹션 1: 시네마틱 vs 나레이션 전략 추천 (CEO 결정 필요)

### 배경

이전 세션 RICE 분석에서 시네마틱(A=67.5) >> 나레이션(B=8.75)으로, "A(시네마틱)로 MVP 런칭 -> Phase 2에서 B(나레이션) 조건부 추가"를 추천했습니다.

그러나 004 구현 과정에서 나레이션 모드가 이미 다음 범위로 구현되었습니다:

| 구현 항목 | 파일 | 코드 규모 |
|-----------|------|-----------|
| 모드 선택 모달 (시네마틱/나레이션) | HomePage.tsx L208-226 | 20줄 |
| Store mode 필드 + 관련 액션 | projectStore.ts (v5 마이그레이션 포함) | 30줄 |
| WorkflowSteps 듀얼 워크플로우 | WorkflowSteps.tsx L50-79 | 30줄 |
| IdeaPage 하단 버튼 분기 | IdeaPage.tsx L476 | 3줄 |
| StoryboardPage CutSplit 스킵 분기 | StoryboardPage.tsx L156 | 3줄 |
| TimelinePage 나레이션 TTS 섹션 | TimelinePage.tsx L373-450 | 80줄 |
| TimelinePage 씬 자동 분할 로직 | TimelinePage.tsx L117-158 | 40줄 |
| narrativeAudioUrl, sentenceTimings 상태 | projectStore.ts L129-132 | 10줄 |
| **합계** | | **~216줄** |

### 3가지 옵션 분석

#### 옵션 A: Feature Flag로 나레이션 숨기기, 시네마틱만 MVP 출시

**장점:**
- 사용자 혼란 제거 — MVP에서 하나의 명확한 경험만 제공
- QA/테스트 범위 축소 — 시네마틱 경로만 집중 검증
- 코드 삭제 불필요 — flag 하나로 on/off 전환
- Phase 2에서 바로 활성화 가능 — 재구현 비용 0
- 마케팅 메시지 단순화 — "AI 시네마틱 영상 제작 플랫폼" 한 줄

**단점:**
- 이미 구현된 코드가 당장 사용되지 않음 (약간의 낭비감)
- Feature flag 관리 코드 추가 필요 (경미)

**구현 난이도:** 매우 낮음 (1-2시간)
- `settingsStore`에 `featureFlags: { narrationMode: boolean }` 추가
- HomePage 모드 선택 모달에서 flag 체크
- 또는 더 간단하게: 모드 선택 모달 자체를 제거하고 바로 cinematic으로 진행

#### 옵션 B: 둘 다 MVP에 포함, 나레이션은 "Beta" 라벨

**장점:**
- 구현된 코드 즉시 활용
- 타겟 유저 폭이 넓어짐 (나레이션 선호 유저도 포함)
- "두 가지 모드 지원"은 경쟁사 대비 차별점

**단점:**
- **나레이션 여정이 불완전함** (후술 섹션 3에서 상세 분석)
  - TTS -> 씬 자동 분할 -> 스토리보드 이동 후, 이미지 생성까지의 플로우가 어색
  - 나레이션 모드에서 Cast 선택 후 스토리보드에서 CutSplit을 스킵하는데, 씬 텍스트가 이미 자동 분할되었으므로 논리적으로 맞지만 유저 입장에서 "내가 뭘 건너뛴 거지?" 혼란 유발
  - 나레이션 완료 후 다시 TimelinePage로 돌아와야 하는데, 현재 TimelinePage가 시네마틱 모드용 편집 UI와 나레이션 모드를 동시 표시
- **QA 부담 2배** — 두 경로 모두 검증 필요
- **"Beta" 라벨은 유저 신뢰 저하** — "미완성 느낌"
- MVP 런칭 지연 가능성 (나레이션 플로우 QA + 수정)

**구현 난이도:** 중간 (추가 QA + UX 수정 필요)

#### 옵션 C: 나레이션 코드 제거, 시네마틱만 유지

**장점:**
- 코드베이스 단순화 — 유지보수 쉬움
- 시네마틱에 100% 집중

**단점:**
- **216줄의 코드 삭제** — 나중에 재구현 비용 발생
- Store 마이그레이션 v5 롤백 필요 — 기존 사용자 데이터 호환성 문제
- Git 히스토리에 남아있어 복원은 가능하지만, 코드 복원보다 재구현이 빠를 수 있음
- **되돌릴 수 없는 결정** (옵션 A는 되돌릴 수 있음)

**구현 난이도:** 중간 (삭제 자체는 쉽지만, Store 마이그레이션 주의)

### CPO 추천: 옵션 A (Feature Flag)

**이유:**

1. **리스크 최소화**: 코드를 삭제하지 않으므로 되돌릴 수 있음. Flag 하나로 언제든 활성화.
2. **MVP 집중**: 시네마틱 경로 하나를 완벽하게 만드는 것이 "두 개를 대충"보다 훨씬 나음.
3. **나레이션 플로우가 아직 불완전**: 섹션 3에서 상세히 분석하겠지만, 현재 나레이션 모드는 유저가 혼란스러워할 지점이 최소 3곳. Beta 라벨로 출시하면 첫인상이 나빠짐.
4. **비용 효율**: 1-2시간이면 구현 완료. Phase 2에서 나레이션 플로우를 제대로 다듬어서 정식 출시하는 것이 프로덕트 퀄리티 측면에서 우월.

**구체적 구현 방안:**
- HomePage에서 "대본부터" 클릭 시 모드 선택 모달을 표시하지 않고, 바로 `cinematic` 모드로 프로젝트 시작
- 모드 선택 모달 코드는 그대로 두되, `showModeSelect` 대신 바로 `handleModeSelect('cinematic')` 호출
- Store의 mode 필드와 나레이션 관련 코드는 그대로 유지 (삭제하지 않음)
- WorkflowSteps의 NARRATION_WORKFLOW도 그대로 유지
- Admin 페이지나 .env에 `VITE_FEATURE_NARRATION=true` 로 개발 중 테스트 가능

**CEO 결정 요청:** 옵션 A/B/C 중 선택해주세요.

---

## 섹션 2: 시네마틱 모드 고객 여정 분석

### 전체 플로우

```
[홈페이지]
    |
    +-- (A) 대본부터 ---------> [모드선택모달] --> cinematic --> [IdeaPage]
    |                                                              |
    +-- (B) 스타일부터 -------> [프리셋그리드] --> 선택 --> [IdeaPage] (프리셋모달)
    |                                                              |
    +-- (C) Cast부터 ---------> [CastPage ?mode=project] --> 5장 선택 --> [IdeaPage]
    |                                                              |
    +-- (D) 템플릿 클릭 ------> [모드선택모달] --> cinematic --> [IdeaPage]
    |                                                              |
    +-- (E) 기존 프로젝트 열기 -> loadProject --> [IdeaPage]       |
                                                                   |
                                                                   v
                                                            [IdeaPage]
                                                          SCRIPT | STYLE 탭
                                                          대본 입력/생성
                                                          스타일 선택
                                                          비율 선택
                                                                   |
                                                                   v
                                                         [StoryboardPage]
                                                        Phase: cast-setup
                                                         (AI 분석 모달)
                                                         (덱 카드 선택)
                                                                   |
                                                                   v
                                                        Phase: script-review
                                                          (컷 분할 확인)
                                                       (씬별 영상 개수 선택)
                                                                   |
                                                                   v
                                                        Phase: seed-check
                                                         (시드 매칭 확인)
                                                       (이미지 생성 실행)
                                                       (영상 생성 실행)
                                                                   |
                                                                   v
                                                         [TimelinePage]
                                                         클립 편집 (자르기/붙이기/순서)
                                                         TTS 음성 생성
                                                         Export (미구현)
```

### 단계별 상세 분석

#### 2.1 HomePage -> IdeaPage 전환

**진입점 A: 대본부터**
- 클릭 -> 모드 선택 모달 -> cinematic 선택 -> `startNewProject('Untitled Project', 'cinematic')` -> `setEntryPoint('script')` -> navigate('/project/idea')
- **정상 작동**. 단, 모드 선택 모달이 나레이션과 관련되므로 옵션 A 적용 시 이 모달은 스킵됨.

**진입점 B: 스타일부터**
- 클릭 -> 프리셋 그리드 토글 -> 프리셋 선택 -> `startNewProject(preset.name)` -> navigate('/project/idea')
- IdeaPage 진입 시 PresetInfoModal 표시 -> "적용" 또는 "커스터마이징" 선택
- **발견 문제 [B-1]**: `startNewProject(preset.name)` 호출 시 mode 파라미터가 없어서 기본값 `cinematic` 사용. 이것은 의도된 동작이지만, 스타일부터 진입한 유저에게 모드 선택 기회가 없음. (옵션 A 적용 시 문제 아님)
- **발견 문제 [B-2]**: `setSelectedPreset(preset.id)` -> `setSelectedStyle(preset.style)` -> `setAspectRatio(preset.aspectRatio)` 순서로 설정하지만, IdeaPage에서 PresetInfoModal의 "적용" 클릭 시 `setSelectedPreset(null)` 호출. 이때 style과 aspectRatio는 유지됨. **정상 동작.**

**진입점 C: Cast부터**
- 클릭 -> navigate('/cast?mode=project')
- CastPage에서 카드 선택 (최대 5장) -> "프로젝트 시작하기" 클릭
- `setEntryPoint('cast')` -> `startNewProject('Untitled Project')` -> navigate('/project/idea')
- **발견 문제 [C-1] CRITICAL**: `startNewProject`가 `selectedDeck: []`로 리셋함! CastPage에서 `setSelectedDeck`으로 선택한 카드 목록이 **모두 날아감**. `startNewProject` 호출이 `setSelectedDeck` 이후에 일어나므로 선택한 카드가 사라짐.
  - CastPage L102-106: `setEntryPoint('cast')` -> `startNewProject(...)` -> navigate
  - projectStore L195-212: `startNewProject`가 `selectedDeck: []`로 초기화
  - **결과**: Cast부터 진입해도 IdeaPage에서 selectedDeck이 빈 배열. Cast 선택이 무의미해짐.

**진입점 D: 템플릿 클릭**
- 템플릿 카드 클릭 -> `handleScriptStart()` -> 모드 선택 모달 표시
- **발견 문제 [D-1]**: 템플릿을 클릭했는데 해당 템플릿의 데이터(제목, 장르, 대본 등)가 프로젝트에 반영되지 않음. `handleScriptStart`는 단순히 모드 선택 모달만 표시할 뿐, 템플릿 데이터를 store에 저장하지 않음. **유저는 템플릿을 선택했다고 생각하지만 실제로는 빈 프로젝트가 시작됨.**

**진입점 E: 기존 프로젝트 열기**
- loadProject -> setProjectId, setTitle, setSelectedStyle, setAspectRatio, setScenes, setCurrentPhase(2) -> navigate('/project/idea')
- **발견 문제 [E-1]**: `setCurrentPhase(2)`이지만 IdeaPage는 Phase 1. 상태와 라우팅이 불일치하지만 실제 UI에는 영향 없음 (currentPhase는 현재 UI에서 사용되지 않는 필드).
- **발견 문제 [E-2]**: loadProject에서 mode, entryPoint, aiModelPreferences를 복원하지 않음. 항상 기본값(cinematic, null, DEFAULT_AI_MODELS)으로 시작. MVP에서는 큰 문제 아니지만, 나중에 프로젝트 복원 시 모드/설정 소실.

#### 2.2 IdeaPage 내부

**SCRIPT 탭:**
- 아이디어 입력 모드: 텍스트 입력 -> AI 모델 선택 -> "AI로 대본 생성" -> 크레딧 차감 -> LLM 호출 -> 씬 분할 결과 표시
- 대본 직접 입력 모드: textarea에 대본 붙여넣기 -> 씬 수 설정 -> "Generate Script" -> 로컬 분할 (AI 미사용)
- **정상 작동.** 씬 분할 후 개별 씬 편집/체크 가능.

**STYLE 탭:**
- artStyles 목록에서 스타일 선택 -> `setSelectedStyle(style.name)`
- **정상 작동.** 단, 선택 후 시각적 확인(선택됨 표시)이 잘 됨.

**비율 선택:**
- 16:9 / 9:16 / 1:1 세 버튼 -> `setAspectRatio`
- **정상 작동.**

**"다음" 버튼:**
- 시네마틱: navigate('/project/storyboard')
- 나레이션: navigate('/project/timeline')
- **정상 작동.**

**발견 문제 [F-1]**: CAST 탭이 IdeaPage에 없음. VISION.md에서는 "3탭 통합 (SCRIPT | STYLE | CAST)"이라고 했지만, 현재 IdeaPage는 SCRIPT | STYLE 2탭만 존재. Cast 관리는 별도 CastPage(/cast)에서만 가능. 이것은 의도적 설계 변경인지 누락인지 확인 필요.

#### 2.3 StoryboardPage

**Phase: cast-setup**
- AI 분석 모달 자동 표시 -> "분석하기" 또는 "스킵"
- 분석: cardLibrary에서 character 3 + background 1 + item 1 선택 -> deck 설정
- 스킵: aiSuggestedCards 기본 덱 사용
- 덱 편집: 카드 추가/제거, AI 생성 가능
- **정상 작동.** 다음 단계로 이동 가능.

**Phase: script-review (컷 분할)**
- 씬별 텍스트 + 영상 개수 선택 (1/2/3)
- 씬별 덱 카드 할당 표시
- **정상 작동.**

**Phase: seed-check (시드 매칭 & 생성)**
- 씬별로 시드 카드 매칭 확인
- 이미지 생성 버튼 -> AI 이미지 생성 (Mock/Gemini/Replicate)
- 영상 생성 버튼 -> (현재 Mock만 지원)
- AI 모델 선택 (이미지/영상)
- "타임라인으로 이동" 버튼 -> navigate('/project/timeline')
- **정상 작동.**

#### 2.4 TimelinePage

- 클립 목록 표시 (씬 기반)
- 클립 선택 -> 프리뷰 영역에 이미지/정보 표시
- 편집 도구: 자르기, 이어붙이기, 순서 변경, 삭제
- TTS: 개별 클립 또는 전체 일괄 생성
- TTS AI 모델 선택
- Export 버튼: disabled (미구현)
- **정상 작동.** 단, 실제 재생(Play/Pause)은 시각적 전환만 있고 실제 미디어 재생은 없음.

**발견 문제 [G-1]**: 시네마틱 모드에서 TimelinePage에 진입해도 나레이션 TTS 섹션 코드가 `mode === 'narration'` 조건으로 숨겨져 있어 문제 없음. **정상.**

#### 2.5 시네마틱 모드 전체 데이터 흐름

```
[Store 데이터 흐름]

HomePage
  -> startNewProject(title, 'cinematic')
  -> setEntryPoint('script'|'style'|'cast')
  -> setSelectedPreset/Style/AspectRatio (스타일부터 시)

IdeaPage
  -> setTitle
  -> setScenes (대본 -> 씬 분할)
  -> setSelectedStyle
  -> setAspectRatio
  -> setAiModelPreference('script', modelId)

StoryboardPage
  -> cardLibrary 읽기
  -> deck 설정 (로컬 state, store 반영은 selectedDeck을 통해 가능하나 현재 미사용)
  -> sceneSeeds 설정 (로컬 state)
  -> 이미지 생성 -> scene.imageUrl 업데이트
  -> setAiModelPreference('image'|'video', modelId)

TimelinePage
  -> scenes 읽기 -> clips 로컬 state 생성
  -> TTS 생성 -> clip.audioUrl 로컬 state
  -> setAiModelPreference('tts', modelId)
```

**발견 문제 [H-1] MAJOR**: StoryboardPage의 deck, sceneSeeds, videoCountPerScene, 생성된 이미지 등이 모두 **로컬 state**에만 존재하고 store에 영속화되지 않음. 페이지를 벗어나면 데이터 소실. 뒤로가기 -> 다시 StoryboardPage 진입 시 처음부터 다시 시작해야 함.

**발견 문제 [H-2] MAJOR**: TimelinePage의 clips, audioUrl 등도 **로컬 state**. TimelinePage에서 나갔다 돌아오면 TTS 생성 결과가 모두 사라짐.

**발견 문제 [H-3]**: StoryboardPage에서 이미지가 생성되면 `scene.imageUrl`이 업데이트되지만, 이것이 store의 `scenes`에 반영되는지 확인 필요. SeedCheckPhase 내부 구현을 추가 확인해야 함.

---

## 섹션 3: 나레이션 모드 고객 여정 분석

### 전체 플로우

```
[홈페이지]
    |
    +-- (A) 대본부터 --> [모드선택모달] --> narration --> [IdeaPage]
                                                            |
                                                            v
                                                      [IdeaPage]
                                                    SCRIPT | STYLE 탭
                                                    대본 입력/생성
                                                            |
                                                            v  ("다음: 나레이션 생성 ->")
                                                      [TimelinePage]
                                                    나레이션 TTS 섹션 표시
                                                    전체 대본 TTS 생성
                                                    문장별 타이밍 분석
                                                    "씬 자동 분할 -> 스토리보드"
                                                            |
                                                            v
                                                     [StoryboardPage]
                                                    Phase: cast-setup
                                                    (CutSplit 스킵)
                                                            |
                                                            v
                                                    Phase: seed-check
                                                    이미지/영상 생성
                                                            |
                                                            v
                                                     [TimelinePage]
                                                    (시네마틱 편집 UI 표시)
                                                    ???
```

### 단계별 상세 분석

#### 3.1 IdeaPage (나레이션 모드)

- SCRIPT 탭에서 대본 작성/생성 -> 동일하게 작동
- STYLE 탭에서 스타일 선택 -> 동일
- "다음" 버튼: "다음: 나레이션 생성 ->" -> navigate('/project/timeline')
- **기능적으로 정상 작동.**

**발견 문제 [N-1] MINOR**: 나레이션 모드에서도 STYLE 탭이 표시되지만, 나레이션 모드에서 스타일 선택의 의미가 불명확. 나레이션 = TTS 우선이므로 스타일은 이미지 생성에만 영향. 유저 혼란 가능.

#### 3.2 TimelinePage (나레이션 모드 - 1차 방문)

- 나레이션 TTS 섹션 표시 (mode === 'narration' 조건)
- 전체 대본 합치기: `fullScript = storeScenes.map(s => s.text).join(' ')`
- TTS AI 모델 선택
- "TTS 생성" 버튼 클릭 -> generateTTS 호출 -> narrativeAudioUrl + sentenceTimings 설정
- 문장별 타이밍 표시 (최대 5개 + "...외 N개")
- "씬 자동 분할 -> 스토리보드" 버튼 -> handleAutoSplit -> setScenes -> navigate('/project/storyboard')

**발견 문제 [N-2] CRITICAL**: 나레이션 모드로 TimelinePage에 처음 진입할 때, 아직 이미지가 없으므로 **하단의 시네마틱 편집 UI(프리뷰, 툴바, 클립 스트립)가 빈 상태로 표시됨**. 나레이션 TTS 섹션은 상단에 있지만, 아래로 스크롤하면 비어있는 타임라인 편집 영역이 보임. 유저 입장에서 "이 빈 영역은 뭐지?" 혼란 유발.

**발견 문제 [N-3] MAJOR**: `fullScript`가 빈 문자열일 수 있음. IdeaPage에서 "아이디어 입력 -> AI 생성"을 하면 `scenes`에 데이터가 있지만, "대본 직접 입력 -> Generate Script"를 하면 `scenes[].text`에 데이터가 있음. 두 경우 모두 `storeScenes.map(s => s.text).join(' ')`로 추출 가능. **하지만**, IdeaPage에서 대본을 입력하지 않고 바로 "다음"을 누르면 scenes가 비어있어 fullScript가 빈 문자열. 이때 TTS 생성 버튼이 disabled 되긴 하지만(`!fullScript.trim()`), 유저가 왜 비활성인지 이해하기 어려움.

**발견 문제 [N-4] MAJOR**: `handleAutoSplit`이 sentenceTimings를 기반으로 새로운 scenes를 만들어 `setScenes`로 덮어쓴 후 StoryboardPage로 이동. 그런데 이때 **IdeaPage에서 생성한 원본 scenes가 사라짐**. 자동 분할된 씬은 타이밍 기반이므로 원본 대본의 논리적 구분과 다를 수 있음.

#### 3.3 StoryboardPage (나레이션 모드)

- Phase: cast-setup 진입 (시네마틱과 동일)
- "다음" 클릭 시 `mode === 'narration'`이면 CutSplit 스킵 -> 바로 seed-check
- **발견 문제 [N-5] MINOR**: CutSplit을 스킵하는 것은 논리적으로 맞음 (이미 자동 분할됨). 하지만 WorkflowSteps에서 나레이션 워크플로우의 Step 3(Generate)에는 'cast-setup'과 'image-gen'만 있고 'cut-split'이 없음. 현재 StoryboardPage의 phase는 'cast-setup' -> 'seed-check'으로 전환되는데, WorkflowSteps의 sub-step 매핑이 정확히 맞지 않음.

#### 3.4 TimelinePage (나레이션 모드 - 2차 방문)

- 스토리보드에서 이미지 생성 완료 후 TimelinePage로 이동
- **발견 문제 [N-6] CRITICAL**: 2차 방문 시에도 나레이션 TTS 섹션이 다시 표시됨. 이미 TTS를 생성했는데 또 TTS 생성 UI가 보임. narrativeAudioUrl이 store에 저장되어 있으므로 "재생성" 버튼으로 표시되긴 하지만, **유저 여정에서 "이미 끝난 단계"가 다시 보이는 것은 혼란스러움**.
- 더 큰 문제: 이 시점에서 유저가 해야 할 일은 이미지/영상 클립과 나레이션 오디오를 **싱크 맞추는 것**인데, 현재 TimelinePage에는 나레이션 오디오와 영상 클립을 연동하는 기능이 없음. 기존 시네마틱용 TTS(개별 클립별)와 나레이션 TTS(전체 음성)가 **충돌**함.

**발견 문제 [N-7] CRITICAL**: 나레이션 모드의 핵심 가치인 "나레이션 오디오 타이밍에 맞춰 이미지/영상을 배치"하는 기능이 **미구현**. 현재는:
1. TTS 생성 -> sentenceTimings 저장
2. 씬 자동 분할
3. 스토리보드에서 이미지 생성
4. TimelinePage로 이동 -> 그냥 일반 타임라인 편집 UI

나레이션 오디오와 영상 클립의 자동/수동 싱크 기능이 없음. 이것이 나레이션 모드의 핵심 차별점이어야 하는데 빠져있음.

---

## 섹션 4: 발견된 UX 문제점 + 심각도

### Critical (서비스 불가 / 데이터 손실)

| ID | 문제 | 위치 | 설명 |
|----|------|------|------|
| C-1 | Cast 진입점에서 selectedDeck 초기화 | CastPage L102-106, projectStore L195 | `startNewProject`가 selectedDeck을 []로 리셋하여 Cast 선택이 무효화됨 |
| N-2 | 나레이션 1차 TimelinePage에서 빈 타임라인 UI 노출 | TimelinePage L452-661 | 시네마틱 편집 UI가 빈 상태로 표시되어 혼란 유발 |
| N-6 | 나레이션 2차 TimelinePage에서 TTS 섹션 재표시 | TimelinePage L373-450 | 이미 완료된 TTS 단계가 다시 보이며, 오디오-영상 싱크 기능 부재 |
| N-7 | 나레이션 오디오-영상 싱크 기능 미구현 | TimelinePage | 나레이션 모드의 핵심 가치 기능이 없음 |

### Major (기능 장애 / 데이터 비영속)

| ID | 문제 | 위치 | 설명 |
|----|------|------|------|
| D-1 | 템플릿 클릭 시 데이터 미반영 | HomePage L364 | 템플릿 카드 클릭이 빈 프로젝트 시작과 동일 |
| H-1 | StoryboardPage 데이터 비영속 | StoryboardPage | deck, sceneSeeds, 생성 이미지 등이 로컬 state만. 페이지 이동 시 소실 |
| H-2 | TimelinePage 데이터 비영속 | TimelinePage | clips, audioUrl 등이 로컬 state만. 페이지 이동 시 소실 |
| N-3 | 빈 대본으로 TimelinePage 진입 가능 | IdeaPage L476 | 대본 없이 "다음" 클릭 가능, TTS 생성 불가 상태 진입 |
| N-4 | 씬 자동 분할이 원본 scenes 덮어쓰기 | TimelinePage L156 | handleAutoSplit이 setScenes로 원본 대본 구조 소실 |

### Minor (UX 어색함 / 개선 가능)

| ID | 문제 | 위치 | 설명 |
|----|------|------|------|
| F-1 | IdeaPage에 CAST 탭 없음 | IdeaPage | VISION.md의 "3탭 통합"과 불일치. Cast는 별도 페이지로 분리됨 |
| E-2 | 프로젝트 복원 시 mode/설정 미복원 | HomePage L91-105 | loadProject에서 mode, entryPoint 등을 복원하지 않음 |
| N-1 | 나레이션 모드에서 STYLE 탭 의미 불명확 | IdeaPage | 나레이션 = 음성 우선인데 스타일(이미지용) 탭이 동일하게 표시 |
| N-5 | 나레이션 모드 WorkflowSteps 서브스텝 불일치 | WorkflowSteps + StoryboardPage | phase 전환과 sub-step 표시가 정확히 매핑되지 않음 |

---

## 섹션 5: 개선 우선순위 로드맵

### 즉시 (MVP 출시 전 필수)

| 순위 | 작업 | 문제 ID | 예상 공수 | 비즈니스 임팩트 |
|------|------|---------|-----------|----------------|
| 1 | Feature Flag로 나레이션 모드 숨기기 | N-2,N-6,N-7 | 1시간 | 불완전한 기능 노출 차단 |
| 2 | Cast 진입점 selectedDeck 버그 수정 | C-1 | 30분 | 3진입점 중 1개(Cast)가 완전히 깨져있음 |
| 3 | 템플릿 클릭 시 데이터 연동 | D-1 | 2시간 | HomePage 템플릿 섹션이 장식용이 됨 |

### 단기 (MVP 출시 후 1-2주)

| 순위 | 작업 | 문제 ID | 예상 공수 | 비즈니스 임팩트 |
|------|------|---------|-----------|----------------|
| 4 | StoryboardPage 데이터 store 영속화 | H-1 | 4시간 | 페이지 간 이동 시 작업 결과 보존 |
| 5 | TimelinePage 데이터 store 영속화 | H-2 | 3시간 | TTS 생성 결과 보존 |
| 6 | IdeaPage "다음" 클릭 시 유효성 검증 | N-3 | 1시간 | 빈 대본 상태로 다음 단계 진입 방지 |

### 중기 (Phase 2 준비)

| 순위 | 작업 | 문제 ID | 예상 공수 | 비즈니스 임팩트 |
|------|------|---------|-----------|----------------|
| 7 | 나레이션 모드 TimelinePage 재설계 | N-2,N-6,N-7 | 2주 | 나레이션 핵심 UX (오디오-영상 싱크) |
| 8 | 프로젝트 완전 복원 (mode, 설정 등) | E-2 | 3시간 | 프로젝트 재개 시 설정 보존 |
| 9 | IdeaPage CAST 탭 통합 또는 의도적 분리 확정 | F-1 | 결정 필요 | 3진입점 일관성 |

### 참고: 3진입점 현황 요약

| 진입점 | 구현 상태 | 작동 여부 | 비고 |
|--------|-----------|-----------|------|
| A. 대본부터 | 완전 구현 | 정상 (모드 선택 모달 포함) | 옵션 A 시 모달 제거 |
| B. 스타일부터 | 완전 구현 | 정상 | 프리셋 모달 + 설정 자동 적용 |
| C. Cast부터 | 구현됨 | **버그 (C-1)** | selectedDeck 초기화 버그 |
| D. 템플릿 | UI 구현됨 | **무기능 (D-1)** | 데이터 연동 안 됨 |

---

## 최종 요약 (CEO 보고용)

1. **시네마틱 모드**: 대체로 잘 작동. Cast 진입점 버그(C-1)와 템플릿 무기능(D-1) 수정하면 MVP 출시 가능.
2. **나레이션 모드**: 핵심 기능(오디오-영상 싱크) 미구현으로 MVP 출시 부적합. Feature Flag로 숨기고 Phase 2에서 완성 추천.
3. **데이터 영속성**: StoryboardPage와 TimelinePage의 작업 결과가 페이지 이동 시 사라짐. MVP 출시 전 또는 직후 영속화 필요.
4. **CEO 결정 필요**: 나레이션 전략 옵션 A/B/C 선택.

---

*이 문서는 CPO 유나가 작성했으며, CTO 일론의 기술 검토를 거쳐 CEO에게 전달됩니다.*
