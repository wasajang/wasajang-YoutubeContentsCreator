# Round 1 비즈니스 검증 리포트

> 작성: CPO 유나 (2026-02-28)
> 요청: CTO 일론 (CEO 지시 "리서치와 계획을 더 탄탄히 하라")
> 근거 문서: customer-journey.md (유나), spec-sheet.md (미소), plan-round1.md (일론)
> 참조 코드: StoryboardPage.tsx, IdeaPage.tsx, TimelinePage.tsx, HomePage.tsx, useGeneration.ts, useCredits.ts, prompt-builder.ts, stylePresets.ts, creditCosts.ts, NarrationVideoStep.tsx

---

## 1. 3개 문서 교차 검증

### 1-1. 두 문서 모두 동일하게 지적한 문제 (신뢰도 높음)

> 참고: ux-audit.md는 010-customer-journey 폴더에 존재하지 않음. customer-journey.md(유나)와 spec-sheet.md(미소) 2개 문서 기준으로 교차 검증.

| # | 문제 | customer-journey.md | spec-sheet.md | 확신도 |
|---|------|:---:|:---:|:---:|
| A1 | **selectedPreset이 null로 초기화** -- PresetInfoModal 닫을 때 `setSelectedPreset(null)` 호출, 이후 StoryboardPage에서 프리셋 프롬프트 미적용 | P3-6 | 부록 #14 | **매우 높음** -- 코드에서 직접 확인됨 (IdeaPage.tsx L220, 224, 228) |
| A2 | **TTS 크레딧이 'script' 타입으로 차감** -- `canAfford('script')`, `spend('script')` 사용 | P4-1 | 부록 #7 | **매우 높음** -- 코드에서 직접 확인됨 (TimelinePage.tsx L288, 305, 325, 346) |
| A3 | **나레이션 TTS 크레딧 체크 누락** -- handleNarrativeTTS에 canAfford/spend 없음 | (암시) | 부록 #8 | **매우 높음** -- 코드에서 직접 확인됨 (TimelinePage.tsx L88~127에 크레딧 코드 없음) |
| A4 | **recommendedCast가 AI 분석에 미사용** -- 하드코딩(3,1,1) | P1-1 | (Part 1-3 주의사항에서 암시) | **매우 높음** -- 코드에서 직접 확인됨 (StoryboardPage.tsx L82~84) |
| A5 | **영상 URL이 store에 미저장** -- useGeneration 내부 state만 관리 | P3-4 | 부록 #3 | **매우 높음** -- Scene 타입에 videoUrl 필드 없음 |
| A6 | **StoryboardPage 제목 하드코딩** -- "강철의 북진" | (Part A Step 4~7 전반) | 부록 #1 | **매우 높음** -- StoryboardPage.tsx L194, L269에서 확인 |
| A7 | **selectedStyle 대소문자 불일치** -- 프리셋은 'cinematic', artStyles는 'Cinematic' | C4 | (Part 3-2 주의사항에서 암시) | **높음** -- stylePresets.ts에서 5개 프리셋 모두 소문자 확인 |
| A8 | **NarrationVideoStep에서 seedCards 빈 배열** | P1-7 | (암시) | **매우 높음** -- NarrationVideoStep.tsx L105에서 `seedCards: []` 직접 확인 |
| A9 | **voice.voiceId/speed 모든 프리셋에서 미정의** | P1-3 | Part 3-4 전체 | **매우 높음** -- stylePresets.ts에서 5개 프리셋 모두 voice 필드 없음 |
| A10 | **scenes[].checked 필터링 누락** -- StoryboardPage에서 체크 해제 씬도 표시 | (Part A Step 5에서 암시) | 부록 #2 | **높음** -- StoryboardPage.tsx L42에서 storeScenes를 필터 없이 사용 |

### 1-2. 1개 문서에서만 지적한 문제 (추가 검증 필요)

