# AntiGravity 비전 vs 현재 구현 갭 분석

> 작성: CPO 유나 (Yuna) | 2026-03-01
> 분석 대상: VISION.md (2026-02-27) vs 코드베이스 (2026-03-01 기준)
> 분석 범위: 고객 진입 경험, 워크플로우 완성도, Cast 시스템, 크레딧/BYOK, 프리셋/템플릿 시스템

---

## 비전 부합도 종합 평가: 65/100

비전 문서에서 정의한 핵심 방향 대부분의 **데이터 구조와 아키텍처는 잘 설계되어 있으나**, 실제 UI에서 사용자가 체감하는 부분에서 미완성 또는 연결 누락이 다수 존재합니다.

---

## 1. 잘 구현된 부분

### 1.1 템플릿 데이터 구조 (비전 부합도: 95%)

`src/data/templates.ts`의 Template 인터페이스는 비전이 요구하는 거의 모든 것을 담고 있습니다.

- **promptRules 4계층 체계**: scriptSystemPrompt, sceneSplitRules, imagePromptRules, videoPromptRules 모두 정의됨
- **castPreset 상세 데이터**: characters/backgrounds/items에 이름, description, isRequired까지 포함
- **defaultModels**: 대본/이미지/영상/TTS 4개 카테고리 AI 모델 기본값 지정
- **UGC 확장 필드**: authorId, authorName, price, downloads, rating 이미 예약됨
- **관리 필드**: visibility (public/soon/hidden), isOfficial, version 관리
- **5개 공식 템플릿**: 각각 고유한 promptRules와 castPreset을 가지고 있음

**평가**: 비전의 "프리셋 확장성 -- 데이터만 추가하면 되도록" 원칙을 완벽히 충족합니다. 새 템플릿을 추가할 때 `templates` 배열에 객체 하나만 push하면 됩니다.

### 1.2 프롬프트 빌더 시스템 (비전 부합도: 85%)

`src/services/prompt-builder.ts`가 비전의 핵심 원칙을 잘 구현하고 있습니다.

- **우선순위 체계 구현됨**: 템플릿 promptRules > ArtStyle prefix > 기본값
- **buildImagePrompt**: [prefix] + [씬 대본] + [카메라앵글/로케이션] + [캐스트 카드 descriptions] + [suffix]
- **buildVideoPrompt**: 동일한 우선순위로 영상 프롬프트 조립
- **getNegativePrompt**: 템플릿 > ArtStyle > 기본값 순서
- **aspectRatioToSize**: 비율을 픽셀 크기로 변환

**평가**: 비전의 "옵션 영속성 -- 사용자 선택은 이후 프롬프트에 반영" 원칙이 프롬프트 빌더를 통해 기술적으로 구현되어 있습니다.

### 1.3 크레딧 2계층 구조 (비전 부합도: 90%)

- **CREDIT_COST_TABLE** (`src/data/creditCosts.ts`): platformFee + apiCost 분리, total과 totalByok 명확
- **useCredits 훅**: BYOK 여부를 settingsStore에서 확인하여 자동으로 비용 계산
- **settingsStore**: ApiProvider별 키 저장, hasApiKeyForAction으로 BYOK 판정
- **비전의 비용표와 일치**: script(2/1), image(3/1), video(10/2), tts(2/1), card(3/1)

**평가**: 비전의 "BYOK도 플랫폼 이용료는 차감" 원칙이 정확히 구현되어 있습니다.

### 1.4 듀얼 모드 워크플로우 (비전 부합도: 80%)

- **시네마틱 4스텝**: Idea -> Storyboard -> Generate -> Animate (WorkflowSteps 구현 완료)
- **나레이션 8스텝**: Script -> Voice -> Split -> Direct -> Image -> Video -> Edit -> Export (WorkflowSteps 구현 완료)
- **모드별 라우팅 분기**: StoryboardPage, TimelinePage 모두 mode에 따라 다른 UI 렌더링
- **store에 모든 나레이션 상태**: narrationStep, narrationClips, narrativeAudioUrl, sentenceTimings

### 1.5 다중 AI 프로바이더 패턴 (비전 부합도: 85%)

