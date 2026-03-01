# 프리셋별 고객 E2E 여정 시나리오

> 작성: CPO 유나 (2026-02-28)
> 목적: 현재 코드베이스 기준으로 각 프리셋의 고객 여정을 완전히 추적하고, 끊기는 지점/부족한 지점을 식별
> CEO 피드백 핵심: "추가 개발 멈추고 기존 기능을 완벽하게 동작시키자"

---

## 프리셋 요약

| # | 프리셋 ID | 이름 | 모드 | 비율 | 추천 캐스트 |
|---|-----------|------|------|------|-------------|
| 1 | `cinematic-drama` | 시네마틱 드라마 | cinematic | 16:9 | 캐릭터2 + 배경2 + 아이템0 |
| 2 | `overseas-touching-story` | 해외감동사연 | narration | 16:9 | 캐릭터2 + 배경2 + 아이템0 |
| 3 | `martial-arts` | 무협지 | narration | 16:9 | 캐릭터3 + 배경2 + 아이템1 |
| 4 | `martial-arts-cinematic` | 무협지2 | cinematic | 16:9 | 캐릭터3 + 배경2 + 아이템2 |
| 5 | `skeleton-shorts` | 해골 쇼츠 | narration | 9:16 | 캐릭터1 + 배경1 + 아이템0 |

---

## Part A: 시네마틱 모드 여정 (프리셋 1: 시네마틱 드라마, 프리셋 4: 무협지2)

### Workflow 개요

```
HomePage -> IdeaPage(Script) -> IdeaPage(Style) -> StoryboardPage(CastSetup)
-> StoryboardPage(CutSplit) -> StoryboardPage(SeedCheck) -> TimelinePage(Animate)
```

WorkflowSteps 표시: `1.Idea > 2.Storyboard > 3.Generate > 4.Animate`

---

### Step 1: HomePage -- 진입점 선택

#### 1A. "스타일부터" 진입 (프리셋 선택)

**사용자 액션:**
1. HomePage에서 "스타일부터" 카드를 클릭
2. 프리셋 그리드가 확장됨 (activeEntry === 'style')
3. "시네마틱 드라마" 또는 "무협지2" 카드를 클릭

**시스템 이벤트:**
- `handleStyleStart()` -> activeEntry를 'style'로 설정
- `handlePresetSelect(preset)` 호출:
  - `startNewProject(preset.name, preset.mode)` -- 새 프로젝트 초기화
  - `setEntryPoint('style')` -- store에 진입점 기록
  - `setSelectedPreset(preset.id)` -- 프리셋 ID 저장
  - `setSelectedStyle(preset.style)` -- 아트스타일 저장 (둘 다 'cinematic')
  - `setAspectRatio(preset.aspectRatio)` -- 화면 비율 저장
  - `navigate('/project/idea')` -- IdeaPage로 이동

**유지되어야 할 상태:**
```
projectStore:
  hasActiveProject: true
  title: "시네마틱 드라마" 또는 "무협지2"
  mode: "cinematic"
  entryPoint: "style"
  selectedPreset: "cinematic-drama" 또는 "martial-arts-cinematic"
  selectedStyle: "cinematic"
  aspectRatio: "16:9"
  aiModelPreferences: { script: 'gemini-2.5-flash', image: 'gemini-2.0-flash-exp-image-generation', ... }
  scenes: []
  cardLibrary: [기존 카드 유지]
  selectedDeck: []
```

**사용되는 프롬프트:** 아직 없음 (프리셋만 선택됨)

**예상 결과:**
- IdeaPage로 이동
- PresetInfoModal이 표시됨 (selectedPreset이 있으므로)
- 프리셋의 이름, 설명, 추천 캐스트 수 등 정보 확인 가능

**실패 시나리오:**
- 프리셋 썸네일 이미지 로드 실패 -> 플레이스홀더 아이콘(Star) 표시
- startNewProject 실패 -> 불가능 (로컬 상태만 변경)

**[문제점 발견]**
- `startNewProject()`에서 `selectedPreset: null`로 리셋하는데, 바로 다음에 `setSelectedPreset(preset.id)`를 호출함 -> 타이밍 이슈는 없지만 불필요한 리셋-세팅 순서
- `startNewProject()`에서 `selectedStyle: 'Cinematic'`(대문자)로 리셋하는데, 바로 `setSelectedStyle(preset.style)` 에서 'cinematic'(소문자)로 덮어씀 -> OK이긴 하지만, 기본값과 프리셋값의 대소문자가 다름 (잠재적 버그)

#### 1B. "대본부터" 진입

**사용자 액션:**
1. HomePage에서 "대본부터" 카드를 클릭
2. 모드 선택 오버레이가 표시됨 (showModeSelect === true)
3. "시네마틱" 모드를 선택

**시스템 이벤트:**
- `handleScriptStart()` -> showModeSelect = true
- `handleModeSelect('cinematic')`:
  - `startNewProject('Untitled Project', 'cinematic')`
  - `setEntryPoint('script')`
  - `setSelectedPreset(null)` -- 프리셋 없음
  - `navigate('/project/idea')`

**유지되어야 할 상태:**
```
projectStore:
  hasActiveProject: true
  title: "Untitled Project"
  mode: "cinematic"
  entryPoint: "script"
  selectedPreset: null  <-- 프리셋 미선택
  selectedStyle: "Cinematic"  <-- 기본값 (대문자)
  aspectRatio: "16:9"
```

**[문제점 발견]**
- 프리셋 없이 시작하면 `selectedPreset = null` -> 이후 프롬프트에 프리셋 prefix가 적용되지 않음
- `selectedStyle`이 'Cinematic'(대문자) -> `stylePromptPrefix['Cinematic']`과 매칭됨 -> OK
- "대본부터" 진입 시 프리셋을 선택할 기회가 없음 (IdeaPage Style 탭에서 할 수는 있지만 흐름이 끊김)

#### 1C. "Cast부터" 진입

**사용자 액션:**
1. "Cast부터" 카드를 클릭

**시스템 이벤트:**
- `handleCastStart()` -> `navigate('/cast?mode=project')`

**[문제점 발견]**
- CastPage가 구현되어 있는지 확인 필요 (라우터에 `/cast` 경로가 있는가?)
- Cast에서 돌아온 후 프로젝트가 생성되지 않은 상태 -> `hasActiveProject`가 false일 수 있음
- Cast -> Idea -> Storyboard 흐름에서 선택한 카드가 `selectedDeck`에 반영되는지 불확실

#### 1D. "템플릿" 진입

**사용자 액션:**
1. 템플릿 그리드에서 카드를 클릭 (예: "Mars Colony")
2. 모드 선택 오버레이 표시
3. "시네마틱" 선택

**시스템 이벤트:**
- `handleTemplateSelect(template)` -> pendingTemplate = template, showModeSelect = true
- `handleModeSelect('cinematic')`:
  - `startNewProject(template.title, 'cinematic')` -- 템플릿 제목 사용
  - `setEntryPoint('script')`
  - `setSelectedPreset(null)` -- 프리셋 연결 없음