| # | 문제 | 출처 | 코드 확인 결과 | 판단 |
|---|------|------|--------------|------|
| B1 | CastPage(/cast) 라우트 존재 여부 | customer-journey P0-1 | `/cast` 라우트는 존재함 (App.tsx에서 확인 필요하나 HomePage에서 Link to="/cast" 사용 중) | **검증 보류** -- 라우터 파일 확인 필요하지만, 현재 코드에 `/cast` 링크가 있으므로 404는 아닐 가능성 높음 |
| B2 | 시네마틱 10씬 풀 워크플로우 크레딧 부족 (152 필요, 초기 100) | customer-journey P0-2 | CREDIT_COST_TABLE 확인: script(2)+image(30)+video(100)+tts(20) = 152. 초기 크레딧 100 맞음 | **유효** -- 실제로 부족함. 단, MVP에서 풀 워크플로우를 실행하는 사용자가 얼마나 될지는 별개 문제 |
| B3 | narrativeAudioUrl Blob URL 새로고침 시 무효 | customer-journey P0-3 | persist에 포함되나 Blob URL은 세션 간 유효하지 않음 | **유효하지만 Round 1 범위 밖** -- Store 구조 변경 필요 |
| B4 | prompts.analysis 정의됨 but 미사용 | customer-journey P1-4 | stylePresets.ts에 analysis 필드 있으나 코드에서 호출하는 곳 없음 | **사실이지만 무해** -- 사용하지 않는 데이터 필드일 뿐, 기능 차단이 아님 |
| B5 | defaultModels가 aiModelPreferences 초기값에 미연결 | customer-journey P1-2 | projectStore.ts의 startNewProject에서 DEFAULT_AI_MODELS 하드코딩 사용 | **유효** -- plan-round1에 미포함. Round 2/3 후보 |
| B6 | Gemini Image에 negativePrompt 미전달 | customer-journey P1-6 | ai-image.ts의 geminiProvider에서 negativePrompt 무시 확인 | **유효하지만 Gemini API 한계** -- Gemini Image API가 negativePrompt를 지원하지 않으므로 코드 수정으로 해결 불가 |
| B7 | BYOK 판단 로직이 Gemini를 인식 못 함 | spec-sheet 부록 #9 | settingsStore의 ACTION_PROVIDER_MAP 확인 필요 | **검증 보류** -- settingsStore 코드 확인 필요 |
| B8 | 에러 처리 일관성 (alert/console/Modal 혼재) | spec-sheet 부록 #11, 13 | 코드 전체에서 확인됨 | **유효하지만 Round 1 범위 밖** -- UX 개선 사항으로 분류 |
| B9 | 대본 직접 입력 시 checked: false vs AI 생성 시 checked: true | customer-journey P2-8 | IdeaPage.tsx L59 (checked: false) vs L156 (checked: true) | **유효** -- A10 (checked 필터링 누락)과 연관. 필터링이 없으면 checked 값 자체가 무의미해짐 |

### 1-3. 문서 간 충돌하는 분석

| # | 항목 | customer-journey | spec-sheet | 판단 |
|---|------|-----------------|-----------|------|
| C1 | TTS 크레딧 비용 금액 | "우연히 같은 금액(2)" | "의미상 맞지 않음" | **충돌 아님** -- 두 문서 모두 금액이 동일함을 인정하면서 논리적 오류를 지적. CREDIT_COST_TABLE에서 tts: total=2, script: total=2 확인. 금액은 같지만 타입이 다른 것은 맞음 |
| C2 | 나레이션 TTS 크레딧 | customer-journey에서는 "크레딧이 부족합니다" alert 언급 | spec-sheet에서는 "크레딧 체크 없음" 명시 | **spec-sheet가 정확** -- TimelinePage.tsx L88~127의 handleNarrativeTTS에 canAfford/spend 코드가 실제로 없음. customer-journey의 "실패 시나리오" 섹션은 이상적 동작을 기술한 것으로 보임 |