- **ai-image.ts**: mock / replicate / gemini 3개 프로바이더
- **ai-llm.ts**: mock / openai / anthropic / gemini 4개 프로바이더
- **환경변수 전환**: VITE_IMAGE_API_PROVIDER, VITE_LLM_API_PROVIDER
- **모델 ID 분기**: 특정 모델 하드코딩 없이 req.model로 동적 선택

---

## 2. 비전과의 갭

### 갭 요약 테이블

| # | 비전 항목 | 현재 상태 | 갭 설명 | 우선순위 |
|---|----------|----------|---------|---------|
| G1 | **3가지(혹은 4가지) 시작점** | 단일 CTA + 템플릿 카드만 존재 | 홈페이지에 "대본부터 시작하기" 버튼 1개 + 템플릿 그리드만 있음. "스타일부터", "캐스트부터" 진입 버튼이 없음. ux-design.md에 4진입점 설계 완료되었으나 HomePage UI에 미반영 | **P0** |
| G2 | **템플릿의 defaultModels 미적용** | 템플릿 선택 시 AI 모델 기본값이 store에 반영되지 않음 | HomePage의 `handleTemplateCardSelect`가 mode/artStyleId/aspectRatio만 설정하고, template.defaultModels를 aiModelPreferences에 반영하지 않음 | **P1** |
| G3 | **템플릿의 sceneSplitRules 미활용** | IdeaPage의 씬 수가 항상 사용자 지정(기본 10) | 템플릿에 defaultSceneCount, minSceneCount, maxSceneCount가 정의되어 있으나, IdeaPage의 sceneCount 초기값이 템플릿을 참조하지 않음 | **P1** |
| G4 | **BYOK 설정 UI 부재** | settingsStore에 구조만 있고 SettingsPage가 없음 | 사용자가 API 키를 입력할 수 있는 Settings 페이지가 존재하지 않음. BYOK 구조는 완벽하나 사용자가 접근할 방법이 없음 | **P1** |
| G5 | **Cast가 이미지 프롬프트에 반영되는 경로의 약점** | prompt-builder에 구조는 있으나 실제 연결이 불완전 | buildImagePrompt에 seedCards가 전달되지만, StoryboardPage에서 sceneSeeds 초기값이 빈 배열이므로 사용자가 수동으로 씬별 카드를 배치하지 않으면 Cast 정보가 프롬프트에 포함되지 않음. AI 분석 시 전체 카드가 모든 씬에 배치되나, 이것이 최적이 아닐 수 있음 | **P1** |
| G6 | **CastPage 독립 관리 vs 프로젝트 종속** | "프로젝트에 종속되지 않음" 비전과 부분적으로 일치 | cardLibrary는 프로젝트 간 유지되지만(startNewProject에서 리셋 안 함), mockCardLibrary로 초기화되는 로직이 HomePage/IdeaPage/CastPage 3곳에 중복. 실제 유저 생성 카드와 mock 카드의 경계가 불명확 | **P2** |
| G7 | **프롬프트 생성 AI (내부 전용 4번째 AI)** | 전혀 미구현 | 비전의 "프롬프트 생성 AI" -- 사용자 선택/프리셋을 조합하여 최적화된 프롬프트를 자동 생성하는 내부 AI가 없음. 현재는 prompt-builder.ts의 문자열 조합만으로 처리 | **P2** |
| G8 | **Dev Admin 페이지** | 미구현 | 비전의 "AI 프롬프트 템플릿 편집, 스타일 프리셋 관리, 크레딧 비용 설정, 시스템 현황" 페이지 없음. getTemplateById에 localStorage 오버라이드 로직은 있으나 UI 없음 | **P2** |
| G9 | **수익 모델 / 결제 시스템** | 전혀 미구현 | 무료/Pro/Enterprise 플랜, Stripe/토스페이먼츠 결제 없음. 크레딧은 100 고정 + resetCredits 뿐 | **P2** |
| G10 | **UGC 마켓플레이스** | Template 인터페이스에 필드만 예약 | authorId, price, downloads, rating 필드는 존재하나 어떤 UI/비즈니스 로직도 없음 | **P3** |
| G11 | **Export 기능** | 시네마틱 모드의 Export 버튼 disabled, 나레이션 Step 8 placeholder | 최종 결과물을 다운로드할 수 없음 | **P1** |
| G12 | **templateId에 따른 instruction 필드 미활용** | imagePromptRules.instruction, videoPromptRules.instruction이 프롬프트에 반영되지 않음 | 각 템플릿에 상세한 instruction이 있으나 prompt-builder.ts의 buildImagePrompt/buildVideoPrompt가 이를 사용하지 않음 | **P1** |
| G13 | **template.sampleIdea 미활용** | 템플릿 선택 시 IdeaPage의 아이디어 입력 placeholder에 sampleIdea가 반영되지 않음 | 사용자에게 "이런 아이디어를 입력해보세요" 가이드가 없어 초보자 UX 저하 | **P1** |
| G14 | **template.voice 설정 부분 활용** | TTS에 voiceId/speed는 전달되지만, 프로젝트 시작 시 자동 적용되지 않음 | template.voice가 있으나 사용자가 인지할 수 없음. 템플릿 설명에도 "이 템플릿은 OO 톤의 음성을 사용합니다" 안내 없음 | **P2** |
| G15 | **나레이션 모드 씬 checked 기본값 false** | TimelinePage의 handleAutoSplit에서 생성되는 씬의 checked가 false | StoryboardPage에서 allScenes.filter(s => s.checked !== false) 처리가 있으므로 자동 분할된 씬이 모두 필터링되어 이미지 생성 불가 상태 | **P0** |

