# 기능 스펙시트 — AntiGravity 현재 구현 상태

> 작성자: 미소 (PM)
> 작성일: 2026-02-28
> 배경: CEO "전반적인 플로우가 어색하고 부족하다" 피드백 → 추가 개발 멈추고 현재 기능 완성도 집중

---

## Part 1: 페이지별 Store 상태 매핑

### 1-1. HomePage (`src/pages/HomePage.tsx`)

| 구분 | 상태/액션 | 상세 |
|------|-----------|------|
| **읽는 상태** | `cardLibrary` | My Cast 미리보기 (최대 4장) |
| **쓰는 상태** | `startNewProject(title, mode)` | 새 프로젝트 초기화 (scenes, style, deck 모두 리셋) |
| | `setEntryPoint('script' or 'style')` | 진입점 기록 |
| | `setSelectedPreset(presetId or null)` | 선택된 프리셋 ID 저장 |
| | `setSelectedStyle(style)` | 스타일 이름 저장 |
| | `setAspectRatio(ratio)` | 화면 비율 저장 |
| | `addToCardLibrary(card)` | cardLibrary가 비어있으면 mockCardLibrary로 초기화 |
| | `setProjectId(id)` | 기존 프로젝트 열기 시 |
| | `setTitle(title)` | 기존 프로젝트 열기 시 |
| | `setScenes(scenes)` | 기존 프로젝트 열기 시 |
| | `setCurrentPhase(2)` | 기존 프로젝트 열기 시 |
| **호출하는 서비스** | `listProjects(userId)` | Supabase: 로그인 시 프로젝트 목록 |
| | `deleteProject(projectId)` | Supabase: 프로젝트 삭제 |
| | `loadProject(projectId)` | Supabase: 프로젝트 열기 |

**주의사항:**
- `handleCastStart()` 는 `/cast?mode=project` 로 이동할 뿐, store에 아무것도 기록하지 않음 (진입점 = 'cast' 미기록)
- `startNewProject` 호출 시 모든 필드 리셋. 단 `cardLibrary` 는 리셋 안 됨 (의도적)

---

### 1-2. IdeaPage (`src/pages/IdeaPage.tsx`)

| 구분 | 상태/액션 | 상세 |
|------|-----------|------|
| **읽는 상태** | `title` | 프로젝트 제목 표시 및 편집 |
| | `scenes` | 씬 목록 — 있으면 "Script Breakdown" 뷰 자동 표시 |
| | `aspectRatio` | 화면 비율 버튼 현재 선택 표시 |
| | `selectedStyle` | Style 탭에서 선택된 스타일 카드 하이라이트 |
| | `cardLibrary` | Cast 초기화 여부 확인용 |
| | `hasActiveProject` | false이면 `startNewProject` 자동 호출 |
| | `selectedPreset` | 스타일부터 진입 시 PresetInfoModal 표시 트리거 |
| | `aiModelPreferences.script` | 대본 AI 모델 선택 UI |
| | `mode` | 시네마틱 vs 나레이션 분기 (다음 버튼 레이블, 이동 경로) |
| **쓰는 상태** | `setTitle(title)` | 타이틀 편집 |
| | `setScenes(scenes)` | 대본 분할 결과 저장 |
| | `toggleSceneCheck(id)` | 씬 포함 여부 체크 |
| | `setAspectRatio(ratio)` | 화면 비율 변경 |
| | `setSelectedStyle(name)` | Style 탭에서 스타일 클릭 |
| | `setSelectedPreset(id or null)` | 프리셋 칩 선택, 또는 모달 닫을 때 null |
| | `addToCardLibrary(card)` | Cast 초기화 (cardLibrary 비어있을 때) |
| | `setAiModelPreference('script', id)` | AI 모델 드롭다운 변경 |
| | `setNarrationStep(2)` | 나레이션 모드에서 다음 버튼 클릭 시 |
| | `startNewProject(title)` | `hasActiveProject` false일 때 자동 호출 |
| **호출하는 서비스** | `generateScript(req)` | `ai-llm.ts` — 아이디어 입력 → AI 대본 생성 |
| **사용하는 훅** | `useCredits()` | `canAfford`, `spend`, `remaining`, `CREDIT_COSTS` |