**결론:** 두 문서 간 근본적인 충돌은 없습니다. C2는 customer-journey가 "있어야 할 동작"과 "실제 동작"을 혼동한 것으로, spec-sheet의 코드 레벨 분석이 정확합니다.

---

## 2. Round 1 수정 6건 RICE 분석

### RICE 점수 산출 기준

- **Reach**: 해당 문제에 부딪히는 사용자 비율 (0~100%)
- **Impact**: 개선 정도 (3=massive, 2=high, 1=medium, 0.5=low, 0.25=minimal)
- **Confidence**: 수정이 문제를 실제로 해결할 확신 (1.0=high, 0.8=medium, 0.5=low)
- **Effort**: 소요 시간 (person-hours)
- **RICE Score**: (Reach x Impact x Confidence) / Effort

### 2-1. 수정 #1: recommendedCast 연결

| 항목 | 값 | 근거 |
|------|---|------|
| Reach | 80% | "스타일부터" 진입 사용자 전원. "대본부터" 진입 시에도 STYLE 탭에서 프리셋 선택 가능 |
| Impact | 1 (medium) | 캐스트 추천 수가 잘못되어도 사용자가 수동으로 조정 가능. UX 불편이지 기능 차단은 아님 |
| Confidence | 1.0 | 코드 변경 지점이 명확 (StoryboardPage L82~101, L63~74). 프리셋 데이터 구조도 검증됨 |
| Effort | 0.5h | slice 인자 교체 + while 루프 조건 변경. 4곳 수정 |
| **RICE** | **160** | |

**비즈니스 판단:** 중요하지만 급하지 않음. 해골 쇼츠(캐릭터1+배경1)에서 5개 추천되는 건 혼란스럽지만, 사용자가 직접 해제할 수 있음. 무협지2(캐릭터3+배경2+아이템2=7)에서 5개만 추천되는 건 오히려 부족해서 품질 저하 가능.

---

### 2-2. 수정 #2: selectedPreset null 초기화 버그

| 항목 | 값 | 근거 |
|------|---|------|
| Reach | 80% | "스타일부터" 진입 사용자 전원. PresetInfoModal을 닫는 순간 프리셋이 사라짐 |
| Impact | 3 (massive) | **프리셋의 존재 이유를 무효화하는 치명적 버그**. 프리셋으로 시작해도 imagePrefix, videoPrefix, script 지시가 전부 미적용. 사용자가 "시네마틱 드라마"를 선택했는데 실제 프롬프트는 기본 폴백으로 동작 |
| Confidence | 1.0 | 코드에서 `setSelectedPreset(null)` 3곳이 명확히 확인됨. 삭제하면 즉시 해결 |
| Effort | 0.5h | null 초기화 3줄 삭제 + hasShownPresetModal 가드 추가 |
| **RICE** | **480** | |

**비즈니스 판단: 이것은 Round 1에서 가장 중요한 수정입니다.** 프리셋 시스템은 AntiGravity의 핵심 차별점인 "3진입점" 중 "스타일부터" 경로의 근간입니다. 이 버그가 있는 한, 프리셋은 단순히 프로젝트 제목과 모드를 설정하는 것 외에 아무런 역할을 하지 않습니다. 프리셋별로 정성스럽게 작성한 5개 프리셋의 prompts.script, imagePrefix, videoPrefix, negativePrompt가 모두 무용지물입니다.

---

### 2-3. 수정 #3: selectedStyle 대소문자 통일

| 항목 | 값 | 근거 |
|------|---|------|
| Reach | 80% | "스타일부터" 진입 사용자 전원 |
| Impact | 0.5 (low) | STYLE 탭에서 현재 선택 스타일이 하이라이트되지 않는 시각적 문제. 프롬프트는 capitalize() 폴백으로 동작함 |
| Confidence | 1.0 | stylePresets.ts에서 5개 프리셋의 style 값을 대문자로 변경하면 해결 |
| Effort | 0.25h | stylePresets.ts에서 5줄 변경 ('cinematic' -> 'Cinematic') |
| **RICE** | **160** | |