---

## 3. 상세 갭 분석

### 3.1 고객 진입 경험 (비전 부합도: 55%)

**비전**: "3가지 시작점 (대본부터 / 스타일부터 / Cast부터) + 템플릿"
**현실**: "대본 작성으로 시작하기" 단일 CTA + 5개 템플릿 카드

현재 HomePage (`src/pages/HomePage.tsx`)의 구조:
```
1. Hero: "What story will you tell today?"
2. CTA: "대본 작성으로 시작하기" (모드 선택 오버레이)
3. My Cast 미리보기 (최대 4장, 링크만)
4. My Projects (로그인 시)
5. 템플릿 그리드 (5개)
```

ux-design.md에서 설계한 "4가지 진입점"이 홈페이지 UI에 반영되지 않았습니다.

- "스타일부터 시작" 버튼/카드가 없음
- "캐스트부터 시작" 버튼/카드가 없음 (My Cast 미리보기는 /cast 링크만 제공, project mode가 아님)
- 템플릿 클릭 시 entryPoint를 'style'로 설정하고 있어 비전의 "스타일부터" 경로와 혼재

**CEO 판단 포인트**: ux-design.md의 4진입점 설계를 HomePage에 실제로 반영할 것인지, 아니면 현재의 "대본 + 템플릿" 2경로로 단순화할 것인지.

### 3.2 워크플로우 완성도 (비전 부합도: 70%)

#### 시네마틱 4스텝

| 단계 | 비전 | 구현 상태 | 문제 |
|------|------|----------|------|
| 1. Idea | 대본 작성 + 스타일 선택 | 구현됨 (좌우 분할 레이아웃) | 템플릿 sceneCount 미적용, sampleIdea 미반영 |
| 2. Storyboard | 카드 선택(덱 구성) + 컷 분할 | 구현됨 (CastSetupPhase + CutSplitPhase) | AI 분석이 mock 타임아웃(2.5초) |
| 3. Generate | 시드 매칭 + AI 이미지/영상 생성 | 구현됨 (SeedCheckPhase) | template.instruction 미활용 |
| 4. Animate | 타임라인 + TTS + Export | 기본 구현됨 | Export 미구현, 재생 미구현 |

#### 나레이션 8스텝

| 단계 | 비전 | 구현 상태 | 문제 |
|------|------|----------|------|
| 1. Script | 대본 + 스타일 | 구현됨 (IdeaPage 공유) | - |
| 2. Voice | TTS 생성 | 구현됨 (NarrationVoiceStep) | - |
| 3. Split | 씬 자동 분할 | 구현됨 (NarrationSplitStep) | **checked=false 버그 (G15)** |
| 4. Direct | 캐스트 선택 | 구현됨 (CastSetupPhase 재활용) | - |
| 5. Image | 시드 매칭 + 이미지 생성 | 구현됨 (SeedCheckPhase 재활용) | - |
| 6. Video | 영상화 | 구현됨 (NarrationVideoStep) | - |
| 7. Edit | 편집 | 구현됨 (NarrationEditView) | 기본 기능만 |
| 8. Export | 내보내기 | **placeholder만** | "구현 예정" 텍스트만 표시 |

