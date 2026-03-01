# QA 검증 보고서 — AntiGravity 현재 코드 검증

> 작성: 타로 (QA Engineer)
> 작성일: 2026-02-28
> 검증 대상: 고객 여정 문서 + 스펙시트

---

## A. selectedPreset 생명주기 추적

### A-1. 설정되는 모든 위치

#### HomePage.tsx L93
```
setSelectedPreset(preset.id)
```
프리셋 선택 시 preset ID 저장

#### HomePage.tsx L78
```
setSelectedPreset(null)
```
대본부터 진입 시 null 설정

#### projectStore.ts L234
```
selectedPreset: null
```
startNewProject() 내에서 null로 초기화

#### IdeaPage.tsx L220, L224, L228
```
onApply: setSelectedPreset(null)
onCustomize: setSelectedPreset(null)
onClose: setSelectedPreset(null)
```
PresetInfoModal 닫을 때 null 초기화

### A-2. 핵심 문제

**프리셋 진입 흐름:**
1. HomePage: setSelectedPreset('cinematic-drama') ✓
2. IdeaPage: PresetInfoModal 표시 ✓
3. 모달 닫기: setSelectedPreset(null) ← 문제!
4. StoryboardPage: selectedPreset === null → 프리셋 프롬프트 미적용 ✗

**영향:** 프리셋으로 진입하면 IdeaPage에서는 프리셋이 있지만, StoryboardPage에 도달할 때는 null로 초기화되어 있음.

---

## B. AI 분석 (handleAiAnalysis) — 정확한 코드 추적

### B-1. StoryboardPage.tsx L62-116

```typescript
const handleAiAnalysis = (doAnalysis: boolean) => {
    // ...
    setIsAiAnalyzing(true);
    setTimeout(() => {
        const libChars = cardLibrary.filter((c) => c.type === 'character');  // L78
        const libBgs = cardLibrary.filter((c) => c.type === 'background');   // L79
        const libItems = cardLibrary.filter((c) => c.type === 'item');       // L80

        const selectedChars = libChars.slice(0, 3).map(...);  // L82 — 하드코딩 3개
        const selectedBgs = libBgs.slice(0, 1).map(...);      // L83 — 하드코딩 1개
        const selectedItems = libItems.slice(0, 1).map(...);  // L84 — 하드코딩 1개

        const aiCharsPool = aiSuggestedCards.filter(...);     // L86
        const aiBgsPool = aiSuggestedCards.filter(...);       // L87
        const aiItemsPool = aiSuggestedCards.filter(...);     // L88

        while (selectedChars.length < 3 && aiCharsPool.length > 0) { ... }  // L90
        while (selectedBgs.length < 1 && aiBgsPool.length > 0) { ... }      // L94
        while (selectedItems.length < 1 && aiItemsPool.length > 0) { ... }  // L98
    }, 2500);
};
```

### B-2. 정확한 시나리오별 결과

#### 시나리오 1: cardLibrary = [캐릭터5 + 배경3 + 아이템2]
```
결과: 캐릭터3 + 배경1 + 아이템1 = 5개 카드
```

#### 시나리오 2: cardLibrary = []
```
결과: aiSuggestedCards에서 캐릭터3 + 배경1 + 아이템1 = 5개 (모두 AI)
```

#### 시나리오 3: cardLibrary = [캐릭터2만]
```
결과: 캐릭터2 + ai캐릭터1 + ai배경1 + ai아이템1 = 5개
```

### B-3. 핵심 문제

**하드코딩된 값 vs 프리셋의 recommendedCast:**

| 프리셋 | recommendedCast | 실제 적용 | 차이 |
|--------|-----------------|---------|------|
| 시네마틱 드라마 | 2+2+0=4 | 3+1+1=5 | ✗ 불일치 |
| 해외감동사연 | 2+2+0=4 | 3+1+1=5 | ✗ 불일치 |
| 무협지 | 3+2+1=6 | 3+1+1=5 | ✗ 불일치 |
| 무협지2 | 3+2+2=7 | 3+1+1=5 | ✗ 불일치 |
| 해골 쇼츠 | 1+1+0=2 | 3+1+1=5 | ✗ 심각 불일치 |

**모든 프리셋에서 프리셋 설정이 무시되고 하드코딩된 3,1,1 적용됨**

---

## C. TTS 크레딧 문제

### C-1. handleGenerateTTS — TimelinePage.tsx L284-318

```typescript
if (!canAfford('script', 1)) {  // L288 — 'script' 타입 사용
    alert('크레딧이 부족합니다!');
    return;
}
spend('script', 1);  // L305 — 'script' 타입으로 차감
```

**문제:** 'tts' 타입이 아닌 'script' 타입 사용. CREDIT_COSTS.tts가 정의되어 있지만 무시됨.

### C-2. handleGenerateAllTTS — TimelinePage.tsx L321-347

```typescript
const totalCost = pendingClips.length * CREDIT_COSTS.script;  // L325
spend('script', 1);  // L346
```

**문제:** 동일하게 'script' 타입 사용