**[문제점 발견]**
- 템플릿이 프리셋과 연결되지 않음 -> 템플릿은 단순히 제목만 전달하고 프리셋/스타일 정보가 없음
- 사용자는 "Mars Colony" 템플릿을 선택했지만, 실제로는 빈 프로젝트 + 제목만 설정됨
- 프롬프트에 템플릿의 장르/스타일이 전혀 반영되지 않음

---

### Step 2: IdeaPage -- SCRIPT 탭 (대본 작성)

**사용자 액션 (아이디어 입력 모드):**
1. "아이디어 입력" 탭 선택
2. 아이디어 텍스트 입력 (예: "무협 세계에서 벌어지는 복수극")
3. 씬 수 조절 (기본 10)
4. 대본 AI 모델 선택 (기본: gemini-2.5-flash)
5. "AI로 대본 생성" 버튼 클릭

**시스템 이벤트:**
- `handleIdeaGenerate()`:
  - `canAfford('script')` 확인 (비용: 2 크레딧 / BYOK: 1)
  - `spend('script')` 크레딧 차감
  - `generateScript()` 호출 (ai-llm.ts)
    - provider 결정: `VITE_LLM_API_PROVIDER` (mock/gemini/openai/anthropic)
    - `buildSystemPrompt(req)` 호출:
      - **프리셋이 있으면**: `getPresetById(selectedPreset).prompts.script`를 role instruction으로 사용
      - **프리셋이 없으면**: 기본 "YouTube 영상 시나리오 작가" 프롬프트 사용
      - mode === 'cinematic'이면: "씬별 시각적 장면 묘사에 집중" 지시 추가
    - `buildUserPrompt(req)`: "다음 아이디어로 N개 씬의 영상 대본을 작성해주세요"
  - 결과를 `setScenes(storeScenes)` -> store에 씬 배열 저장
  - `setIsGenerated(true)` -> Script Breakdown 뷰로 전환

**사용되는 프롬프트 (시네마틱 드라마 프리셋 선택 시):**
```
System: "당신은 드라마 영화 각본가입니다. 인물의 감정과 갈등에 집중한 씬을 작성하세요."
+ "정확히 10개의 씬으로 나누어 작성"
+ "씬별 시각적 장면 묘사에 집중"
+ "카메라 앵글과 로케이션을 구체적으로 명시"

User: "다음 아이디어로 10개 씬의 영상 대본을 작성해주세요:\n\n{아이디어 텍스트}"
```

**사용되는 프롬프트 (무협지2 프리셋 선택 시):**
```
System: "당신은 무협 영화 감독입니다. 화려한 액션과 드라마틱한 장면을 씬별로 작성하세요."
+ 동일 규칙
```

**사용되는 프롬프트 (프리셋 미선택 시):**
```
System: "당신은 YouTube 영상 시나리오 작가입니다. 사용자의 아이디어를 기반으로 시네마틱 영상 대본을 작성합니다."
+ 동일 규칙
```

**유지되어야 할 상태:**
```
projectStore:
  scenes: [
    { id: 'scene-1', text: '씬1 대본...', location: '장소', cameraAngle: 'Wide Angle', imageUrl: '', status: 'pending', checked: true },
    ...
  ]
```

**예상 결과:**
- Script Breakdown 뷰가 표시됨
- 각 씬에 번호, 대본 텍스트, 편집 버튼, 체크박스가 표시
- 사용자는 씬을 편집/삭제/포함여부 토글 가능

**실패 시나리오:**
- 크레딧 부족 -> alert 표시, 생성 중단
- API 호출 실패 -> alert "대본 생성에 실패했습니다", isIdeaGenerating = false로 복원
- JSON 파싱 실패 (LLM 응답이 JSON이 아닌 경우) -> fallback-parse: 텍스트를 균등 분할

**[문제점 발견]**
- 대본 직접 입력 모드에서 `splitScriptIntoScenes()`는 크레딧을 소비하지 않음 -> OK (AI 미사용이므로)
- 대본 직접 입력 시 `location`과 `cameraAngle`이 빈 문자열로 설정됨 -> Storyboard에서 위치/앵글 정보 없음
- 아이디어 모드에서 생성된 씬은 `checked: true`로 설정되지만, 직접 입력 모드는 `checked: false` -> 일관성 없음
- 프리셋이 선택된 상태에서 대본을 직접 입력하면 프리셋의 `prompts.script` 지시가 적용되지 않음 (직접 입력은 AI를 호출하지 않으므로)

---

### Step 3: IdeaPage -- STYLE 탭 (스타일 선택)

**사용자 액션:**
1. STYLE 탭 클릭
2. 현재 모드에 맞는 프리셋 목록 표시 (cinematic 모드 -> cinematic 프리셋들)
3. 프리셋 칩을 클릭하여 변경 가능
4. artStyles 그리드에서 아트스타일 선택 (Cinematic, Anime 등)

**시스템 이벤트:**
- `getPresetsByMode(mode)` -> cinematic 모드면 [cinematic-drama, martial-arts-cinematic]
- 프리셋 칩 클릭: `setSelectedPreset(preset.id)` + `setSelectedStyle(preset.style)`
- artStyles 그리드 클릭: `setSelectedStyle(style.name)` (예: 'Oil Painting')

**유지되어야 할 상태:**
```
projectStore:
  selectedPreset: "cinematic-drama" (또는 변경된 프리셋 ID)
  selectedStyle: "cinematic" (또는 'Oil Painting' 등 변경값)
```

**[문제점 발견]**
- 프리셋을 선택하면 `selectedStyle`이 프리셋의 style('cinematic')로 세팅됨
- 이후 artStyles에서 다른 스타일(예: 'Anime')을 선택하면 `selectedStyle`만 바뀌고 `selectedPreset`은 그대로 유지됨
- -> 프리셋은 "cinematic-drama"인데 스타일은 "Anime" -> **프롬프트 충돌**: imagePrefix는 프리셋 것(cinematic), 아트스타일은 Anime
- -> `buildImagePrompt()`에서 프리셋 imagePrefix가 우선 적용되므로 사실상 artStyle 선택이 무시됨
- 사용자에게 "Anime 스타일을 선택했는데 시네마틱 프리셋의 프롬프트가 적용됨"이라는 혼란 발생

---

### Step 4: StoryboardPage -- CastSetup (카드 덱 구성)

**사용자 액션:**
1. IdeaPage에서 "다음: 스토리보드" 버튼 클릭 -> `/project/storyboard`
2. AI 분석 팝업 모달이 표시됨 (showAiAnalysisModal = true)
3. "AI 분석 실행" 또는 "스킵" 선택

**시스템 이벤트 (AI 분석 실행 시):**
- `handleAiAnalysis(true)`:
  - 2500ms 딜레이 (Mock 분석)
  - cardLibrary에서 character 최대 3개, background 1개, item 1개 추출
  - AI 추천 카드(aiSuggestedCards)로 부족분 보충
  - 결과를 `deckApi.setDeck(finalDeck)` + `addToCardLibrary(card)` 실행
  - 모든 씬에 전체 카드 ID를 `genApi.setSceneSeeds()`로 배정

**시스템 이벤트 (스킵 시):**
- `handleAiAnalysis(false)`:
  - aiSuggestedCards에서 MAX_AI_SLOTS(5)개를 기본 덱으로 설정
  - 전체 씬에 동일하게 배정