**주의사항:**
- 대본 직접 입력(inputMode='script') 시에는 크레딧 차감 없음 — `splitScriptIntoScenes` 는 로컬 처리
- 아이디어 입력(inputMode='idea') 시에만 `generateScript` 호출 + 크레딧 차감
- `selectedPreset` 을 null로 초기화하는 타이밍이 3곳 (onApply, onCustomize, onClose) — 실질적으로 동일

---

### 1-3. StoryboardPage (`src/pages/StoryboardPage.tsx`)

| 구분 | 상태/액션 | 상세 |
|------|-----------|------|
| **읽는 상태** | `selectedStyle` | 이미지/영상 프롬프트 빌드에 사용 |
| | `scenes` (storeScenes) | 씬 목록. 없으면 `mockStoryboardScenes` 폴백 |
| | `cardLibrary` | 덱 풀 데이터 소스 |
| | `aiModelPreferences.image` | 이미지 모델 선택 UI + 생성 요청 |
| | `aiModelPreferences.video` | 영상 모델 선택 UI + 생성 요청 |
| | `mode` | 'cinematic' vs 'narration' 렌더링 분기 |
| | `narrationStep` | 나레이션 모드 현재 단계 |
| | `narrationClips` | 나레이션 클립 목록 |
| | `selectedPreset` | 이미지/영상 프롬프트 빌드에 사용 |
| | `aspectRatio` | 이미지 생성 크기 계산에 사용 |
| **쓰는 상태** | `addToCardLibrary(card)` | AI 분석 결과 카드를 라이브러리에 추가 |
| | `setAiModelPreference('image', id)` | 이미지 모델 변경 |
| | `setAiModelPreference('video', id)` | 영상 모델 변경 |
| | `setNarrationStep(step)` | 나레이션 모드 단계 전환 |
| | `setNarrationClips(clips)` | 이미지 생성 완료 후 클립에 이미지 동기화 |
| | `updateSceneImage(sceneId, url)` | (useGeneration 훅 내부) 이미지 생성 완료 시 |
| | `setSelectedDeck(ids)` | (useDeck 훅 내부) 덱 변경 시 자동 동기화 |
| **호출하는 서비스** | `generateImage(req)` | `ai-image.ts` — 씬 이미지 생성 |
| | `generateVideo(req)` | `ai-video.ts` — 씬 영상 생성 |
| | `buildImagePrompt(ctx)` | `prompt-builder.ts` |
| | `buildVideoPrompt(ctx)` | `prompt-builder.ts` |
| | `getNegativePrompt(presetId)` | `prompt-builder.ts` |
| **사용하는 훅** | `useCredits()` | `canAfford`, `spend`, `remaining`, `CREDIT_COSTS` |
| | `useDeck()` | 덱 상태 전체 |
| | `useGeneration()` | 이미지/영상 생성 상태 전체 |

**주의사항:**
- 헤더 제목이 store의 `title` 이 아닌 하드코딩 "강철의 북진" 사용 — 버그
- 씬이 없으면 `mockStoryboardScenes` 폴백 사용 — 실제 유저는 IdeaPage에서 올 것이므로 문제 없으나, 명시적 가드 없음

---

### 1-4. TimelinePage (`src/pages/TimelinePage.tsx`)