### C-3. handleNarrativeTTS — TimelinePage.tsx L88-127

```typescript
const handleNarrativeTTS = useCallback(async () => {
    // ... TTS 생성 코드 ...
    setNarrativeAudioUrl(result.audioUrl);
    // ← 크레딧 체크 코드 없음!
}, [...]);
```

**문제:** canAfford(), spend() 호출 완전히 없음. 나레이션 TTS는 크레딧 무한 사용 가능.

### C-4. CREDIT_COSTS 확인

useCredits.ts L17-23:
```typescript
export const CREDIT_COSTS = {
    image:  3,  // CREDIT_COST_TABLE.image.total
    video:  10,
    script: 2,
    tts:    2,  // ← 정의되어 있음
    card:   3,
};
```

**현재:** TTS와 Script 비용이 같음(2)이므로 우연히 같은 금액이지만 타입 불일치.

---

## D. selectedStyle 대소문자 문제

### D-1. projectStore.ts L230

```typescript
selectedStyle: 'Cinematic',  // 대문자 C
```

### D-2. stylePresets.ts L60, 80, 100, 120, 140

```typescript
style: 'cinematic',  // 소문자 c (5개 프리셋 모두)
```

### D-3. 비교 위치

IdeaPage STYLE 탭: `selectedStyle === style.name`
- 프리셋으로 진입: 'cinematic'
- artStyle 그리드: 'Cinematic'
- 비교: 'cinematic' !== 'Cinematic' → **하이라이트 안 됨**

### D-4. capitalize() 함수

prompt-builder.ts에서 사용: `stylePromptPrefix[capitalize(ctx.style)]`
- `capitalize('cinematic')` → 'Cinematic' ✓ (프롬프트는 정상)
- 하지만 STYLE 탭 하이라이트는 이 함수 사용 안 함

---

## E. StoryboardPage 제목 하드코딩

### E-1. StoryboardPage.tsx L194, L269

```typescript
// 나레이션 모드 L194
<h2 className="storyboard-header__title">강철의 북진</h2>

// 시네마틱 모드 L269  
<h2 className="storyboard-header__title">강철의 북진</h2>
```

**문제:** 모든 프로젝트에서 "강철의 북진" 하드코딩됨.

### E-2. store.title 사용 여부

StoryboardPage.tsx L19-24:
```typescript
const {
    selectedStyle, scenes: storeScenes, cardLibrary, addToCardLibrary,
    aiModelPreferences, setAiModelPreference, mode,
    narrationStep, setNarrationStep, narrationClips, setNarrationClips,
    selectedPreset, aspectRatio,
} = useProjectStore();
```

**문제:** `title`을 구조분해하지 않음. 헤더에 title 사용 불가능.

**해결:** 
1. L19에 `title` 추가
2. L194, L269를 `{title || '프로젝트 제목'}`으로 변경

---

## F. 빌드 검증

### F-1. npm run build

**상태: ✅ 성공**

```
vite v7.3.1 building client environment for production...
✓ 1837 modules transformed.
rendering chunks...
✓ built in 4.71s

dist/index.html: 0.61 kB
dist/assets/index-P9L0pXa3.css: 144.61 kB | gzip: 20.34 kB
dist/assets/index-CZF7i2-W.js: 620.25 kB | gzip: 181.57 kB
```

### F-2. TypeScript 에러

**상태: ✅ 0개**

`tsc -b` 완료 (에러 없음)

### F-3. ESLint 에러

**상태: ❌ 4개 에러**

| 파일 | 라인 | 문제 |
|------|------|------|
| NarrationEditView.tsx | 55 | `tick` accessed before declared |
| NarrationSceneList.tsx | 44 | React Compiler memoization 미보존 |
| NarrationSceneList.tsx | 56 | React Compiler memoization 미보존 |
| NarrationSceneList.tsx | 87 | React Compiler memoization 미보존 |

**심각도:** 경고 수준 (기능 작동). 개발 환경 정리 권장.

---

## 종합 결론

### 빌드: ✅ 성공
- TypeScript: 0 에러
- Vite: 성공
- ESLint: 4 경고

### 코드 검증: ❌ 6개 심각 문제 발견

**P0 (차단):**
1. AI 분석이 프리셋 recommendedCast 무시 (전 프리셋 영향)
2. 나레이션 TTS 크레딧 체크 없음
3. StoryboardPage 제목 하드코딩
4. PresetInfoModal에서 selectedPreset null 초기화

**P1 (중간):**
5. TTS 크레딧 타입 불일치 ('script' vs 'tts')
6. selectedStyle 대소문자 불일치

### 권장사항

**즉시 수정 필요:**
- A: PresetInfoModal에서 selectedPreset null 초기화 제거 또는 재설정
- B: handleAiAnalysis에서 preset.recommendedCast 참조
- C3: handleNarrativeTTS에 크레딧 체크 추가
- E: StoryboardPage 제목을 store.title 사용으로 변경

**다음 우선순위:**
- C1, C2: TTS 크레딧 타입 정정
- D: selectedStyle 대소문자 정규화