**유지되어야 할 상태:**
```
projectStore:
  cardLibrary: [...기존 카드 + AI 추천 카드]
  selectedDeck: [카드 ID 배열] (useDeck에서 자동 동기화)
```

**사용되는 프롬프트:** 없음 (현재 Mock AI 분석)

**[문제점 발견]**
- **핵심 문제: AI 분석이 프리셋의 recommendedCast를 사용하지 않음**
  - 프리셋에 `recommendedCast: { characters: 2, backgrounds: 2, items: 0 }`이 정의되어 있으나
  - `handleAiAnalysis()`에서는 하드코딩된 값(캐릭터3, 배경1, 아이템1)을 사용
  - 시네마틱 드라마(캐릭터2)와 무협지2(캐릭터3)가 다름에도 동일하게 처리
- **AI 분석이 Mock**: 실제로 대본 내용을 분석하지 않고 cardLibrary에서 순서대로 가져옴
  - 대본에 "검술 고수가 등장"이라 했는데, 군인 캐릭터가 추천될 수 있음
- **기존 카드와 매칭 로직 부재**: 대본의 캐릭터 이름/설명을 cardLibrary와 매칭하는 로직 없음

---

### Step 5: StoryboardPage -- CutSplit (컷 분할)

**사용자 액션:**
1. CastSetup에서 "다음: 컷 분할" 버튼 클릭
2. 좌측: 현재 덱 패널, 우측: 컷 리스트
3. 씬별 영상 개수 선택 (1/2/3)
4. 씬 편집/삭제 가능 (아이콘만 있고 핸들러 없음)

**시스템 이벤트:**
- phase 전환: 'cast-setup' -> 'script-review'
- `scriptCuts`를 storeScenes의 text 배열로 구성
- 각 씬에 `videoCountPerScene` 표시 (기본 1)

**유지되어야 할 상태:**
```
useGeneration 내부:
  videoCountPerScene: { 'scene-1': 1, 'scene-2': 2, ... }
```

**사용되는 프롬프트:** 없음

**[문제점 발견]**
- 씬 편집/삭제 버튼이 UI에 있지만 **핸들러가 연결되지 않음** (Pencil, Trash2 아이콘만 렌더링)
- `videoCountPerScene` 값이 이후 영상 생성에서 사용되지 않음 (현재 1개만 생성)
- IdeaPage에서 직접 입력한 대본의 경우 location/cameraAngle이 빈 값 -> "Unknown" / "Wide Angle"로 표시

---

### Step 6: StoryboardPage -- SeedCheck (시드 매칭 & 이미지 생성)

**사용자 액션:**
1. CutSplit에서 "다음: 시드 매칭 & 생성" 클릭
2. 씬별로 시드 카드(캐스트)를 토글하여 배정/해제
3. 이미지 AI 모델 선택 (기본: gemini-2.0-flash-exp-image-generation)
4. 개별 이미지 생성 또는 "일괄 이미지 생성" 클릭

**시스템 이벤트 (개별 이미지 생성):**
- `generateSingleScene(sceneId)`:
  - `canAfford('image')` 확인 (비용: 3 크레딧)
  - `spend('image')` 차감
  - `buildImagePrompt()` 호출:
    ```
    1. prefix: 프리셋 imagePrefix (있으면) || stylePromptPrefix[selectedStyle] (폴백)
    2. sceneText: scene.text (또는 mockScenePrompts[sceneId].imagePrompt가 있으면 우선)
    3. cameraAngle: scene.cameraAngle (있으면 추가)
    4. location: scene.location (있으면 추가)
    5. seedCards의 description (Characters: ..., Background: ..., Props: ...)
    ```
  - `aspectRatioToSize(aspectRatio)` -> { width: 1344, height: 768 } (16:9)
  - `getNegativePrompt(presetId)` -> 프리셋의 negativePrompt 또는 기본값
  - `generateImage()` 호출 (ai-image.ts)
  - 성공: `updateSceneImage(sceneId, result.imageUrl)` -> store에 이미지 URL 저장
  - 실패: sceneGenStatus를 'idle'로 복원

**시스템 이벤트 (일괄 이미지 생성):**
- `generateAllScenes()`:
  - pending 상태인 씬 목록 필터
  - `canAfford('image', pending.length)` 확인
  - 600ms 간격으로 순차 호출: `setTimeout(() => generateSingleScene(scene.id), i * 600)`

**사용되는 프롬프트 (시네마틱 드라마 프리셋, 직접 대본):**
```
"cinematic photography, dramatic, natural lighting, film grain, emotional, award-winning,.
{씬 대본 텍스트}.
{카메라앵글} shot.
location: {장소}.
Characters: {캐릭터1 description}, {캐릭터2 description}.
Background: {배경 description}"

negativePrompt: "blurry, low quality, distorted, deformed, ugly, watermark, text, logo, anime, cartoon, oversaturated"
```

**사용되는 프롬프트 (무협지2 프리셋):**
```
"wuxia cinematic, martial arts action, dynamic composition, dramatic lighting, epic battle, flying swords,.
{씬 대본 텍스트}.
Characters: ...
Background: ..."

negativePrompt: "blurry, low quality, distorted, deformed, ugly, watermark, text, logo, modern weapons, guns"
```

**사용되는 프롬프트 (프리셋 없음, artStyle='Cinematic'):**
```
"photorealistic cinematic still, anamorphic lens, dramatic lighting, film grain, 4K,.
{씬 대본 텍스트}.
Characters: ...
Background: ..."
```

**예상 결과:**
- 각 씬 행에 생성된 이미지가 표시됨
- 생성 중 상태는 로딩 스피너, 완료 시 이미지 표시
- 하단에 필름스트립으로 전체 진행 상황 확인

**실패 시나리오:**
- 크레딧 부족 -> CreditShortageModal 표시 (필요 크레딧, 현재 크레딧 안내)
- API 호출 실패 -> 콘솔 에러 + sceneGenStatus를 'idle'로 복원 -> 재시도 가능
- 일괄 생성 중 일부 실패 -> **실패한 씬만 'idle' 상태, 나머지는 'done'**

**[문제점 발견]**
- **일괄 생성 중 실패한 이미지만 재생성하는 UI가 없음**
  - `generateAllScenes()`는 `status === 'idle'`인 씬만 필터
  - 한번 실패하면 'idle'로 돌아가므로 다시 "일괄 생성"을 누르면 실패한 것만 재시도 -> OK인 것처럼 보이지만...
  - 사용자 관점에서 "3/10 실패" 상태를 인지하기 어려움 -> "실패한 이미지 N개 재생성" 버튼 필요
- **mockScenePrompts 폴백**: `customImagePrompt: mockScenePrompts[sceneId]?.imagePrompt`가 있으면 씬 대본 대신 사용
  - 이것은 Mock 데이터인데, 실제 대본이 있어도 Mock 프롬프트가 우선됨
  - mockStoryboardScenes가 아닌 사용자 생성 씬에서는 mockScenePrompts[sceneId]가 없으므로 OK
  - 하지만 mock 폴백 씬(store가 비어있을 때)에서는 mock 프롬프트가 적용됨 -> 의도된 동작이긴 하지만 혼란의 여지