| 구분 | 상태/액션 | 상세 |
|------|-----------|------|
| **읽는 상태** | `title` | 헤더에 프로젝트 제목 표시 |
| | `scenes` (storeScenes) | 클립 초기화 데이터 소스. 없으면 `mockStoryboardScenes` 폴백 |
| | `aiModelPreferences.tts` | TTS 모델 선택 UI + 생성 요청 |
| | `mode` | 'cinematic' vs 'narration' 분기 |
| | `sentenceTimings` | 나레이션 모드: 문장별 타이밍 목록 |
| | `narrativeAudioUrl` | 나레이션 TTS 완료 여부 확인 |
| | `narrationStep` | 나레이션 모드 현재 단계 분기 |
| | `selectedPreset` | TTS 목소리(voiceId, speed) 설정에 사용 |
| **쓰는 상태** | `setAiModelPreference('tts', id)` | TTS 모델 변경 |
| | `setNarrativeAudioUrl(url)` | 나레이션 TTS 완료 시 |
| | `setSentenceTimings(timings)` | 나레이션 TTS 완료 후 타이밍 계산 |
| | `setScenes(autoScenes)` | 씬 자동 분할 후 store 업데이트 |
| | `setNarrationStep(step)` | 나레이션 단계 이동 |
| **호출하는 서비스** | `generateTTS(req)` | `ai-tts.ts` — 개별 클립 TTS, 전체 일괄 TTS, 나레이션 TTS |
| **사용하는 훅** | `useCredits()` | `canAfford`, `spend`, `remaining` |

**주의사항:**
- 클립(TimelineClip)은 `useState` 로 로컬 관리 — store에 저장되지 않음
- 클립 편집(자르기/이어붙이기/삭제)은 페이지 새로고침 시 초기화됨
- 이미지가 생성된 씬의 imageUrl이 TimelinePage의 클립 썸네일에 반영되지 않는 경우 발생 가능 (클립은 초기 sourceScenes 기준으로 생성됨)

---

## Part 2: 단계 간 데이터 전달 매트릭스

### 2-1. HomePage → IdeaPage

| 항목 | 이상적 | 실제 (코드 기준) | 누락/불일치 |
|------|--------|-----------------|------------|
| 프로젝트 제목 | 템플릿/프리셋 이름 | `startNewProject(title, mode)` 로 store에 저장 | 정상 |
| 제작 모드 | 시네마틱 or 나레이션 | `startNewProject(title, mode)` 로 store에 저장 | 정상 |
| 진입점 | 'script', 'style', 'cast' 중 하나 | 대본/스타일 진입 시 `setEntryPoint` 저장. Cast 진입 시 미저장 | **누락: Cast 진입점 미기록** |
| 선택한 프리셋 | 프리셋 객체 전체 | `setSelectedPreset(id)` — ID만 저장, 나머지는 getPresetById로 조회 | 정상 (의도된 구조) |
| 스타일 | 스타일 이름 | `setSelectedStyle(preset.style)` | 정상 |
| 화면 비율 | 16:9, 9:16, 1:1 | `setAspectRatio(preset.aspectRatio)` | 정상 |
| 기존 씬 데이터 | - | 기존 프로젝트 열기 시만 전달 | 정상 |

**문제:**
- "대본부터" + 템플릿 선택 시, 템플릿 제목만 전달되고 템플릿의 내용(장르, 아이디어, 스타일)은 전달 안 됨
- IdeaPage 진입 시 PresetInfoModal은 `selectedPreset` 이 있을 때만 표시 → "대본부터" 진입 시 프리셋 모달 없음 (정상 동작이지만, 스타일 연동이 약함)

---

### 2-2. IdeaPage → StoryboardPage

| 항목 | 이상적 | 실제 (코드 기준) | 누락/불일치 |
|------|--------|-----------------|------------|
| 씬 목록 | `id, text, location, cameraAngle` 가 채워진 배열 | store.scenes — 아이디어 생성 시 4필드 있음, 대본 직접 입력 시 `location`, `cameraAngle` 빈 문자열 | **부분 누락: 직접 입력 시 location, cameraAngle 없음** |
| 선택한 스타일 | selectedStyle | store.selectedStyle | 정상 |
| 선택한 프리셋 | selectedPreset ID | store.selectedPreset | 정상 |
| 화면 비율 | aspectRatio | store.aspectRatio | 정상 |
| AI 모델 선호도 | aiModelPreferences | store.aiModelPreferences | 정상 |
| 씬별 checked 상태 | 포함할 씬만 전달 | store.scenes 내 `checked` 필드 존재. StoryboardPage에서 checked 필드 필터링 없음 | **누락: checked=false 씬도 StoryboardPage에서 그대로 표시됨** |
| Cast 덱 | 선택한 캐릭터/배경/아이템 | store.selectedDeck (ID 배열). StoryboardPage에서 useDeck 훅으로 복원 | 정상 |

