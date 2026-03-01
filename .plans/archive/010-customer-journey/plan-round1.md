# Round 1: 데이터 정합성 수정 계획

> 작성: CTO 일론 (2026-02-28)
> 근거: customer-journey.md (유나), ux-audit.md (하나), spec-sheet.md (미소)
> 원칙: **추가 기능 없음. 기존 코드의 연결을 바로잡는 것만.**

---

## 수정 항목 6건

### 1. 프리셋 recommendedCast → AI 분석 연결

**파일:** `src/pages/StoryboardPage.tsx` L82~101
**문제:** 하드코딩 `캐릭터3 + 배경1 + 아이템1`로 고정. 프리셋의 `recommendedCast`가 완전히 무시됨.
**영향:** 해골 쇼츠(캐릭터1+배경1)인데 5개 추천, 시네마틱 드라마(캐릭터2+배경2)인데 3+1+1 추천.

**수정 내용:**
```typescript
// 기존 (L82~84): 하드코딩
const selectedChars = libChars.slice(0, 3)...
const selectedBgs = libBgs.slice(0, 1)...
const selectedItems = libItems.slice(0, 1)...

// 수정: 프리셋 recommendedCast 사용
import { getPresetById } from '../data/stylePresets';

const preset = selectedPreset ? getPresetById(selectedPreset) : null;
const castConfig = preset?.recommendedCast ?? { characters: 3, backgrounds: 1, items: 1 };

const selectedChars = libChars.slice(0, castConfig.characters)...
const selectedBgs = libBgs.slice(0, castConfig.backgrounds)...
const selectedItems = libItems.slice(0, castConfig.items)...

// while 루프도 동일하게 변경:
while (selectedChars.length < castConfig.characters && aiCharsPool.length > 0) { ... }
while (selectedBgs.length < castConfig.backgrounds && aiBgsPool.length > 0) { ... }
while (selectedItems.length < castConfig.items && aiItemsPool.length > 0) { ... }
```

**스킵 케이스도 동일 적용 (L63~74):**
```typescript
// 기존: aiSuggestedCards.slice(0, MAX_AI_SLOTS)
// 수정: castConfig 합계만큼만 선택
const totalSlots = castConfig.characters + castConfig.backgrounds + castConfig.items;
const defaultDeck = aiSuggestedCards.slice(0, totalSlots)...
```

---

### 2. selectedPreset null 초기화 버그 수정

**파일:** `src/pages/IdeaPage.tsx` L218~229
**문제:** PresetInfoModal의 onApply/onCustomize/onClose에서 `setSelectedPreset(null)` 호출. 이후 StoryboardPage에서 `selectedPreset`이 null → 프리셋 프롬프트가 전부 미적용.
**영향:** 프리셋으로 진입해도 실질적으로 프리셋이 사용되지 않음 (가장 치명적).

**수정 내용:**
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
    // selectedPreset 유지 — 전체 여정에서 프리셋이 사용되어야 함
}}
onCustomize={() => {
    setShowPresetModal(false);
}}
onClose={() => {
    setShowPresetModal(false);
}}
```

**모달 재표시 방지:** `selectedPreset` useEffect가 모달을 반복 표시하지 않도록 수정
```typescript
// 기존 (L90~94)
useEffect(() => {
    if (selectedPreset) setShowPresetModal(true);
}, [selectedPreset]);

// 수정: 최초 1회만 표시 (이미 본 모달은 다시 안 열림)
const [hasShownPresetModal, setHasShownPresetModal] = useState(false);
useEffect(() => {
    if (selectedPreset && !hasShownPresetModal) {
        setShowPresetModal(true);
        setHasShownPresetModal(true);
    }
}, [selectedPreset, hasShownPresetModal]);
```

---

### 3. selectedStyle 대소문자 통일

**파일:** `src/store/projectStore.ts` L187, L230
**문제:** `startNewProject()`의 기본값은 `selectedStyle: 'Cinematic'`(대문자), 프리셋의 style은 `'cinematic'`(소문자). STYLE 탭에서 현재 선택된 스타일 하이라이트 비교 실패.

**수정 내용:**
```typescript
// projectStore.ts L187 (기본값)
selectedStyle: 'Cinematic',  // ← 유지 (artStyles의 name과 일치)