- **이미지 AI 모델이 Gemini인데 negativePrompt를 지원하지 않을 수 있음**
  - `geminiProvider.generate()`에서 negativePrompt를 API에 전달하지 않음 (contents에 prompt만 전달)
  - negativePrompt가 무시됨 -> 프리셋별 negativePrompt가 의미 없어짐
- **seed 값이 첫 번째 seedCard의 seed만 사용됨** -> 여러 캐릭터를 배정해도 일관성 유지에 제한적

---

### Step 6b: StoryboardPage -- 영상 생성

**사용자 액션:**
1. 모든 이미지 생성 완료 후 "5초 영상 일괄 생성" 버튼 활성화
2. 영상 AI 모델 선택 (기본: runway-gen3)
3. "5초 영상 일괄 생성" 클릭

**시스템 이벤트:**
- `generateAllVideos()`:
  - `canAfford('video', pending.length)` 확인 (비용: 10 크레딧/편)
  - 800ms 간격으로 `generateSingleVideo(scene.id)` 순차 호출
  - `buildVideoPrompt()`: 프리셋 videoPrefix + 씬 대본 + 카메라 앵글
  - `generateVideo()`: imageUrl + prompt + duration(5초) + model

**사용되는 프롬프트 (시네마틱 드라마):**
```
"cinematic, slow motion, handheld camera, emotional score, golden hour,.
{씬 대본 텍스트}.
Camera: {카메라앵글}, slow cinematic movement"
```

**사용되는 프롬프트 (무협지2):**
```
"cinematic wuxia, wire-fu action, sweeping camera, dramatic score, slow motion combat,.
{씬 대본 텍스트}.
Camera: {카메라앵글}, slow cinematic movement"
```

**[문제점 발견]**
- `videoCountPerScene` 값(Step 5에서 선택)이 실제 영상 생성에 반영되지 않음 -> 항상 1개만 생성
- 영상 생성 중 실패한 건을 재생성하는 개별 UI는 있음 (`regenerateSingleVideo`)
  - SceneRow에 재생성 버튼이 있어야 하지만, 호출 경로 확인 필요
- 영상 URL이 store에 저장되지 않음 -> `videoGenStatus`는 useGeneration 내부 state일 뿐, 페이지 새로고침 시 상실

---

### Step 7: TimelinePage -- 타임라인 편집 & Export

**사용자 액션:**
1. StoryboardPage에서 "타임라인으로 이동" 버튼 클릭
2. TimelinePage에서 클립 목록 확인 (씬 기반 자동 생성)
3. 클립 선택, 자르기, 이어붙이기, 순서 변경, 삭제
4. TTS 개별/일괄 생성
5. Export (미구현)

**시스템 이벤트:**
- `clips` 상태: storeScenes 기반으로 초기 클립 배열 생성
  - 각 클립: `{ id, sceneId, label, text, location, cameraAngle, imageUrl, duration: 5, startTime }`
- 자르기: `handleSplit()` -> splitPosition%로 클립을 2개로 분할
- TTS: `handleGenerateTTS(clipId)`:
  - `canAfford('script', 1)` + `spend('script', 1)` (TTS도 script 크레딧 사용)
  - `generateTTS()`: text + model + voiceId + speed
  - 결과: clip.audioUrl에 Blob URL 저장

**사용되는 프롬프트:** TTS는 프롬프트 없음 (텍스트 -> 음성 변환)

**[문제점 발견]**
- **TTS 크레딧이 'script'로 차감됨** -> `handleGenerateTTS`에서 `canAfford('script', 1)`, `spend('script', 1)` 사용
  - CREDIT_COST_TABLE에 tts가 별도로 있는데(비용 2) script 비용(비용 2)으로 차감 -> 우연히 같은 금액이지만 논리적 오류
- **클립 편집이 로컬 state** -> 페이지 이동/새로고침 시 편집 내용 상실
- **Export 미구현** -> 버튼은 있지만 disabled
- **영상 URL이 클립에 포함되지 않음** -> StoryboardPage에서 생성한 영상 URL이 TimelinePage clips에 반영되지 않음
  - clips 초기화 시 storeScenes의 imageUrl만 사용, videoUrl은 포함하지 않음
- **프리셋의 voice 설정이 TTS에 반영되는 경로**:
  - `selectedPreset ? getPresetById(selectedPreset) : null` -> preset.voice.voiceId 전달
  - 그런데 Step 3(STYLE 탭)에서 프리셋을 변경하면 selectedPreset이 null로 초기화될 수 있음 (PresetInfoModal onApply/onClose에서 setSelectedPreset(null))

---

## Part B: 나레이션 모드 여정 (프리셋 2: 해외감동사연, 프리셋 3: 무협지, 프리셋 5: 해골 쇼츠)

### Workflow 개요

```
HomePage -> IdeaPage(Script+Style) -> TimelinePage(Voice) -> TimelinePage(Split)
-> StoryboardPage(Direct) -> StoryboardPage(Image) -> TimelinePage(Video)
-> TimelinePage(Edit) -> TimelinePage(Export)
```

WorkflowSteps 표시: `1.Script > 2.Voice > 3.Split > 4.Direct > 5.Image > 6.Video > 7.Edit > 8.Export`

---

### Step 1: HomePage -- 프리셋 선택 (스타일부터)

**동일 흐름 (Part A Step 1A 참조)**

차이점:
- 해외감동사연: `mode: 'narration'`, `aspectRatio: '16:9'`
- 무협지: `mode: 'narration'`, `aspectRatio: '16:9'`
- 해골 쇼츠: `mode: 'narration'`, `aspectRatio: '9:16'`

**시스템 이벤트:**
- `handlePresetSelect(preset)`:
  - `startNewProject(preset.name, preset.mode)` -> **mode: 'narration'**
  - 나머지 동일

**유지되어야 할 상태:**
```
projectStore:
  mode: "narration"
  selectedPreset: "overseas-touching-story" / "martial-arts" / "skeleton-shorts"
  aspectRatio: "16:9" (해외감동사연, 무협지) 또는 "9:16" (해골 쇼츠)
  narrationStep: 1 (초기값, startNewProject에서 설정)
```

---

### Step 2: IdeaPage -- 대본 + 스타일

**사용자 액션:** Part A Step 2~3과 거의 동일

차이점:
- 대본 AI 프롬프트에서 mode별 지시가 다름
- 하단 "다음" 버튼: "다음: 나레이션 생성" (timelinePage로 이동)

**시스템 이벤트 (다음 버튼):**
```javascript
if (mode === 'narration') {
    setNarrationStep(2);
    navigate('/project/timeline');
}
```

**사용되는 프롬프트 (해외감동사연):**
```
System: "당신은 감동 실화 나레이터입니다. 시청자의 감정을 자극하는 따뜻한 이야기를 작성하세요. 나레이션 형식으로 작성하세요."
+ "나레이션 형식으로 작성: 시청자에게 직접 이야기하듯 서술"
+ "각 씬은 나레이션 문장 단위로 구성"
```

**사용되는 프롬프트 (무협지):**
```
System: "당신은 무협 소설가입니다. 강호의 전설을 나레이션 형식으로 풀어가세요. 웅장하고 서사적인 톤으로 작성하세요."
+ 동일 나레이션 지시
```