**문제:**
- `scenes[].checked` 가 false인 씬을 제외하는 로직이 StoryboardPage에 없음 — IdeaPage에서 씬 체크를 해제해도 Storyboard에 다 나옴
- 대본 직접 입력 시 `location`, `cameraAngle` 이 빈 문자열 → 프롬프트 빌더에서 해당 정보 미반영 → 이미지 품질 저하 가능

---

### 2-3. StoryboardPage → TimelinePage

| 항목 | 이상적 | 실제 (코드 기준) | 누락/불일치 |
|------|--------|-----------------|------------|
| 씬별 이미지 URL | 생성된 이미지 URL | `updateSceneImage` 로 store.scenes[].imageUrl 업데이트 → TimelinePage 초기화 시 사용 | 정상 |
| 씬별 영상 URL | 생성된 영상 URL | store에 저장 로직 없음. useGeneration 훅이 videoGenStatus만 관리 | **누락: 영상 URL이 store에 저장되지 않음** |
| 씬 텍스트 | 대본 텍스트 | store.scenes[].text → TimelinePage 클립.text 로 복사 | 정상 |
| 덱/캐스트 정보 | TimelinePage에서 참조 | TimelinePage는 덱 정보를 전혀 읽지 않음 | 해당 없음 (타임라인에서 캐스트 불필요) |
| 선택한 프리셋 | TTS 목소리 설정에 사용 | store.selectedPreset → getPresetById로 voiceId, speed 조회 | 정상 |
| 나레이션 클립 | 이미지 동기화된 클립 | `syncScenesImageToClips` 후 `setNarrationClips` | 정상 |

**문제:**
- 영상 생성 결과(videoUrl)가 store에 저장되지 않음 — StoryboardPage 새로고침 또는 TimelinePage 이동 시 생성한 영상 URL 분실
- TimelinePage의 클립은 `useState` 로 초기화 → 클립 편집 내용이 store에 저장되지 않음 → 뒤로 갔다 오면 편집 내용 초기화

---

## Part 3: 프리셋 프롬프트 적용 매트릭스

### 전제 조건
- 프리셋 선택 여부에 따라 `presetId` 가 `ai-llm.ts`, `ai-image.ts`, `prompt-builder.ts`, `ai-tts.ts` 에 전달됨
- 프리셋 미선택 시: `stylePromptPrefix[selectedStyle]` 폴백 사용

### 3-1. 대본 생성 (ai-llm.ts, buildSystemPrompt)

| 프리셋 | 대본 AI 지시 (`prompts.script`) | 실제 적용 여부 |
|--------|--------------------------------|---------------|
| 시네마틱 드라마 | "당신은 드라마 영화 각본가입니다. 인물의 감정과 갈등에 집중한 씬을 작성하세요." | 적용됨 — presetId 전달 시 `buildSystemPrompt` 에서 roleInstruction 교체 |
| 해외감동사연 | "당신은 감동 실화 나레이터입니다. 시청자의 감정을 자극하는 따뜻한 이야기를 작성하세요. 나레이션 형식으로 작성하세요." | 적용됨 |
| 무협지 | "당신은 무협 소설가입니다. 강호의 전설을 나레이션 형식으로 풀어가세요." | 적용됨 |
| 무협지2 | "당신은 무협 영화 감독입니다. 화려한 액션과 드라마틱한 장면을 씬별로 작성하세요." | 적용됨 |
| 해골 쇼츠 | "당신은 해골 캐릭터입니다. 무섭지만 웃긴 톤으로 짧은 이야기를 나레이션하세요." | 적용됨 |

**주의:** 대본 AI 지시는 아이디어 입력(inputMode='idea')에서만 적용. 대본 직접 입력(inputMode='script')에서는 LLM 미호출 → 프리셋 script 지시 완전히 무시됨

---

### 3-2. 이미지 생성 시 (`prompt-builder.ts`, `buildImagePrompt`)