// projectStore.ts L230 (startNewProject)
selectedStyle: 'Cinematic',  // ← 유지
```

프리셋 진입 시 `setSelectedStyle(preset.style)` → 'cinematic'(소문자)이 설정됨.
이걸 대문자로 정규화:

```typescript
// HomePage.tsx handlePresetSelect 내부 (또는 stylePresets.ts)
// 방법: capitalize 함수로 통일
setSelectedStyle(preset.style.charAt(0).toUpperCase() + preset.style.slice(1));
// 'cinematic' → 'Cinematic'
```

또는 stylePresets.ts에서 style 값을 대문자로 변경:
```typescript
// 5개 프리셋 모두: style: 'cinematic' → style: 'Cinematic'
```

**추천: stylePresets.ts에서 대문자로 통일** (원인에서 수정, 코드 1곳 변경)

---

### 4. TTS 크레딧 타입 수정

**파일:** `src/pages/TimelinePage.tsx`
**문제:** TTS 개별/전체 생성에서 `canAfford('script')`, `spend('script')` 사용. 크레딧 비용은 우연히 같지만(2), 논리적 오류.

**수정 내용:**
```typescript
// TimelinePage handleGenerateTTS 내부
// 기존: canAfford('script', 1) → spend('script')
// 수정: canAfford('tts') → spend('tts')

// TimelinePage handleGenerateAllTTS 내부
// 기존: CREDIT_COSTS.script 기반 비용 계산
// 수정: CREDIT_COSTS.tts 기반 비용 계산
```

---

### 5. 나레이션 전체 TTS 크레딧 체크 추가

**파일:** `src/pages/TimelinePage.tsx` — handleNarrativeTTS 함수
**문제:** 나레이션 모드 전체 TTS 생성에 크레딧 체크가 **완전히 빠져있음**. 무한 사용 가능.

**수정 내용:**
```typescript
// handleNarrativeTTS 함수 상단에 추가
if (!canAfford('tts')) {
    alert(`크레딧이 부족합니다! (TTS ${CREDIT_COSTS.tts} 크레딧 필요, 잔여: ${creditsRemaining})`);
    return;
}
if (!spend('tts')) return;
```

---

### 6. StoryboardPage 제목 하드코딩 수정

**파일:** `src/pages/StoryboardPage.tsx`
**문제:** 헤더 제목이 store의 `title` 대신 "강철의 북진"으로 하드코딩.

**수정 내용:**
```typescript
// 기존
<h2>강철의 북진</h2>

// 수정
const { title, ...rest } = useProjectStore();
<h2>{title || 'Untitled Project'}</h2>
```

---

## 수정하지 않는 것 (Round 2, 3으로 이월)

| 항목 | 이유 |
|------|------|
| Scene에 videoUrl 추가 | Store 구조 변경 + 마이그레이션 필요 (Round 2) |
| sceneGenStatus persist | useGeneration 리팩토링 필요 (Round 2) |
| 일괄 생성 실패 재생성 UI | 새 UI 컴포넌트 필요 (Round 3) |
| Cast 진입점 완성 | 새 페이지 로직 필요 (Round 3) |
| 프리셋 vs 스타일 UI 정리 | UX 설계 변경 필요 (Round 3) |

---

## 수정 파일 목록 (6건)

| # | 파일 | 변경 내용 |
|---|------|-----------|
| 1 | `src/pages/StoryboardPage.tsx` | recommendedCast 연결 + 제목 하드코딩 수정 |
| 2 | `src/pages/IdeaPage.tsx` | selectedPreset null 초기화 제거 + 모달 재표시 방지 |
| 3 | `src/data/stylePresets.ts` | 5개 프리셋 style 값 대문자로 통일 |
| 4 | `src/pages/TimelinePage.tsx` | TTS 크레딧 타입 수정 + 나레이션 TTS 크레딧 체크 추가 |

---

## 검증 체크리스트

1. `npm run build` — 빌드 성공
2. 프리셋(시네마틱 드라마) 선택 → IdeaPage → StoryboardPage:
   - AI 분석 시 캐릭터 2 + 배경 2 추천되는지 확인
   - 스킵 시에도 4개(2+2+0)만 덱에 추가되는지 확인
3. 프리셋(해골 쇼츠) 선택 → StoryboardPage:
   - AI 분석 시 캐릭터 1 + 배경 1 추천되는지 확인
4. IdeaPage STYLE 탭: 프리셋 선택 후 현재 스타일이 하이라이트되는지 확인
5. StoryboardPage: 이미지 생성 프롬프트에 프리셋 imagePrefix가 적용되는지 (console.log 확인)
6. TimelinePage: TTS 생성 시 'tts' 크레딧으로 차감되는지 확인
7. StoryboardPage 제목이 프로젝트명으로 표시되는지 확인