**사용되는 프롬프트 (해골 쇼츠):**
```
System: "당신은 해골 캐릭터입니다. 무섭지만 웃긴 톤으로 짧은 이야기를 나레이션하세요. 30초~1분 분량."
+ 동일 나레이션 지시
```

**[문제점 발견]**
- 해골 쇼츠는 30초~1분 분량인데, 씬 수 기본값이 10개 -> 30초에 10씬은 과다
  - 프리셋별 기본 씬 수 설정이 없음
  - 사용자가 수동으로 줄여야 함

---

### Step 3: TimelinePage -- NarrationVoiceStep (TTS 생성)

**사용자 액션:**
1. 전체 대본 미리보기 확인 (읽기 전용)
2. TTS AI 모델 선택 (기본: fish-speech)
3. "음성 생성" 버튼 클릭
4. 생성 완료 후 미리듣기
5. "다음: 씬 분할" 클릭

**시스템 이벤트:**
- `handleGenerateTTS()`:
  - `fullScript = scenes.map(s => s.text).join(' ')` -> 전체 대본을 하나로 합침
  - `canAfford('tts')` 확인 (비용: 2 크레딧)
  - `spend('tts')` 차감
  - `generateTTS({ text: fullScript, clipId: 'narrative', model, voiceId, speed })`
    - voiceId: `getPresetById(selectedPreset)?.voice?.voiceId` -> 현재 모든 프리셋에 voice.voiceId가 없음 -> undefined
    - speed: 동일하게 undefined
  - 결과: `setNarrativeAudioUrl(result.audioUrl)` -> Blob URL 저장
  - 문장 단위 타이밍 추정: 한국어 4자/초로 계산
    - `text.match(/[^.!?。\n]+[.!?。]?/g)` -> 문장 분리
    - 각 문장에 duration = max(1, 문장길이 / 4) 할당
  - `setSentenceTimings(timings)` 저장

**유지되어야 할 상태:**
```
projectStore:
  narrativeAudioUrl: "blob:..." (TTS 결과)
  sentenceTimings: [
    { index: 0, text: "문장1", startTime: 0, endTime: 5.3 },
    { index: 1, text: "문장2", startTime: 5.3, endTime: 9.7 },
    ...
  ]
  narrationStep: 2
```

**예상 결과:**
- 오디오 생성 완료 배지 표시
- 미리듣기 버튼 (Play/Pause)
- 문장별 타이밍 목록 표시 (최대 전부 표시)
- "다음: 씬 분할" 버튼 활성화

**실패 시나리오:**
- 대본 없음 -> alert "대본이 없습니다"
- 크레딧 부족 -> alert "크레딧이 부족합니다"
- TTS API 실패 -> alert + 재시도 가능

**[문제점 발견]**
- **프리셋에 voice 설정이 모두 비어있음** -> voiceId와 speed가 항상 undefined
  - Fish Speech에서 voice 모델을 선택할 수 없음 -> 기본 음성만 사용
  - 프리셋별 차별화된 음성을 제공하려면 voiceId/speed 데이터를 채워야 함
- **문장 타이밍이 추정값** -> 실제 TTS 결과의 오디오 길이와 일치하지 않을 수 있음
  - Mock provider는 1초짜리 무음 WAV 반환 -> 타이밍 추정은 텍스트 기반
  - 실제 Fish Speech도 정확한 타이밍을 반환하지 않으므로 추정에 의존
- **해골 쇼츠(9:16)의 TTS**: 전체 대본이 매우 짧을 수 있음 (30초 분량)
  - 짧은 대본에 대한 TTS가 정상 작동하는지 확인 필요

---

### Step 4: TimelinePage -- NarrationSplitStep (씬 분할)

**사용자 액션:**
1. 분할 기준 변경 (3/5/7/10초, 기본 5초)
2. 자동 분할된 씬 목록 확인
3. 씬 합치기 (Merge 버튼) / 씬 나누기 (Scissors 버튼)
4. 10초 초과 씬에 경고 표시 확인
5. "다음: 연출" 버튼 클릭

**시스템 이벤트:**
- `autoSplit(sentenceTimings, maxDuration)`:
  - sentenceTimings를 순회하며 maxDuration 이내로 그룹핑
  - 그룹이 maxDuration 초과 시 새 그룹 시작
  - 결과: SplitGroup[] (id, text, sentences, audioStartTime, audioEndTime, duration)
- "다음" 클릭 -> `handleApplyAndNext()`:
  - groups를 `Scene[]`로 변환 -> `setScenes(newScenes)` -> store에 저장
  - groups를 `NarrationClip[]`로 변환 -> `setNarrationClips(newClips)` -> store에 저장
  - `setNarrationStep(4)` -> Step 4로
  - `onNext()` -> StoryboardPage로 navigate

**유지되어야 할 상태:**
```
projectStore:
  scenes: [
    { id: 'scene-1', text: '분할된 씬 텍스트', location: '', cameraAngle: 'Wide Angle', imageUrl: '', ... },
    ...
  ]
  narrationClips: [
    { id: 'scene-1', sceneId: 'scene-1', text: '...', sentences: [...], imageUrl: '', videoUrl: '',
      effect: 'none', audioStartTime: 0, audioEndTime: 4.5, duration: 4.5, order: 0, ... },
    ...
  ]
  narrationStep: 4
```

**[문제점 발견]**
- 분할된 씬의 `location`이 항상 빈 문자열 -> 이미지 프롬프트에서 location 정보 없음
- 분할된 씬의 `cameraAngle`이 항상 'Wide Angle' -> 다양한 앵글 없음
  - 원래 AI 생성 대본에는 location/cameraAngle이 있었으나, Split에서 새로 Scene을 만들면서 사라짐
- `narrationClips`의 id와 `scenes`의 id가 동일(`scene-1`) -> 나중에 혼동될 수 있음

---

### Step 5: StoryboardPage -- CastSetup (연출 / 카드 선택)

**사용자 액션:**
1. StoryboardPage로 이동 (narration 모드, narrationStep=4)
2. AI 분석 모달 표시
3. 카드 선택 (시네마틱 모드와 동일)
4. "다음" 버튼 -> 바로 seed-check(이미지 생성)로 이동 (CutSplit 스킵)

**시스템 이벤트:**
- `onNextPhase`:
  ```javascript
  setPhase('seed-check');
  setNarrationStep(5);
  ```
  -> CutSplit 단계를 건너뜀 (나레이션 모드에서는 Split이 이미 TimelinePage에서 완료됨)

**사용되는 프롬프트:** 없음

**[문제점 발견]**
- 나레이션 모드에서도 AI 분석이 프리셋의 recommendedCast를 사용하지 않음 (Part A와 동일 문제)
- 해골 쇼츠의 경우 캐릭터1+배경1인데, 기본 AI 분석은 캐릭터3+배경1+아이템1 추천 -> 과다

---

### Step 6: StoryboardPage -- SeedCheck (이미지 생성)

**사용자 액션:**
1. 씬별 시드 카드 토글
2. "일괄 이미지 생성" 클릭
3. 모든 이미지 완료 후 "다음: 영상화" 클릭