| 프리셋 | `imagePrefix` | 실제 적용 여부 |
|--------|---------------|---------------|
| 시네마틱 드라마 | `cinematic photography, dramatic, natural lighting, film grain, emotional, award-winning,` | 적용됨 — presetId 있으면 이 prefix 사용 |
| 해외감동사연 | `photorealistic, emotional, warm tones, real life story, documentary style, heartwarming,` | 적용됨 |
| 무협지 | `wuxia, martial arts, ancient chinese fantasy, dramatic pose, flowing robes, mountain scenery, ink wash painting style,` | 적용됨 |
| 무협지2 | `wuxia cinematic, martial arts action, dynamic composition, dramatic lighting, epic battle, flying swords,` | 적용됨 |
| 해골 쇼츠 | `skeleton character, dark humor, spooky cute, vertical composition, 9:16, eerie lighting, fun horror,` | 적용됨 |
| (프리셋 없음) | `stylePromptPrefix[selectedStyle]` (mockData) | 폴백 적용 |

**주의:** `presetId` 가 store에서 `null` 로 초기화되는 타이밍 — IdeaPage에서 PresetInfoModal 닫을 때 `setSelectedPreset(null)` 호출. 이 경우 StoryboardPage에서 presetId = null → 폴백 동작

---

### 3-3. 영상 생성 시 (`prompt-builder.ts`, `buildVideoPrompt`)

| 프리셋 | `videoPrefix` | 실제 적용 여부 |
|--------|---------------|---------------|
| 시네마틱 드라마 | `cinematic, slow motion, handheld camera, emotional score, golden hour,` | 적용됨 |
| 해외감동사연 | `documentary style, emotional narration, gentle camera movement, warm color grading,` | 적용됨 |
| 무협지 | `wuxia action, slow motion martial arts, flowing movements, epic landscapes,` | 적용됨 |
| 무협지2 | `cinematic wuxia, wire-fu action, sweeping camera, dramatic score, slow motion combat,` | 적용됨 |
| 해골 쇼츠 | `vertical video, skeleton animation, dark comedy, spooky atmosphere, jump scare elements,` | 적용됨 |
| (프리셋 없음) | `stylePromptPrefix[selectedStyle]` (이미지용 prefix와 동일) | 폴백 — 이미지/영상 prefix 미구분 문제 |

---

### 3-4. TTS 생성 시 (`ai-tts.ts`)

| 프리셋 | `voice.voiceId` | `voice.speed` | 실제 적용 여부 |
|--------|----------------|---------------|---------------|
| 시네마틱 드라마 | 없음 (undefined) | 없음 | 미적용 — Fish Speech 기본 목소리 사용 |
| 해외감동사연 | 없음 | 없음 | 미적용 |
| 무협지 | 없음 | 없음 | 미적용 |
| 무협지2 | 없음 | 없음 | 미적용 |
| 해골 쇼츠 | 없음 | 없음 | 미적용 |

**문제:** 5개 프리셋 모두 `voice` 필드 미정의 → TTS 생성 시 프리셋 목소리 설정이 완전히 미적용. voiceId/speed가 없으면 Fish Speech 기본값 사용. 프리셋별 차별화된 목소리 연출 불가능.

---

## Part 4: 크레딧 소비 매트릭스

### 4-1. 기본 비용 표 (`src/data/creditCosts.ts`)

| 액션 | 플랫폼 이용료 | AI API 비용 | 일반 사용자 총합 | BYOK 사용자 총합 |
|------|-------------|------------|----------------|----------------|
| 대본 생성 (AI) | 1 | 1 | **2** | 1 |
| 이미지 생성 | 1 | 2 | **3** | 1 |
| 영상 생성 | 2 | 8 | **10** | 2 |
| TTS 생성 | 1 | 1 | **2** | 1 |
| 카드 이미지 생성 | 1 | 2 | **3** | 1 |

### 4-2. 크레딧 체크 코드 위치

