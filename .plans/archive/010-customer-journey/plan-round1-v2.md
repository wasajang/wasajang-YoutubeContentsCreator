# Round 1: 데이터 정합성 수정 계획 (v2)

> 작성: CTO 일론 (2026-02-28)
> 버전: v2 — 6개 분석 문서 종합 반영
> 근거 문서:
> - customer-journey.md (유나 CPO, 1차)
> - spec-sheet.md (미소 PM, 1차)
> - qa-verification.md (타로 QA, 2차)
> - impact-analysis.md (린 FE, 2차)
> - business-review.md (유나 CPO, 2차)
> - plan-round1.md v1 (일론 CTO, 1차)
>
> 원칙: **추가 기능 없음. 기존 코드의 연결을 바로잡는 것만.**

---

## v1 → v2 변경사항 요약

| 변경 | 내용 |
|------|------|
| 우선순위 변경 | RICE 점수 기반 재정렬 (#2→#5→#6→D1→#1→#3→#4) |
| 항목 추가 | D1: scenes[].checked 필터링 (1줄, RICE 200) |
| 파일 추가 | `PresetInfoModal.tsx` — 수정 #3과 세트 (린 FE 발견) |
| 수정 #5 재평가 | handleNarrativeTTS는 **데드 코드** (유나 CPO 발견) — 방어적 수정 유지 |
| 정확한 라인 번호 | 타로 QA의 코드 레벨 검증 결과 반영 |
| 실행 순서 변경 | 의존성 분석 기반 (린 FE 권장): ⑥→③→②→①→④⑤→D1 |
| 무력화 경로 분석 | 유나 CPO의 각 수정별 무력화 가능성 검토 반영 |

---

## 수정 항목 7건 (RICE 순위순)

### 순위 1. selectedPreset null 초기화 버그 (RICE 480)

**심각도:** P0 — 프리셋 시스템 전체가 무효화됨
**파일:** `src/pages/IdeaPage.tsx`
**근거:** QA 타로 검증 (L220, L224, L228), CPO 유나 RICE 분석

**현재 문제:**
```
프리셋 진입 흐름:
1. HomePage: setSelectedPreset('cinematic-drama') ✓
2. IdeaPage: PresetInfoModal 표시 ✓
3. 모달 닫기: setSelectedPreset(null) ← 문제!
4. StoryboardPage: selectedPreset === null → 프리셋 프롬프트 미적용 ✗
```

프리셋의 `prompts.script`, `imagePrefix`, `videoPrefix`, `negativePrompt`가 모두 무용지물.
5개 프리셋 전부 영향. AntiGravity의 핵심 차별점("3진입점" 중 "스타일부터")을 무효화하는 치명적 버그.

**수정 내용:**

**(a) setSelectedPreset(null) 3줄 삭제 — IdeaPage.tsx L218~229:**
```typescript
// 기존
onApply={() => {
    setShowPresetModal(false);
    setSelectedPreset(null);  // ← 삭제
}}
onCustomize={() => {
    setShowPresetModal(false);
    setSelectedPreset(null);  // ← 삭제
}}
onClose={() => {
    setShowPresetModal(false);
    setSelectedPreset(null);  // ← 삭제
}}

// 수정: 모달만 닫고 프리셋은 유지
onApply={() => {
    setShowPresetModal(false);
}}
onCustomize={() => {
    setShowPresetModal(false);
}}
onClose={() => {
    setShowPresetModal(false);
}}
```

**(b) 모달 재표시 방지 — IdeaPage.tsx L90~94:**
```typescript
// 기존
useEffect(() => {
    if (selectedPreset) setShowPresetModal(true);
}, [selectedPreset]);

// 수정: 최초 1회만 표시
const [hasShownPresetModal, setHasShownPresetModal] = useState(false);
useEffect(() => {
    if (selectedPreset && !hasShownPresetModal) {
        setShowPresetModal(true);
        setHasShownPresetModal(true);
    }
}, [selectedPreset, hasShownPresetModal]);
```

**린 FE 사이드이펙트 분석:**
- `hasShownPresetModal`은 useState → 컴포넌트 언마운트 시 리셋 → 재진입 시 모달 다시 표시됨 (수용 가능)
- STYLE 탭에서 다른 프리셋 선택 시 `hasShownPresetModal`이 true라 모달 안 뜸 → 프리셋 ID 변경 감지 로직 추가 검토 필요
- **판단:** hasShownPresetModal을 selectedPreset 값과 함께 추적하면 해결 가능하나, MVP에서는 현재 방식으로 충분

**유나 CPO 무력화 경로 분석:**
- HomePage "대본부터": setSelectedPreset(null) → 의도된 동작 ✓
- startNewProject(): selectedPreset: null → 의도된 동작 ✓
- 기존 프로젝트 열기: preset 미복원 → Round 2에서 해결 (DB 스키마 필요)
- **무력화 위험: 낮음** — 핵심 경로(스타일부터→IdeaPage→StoryboardPage)에서는 정상 동작

---

### 순위 2. 나레이션 TTS 크레딧 체크 추가 (RICE 320)

**심각도:** P0 — 수익 모델 직결 (무한 크레딧 소비 가능)
**파일:** `src/pages/TimelinePage.tsx` — handleNarrativeTTS (L88~127)
**근거:** QA 타로 검증 (canAfford/spend 호출 완전 부재), CPO 유나 RICE 분석

**중요 발견 (유나 CPO):**
`handleNarrativeTTS`는 **현재 실행 경로가 없는 데드 코드**입니다.
- 나레이션 모드에서 TimelinePage L388에서 `return` → 하단의 handleNarrativeTTS 호출 코드에 도달 불가
- `NarrationVoiceStep.tsx`가 자체적으로 TTS 호출하며, L50~54에서 **크레딧 체크 이미 포함** (`canAfford('tts')` + `spend('tts')`)
- 즉, 현재 나레이션 TTS는 실제로 안전함

**그럼에도 수정하는 이유:**
1. 미래에 코드 구조가 변경되면 데드 코드가 활성화될 수 있음 (방어적 프로그래밍)
2. 코드 리뷰 시 크레딧 체크 누락으로 오해할 수 있음
3. 수정 비용이 매우 낮음 (4줄 추가)

**수정 내용:**
```typescript
// handleNarrativeTTS 함수 상단에 추가 (L89 이후)
// NOTE: 이 함수는 현재 데드 코드 (NarrationVoiceStep이 TTS를 직접 처리).
// 방어적으로 크레딧 체크를 추가함.
if (!canAfford('tts')) {
    alert('크레딧이 부족합니다!');
    return;
}
// TTS 생성 성공 후 크레딧 차감 (기존 코드 끝에 추가)
spend('tts');
```

**유나 CPO 무력화 경로 분석:**
- NarrationVoiceStep: 크레딧 체크 이미 있음 → 안전
- handleNarrativeTTS: 데드 코드 → 현재 실행 안 됨
- **무력화 위험: 없음**

---

### 순위 3. StoryboardPage 제목 하드코딩 수정 (RICE 200)

**심각도:** P0 — 전 사용자 100% 영향
**파일:** `src/pages/StoryboardPage.tsx` — L194, L269
**근거:** QA 타로 검증 (2곳 하드코딩), spec-sheet 부록 #1

**현재 문제:**
```typescript
// 나레이션 모드 L194
<h2 className="storyboard-header__title">강철의 북진</h2>

// 시네마틱 모드 L269
<h2 className="storyboard-header__title">강철의 북진</h2>
```
모든 프로젝트에서 "강철의 북진" 표시. store.title을 사용하지 않음.

**참고:** TimelinePage L463에서는 이미 `{title || '강철의 북진'}` 사용 중 (일관성 없는 상태).

**수정 내용:**

**(a) title destructuring 추가 — L19:**
```typescript
const {
    title,  // ← 추가
    selectedStyle, scenes: storeScenes, cardLibrary, addToCardLibrary,
    aiModelPreferences, setAiModelPreference, mode,
    narrationStep, setNarrationStep, narrationClips, setNarrationClips,
    selectedPreset, aspectRatio,
} = useProjectStore();
```

**(b) 하드코딩 → 동적 바인딩 (2곳):**
```typescript
// L194, L269 동일:
<h2 className="storyboard-header__title">{title || 'Untitled Project'}</h2>
```

**린 FE 분석:** 사이드이펙트 없음. startNewProject에서 preset.name이 title로 설정되므로 빈 문자열 케이스는 직접 URL 접근 시에만 발생.

---

### 순위 4. scenes[].checked 필터링 추가 (RICE 200, 신규)

**심각도:** P1 — 체크 해제한 씬에 불필요한 크레딧 소비
**파일:** `src/pages/StoryboardPage.tsx` — L42
**근거:** CPO 유나 발견 (business-review D1), spec-sheet 부록 #2

**현재 문제:**
```typescript
// StoryboardPage.tsx L42
const scenes = (storeScenes.length > 0 ? storeScenes : mockStoryboardScenes) as Scene[];
```
IdeaPage에서 `checked: false`로 설정한 씬도 StoryboardPage에 그대로 표시.
사용자가 체크 해제한 씬에 이미지/영상 생성 크레딧이 낭비됨.

**수정 내용:**
```typescript
// 기존 L42
const scenes = (storeScenes.length > 0 ? storeScenes : mockStoryboardScenes) as Scene[];

// 수정: checked !== false인 씬만 표시
const allScenes = (storeScenes.length > 0 ? storeScenes : mockStoryboardScenes) as Scene[];
const scenes = allScenes.filter(s => s.checked !== false);
```

**RICE:**
- Reach 50%, Impact 1 (medium), Confidence 1.0, Effort 0.25h = **200**
- 코드 변경 1줄. 리스크 매우 낮음.

---

### 순위 5. 프리셋 recommendedCast → AI 분석 연결 (RICE 160)

**심각도:** P0 — 전 프리셋 영향 (추천 수 불일치)
**파일:** `src/pages/StoryboardPage.tsx` — L62~116 (handleAiAnalysis)
**근거:** QA 타로 검증 (L82~84 하드코딩 확인), customer-journey P1-1

**현재 문제:**

| 프리셋 | recommendedCast | 실제 적용 (하드코딩) | 차이 |
|--------|-----------------|---------------------|------|
| 시네마틱 드라마 | 2+2+0=4 | 3+1+1=5 | 불일치 |
| 해외감동사연 | 2+2+0=4 | 3+1+1=5 | 불일치 |
| 무협지 | 3+2+1=6 | 3+1+1=5 | 불일치 |
| 무협지2 | 3+2+2=7 | 3+1+1=5 | 불일치 |
| 해골 쇼츠 | 1+1+0=2 | 3+1+1=5 | **심각** 불일치 |

**수정 내용:**

**(a) import 추가:**
```typescript
import { getPresetById } from '../data/stylePresets';
```

**(b) handleAiAnalysis 내부 — AI 분석 실행 시 (L78~101):**
```typescript
// 프리셋 기반 캐스트 구성 계산
const preset = selectedPreset ? getPresetById(selectedPreset) : null;
const castConfig = preset?.recommendedCast ?? { characters: 3, backgrounds: 1, items: 1 };

// 기존 하드코딩 → castConfig 사용
const selectedChars = libChars.slice(0, castConfig.characters).map(/*...*/);
const selectedBgs = libBgs.slice(0, castConfig.backgrounds).map(/*...*/);
const selectedItems = libItems.slice(0, castConfig.items).map(/*...*/);

// while 루프도 동일하게:
while (selectedChars.length < castConfig.characters && aiCharsPool.length > 0) { /*...*/ }
while (selectedBgs.length < castConfig.backgrounds && aiBgsPool.length > 0) { /*...*/ }
while (selectedItems.length < castConfig.items && aiItemsPool.length > 0) { /*...*/ }
```

**(c) 스킵 케이스 (L63~74):**
```typescript
// 기존: aiSuggestedCards.slice(0, MAX_AI_SLOTS)
// 수정: castConfig 합계만큼만 선택
const totalSlots = castConfig.characters + castConfig.backgrounds + castConfig.items;
const defaultDeck = aiSuggestedCards.slice(0, totalSlots).map(/*...*/);
```

**린 FE 분석:**
- `getPresetById` import 추가 필요 (현재 없음)
- `selectedPreset`은 이미 destructuring됨 (L23)
- `totalSlots > MAX_AI_SLOTS(5)` 가능 (무협지2: 7) → aiSuggestedCards가 5개뿐이라 부족할 수 있음. 기능적 에러는 아닌 UX 제한
- 사이드이펙트 없음

**유나 CPO 무력화 분석:**
- recommendedCast 연결해도 "어떤 카드를 가져올 것인가"는 여전히 cardLibrary 순서대로 (해골 쇼츠인데 군인 카드 추천 등)
- 이건 AI 실 연동(004)에서 해결될 문제. Round 1에서는 "수"만이라도 맞추는 것이 목표
- **무력화 위험: 부분적** — 수는 정확해지지만 내용은 여전히 부정확

---

### 순위 6. selectedStyle 대소문자 통일 (RICE 160)

**심각도:** P1 — 시각적 문제 (프롬프트는 capitalize() 폴백으로 동작)
**파일:** `src/data/stylePresets.ts` + `src/components/PresetInfoModal.tsx` (세트)
**근거:** QA 타로 검증, 린 FE 영향도 분석

**현재 문제:**
- projectStore 기본값: `selectedStyle: 'Cinematic'` (대문자)
- stylePresets 5개: `style: 'cinematic'` (소문자)
- IdeaPage STYLE 탭: `selectedStyle === style.name` → 'cinematic' !== 'Cinematic' → **하이라이트 안 됨**
- SeedCheckPhase: `stylePromptPrefix['cinematic']` → undefined → 폴백으로 'Cinematic' 사용 (항상 Cinematic만)

**수정 내용:**

**(a) stylePresets.ts — 5개 프리셋 style 값 대문자화:**
```typescript
// 5개 프리셋 모두:
style: 'cinematic' → style: 'Cinematic'
```

**(b) PresetInfoModal.tsx — STYLE_LABEL 키 대문자화 (린 FE 발견, 필수):**
```typescript
// 기존
const STYLE_LABEL: Record<string, string> = {
    cinematic: 'Cinematic',
    anime: 'Anime',
    'children-illustration': "Children's Illustration",
    // ...
};

// 수정: artStyles.name과 동일한 키로 통일
const STYLE_LABEL: Record<string, string> = {
    Cinematic: 'Cinematic',
    Anime: 'Anime',
    "Children's Illustration": "Children's Illustration",
    'Comic Book': 'Comic Book',
    'Oil Painting': 'Oil Painting',
    Sketch: 'Sketch',
    Cartoon: 'Cartoon',
    Watercolor: 'Watercolor',
    '3D Render': '3D Render',
};
```

**주의:** STYLE_LABEL을 함께 수정하지 않으면 PresetInfoModal에서 스타일 이름이 한국어 레이블 대신 원본 영문으로 표시됨.

**린 FE 검증:**
- prompt-builder.ts의 capitalize() → 이미 대문자면 이중 변환 없음. 안전
- SeedCheckPhase의 stylePromptPrefix → 대문자 키로 직접 매핑됨. 폴백 불필요
- 사이드이펙트: 경미 (PresetInfoModal만, 세트로 수정하면 해결)

---

### 순위 7. TTS 크레딧 타입 수정 (RICE 60)

**심각도:** P1 — 논리적 오류 (현재 금액 동일하여 실질적 영향 없음)
**파일:** `src/pages/TimelinePage.tsx`
**근거:** QA 타로 검증 (L288, L305, L325, L346)

**현재 문제:**
```typescript
// handleGenerateTTS (시네마틱 모드 개별 TTS)
if (!canAfford('script', 1)) { ... }  // L288 — 'script' 타입
spend('script', 1);                    // L305

// handleGenerateAllTTS (시네마틱 모드 전체 TTS)
const totalCost = pendingClips.length * CREDIT_COSTS.script;  // L325
spend('script', 1);                                           // L346
```

`CREDIT_COSTS.script === CREDIT_COSTS.tts === 2` → 금액 동일하여 우연히 정상 동작.
하지만 나중에 TTS 비용 조정 시 올바른 타입으로 차감되어야 함.

**수정 내용:**
```typescript
// handleGenerateTTS
canAfford('script', 1) → canAfford('tts', 1)  // L288
spend('script', 1)     → spend('tts', 1)       // L305

// handleGenerateAllTTS
CREDIT_COSTS.script    → CREDIT_COSTS.tts       // L325
spend('script', 1)     → spend('tts', 1)        // L346
```

**린 FE 검증:** useCredits.ts에 GenerationType `'tts'`와 CREDIT_COST_TABLE `tts` 모두 존재. 바로 사용 가능. 사이드이펙트 없음.

---

## 수정 파일 목록 (5개 파일)

| # | 파일 | 수정 항목 | v1 대비 변경 |
|---|------|----------|-------------|
| 1 | `src/pages/IdeaPage.tsx` | 순위1: selectedPreset null 삭제 + 모달 가드 | 동일 |
| 2 | `src/pages/StoryboardPage.tsx` | 순위3: 제목 + 순위4: checked 필터 + 순위5: recommendedCast | D1(checked) 추가 |
| 3 | `src/data/stylePresets.ts` | 순위6: 대소문자 통일 | 동일 |
| 4 | `src/components/PresetInfoModal.tsx` | 순위6: STYLE_LABEL 키 수정 | **신규** (린 발견) |
| 5 | `src/pages/TimelinePage.tsx` | 순위2: 나레이션 TTS 크레딧 + 순위7: TTS 타입 | 동일 |

---

## 실행 순서 (의존성 기반, 린 FE 권장)

```
Step 1: StoryboardPage — 제목 + checked 필터 (순위3, 순위4)
  → 가장 단순. 독립적. title 추가 + h2 2곳 + filter 1줄.
  → npm run build 확인

Step 2: stylePresets.ts + PresetInfoModal.tsx (순위6)
  → 세트로 묶어야 함. stylePresets 5개 + STYLE_LABEL 키.
  → npm run build 확인

Step 3: IdeaPage — selectedPreset null 제거 (순위1)
  → Step 2 완료 후 (style 값이 올바른 상태에서 테스트 가능)
  → npm run build 확인

Step 4: StoryboardPage — recommendedCast 연결 (순위5)
  → Step 3 완료 후 (selectedPreset이 유지되어야 의미 있음)
  → npm run build 확인. 브라우저에서 AI 분석 동작 확인.

Step 5: TimelinePage — TTS 크레딧 (순위2, 순위7)
  → 독립적. 마지막에 진행.
  → npm run build 확인
```

**참고:** RICE 우선순위와 실행 순서가 다른 이유:
- RICE는 "비즈니스 임팩트" 기준
- 실행 순서는 "코드 의존성" 기준 (selectedPreset이 유지되어야 recommendedCast가 의미 있음)
- 둘 다 필요하므로 별도로 관리

---

## 수정하지 않는 것 (Round 2, 3으로 이월)

### Round 2: 상태 영속성 (사용자 이탈 방지)

| 항목 | 이유 |
|------|------|
| Scene에 videoUrl 추가 | Store 구조 변경 + 마이그레이션 필요 |
| sceneGenStatus persist | useGeneration 리팩토링 필요 |
| Blob URL 새로고침 무효 | 파일 저장 로직 필요 |
| defaultModels 미연결 | 프리셋-모델 매핑 로직 추가 |
| 기존 프로젝트 preset 복원 | DB 스키마 변경 필요 |

### Round 3: UX 정밀화 (품질 제고)

| 항목 | 이유 |
|------|------|
| artStyle + 프리셋 충돌 해소 | UX 설계 변경 필요 |
| 일괄 생성 실패 재생성 UI | 새 UI 컴포넌트 필요 |
| CutSplit 핸들러 완성 | 새 로직 필요 |
| seedCards 전달 완성 | NarrationVideoStep 수정 필요 |
| 에러 처리 통일 | 전체 앱 일관성 작업 |
| voice/voiceId 프리셋 지원 | TTS 시스템 확장 필요 |

### CPO 유나 전략 권고 (Round 1 이후)

> Round 1 완료 후, **004 AI 실 연동**을 Round 2보다 먼저 진행 권장.
> Mock 데이터로 완벽한 상태 관리를 해봐야 실제 가치가 없음.
> AI가 실제로 동작하는 것을 보여주는 것이 MVP의 핵심.
> Round 2는 004 이후에 진행해도 됨.
>
> **최종 판단은 CEO에게 있습니다.**

---

## 검증 체크리스트 (타로 QA 검증 항목 기반)

### 빌드 검증
- [ ] `npm run build` — 빌드 성공
- [ ] TypeScript 에러 0개
- [ ] ESLint 신규 에러 0개 (기존 4개 경고는 허용)

### 기능 검증 — 프리셋 경로

1. **프리셋(시네마틱 드라마) 선택 → IdeaPage:**
   - [ ] PresetInfoModal 표시됨
   - [ ] "적용" 클릭 후 모달 닫힘
   - [ ] STYLE 탭에서 'Cinematic' 하이라이트됨 (순위6 확인)
   - [ ] 뒤로가기 → IdeaPage 재진입 시 모달 다시 표시됨 (수용)

2. **IdeaPage → StoryboardPage:**
   - [ ] 제목이 프리셋명(예: "시네마틱 드라마")으로 표시됨 (순위3 확인)
   - [ ] AI 분석 시 캐릭터 2 + 배경 2 + 아이템 0 = 4개 추천 (순위5 확인)
   - [ ] 스킵 시에도 4개만 덱에 추가됨
   - [ ] 이미지 생성 프롬프트에 프리셋 imagePrefix 적용됨 (console.log 확인)

3. **프리셋(해골 쇼츠) 선택 → StoryboardPage:**
   - [ ] AI 분석 시 캐릭터 1 + 배경 1 = 2개 추천 (순위5 확인)

### 기능 검증 — 대본부터 경로

4. **"대본부터" 진입 → IdeaPage:**
   - [ ] PresetInfoModal 표시 안 됨 (selectedPreset === null)
   - [ ] 대본 입력 → 씬 분할 → checked 해제한 씬이 있을 때
   - [ ] StoryboardPage에서 checked:false 씬 미표시 (순위4 확인)

### 기능 검증 — TTS

5. **시네마틱 모드 TimelinePage:**
   - [ ] TTS 개별 생성: 'tts' 크레딧으로 차감됨 (순위7 확인)
   - [ ] TTS 전체 생성: 'tts' 크레딧으로 차감됨

6. **나레이션 모드 TimelinePage:**
   - [ ] NarrationVoiceStep에서 TTS 생성: 기존대로 정상 동작 (이미 'tts' 타입 사용)

---

## RICE 점수 상세 (CPO 유나 산출)

| 순위 | # | 문제 | Reach | Impact | Confidence | Effort | RICE |
|:---:|:---:|------|:---:|:---:|:---:|:---:|:---:|
| 1 | #2 | selectedPreset null | 80% | 3 (massive) | 1.0 | 0.5h | **480** |
| 2 | #5 | 나레이션 TTS 크레딧 | 40% | 2 (high) | 1.0 | 0.25h | **320** |
| 3 | #6 | 제목 하드코딩 | 100% | 0.5 (low) | 1.0 | 0.25h | **200** |
| 4 | D1 | checked 필터링 | 50% | 1 (medium) | 1.0 | 0.25h | **200** |
| 5 | #1 | recommendedCast | 80% | 1 (medium) | 1.0 | 0.5h | **160** |
| 6 | #3 | 대소문자 통일 | 80% | 0.5 (low) | 1.0 | 0.25h | **160** |
| 7 | #4 | TTS 타입 오류 | 60% | 0.25 (minimal) | 1.0 | 0.25h | **60** |

**총 소요 예상: ~2~2.5 person-hours**

---

## 교차 검증 결과 요약

### 6개 문서에서 공통 확인된 사실
1. **selectedPreset null 초기화**: 3개 문서(customer-journey, spec-sheet, QA) 모두 확인
2. **recommendedCast 하드코딩**: 3개 문서 모두 확인
3. **TTS 크레딧 타입 불일치**: 3개 문서 모두 확인
4. **제목 하드코딩**: 3개 문서 모두 확인

### 2차 분석에서 새로 발견된 사실
1. **handleNarrativeTTS가 데드 코드** (유나 CPO) — NarrationVoiceStep이 이미 처리
2. **PresetInfoModal.tsx STYLE_LABEL도 수정 필요** (린 FE) — stylePresets와 세트
3. **checked 필터링 누락** (유나 CPO) — Round 1에 추가 권장
4. **hasShownPresetModal 재진입 시 리셋** (린 FE) — 수용 가능한 동작

### 문서 간 충돌 해소
- customer-journey의 "나레이션 TTS 크레딧 부족 alert" 기술 → 실제로는 코드에 없음 (spec-sheet가 정확)
- 이 외 근본적 충돌 없음

---

*이 문서는 CEO 검토 후 승인되어야 구현이 시작됩니다.*
*구현 시 Sonnet 4.6 모델로 전환하고, 에이전트(린 FE + 타로 QA)에게 위임합니다.*