**시스템 이벤트 (나레이션 모드):**
- nextLabel="다음: 영상화" 전달됨
- 이미지 완료 후 "다음: 영상화" 클릭 -> `handleGoToVideo()`:
  - `syncScenesImageToClips()`: scenes의 imageUrl을 narrationClips에 복사
  - `setNarrationStep(6)`
  - `navigate('/project/timeline')`

**사용되는 프롬프트 (해외감동사연):**
```
"photorealistic, emotional, warm tones, real life story, documentary style, heartwarming,.
{씬 대본 텍스트}.
Characters: ...
Background: ..."

negativePrompt: "blurry, low quality, distorted, deformed, ugly, watermark, text, logo, anime, cartoon, dark, horror"
```

**사용되는 프롬프트 (무협지):**
```
"wuxia, martial arts, ancient chinese fantasy, dramatic pose, flowing robes, mountain scenery, ink wash painting style,.
{씬 대본 텍스트}.
Characters: ...
Background: ..."
```

**사용되는 프롬프트 (해골 쇼츠):**
```
"skeleton character, dark humor, spooky cute, vertical composition, 9:16, eerie lighting, fun horror,.
{씬 대본 텍스트}.
Characters: ...
Background: ..."
```

**[문제점 발견]**
- 해골 쇼츠의 aspectRatio가 '9:16' -> `aspectRatioToSize('9:16')` = { width: 768, height: 1344 }
  - Gemini Image API에는 width/height가 전달되지 않음 (prompt만 전달) -> 실제로 9:16 비율이 적용되지 않을 수 있음
  - 프롬프트에 "vertical composition, 9:16"이 포함되어 있어 힌트는 주지만 보장되지 않음
- 나레이션 모드에서는 영상 생성이 SeedCheckPhase에서 이루어지지 않음 (nextLabel이 있으면 영상 생성 UI가 표시되지 않음)
  - 이미지만 생성하고 영상화는 Step 6(NarrationVideoStep)에서 별도 처리 -> OK

---

### Step 7: TimelinePage -- NarrationVideoStep (영상화)

**사용자 액션:**
1. imageUrl이 있는 클립 목록 확인
2. 영상화할 클립을 체크박스로 선택
3. Ken Burns 효과 선택 (미체크 클립용)
4. 영상 AI 모델 선택
5. "선택된 씬 영상화" 클릭

**시스템 이벤트:**
- `handleGenerateVideos()`:
  - 체크된 클립을 순차 처리
  - `canAfford('video')` + `spend('video')` (각 10 크레딧)
  - `buildVideoPrompt()`: 프리셋 videoPrefix + 씬 대본 (seedCards는 빈 배열)
  - `generateVideo()`: imageUrl + prompt + duration + model
  - 성공: `narrationClips` 업데이트 (videoUrl, isVideoEnabled = true)

**사용되는 프롬프트 (해외감동사연):**
```
"documentary style, emotional narration, gentle camera movement, warm color grading,.
{씬 대본 텍스트}"
```

**[문제점 발견]**
- **seedCards가 항상 빈 배열**로 전달됨 -> 캐릭터/배경 description이 프롬프트에 포함되지 않음
  - SeedCheckPhase에서 매칭된 시드 카드 정보가 NarrationVideoStep으로 전달되지 않음
- 영상화된 클립의 videoUrl이 narrationClips에만 저장되고 scenes에는 저장되지 않음
- Ken Burns 효과 설정이 저장되지만 실제 렌더링에 사용되지 않음 (편집 뷰에서 Ken Burns 적용 로직 없음)
- 크레딧 부족 시 루프 중단 (break) -> 일부만 생성되고 중단됨

---

### Step 8: TimelinePage -- NarrationEditView (편집)

**사용자 액션:**
1. 좌측: 현재 씬 미리보기 (이미지/영상)
2. 우측: 씬 리스트 (클릭 시 오디오 점프)
3. 하단: 전체 재생/일시정지
4. requestAnimationFrame으로 현재 재생 위치 추적
5. "다음: 내보내기" (disabled)

**시스템 이벤트:**
- `findCurrentClip(currentTime, narrationClips)` -> audioStartTime/audioEndTime 기반으로 현재 클립 결정
- 클립 선택 시 `audioRef.currentTime = clip.audioStartTime`으로 점프

**[문제점 발견]**
- 오디오 URL이 Blob URL -> 새로고침 시 상실 (persist에 포함되지만 Blob URL은 세션 간 유효하지 않음)
- 편집 기능이 매우 제한적 -> 순서 변경, 삭제, 효과 변경 등 기본 편집 기능 없음
- "다음: 내보내기" 버튼이 disabled -> Export 미구현

---

### Step 9: Export (미구현)

narrationStep >= 8일 때 placeholder만 표시: "Step 8: 내보내기 (구현 예정)"

---

## Part C: 크로스커팅 이슈 (모든 프리셋 공통)

### C1. 상태 영속성 문제

| 상태 | persist 여부 | 문제 |
|------|-------------|------|
| `scenes` | O | 페이지 새로고침 시 유지됨 |
| `cardLibrary` | O | 프로젝트 간 유지됨 |
| `selectedDeck` | O | 프로젝트별 유지됨 |
| `narrationClips` | O | 유지됨 |
| `narrativeAudioUrl` | O | Blob URL이라 새로고침 시 무효 |
| `sentenceTimings` | O | 유지됨 |
| `sceneGenStatus` | X | useGeneration 내부 state, 새로고침 시 상실 |
| `videoGenStatus` | X | useGeneration 내부 state, 새로고침 시 상실 |
| `sceneSeeds` | X | useGeneration 내부 state, 새로고침 시 상실 |
| `clips` (TimelinePage) | X | useState, 새로고침 시 상실 |
| `videoUrl` (각 씬) | X | scenes.imageUrl은 persist되지만 videoUrl은 Scene 타입에 없음 |

**핵심 문제: 이미지 생성 상태와 비디오 URL이 persist되지 않음**
-> 페이지 새로고침 시 생성 결과가 사라지고 다시 생성해야 함

### C2. 프리셋-프롬프트 연결 매트릭스

각 프리셋의 프롬프트가 어디에서 사용되는지 추적:

| 프리셋 필드 | 사용 위치 | 시네마틱 | 나레이션 | 비고 |
|------------|-----------|---------|---------|------|
| `prompts.script` | ai-llm.ts `buildSystemPrompt()` | O | O | presetId가 있을 때만 |
| `prompts.imagePrefix` | prompt-builder.ts `buildImagePrompt()` | O | O | presetId가 있을 때만 |
| `prompts.videoPrefix` | prompt-builder.ts `buildVideoPrompt()` | O | O (NarrationVideoStep) | |
| `prompts.negativePrompt` | prompt-builder.ts `getNegativePrompt()` | O | O | Gemini에서는 무시됨 |
| `prompts.analysis` | 미사용 | X | X | 정의되어 있지만 어디서도 호출하지 않음 |
| `recommendedCast` | 미사용 | X | X | handleAiAnalysis에서 하드코딩 |
| `defaultModels` | 미사용 | X | X | aiModelPreferences는 DEFAULT_AI_MODELS에서 초기화 |
| `voice.voiceId` | NarrationVoiceStep, TimelinePage TTS | X | 값 없음 | 모든 프리셋에 voice 미정의 |
| `voice.speed` | 동일 | X | 값 없음 | |
| `sampleIdea` | 미사용 | X | X | 정의도 안 되어 있음 |