| 액션 | 크레딧 체크 코드 위치 | 차감 시점 |
|------|---------------------|-----------|
| AI 대본 생성 | `IdeaPage.tsx` L131~135 (`canAfford('script')`, `spend('script')`) | API 호출 직전 |
| 씬 이미지 생성 (개별) | `useGeneration.ts` L77~85 (`canAfford('image')`, `spend('image')`) | API 호출 직전 |
| 씬 이미지 생성 (전체) | `useGeneration.ts` L127~133 (`canAfford('image', count)`) | 전체 가능 여부 확인 후 개별 호출 위임 |
| 씬 영상 생성 (개별) | `useGeneration.ts` L141~148 (`canAfford('video')`, `spend('video')`) | API 호출 직전 |
| 씬 영상 생성 (전체) | `useGeneration.ts` L181~188 (`canAfford('video', count)`) | 전체 가능 여부 확인 후 개별 호출 위임 |
| 덱 카드 이미지 생성 | `useDeck.ts` L106~111 (`canAfford('image')`, `spend('image')`) | API 호출 직전 |
| TTS 개별 생성 | `TimelinePage.tsx` L288~290 (`canAfford('script', 1)`) | API 호출 직전. spend는 성공 후 L305 |
| TTS 전체 일괄 생성 | `TimelinePage.tsx` L325~328 (credits 잔여 직접 비교) | 전체 가능 여부 먼저 확인 |
| 나레이션 TTS 생성 | `TimelinePage.tsx` — 크레딧 체크 없음 | **미적용** |

**문제 발견:**
1. TTS 개별 생성: `canAfford('script', 1)` — TTS가 'script' 타입으로 체크됨. 의미상 맞지 않음 (`'tts'` 타입으로 체크해야 함)
2. TTS 전체 일괄 생성: `CREDIT_COSTS.script` 로 비용 계산 — 동일한 타입 불일치 문제
3. 나레이션 전체 TTS (`handleNarrativeTTS`): 크레딧 체크 없음 — 크레딧 무한 사용 가능
4. BYOK 판단: `useSettingsStore.hasApiKeyForAction(type)` — `settingsStore`의 `ACTION_PROVIDER_MAP` 기준. 현재 `script: 'openai'`, `image: 'replicate'` 등으로 고정. Gemini 사용 시 BYOK 인정 안 됨

---

### 4-3. 크레딧 실패 시 UX

| 액션 | 실패 시 UX |
|------|-----------|
| AI 대본 생성 부족 | `alert()` — 내용: "크레딧이 부족합니다! (대본 생성 N 크레딧 필요, 잔여: M)" |
| 씬 이미지 생성 부족 | `CreditShortageModal` (StoryboardPage) 또는 `alert()` (useDeck 내부) |
| 씬 영상 생성 부족 | `CreditShortageModal` (StoryboardPage) |
| 덱 카드 이미지 생성 부족 | `alert()` |
| TTS 개별 부족 | `alert('크레딧이 부족합니다!')` |
| TTS 전체 일괄 부족 | `alert()` — 내용: "크레딧이 부족합니다! (필요: N, 보유: M)" |
| 나레이션 TTS | 크레딧 체크 없음 → 실패 없음 |

**일관성 문제:** alert() 와 CreditShortageModal 이 혼재. 일부는 스토리보드 전용 모달 사용, 일부는 브라우저 native alert 사용.

---

## Part 5: 에러 핸들링 매트릭스

### 5-1. 각 액션별 에러 처리 현황