**단계 전환 네비게이션**: WorkflowSteps 클릭으로 자유롭게 이동 가능하나, "이전/다음" 버튼이 일부 단계에서 누락. 시네마틱 모드의 StoryboardPage cast-setup 단계에서 "이전" 버튼이 없어 IdeaPage로 돌아가려면 WorkflowSteps를 클릭해야 함.

### 3.3 Cast 시스템 (비전 부합도: 60%)

**비전**: "Cast는 AI 기반 에셋 생성 스튜디오, 프로젝트에 종속되지 않음"

**잘 된 부분**:
- CastPage에서 AI로 새 카드 생성 가능 (generateImage 연동)
- cardLibrary가 프로젝트 리셋 시에도 유지됨
- 타입 필터 (전체/배우/촬영장소/소품)
- 프로젝트 시작 모드 (?mode=project) 분기

**문제점**:
1. **mockCardLibrary 의존**: 3곳(HomePage, IdeaPage, CastPage)에서 cardLibrary가 비면 mockCardLibrary를 주입. 사용자가 모든 mock 카드를 삭제하면 다음 렌더링에서 다시 등장
2. **Cast -> 프롬프트 반영 경로 불완전**: prompt-builder에 seedCards를 전달하는 구조는 있으나, StoryboardPage에서 "AI 분석" 모달이 mock 데이터 기반으로 카드를 배치하고, 실제 AI 분석이 아님 (setTimeout 2.5초 후 cardLibrary/aiSuggestedCards에서 선택)
3. **Seed 기반 일관성**: 비전에서 "Seed로 일관성 유지"라 했으나, 실제로는 이미지 생성 시 seedCards[0]?.seed만 전달. 여러 카드의 seed를 조합하는 로직 없음
4. **CastPage에서 생성한 카드가 프로젝트에 즉시 반영되는 경로 불명확**: 카드를 생성해도 현재 프로젝트의 덱에 자동 추가되지 않음

### 3.4 크레딧/BYOK 모델 (비전 부합도: 75%)

**잘 된 부분**:
- 2계층 크레딧 구조 완벽 (creditCosts.ts, useCredits.ts)
- settingsStore에 BYOK 키 저장 구조 완비
- useCredits에서 BYOK 시 자동 비용 감면

**문제점**:
1. **Settings 페이지 부재**: 사용자가 API 키를 입력할 UI가 없음. settingsStore가 존재하지만 접근 방법이 없음
2. **크레딧 충전 방법 없음**: credits는 100 고정. addCredits/resetCredits는 있으나 호출하는 UI 없음
3. **BYOK가 AI 호출에 실제 반영되는지 불확실**: ai-image.ts는 환경변수(VITE_IMAGE_API_KEY)로 API 키를 읽음. settingsStore의 BYOK 키를 실제 AI 서비스 호출에 전달하는 코드가 없음. 즉 BYOK 구조는 크레딧 계산에만 반영되고, 실제 API 호출에는 반영되지 않음
4. **ACTION_PROVIDER_MAP 부정합**: script의 provider가 'openai'로 매핑되어 있으나, 실제 기본 모델은 'gemini-2.5-flash'. BYOK 판정이 부정확할 수 있음

### 3.5 프리셋/템플릿 시스템 (비전 부합도: 70%)

**잘 된 부분**:
- Template 인터페이스가 비전의 모든 요구사항을 포함
- 5개 템플릿에 각각 고유한 promptRules, castPreset, defaultModels 정의
- prompt-builder가 templateId를 받아 프롬프트 규칙 우선 적용
- localStorage 오버라이드로 Admin에서 런타임 수정 가능한 구조

**미반영 항목**:

1. **template.promptRules.imagePromptRules.instruction 미활용**
   - 각 템플릿에 "두 시대의 대비를 시각적으로 강조하세요" 같은 상세 지시가 있으나 buildImagePrompt에서 사용되지 않음
   - 비전의 "프롬프트 생성 AI"가 이 instruction을 해석하도록 의도되었으나, 현재는 프롬프트 생성 AI 자체가 미구현