**핵심 발견: 프리셋 데이터의 상당 부분이 사용되지 않고 있음**

### C3. 프리셋별 카드 추천 수 (현재 vs 필요)

| 프리셋 | recommendedCast (정의) | 실제 AI 분석 결과 | 차이 |
|--------|----------------------|-----------------|------|
| 시네마틱 드라마 | 캐2+배2+아0 = 4 | 캐3+배1+아1 = 5 | 불일치 |
| 해외감동사연 | 캐2+배2+아0 = 4 | 캐3+배1+아1 = 5 | 불일치 |
| 무협지 | 캐3+배2+아1 = 6 | 캐3+배1+아1 = 5 | 불일치 |
| 무협지2 | 캐3+배2+아2 = 7 | 캐3+배1+아1 = 5 | 불일치 |
| 해골 쇼츠 | 캐1+배1+아0 = 2 | 캐3+배1+아1 = 5 | 심각 불일치 |

### C4. selectedStyle 대소문자 불일치

```
startNewProject() 기본값: selectedStyle: 'Cinematic' (대문자)
프리셋의 style 값:         style: 'cinematic' (소문자)
stylePromptPrefix 키:     'Cinematic' (대문자)
artStyles의 name:          'Cinematic' (대문자)
```

- 프리셋으로 시작 -> selectedStyle = 'cinematic' (소문자)
  -> stylePromptPrefix['cinematic'] = undefined
  -> `capitalize(ctx.style)` = 'Cinematic' -> stylePromptPrefix['Cinematic'] = OK (폴백이 동작)
- 하지만 프리셋의 imagePrefix가 있으면 이 폴백은 실행되지 않음 -> 현재는 문제 없음
- 단, artStyles 그리드에서 `selectedStyle === style.name` 비교가 실패할 수 있음
  -> 'cinematic' !== 'Cinematic' -> STYLE 탭에서 현재 선택된 스타일이 하이라이트되지 않음

### C5. 크레딧 소비 시뮬레이션

**시네마틱 10씬 풀 워크플로우:**
| 작업 | 단가 | 횟수 | 소계 |
|------|------|------|------|
| 대본 생성 | 2 | 1 | 2 |
| 이미지 생성 | 3 | 10 | 30 |
| 영상 생성 | 10 | 10 | 100 |
| TTS (씬별) | 2 | 10 | 20 |
| **합계** | | | **152** |

초기 크레딧: 100 -> **영상 생성 단계에서 크레딧 부족 발생**

**나레이션 10씬 풀 워크플로우:**
| 작업 | 단가 | 횟수 | 소계 |
|------|------|------|------|
| 대본 생성 | 2 | 1 | 2 |
| TTS (전체) | 2 | 1 | 2 |
| 이미지 생성 | 3 | 10 | 30 |
| 영상화 (선택) | 10 | 5 | 50 |
| **합계** | | | **84** |

초기 크레딧: 100 -> 가능하지만 여유 없음

**해골 쇼츠 (짧은 분량, 3씬 예상):**
| 작업 | 단가 | 횟수 | 소계 |
|------|------|------|------|
| 대본 생성 | 2 | 1 | 2 |
| TTS (전체) | 2 | 1 | 2 |
| 이미지 생성 | 3 | 3 | 9 |
| 영상화 (전부) | 10 | 3 | 30 |
| **합계** | | | **43** |

초기 크레딧: 100 -> 여유 있음

---

## Part D: 발견된 문제 우선순위 정리

### P0: 워크플로우 차단 (기능이 작동하지 않음)

| # | 문제 | 위치 | 영향 프리셋 |
|---|------|------|-----------|
| P0-1 | CastPage(/cast) 라우트 존재 여부 미확인 -- "Cast부터" 진입 시 404 가능 | HomePage | 전체 |
| P0-2 | 시네마틱 모드에서 초기 크레딧(100)으로 풀 워크플로우 불가능 (152 필요) | 전체 | 시네마틱 |
| P0-3 | narrativeAudioUrl이 Blob URL이라 새로고침 시 무효 | TimelinePage | 나레이션 전체 |
| P0-4 | Export 미구현 | TimelinePage | 전체 |

### P1: 데이터 불일치 (프리셋 설정이 무시됨)

| # | 문제 | 위치 | 영향 프리셋 |
|---|------|------|-----------|
| P1-1 | recommendedCast가 AI 분석에 사용되지 않음 -- 하드코딩(3,1,1) | StoryboardPage | 전체 |
| P1-2 | defaultModels가 무시됨 -- DEFAULT_AI_MODELS 하드코딩 사용 | projectStore | 전체 |
| P1-3 | voice.voiceId/speed가 모든 프리셋에서 미정의 | stylePresets | 나레이션 전체 |
| P1-4 | prompts.analysis가 정의되어 있지만 미사용 | StoryboardPage | 전체 |
| P1-5 | sampleIdea가 미정의/미사용 | IdeaPage | 전체 |
| P1-6 | Gemini Image API에 negativePrompt가 전달되지 않음 | ai-image.ts | 전체 |
| P1-7 | NarrationVideoStep에서 seedCards가 빈 배열 -- 캐스트 정보 누락 | NarrationVideoStep | 나레이션 전체 |

### P2: UX 문제 (사용자 혼란)

| # | 문제 | 위치 | 영향 프리셋 |
|---|------|------|-----------|
| P2-1 | 프리셋 선택 후 artStyle 변경 시 프리셋 프롬프트가 우선 -- 사용자 선택 무시 | IdeaPage STYLE | 전체 |
| P2-2 | selectedStyle 대소문자 불일치로 STYLE 탭에서 하이라이트 안 됨 | IdeaPage | 프리셋 진입 시 |
| P2-3 | 템플릿 선택이 제목만 전달하고 스타일/프롬프트 미연결 | HomePage | 전체 |
| P2-4 | 일괄 이미지 생성 중 실패한 건의 "재생성" UI 부재 | SeedCheckPhase | 전체 |
| P2-5 | videoCountPerScene 선택이 실제 영상 생성에 반영되지 않음 | CutSplitPhase | 시네마틱 |
| P2-6 | CutSplit의 편집/삭제 버튼에 핸들러 없음 | CutSplitPhase | 시네마틱 |
| P2-7 | 해골 쇼츠 기본 씬 수 10개가 과다 (30초 분량에) | IdeaPage | 해골 쇼츠 |
| P2-8 | 대본 직접 입력 시 checked: false, AI 생성 시 checked: true -- 비일관 | IdeaPage | 전체 |
| P2-9 | Split에서 새로 만든 씬은 location/cameraAngle이 빈 값 | NarrationSplitStep | 나레이션 전체 |

### P3: 상태 관리 결함 (데이터 유실)