| 액션 | API 실패 시 | 크레딧 부족 시 | 네트워크 에러 시 | 입력 없음 시 |
|------|------------|---------------|----------------|-------------|
| AI 대본 생성 | `alert('대본 생성에 실패했습니다. 다시 시도해주세요.')` | alert + return | (같은 catch 처리) | 버튼 disabled |
| 씬 이미지 생성 (개별) | console.error + sceneGenStatus 'idle' 복원 | CreditShortageModal / alert | (같은 catch 처리) | 해당 없음 |
| 씬 이미지 생성 (전체) | 각 씬 개별 처리 | CreditShortageModal / alert | 각 씬 개별 실패 | 해당 없음 |
| 씬 영상 생성 (개별) | console.error + videoGenStatus 'idle' 복원 | CreditShortageModal / alert | (같은 catch 처리) | 해당 없음 |
| 덱 카드 이미지 생성 | console.error + status 'pending' 복원 | alert | (같은 catch 처리) | 해당 없음 |
| TTS 개별 생성 | `alert('TTS 생성 실패: ...')` + ttsGenerating 복원 | alert + return | (같은 catch) | 해당 없음 |
| TTS 전체 일괄 | 해당 클립 건너뜀 (continue 동작), 다음 클립 계속 진행 | alert + return | (같은 catch) | 해당 없음 |
| 나레이션 TTS | `alert('TTS 생성 실패: ...')` | 없음 | (같은 catch) | alert('대본이 없습니다...') |
| 프로젝트 목록 로드 | `console.warn` (조용히 실패) | 해당 없음 | (같은 catch) | 해당 없음 |
| 프로젝트 열기 | `console.error` (조용히 실패) | 해당 없음 | (같은 catch) | 해당 없음 |
| 프로젝트 삭제 | `console.error` (조용히 실패) | 해당 없음 | (같은 catch) | 해당 없음 |

### 5-2. 에러 핸들링 주요 문제점

1. **일관성 없음:** 어떤 에러는 `alert()`, 어떤 에러는 `console.error`, 어떤 에러는 Modal. 유저 경험이 제각각
2. **이미지/영상 생성 실패 시 유저 피드백 없음:** `sceneGenStatus` 가 'idle'로 복원되지만, 실패 사유를 유저에게 알리는 UI 없음 (toast나 inline error 없음)
3. **프로젝트 CRUD 실패 조용히 처리:** `console.error` 만 출력, 유저에게 아무 알림 없음
4. **네트워크 에러와 API 에러 미구분:** 모든 예외를 하나의 catch 블록에서 처리 — 유저 입장에서 "왜 실패했는지" 알 수 없음
5. **생성 중 페이지 이동 시 처리 없음:** 이미지 생성 중 다른 페이지로 이동하면 promise 무시됨 (race condition 가능)

---

## 부록: 핵심 누락/불일치 요약

| 번호 | 분류 | 문제 | 심각도 |
|------|------|------|--------|
| 1 | 데이터 전달 | StoryboardPage 헤더가 store.title 대신 "강철의 북진" 하드코딩 | 중간 |
| 2 | 데이터 전달 | 씬 checked=false 필터링이 StoryboardPage에서 누락 | 높음 |
| 3 | 데이터 전달 | 영상 생성 URL이 store에 저장되지 않음 (새로고침 시 소실) | 높음 |
| 4 | 데이터 전달 | 클립 편집 결과(자르기/이어붙이기)가 store에 미저장 | 높음 |
| 5 | 데이터 전달 | 대본 직접 입력 시 location, cameraAngle 빈 값으로 전달 | 중간 |
| 6 | 데이터 전달 | Cast 진입점 (entryPoint='cast') 미기록 | 낮음 |
| 7 | 크레딧 | TTS 크레딧 타입이 'tts' 아닌 'script'로 잘못 체크됨 | 중간 |
| 8 | 크레딧 | 나레이션 TTS(handleNarrativeTTS) 크레딧 체크 없음 | 높음 |
| 9 | 크레딧 | BYOK 판단 로직이 Gemini API를 인식 못 함 | 중간 |
| 10 | 프리셋 | 모든 프리셋의 voice 설정(voiceId, speed)이 미정의 | 낮음 |
| 11 | 에러 처리 | 이미지/영상 생성 실패 시 유저 알림 UI 없음 | 높음 |
| 12 | 에러 처리 | 프로젝트 CRUD 실패 시 조용히 처리 | 중간 |
| 13 | 에러 처리 | alert(), console.error, Modal 혼재 — 일관성 없음 | 중간 |
| 14 | 프리셋 | PresetInfoModal 닫을 때 selectedPreset=null 초기화 → StoryboardPage에서 프리셋 프롬프트 미적용 가능성 | 높음 |