2. **template.defaultModels -> store 반영 누락**
   - handleTemplateCardSelect (HomePage)에서 template.defaultModels를 aiModelPreferences에 복사하지 않음
   - 결과: 템플릿을 선택해도 AI 모델이 항상 전역 기본값(gemini-2.5-flash 등)으로 유지

3. **template.sceneSplitRules -> IdeaPage 연동 누락**
   - IdeaPage의 sceneCount 초기값이 항상 10
   - 템플릿의 defaultSceneCount (4~12)가 반영되지 않음
   - minSceneCount/maxSceneCount도 씬 수 선택기에 반영되지 않음

4. **template.sampleIdea -> IdeaPage 연동 누락**
   - 각 템플릿에 sampleIdea가 정의되어 있으나 IdeaPage의 textarea placeholder에 표시되지 않음

5. **castPreset -> CastSetupPhase 연동 부분적**
   - StoryboardPage의 handleAiAnalysis에서 template.castPreset의 카드 수를 참조
   - 하지만 castPreset의 실제 카드 데이터(이름, description)는 활용되지 않고, 기존 cardLibrary/aiSuggestedCards에서 수를 맞춰 선택할 뿐

---

## 4. 프로덕트 개선 제안

비전을 유지하면서 현실적으로 **MVP 런칭에 가장 임팩트가 큰 순서**로 정리합니다.

### 4.1 즉시 수정 (P0) -- 비전 정합성 + 버그

| # | 제안 | 예상 효과 | 난이도 |
|---|------|----------|--------|
| R1 | **나레이션 모드 checked=false 버그 수정**: handleAutoSplit에서 생성되는 씬의 checked를 true로 변경 | 나레이션 모드 워크플로우 정상 작동 | 1줄 수정 |
| R2 | **4진입점 HomePage 반영**: "대본부터" / "스타일부터" / "캐스트부터" 3개 CTA 추가 (현재 1개 -> 3개) | 비전의 핵심 차별점 실현, 사용자 선택지 확대 | 중간 |

### 4.2 단기 개선 (P1) -- 템플릿 연동 완성

| # | 제안 | 예상 효과 | 난이도 |
|---|------|----------|--------|
| R3 | **template.defaultModels -> aiModelPreferences 반영**: handleTemplateCardSelect에서 setAiModelPreference 4회 호출 추가 | 템플릿별 최적 AI 모델 자동 적용 | 낮음 |
| R4 | **template.sceneSplitRules -> sceneCount 연동**: 템플릿 선택 시 IdeaPage의 sceneCount를 template.sceneSplitRules.defaultSceneCount로 초기화, min/max 반영 | 템플릿 경험 일관성 | 낮음 |
| R5 | **template.sampleIdea -> IdeaPage placeholder**: 아이디어 입력 textarea에 sampleIdea를 placeholder로 표시 | 초보자 가이드 | 낮음 |
| R6 | **template.instruction -> prompt-builder 반영**: buildImagePrompt/buildVideoPrompt에 instruction 포함 | AI 생성 품질 향상 | 낮음 |
| R7 | **Settings 페이지 생성**: BYOK API 키 입력 UI (OpenAI, Replicate, Runway, Fish Speech, Google) | BYOK 사용자 확보, 플랫폼 매출 보장 | 중간 |
| R8 | **BYOK 키를 실제 AI 호출에 전달**: ai-image.ts, ai-llm.ts, ai-tts.ts에서 settingsStore의 API 키를 환경변수보다 우선 사용 | BYOK가 실제로 작동하게 됨 | 중간 |
| R9 | **Export 기본 구현**: 시네마틱 모드에서 씬 이미지 + TTS 오디오를 zip으로 다운로드 | 최소한의 결과물 산출 | 중간 |

### 4.3 중기 개선 (P2) -- 완성도 향상