| # | 문제 | 위치 | 영향 프리셋 |
|---|------|------|-----------|
| P3-1 | sceneGenStatus/videoGenStatus가 persist되지 않음 | useGeneration | 전체 |
| P3-2 | sceneSeeds가 persist되지 않음 | useGeneration | 전체 |
| P3-3 | TimelinePage clips가 로컬 state -- 편집 내용 새로고침 시 상실 | TimelinePage | 시네마틱 |
| P3-4 | 영상 URL이 Scene 타입에 없음 -- videoUrl 미저장 | projectStore | 시네마틱 |
| P3-5 | Ken Burns 효과 설정이 저장되지만 렌더링에 미반영 | NarrationVideoStep | 나레이션 |
| P3-6 | PresetInfoModal에서 onApply/onClose 시 selectedPreset을 null로 초기화 | IdeaPage | 프리셋 진입 시 |

### P4: 기술적 개선

| # | 문제 | 위치 |
|---|------|------|
| P4-1 | TTS 크레딧이 'script' 타입으로 차감됨 (tts 타입 미사용) | TimelinePage |
| P4-2 | 일괄 생성에서 Promise.all 대신 setTimeout 사용 -- 에러 핸들링 불완전 | useGeneration |
| P4-3 | Gemini Image에 width/height 미전달 -- 9:16 비율 보장 안 됨 | ai-image.ts |

---

## Part E: 프리셋별 이상적 E2E 여정 (TO-BE)

### E1. 시네마틱 드라마 -- 이상적 여정

```
1. [HomePage] "스타일부터" -> "시네마틱 드라마" 선택
   -> mode: cinematic, preset: cinematic-drama, aspect: 16:9
   -> 자동 설정: aiModels = preset.defaultModels { script: 'gpt-4o-mini', image: 'flux-schnell', ... }

2. [IdeaPage] PresetInfoModal 확인 -> "이 프리셋으로 시작"
   -> 프리셋 정보: "영화적 드라마. 자연광과 감성적 색감..."
   -> 추천 캐스트: 캐릭터 2명, 배경 2곳
   -> sampleIdea 표시: "두 사람의 만남과 이별을 그린 감성 드라마" (현재 미정의)

3. [IdeaPage - Script] 아이디어 입력 -> AI 대본 생성
   -> 프리셋 prompts.script: "당신은 드라마 영화 각본가입니다..."
   -> 결과: 10개 씬 (인물의 감정과 갈등 중심)

4. [IdeaPage - Style] 프리셋 확인 + 필요 시 artStyle 미세 조정
   -> 프리셋을 변경하면 관련 설정도 동시에 변경

5. [StoryboardPage - CastSetup] AI 분석 -> 대본 기반 캐스트 추천
   -> recommendedCast 기반: 캐릭터 2명 + 배경 2곳
   -> 대본 내용과 cardLibrary 매칭: "주인공 남자" -> cardLibrary에서 유사 카드 탐색
   -> 부족분: AI가 새 카드 제안 (description 자동 생성)

6. [StoryboardPage - CutSplit] 10개 컷 확인 + 영상 개수 선택
   -> location/cameraAngle이 AI 생성 결과로 채워져 있음

7. [StoryboardPage - SeedCheck] 이미지 일괄 생성
   -> preset.prompts.imagePrefix: "cinematic photography, dramatic, natural lighting..."
   -> negativePrompt 적용
   -> 실패 시 "실패한 3개 재생성" 버튼 표시

8. [StoryboardPage - SeedCheck] 영상 일괄 생성
   -> preset.prompts.videoPrefix: "cinematic, slow motion, handheld camera..."
   -> videoCountPerScene 반영

9. [TimelinePage] 클립 편집 + TTS 생성
   -> preset.voice 설정으로 보이스 자동 적용
   -> Export -> 최종 영상 다운로드
```

### E2. 해골 쇼츠 -- 이상적 여정

```
1. [HomePage] "스타일부터" -> "해골 쇼츠" 선택
   -> mode: narration, aspect: 9:16
   -> 기본 씬 수: 3 (30초 분량에 맞게)

2. [IdeaPage - Script] 아이디어 입력 -> AI 대본 생성
   -> "해골 캐릭터가 나레이션하는 짧은 공포/코미디"
   -> 결과: 3개 씬 (30초~1분)

3. [TimelinePage - Voice] TTS 생성
   -> preset.voice.voiceId: 해골 캐릭터 전용 음성 (낮고 유머러스)
   -> 짧은 대본 -> 빠르게 완료

4. [TimelinePage - Split] 자동 분할
   -> 3초 기준 -> 약 5~8개 짧은 씬

5. [StoryboardPage - CastSetup] 카드 선택
   -> recommendedCast: 캐릭터 1(해골) + 배경 1

6. [StoryboardPage - SeedCheck] 이미지 생성
   -> "skeleton character, dark humor, spooky cute, vertical composition, 9:16"
   -> 9:16 비율 강제 적용

7. [TimelinePage - Video] 영상화
   -> 짧은 클립 (3초씩) -> 비용 효율적

8. [TimelinePage - Edit] 편집 -> Export
   -> 세로 영상(9:16) YouTube Shorts용
```

---

## Part F: 리팩토링 액션 아이템 제안

CEO 피드백에 맞춰 "추가 기능 없이, 기존 기능을 완벽하게" 하기 위한 우선순위:

### Round 1: 데이터 정합성 (코드 변경 최소, 효과 최대)

1. **프리셋 recommendedCast를 AI 분석에 연결** (StoryboardPage handleAiAnalysis)
   - 영향: 5개 프리셋 모두 올바른 캐스트 추천
   - 난이도: 낮음 (하드코딩 -> preset 참조로 변경)

2. **프리셋 defaultModels를 aiModelPreferences 초기값에 연결** (projectStore startNewProject)
   - 영향: 프리셋별 기본 AI 모델 자동 세팅
   - 난이도: 낮음

3. **selectedStyle 대소문자 정규화** (모든 곳에서 소문자 또는 대문자로 통일)
   - 영향: STYLE 탭 하이라이트, 프롬프트 매칭
   - 난이도: 낮음

4. **TTS 크레딧을 'tts' 타입으로 변경** (TimelinePage handleGenerateTTS)
   - 영향: 정확한 크레딧 차감
   - 난이도: 낮음

### Round 2: 상태 안정화

5. **Scene 타입에 videoUrl 필드 추가** + 영상 생성 시 store에 저장
6. **sceneGenStatus를 scenes.status에서 파생** (persist 불필요, 기존 status 활용)
7. **narrativeAudioUrl의 Blob URL 문제 해결** (Base64로 변환 후 저장, 또는 Supabase Storage)
8. **PresetInfoModal에서 selectedPreset null 초기화 제거** (프리셋이 전체 여정에서 유지되어야 함)

### Round 3: UX 연결 보강

9. **프리셋 + artStyle 충돌 해소** (프리셋 변경 시 경고, 또는 프리셋 내 artStyle 편집 허용)
10. **일괄 생성 실패 시 "실패한 N개 재생성" 버튼 추가**
11. **CutSplit 편집/삭제 핸들러 연결**
12. **NarrationVideoStep에 seedCards 전달**
13. **Gemini Image에 비율 파라미터 전달 방법 조사 및 적용**

---

*이 문서는 코드베이스 분석 기반으로 작성되었으며, 실제 브라우저 테스트 결과와 다를 수 있습니다.*
*CEO/CTO 검토 후 리팩토링 계획(plan.md) 수립으로 진행합니다.*