**비즈니스 판단:** 수정이 쉽고, 프리셋 선택 시 STYLE 탭 UX가 개선됨. 하지만 수정 #2가 해결되지 않으면 이 수정의 효과도 제한적 (프리셋 자체가 null이 되므로).

**추가 발견:** 코드를 확인한 결과, 프리셋의 `style` 값이 변경되면 HomePage.tsx L94의 `setSelectedStyle(preset.style)` 호출에서 대문자 값이 store에 설정됩니다. 이것은 의도된 수정 방향과 일치합니다. 단, IdeaPage STYLE 탭(L460)에서 `setSelectedStyle(preset.style)` 호출도 영향받으므로 통합 테스트 필요.

---

### 2-4. 수정 #4: TTS 크레딧 타입 변경 ('script' -> 'tts')

| 항목 | 값 | 근거 |
|------|---|------|
| Reach | 60% | 시네마틱 모드에서 TTS를 사용하는 사용자. 나레이션 모드는 별도 핸들러(#5에서 수정) |
| Impact | 0.25 (minimal) | 현재 script과 tts 비용이 동일(2 크레딧). 금액 차이 없음. 논리적 정확성만 개선 |
| Confidence | 1.0 | 코드 변경 지점 명확 |
| Effort | 0.25h | canAfford/spend 인자 4곳 변경 |
| **RICE** | **60** | |

**비즈니스 판단:** 금액이 같으므로 사용자에게 실질적 차이 없음. 하지만 나중에 TTS 비용을 별도로 조정할 때 (예: 고품질 TTS 도입 시 비용 인상) 올바른 타입으로 차감되어야 함. "지금은 영향 없지만 미래를 위해 필요한" 수정.

---

### 2-5. 수정 #5: 나레이션 TTS 크레딧 체크 추가

| 항목 | 값 | 근거 |
|------|---|------|
| Reach | 40% | 나레이션 모드 사용자만 해당 (해외감동사연, 무협지, 해골 쇼츠) |
| Impact | 2 (high) | **무한 크레딧 소비 가능**한 보안 취약점. 크레딧 시스템의 근본을 무너뜨림 |
| Confidence | 1.0 | canAfford + spend 추가만 하면 됨 |
| Effort | 0.25h | handleNarrativeTTS 상단에 4줄 추가 |
| **RICE** | **320** | |

**비즈니스 판단: 수익 모델 직결 문제.** 크레딧 시스템이 수익의 근간인데, 특정 경로에서 크레딧 없이 무한 사용 가능하다면 수익 모델 자체가 무의미. 수정 #2 다음으로 중요.

---

### 2-6. 수정 #6: StoryboardPage 제목 하드코딩

| 항목 | 값 | 근거 |
|------|---|------|
| Reach | 100% | 모든 사용자가 StoryboardPage를 방문 |
| Impact | 0.5 (low) | 프로젝트 제목이 "강철의 북진"으로 고정되는 UX 불편. 기능 차단은 아님 |
| Confidence | 1.0 | store.title 바인딩만 변경 |
| Effort | 0.25h | 2곳(나레이션/시네마틱) h2 태그 변경 |
| **RICE** | **200** | |

**비즈니스 판단:** 간단하지만 가시적인 개선. 모든 사용자에게 영향. 프로 의식을 보여주는 수정.

---

### RICE 우선순위 종합

| 순위 | 수정 # | 문제 | RICE | 비즈니스 긴급도 |
|:---:|:---:|------|:---:|:---:|
| 1 | **#2** | selectedPreset null 초기화 | **480** | 치명 -- 프리셋 시스템 무효화 |
| 2 | **#5** | 나레이션 TTS 크레딧 미체크 | **320** | 높음 -- 수익 모델 취약 |
| 3 | **#6** | 제목 하드코딩 | **200** | 중간 -- 전 사용자 UX |
| 4 | **#1** | recommendedCast 미연결 | **160** | 중간 -- 프리셋 정확성 |
| 5 | **#3** | 대소문자 불일치 | **160** | 낮음 -- 시각적 문제 |
| 6 | **#4** | TTS 크레딧 타입 오류 | **60** | 낮음 -- 현재 금액 동일 |

**RICE 결론:** 수정 #2와 #5는 비즈니스 임팩트가 압도적으로 높습니다. 이 두 가지만 수정해도 Round 1의 가치가 충분합니다.

---

## 3. Round 1 수정 효과를 무력화할 수 있는 숨겨진 경로

### 3-1. 수정 #2 (selectedPreset null 초기화 제거) -- 무력화 경로 분석

**질문:** setSelectedPreset(null)을 삭제해도, 다른 곳에서 null로 만드는 경로가 있는가?

| 경로 | 코드 위치 | selectedPreset을 null로 만드는가? | 영향도 |
|------|-----------|:---:|:---:|
| HomePage "대본부터" 진입 | HomePage.tsx L78: `setSelectedPreset(null)` | **YES** | **의도된 동작** -- 프리셋 없이 시작하므로 null이 맞음 |
| startNewProject() | projectStore.ts: `selectedPreset: null` | **YES** | **의도된 동작** -- 새 프로젝트 시작 시 리셋 |
| IdeaPage STYLE 탭 프리셋 칩 클릭 | IdeaPage.tsx L459: `setSelectedPreset(preset.id)` | 아니오 (ID 설정) | 안전 |
| IdeaPage STYLE 탭 artStyle 클릭 | IdeaPage.tsx L488: `setSelectedStyle(style.name)` | 아니오 (style만 변경, preset 유지) | **잠재적 문제** -- 프리셋은 유지되지만 스타일이 변경되면 프리셋 프롬프트와 artStyle이 충돌 (customer-journey P2-1) |
| 기존 프로젝트 열기 | HomePage.tsx L106~118: `handleOpenProject` | **잠재적 문제** -- `setSelectedPreset`이 호출되지 않음. 기존 프로젝트의 preset 정보가 복원되지 않음 | **중간** -- 기존 프로젝트 열기 시 프리셋이 사라짐 |

**결론:** Round 1 수정 #2는 PresetInfoModal 닫기 시의 null 초기화만 제거합니다. 이것으로 "스타일부터" 신규 프로젝트 경로는 해결됩니다. 하지만:

1. **기존 프로젝트 열기 시 프리셋 미복원** -- 이것은 Round 2/3에서 해결해야 할 별도 문제입니다 (프로젝트 DB에 preset_id를 저장해야 함).
2. **artStyle과 프리셋 충돌** -- 이것도 Round 3 UX 개선 범위입니다. Round 1 수정이 무력화되는 것은 아닙니다.

**무력화 위험: 낮음.** Round 1 수정의 핵심 경로(스타일부터 -> IdeaPage -> StoryboardPage)에서는 정상 동작합니다.

---

### 3-2. 수정 #1 (recommendedCast 연결) -- 무력화 경로 분석

**질문:** recommendedCast를 연결해도, AI 분석이 Mock이라서 실질적 효과가 없는 건 아닌가?

**분석:**
- 현재 AI 분석(handleAiAnalysis)은 **Mock 분석**입니다 (2500ms setTimeout 후 cardLibrary에서 순서대로 가져옴).
- recommendedCast를 연결하면 "몇 개를 가져올 것인가"는 정확해집니다.
- 하지만 "어떤 카드를 가져올 것인가"는 여전히 cardLibrary 순서대로입니다.
- 예: 해골 쇼츠에서 캐릭터1+배경1을 추천해도, 가져오는 카드는 cardLibrary의 첫 번째 캐릭터(군인)와 첫 번째 배경(전장)입니다 -- 해골과 무관.

**결론: 수는 정확해지지만 내용은 여전히 무관합니다.** 이것은 AI 분석 실 연동(004 작업)에서 해결될 문제이므로, Round 1에서 "수"만이라도 맞추는 것은 의미가 있습니다. 해골 쇼츠에서 5개 대신 2개만 추천하면 사용자가 수동으로 조정할 부담이 줄어듭니다.

**무력화 위험: 부분적.** "수"는 개선되지만 "내용"은 여전히 부정확. 그러나 이것은 이 수정의 범위를 넘는 문제.

---

### 3-3. 수정 #4, #5 (TTS 크레딧 수정) -- 무력화 경로 분석

**질문:** TTS 크레딧을 수정해도, 나레이션 TTS가 다른 경로로 우회하는 건 아닌가?

**분석:**
- **시네마틱 모드 TTS** (TimelinePage handleGenerateTTS, handleGenerateAllTTS):
  - 수정 #4 적용 대상. 'script' -> 'tts'로 변경.
  - 다른 TTS 호출 경로 없음. 안전.

- **나레이션 모드 TTS** (TimelinePage handleNarrativeTTS):
  - 수정 #5 적용 대상. 크레딧 체크 추가.
  - 그런데 이 외에 **NarrationVoiceStep** 컴포넌트가 별도로 존재합니다.

- **NarrationVoiceStep의 TTS 호출 경로:**
  - TimelinePage L394에서 `<NarrationVoiceStep onNext={...} onPrev={...} />` 렌더링
  - NarrationVoiceStep 내부에서 TTS를 호출하는가? -- 이 컴포넌트의 코드를 확인해야 합니다.

**확인 완료:** NarrationVoiceStep.tsx를 검증했습니다.

- NarrationVoiceStep은 **자체적으로 TTS를 호출**합니다 (L44~91, 자체 handleGenerateTTS 함수).
- **크레딧 체크가 이미 포함되어 있습니다** (L50~54: `canAfford('tts')` + `spend('tts')`).
- 즉, **NarrationVoiceStep의 TTS는 올바르게 'tts' 타입으로 크레딧을 차감**합니다.

그런데 여기서 **중요한 중복 경로 문제**가 발생합니다:

| 경로 | 파일 | 크레딧 체크 | 타입 |
|------|------|:---:|:---:|
| NarrationVoiceStep (Step 2) | NarrationVoiceStep.tsx L50~54 | **있음** | **'tts' (올바름)** |
| TimelinePage 나레이션 TTS (시네마틱 모드 하단 나레이션 섹션) | TimelinePage.tsx L88~127 | **없음** | N/A |

TimelinePage.tsx의 `handleNarrativeTTS`는 **시네마틱 모드 하단에 있는 "나레이션 TTS 생성" 섹션**(L484~561)에서 호출됩니다. 이것은 `mode === 'narration'` 조건부로 렌더링되지만, narrationStep 분기(L388~457) 이후에 시네마틱 모드의 렌더링 코드에 위치합니다. 즉, **나레이션 모드에서는 이 코드에 도달하지 않습니다** (L388에서 return됨).

따라서:
- 나레이션 모드 Step 2: NarrationVoiceStep 사용 -> **크레딧 체크 있음 (안전)**
- TimelinePage.tsx의 handleNarrativeTTS: 나레이션 모드에서 도달 불가 (L388에서 이미 return)
- 결론: **TimelinePage의 handleNarrativeTTS는 현재 실행 경로가 없는 데드 코드**입니다

**무력화 위험: 없음.** NarrationVoiceStep에 이미 크레딧 체크가 있고, TimelinePage의 중복 코드는 실행되지 않습니다.

**단, 수정 #5의 범위 재검토 필요:**
- TimelinePage.tsx의 handleNarrativeTTS는 데드 코드이므로, 크레딧 체크를 추가하는 것보다 **코드 자체를 정리하는 것**이 더 적절할 수 있습니다.
- 하지만 데드 코드라도 나중에 누군가 활성화할 수 있으므로, 크레딧 체크를 추가해두는 것이 방어적 프로그래밍 관점에서 좋습니다.
- **권장:** 수정 #5는 유지하되, 코드 리뷰 시 "이 코드는 현재 데드 코드이지만 방어적으로 크레딧 체크를 추가한다"는 주석을 남깁니다.

---

### 3-4. 추가 발견: Round 1에 포함되지 않았지만 효과를 약화시키는 문제

| # | 문제 | Round 1 수정과의 관계 | 심각도 | 권장 |
|---|------|---------------------|:---:|------|
| D1 | **scenes[].checked 필터링 누락** -- IdeaPage에서 체크 해제한 씬이 StoryboardPage에 그대로 표시 | 수정 #1과 직접 연관 -- recommendedCast 수를 맞춰도, 불필요한 씬이 포함되면 시드 매칭 대상이 늘어남 | 중간 | **Round 1에 추가 검토** |
| D2 | **defaultModels 미연결** -- 프리셋이 유지되어도 AI 모델은 기본값 사용 | 수정 #2의 효과를 약화 -- 프리셋이 recomm하는 모델(예: flux-schnell)이 아닌 기본 모델(gemini)이 사용됨 | 낮음 | Round 2 |
| D3 | **기존 프로젝트 열기 시 preset_id 미복원** | 수정 #2와 관련 -- 새 프로젝트는 OK이지만 기존 프로젝트는 프리셋 없이 열림 | 낮음 | Round 2 (DB 스키마 변경 필요) |
| D4 | **artStyle 변경 시 프리셋 imagePrefix와 충돌** | 수정 #2 적용 후 발생 가능 -- 프리셋이 유지되면서 artStyle도 변경 가능해지므로 충돌 빈도 증가 | 중간 | Round 3 (UX 설계 필요) |

**D1에 대한 상세 분석:**

StoryboardPage.tsx L42:
```typescript
const scenes = (storeScenes.length > 0 ? storeScenes : mockStoryboardScenes) as Scene[];
```

여기서 `storeScenes`를 필터 없이 사용합니다. IdeaPage에서 `checked: false`로 설정한 씬도 포함됩니다.

**RICE 산출:**
- Reach: 50% (체크 해제 기능을 실제로 사용하는 비율)
- Impact: 1 (medium) -- 불필요한 씬에 이미지/영상 크레딧 낭비
- Confidence: 1.0
- Effort: 0.25h (`.filter(s => s.checked !== false)` 한 줄 추가)
- RICE: **200**

**권장: Round 1에 추가.** 코드 변경이 매우 작고(1줄), 크레딧 낭비 방지에 직결됩니다.

---

## 4. Round 분류 재검토

### 현재 분류 (plan-round1.md 기준)

| Round | 분류 | 항목 |
|:---:|------|------|
| 1 | 데이터 정합성 | #1 recommendedCast, #2 selectedPreset, #3 대소문자, #4 TTS 타입, #5 나레이션 크레딧, #6 제목 |
| 2 | 상태 안정화 | videoUrl 추가, sceneGenStatus persist, Blob URL, PresetInfoModal null 제거 |
| 3 | UX 연결 | 프리셋+artStyle 충돌, 재생성 UI, CutSplit 핸들러, seedCards 전달, Gemini 비율 |

### 비즈니스 관점 재검토

**Round 2의 "PresetInfoModal null 제거"가 Round 1 수정 #2와 중복됩니다.**
plan-round1.md에 이미 수정 #2로 포함되어 있는데, Round 2 이월 목록에도 "PresetInfoModal에서 selectedPreset null 초기화 제거"가 있습니다. 이것은 제거해야 합니다.

### 재분류 제안

| Round | 테마 | 항목 | 비즈니스 근거 |
|:---:|------|------|-------------|
| **1** | **프리셋 + 크레딧 (핵심 수익 경로)** | #2 selectedPreset null (RICE 480), #5 나레이션 크레딧 (RICE 320), #6 제목 (RICE 200), D1 checked 필터링 (RICE 200), #1 recommendedCast (RICE 160), #3 대소문자 (RICE 160), #4 TTS 타입 (RICE 60) | 프리셋이 동작해야 프로덕트의 핵심 가치("프리셋으로 쉽게 시작")가 전달됨. 크레딧이 정확해야 수익 모델 유지 |
| **2** | **상태 영속성 (사용자 이탈 방지)** | videoUrl 추가, sceneGenStatus 파생, Blob URL 해결, defaultModels 연결, 기존 프로젝트 preset 복원 | 새로고침 시 데이터 유실은 사용자 이탈의 직접 원인. 하지만 MVP에서는 "새로고침하지 말라"는 가이드로 임시 우회 가능 |
| **3** | **UX 정밀화 (품질 제고)** | artStyle+프리셋 충돌 해소, 재생성 UI, CutSplit 핸들러, seedCards 전달, Gemini 비율, 에러 처리 통일 | 사용 경험의 질을 높이지만, 핵심 기능이 동작하지 않는 문제는 아님 |

### 변경 사항 요약

1. **Round 1에 D1(checked 필터링) 추가** -- 코드 1줄, RICE 200
2. **Round 2에서 "PresetInfoModal null 제거" 삭제** -- Round 1 #2와 중복
3. **Round 2에 defaultModels 연결, 기존 프로젝트 preset 복원 추가**
4. **Round 1의 순서를 RICE 기준으로 재정렬** -- #2 -> #5 -> #6 -> D1 -> #1 -> #3 -> #4

---

## 5. 최종 권고사항

### 5-1. Round 1 실행 권고

Round 1의 7건(기존 6건 + D1)을 **RICE 순서대로 실행**합니다:

1. **selectedPreset null 초기화 제거** (RICE 480) -- 이것 하나가 프로덕트 가치의 절반
2. **나레이션 TTS 크레딧 체크 추가** (RICE 320) -- 수익 모델 보호
3. **StoryboardPage 제목 동적 바인딩** (RICE 200) -- 전 사용자 가시적 개선
4. **scenes[].checked 필터링 추가** (RICE 200, 신규) -- 크레딧 낭비 방지
5. **recommendedCast 연결** (RICE 160) -- 프리셋 정확성
6. **selectedStyle 대소문자 통일** (RICE 160) -- 시각적 일관성
7. **TTS 크레딧 타입 변경** (RICE 60) -- 미래 대비

총 소요: 약 2~2.5 person-hours

### 5-2. 실행 전 검증 요청

1. **NarrationVoiceStep.tsx 내부 TTS 호출 경로** -- 크레딧 체크 누락 여부 확인
2. **App.tsx의 /cast 라우트 존재 여부** -- CastPage 404 가능성 확인

### 5-3. Round 1 이후 전략 방향

Round 1 완료 후, CEO에게 다음 판단을 요청해야 합니다:

- **Round 2 진행** vs **004 AI 실 연동 진행** -- 어느 것이 MVP 런칭에 더 가까운가?
  - Round 2(상태 영속성)는 "새로고침 시 데이터 유실" 해결 -- 사용성 개선
  - 004(AI 실 연동)는 "Mock에서 실제로" 전환 -- 프로덕트 가치 실현
  - **CPO 의견:** 004 AI 실 연동이 먼저. Mock 데이터로 완벽한 상태 관리를 해봐야 실제 가치가 없습니다. AI가 실제로 동작하는 것을 보여주는 것이 MVP의 핵심입니다. Round 2는 004 이후에 진행해도 됩니다.

---

*이 문서는 코드베이스 분석 기반으로 작성되었습니다. 최종 판단은 CEO에게 있습니다.*