| # | 제안 | 예상 효과 | 난이도 |
|---|------|----------|--------|
| R10 | **mockCardLibrary 의존 제거**: 초기 카드를 사용자가 직접 생성하도록 유도, 빈 라이브러리 허용 | 깔끔한 데이터 구조 | 낮음 |
| R11 | **프롬프트 생성 AI (내부)**: 씬 대본 + 캐스트 카드 + 아트 스타일 + 템플릿 instruction을 LLM에 입력하여 최적화된 이미지 프롬프트 생성 | AI 생성 품질 대폭 향상 | 높음 |
| R12 | **Dev Admin 페이지**: 템플릿 프롬프트 편집, 크레딧 비용 조정 | 운영 효율화 | 중간 |
| R13 | **ACTION_PROVIDER_MAP 정합성**: script provider를 실제 사용 모델과 일치시키기 | BYOK 정확도 | 낮음 |
| R14 | **castPreset 카드 데이터 활용**: AI 분석 시 template.castPreset의 이름/description을 사용하여 실제 카드 생성 | 템플릿 캐스트 품질 향상 | 중간 |

### 4.4 장기 과제 (P3) -- 성장 단계

| # | 제안 | 예상 효과 | 난이도 |
|---|------|----------|--------|
| R15 | **UGC 마켓플레이스** | 수익 모델 다각화, 커뮤니티 형성 | 매우 높음 |
| R16 | **결제 시스템 (Stripe + 토스)** | 수익화 시작 | 높음 |
| R17 | **배포 (Vercel + Supabase)** | 실사용자 확보 | 중간 |

---

## 5. 비전 문서 업데이트 제안

현재 구현 과정에서 비전이 진화한 부분들을 VISION.md에 반영해야 합니다.

### 5.1 "3가지 시작점" -> "4가지 시작점"으로 업데이트

CEO가 세션 16에서 확정한 4진입점 구조:
- **[A] 템플릿으로 시작** (비전 문서에 없음, 추가 필요)
- **[B] 대본부터 시작**
- **[C] 스타일부터 시작**
- **[D] 캐스트부터 시작**

### 5.2 "StylePreset" -> "Template" 용어 통일

비전 문서에서는 "영상 스타일(프리셋)"이라 하지만, 실제 구현은 Template이 StylePreset을 완전 대체. VISION.md에서도 Template 용어로 통일 필요.

### 5.3 "프롬프트 생성 AI" 위치 명확화

비전에서 "내부 전용 AI"로 정의했으나, 현재는 prompt-builder.ts의 문자열 조합. MVP에서는 문자열 조합으로 충분하고, Phase 2에서 LLM 기반 프롬프트 최적화로 업그레이드하는 것이 현실적.

---

## 6. 결론

### 비전 충실도 영역별 점수

| 영역 | 점수 | 요약 |
|------|------|------|
| 데이터 구조 / 아키텍처 | **85/100** | Template, ArtStyle, 크레딧 2계층, 프로바이더 패턴 모두 우수 |
| 사용자 진입 경험 | **55/100** | 4진입점 중 1.5개만 구현 (대본 + 템플릿) |
| 워크플로우 완성도 | **70/100** | 시네마틱 80%, 나레이션 65% (checked 버그, Export 미구현) |
| 데이터 연동 | **60/100** | 템플릿 데이터가 풍부하나 실제 UI/프롬프트에 미반영 항목 다수 |
| 수익화 인프라 | **40/100** | 크레딧 구조 있으나 결제/충전/Settings UI 없음 |

### 핵심 메시지

**"설계는 90점, 연결은 60점."**

Template 데이터 구조, 프롬프트 빌더, 크레딧 시스템 등 **뼈대는 비전에 충실하게 설계되어 있습니다.** 하지만 그 뼈대에 살을 붙이는 과정 -- 즉 "Template의 defaultModels가 실제로 store에 반영되는가", "castPreset의 카드 데이터가 실제로 AI 분석에 사용되는가", "BYOK 키가 실제 API 호출에 전달되는가" 같은 **데이터 흐름의 마지막 1마일**이 누락된 곳이 여러 곳입니다.

가장 비용 대비 효과가 큰 개선은 **R3~R6 (템플릿 데이터 연동 완성)**입니다. 이미 존재하는 풍부한 데이터를 실제 사용 경로에 연결하기만 하면 되므로, 적은 코드 변경으로 사용자 경험이 크게 향상됩니다.

---

*이 분석은 CPO 유나가 작성했으며, CEO의 검토와 우선순위 확정을 요청합니다.*
