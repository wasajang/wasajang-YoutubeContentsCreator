# 004-2 AI 파이프라인 완성 — 리서치

> 작성: 2026-03-06 | CTO 일론
> 대상: 대본 분석 → 카드 추천 + 씬별 씨드 카드 자동 매칭

---

## 1. 현재 상태 요약

### AI 파이프라인 전체 흐름

| 단계 | 기능 | 현재 상태 | 문제점 |
|------|------|----------|--------|
| 1 | 대본 생성 | **실제 AI** (Gemini 2.5 Flash) | 정상 |
| **2** | **대본 분석 → 카드 추천** | **가짜** (hardcoded) | `setTimeout(2500)` + 고정 데이터 |
| **3** | **씬별 씨드 카드 매칭** | **랜덤** (Math.random) | 대본 내용 무시, 무작위 배정 |
| 4 | 이미지 프롬프트 생성 | 정상 (결정론적 코드) | — |
| 5 | 이미지 생성 | **실제 AI** (Gemini Flash Image) | 정상 |
| 6 | 영상 생성 | **실제 AI** (AnimateDiff) | 정상 |
| 7 | TTS 음성 생성 | **실제 AI** (Gemini TTS + Edge TTS) | 정상 |

**결론:** 단계 2, 3이 가짜/랜덤 → 진짜 AI로 교체 필요

---

## 2. 빈 곳 #1: 대본 분석 → 카드 추천 (StoryboardPage)

### 현재 코드 (가짜)

**파일:** `src/pages/StoryboardPage.tsx` (lines 67-128)

```
handleAiAnalysis(doAnalysis: boolean)
├── doAnalysis=false: aiSuggestedCards에서 N개 슬라이스 (고정 데이터)
└── doAnalysis=true:
    ├── setTimeout(2500) — 가짜 딜레이
    ├── cardLibrary에서 타입별 앞에서 N개 선택
    ├── 부족하면 aiSuggestedCards에서 보충
    └── 대본(script) 내용 전혀 분석하지 않음
```

### 데이터 구조

**카드(AssetCard):**
```typescript
interface AssetCard {
  id: string;
  name: string;
  type: 'character' | 'background' | 'item';
  description: string;  // ← AI 프롬프트에 주입되는 핵심 필드
  imageUrl: string;
  seed: number;
  status: 'pending' | 'generating' | 'done' | 'failed';
  isRequired?: boolean;
  source?: 'ai' | 'manual' | 'template';
}
```

**현재 하드코딩 카드 풀:**
- `mockCardLibrary`: 8장 (한국전쟁 테마 고정)
- `aiSuggestedCards`: 5장 (한국전쟁 테마 고정)
- `favoritesPool`: 9장

**템플릿 캐스트 프리셋:**
```typescript
interface TemplateCastPreset {
  characters: TemplateCastCard[];  // 캐릭터 N명 사전 정의
  backgrounds: TemplateCastCard[]; // 배경 N개
  items: TemplateCastCard[];       // 아이템 N개
}
```

### 필요한 변화

1. **대본 전체를 LLM에 보내서 캐릭터/배경/아이템 추출**
2. **기존 cardLibrary와 비교 → 매칭되는 카드 추천**
3. **매칭 안 되는 것 → 새 카드 자동 생성 (이름+설명)**
4. **사용자에게 추천 결과 보여주고 수정 가능**

---

## 3. 빈 곳 #2: 씬별 씨드 카드 자동 매칭 (useGenerationPrompts)

### 현재 코드 (랜덤)

**파일:** `src/hooks/useGenerationPrompts.ts` (lines 101-178)

```
initPrompts() → assignRandom()
├── 캐릭터: 1~2명 랜덤 셔플 → 앞에서 자름
├── 배경: 1개 랜덤 선택
├── 아이템: 60% 확률로 1개 랜덤 선택
└── 대본 내용(scene.text) 전혀 참조하지 않음
```

### 데이터 흐름

```
sceneSeeds: Record<string, string[]>
├── "scene-1": ["char-a", "bg-x"]
├── "scene-2": ["char-b", "bg-y", "item-1"]
└── "scene-1-0", "scene-1-1": 서브씬별 별도 매칭
```

씨드가 배정되면 → `buildImagePrompt()`에서 카드의 `.description`이 프롬프트에 삽입됨.

### 필요한 변화

1. **각 씬의 텍스트를 분석해서 등장 캐릭터/배경/아이템 식별**
2. **덱(deck)의 카드 중 해당 씬에 등장하는 것만 매칭**
3. **서브씬(scene-N-0, scene-N-1)은 부모 씬 매칭 상속**
4. **사용자가 수동으로 변경 가능 (기존 토글 UI 유지)**

---

## 4. 기술 인프라 현황

### Gemini LLM 호출 패턴 (이미 작동 중)

```typescript
// 구조화된 JSON 응답 지원
generationConfig: {
  temperature: 0.3,
  maxOutputTokens: 2000,
  responseMimeType: 'application/json',  // ← JSON 강제 출력
}
```

### BYOK + 쿼터 시스템 (이미 작동 중)

- `getGeminiApiKey()`: Settings → .env 폴백
- `consumeQuota('llm')`: 세션당 5회 제한 → 초과 시 Mock

### 재사용 가능한 패턴들

| 패턴 | 파일 | 용도 |
|------|------|------|
| Gemini JSON 호출 | `ai-llm.ts` geminiProvider | 구조화된 응답 받기 |
| 429 재시도 | `ai-image.ts` geminiProvider | Rate limit 대응 |
| BYOK 키 획득 | `ai-llm.ts` getGeminiApiKey() | API 키 우선순위 |
| 쿼터 체크 | `ai-quota.ts` consumeQuota() | 비용 안전장치 |

---

## 5. 구현 접근법 비교

### 옵션 A: 2단계 LLM 호출 (분석 1회 + 매칭 1회)

```
1회: 대본 전체 → "캐릭터/배경/아이템 추출" (분석)
2회: 추출 결과 + 씬 텍스트 + 덱 → "씬별 매칭" (매칭)
```

- 장점: 각 단계 프롬프트가 짧고 명확
- 단점: LLM 쿼터 2회 소비, 대기 시간 2배

### 옵션 B: 1회 통합 LLM 호출 (추천)

```
1회: 대본 전체 + 기존 카드 목록 + 씬 목록
→ "카드 추천 + 씬별 매칭" 한번에 반환
```

- 장점: 쿼터 1회, 대기 시간 짧음, 맥락 유지
- 단점: 프롬프트가 길어짐 (하지만 Gemini Flash는 100만 토큰 컨텍스트)

### 옵션 C: 대본 생성 시 통합 (추천X)

```
generateScript() 응답에 캐릭터/배경/아이템도 포함
```

- 장점: 추가 호출 없음
- 단점: 기존 대본 생성 프롬프트 복잡해짐, 카드 라이브러리 참조 불가

### **추천: 옵션 B (1회 통합 호출)**

이유:
- Gemini 2.5 Flash는 무료 + 100만 토큰 → 대본 + 카드 목록 충분히 입력 가능
- 쿼터 1회만 소비 (테스트 시 5회 중 1회)
- 한번에 카드 추천 + 씬별 매칭까지 → UX 일관성

---

## 6. LLM 프롬프트 설계 (초안)

### 시스템 프롬프트

```
당신은 영상 제작 AI 어시스턴트입니다.
대본을 분석하여 필요한 시각적 에셋(캐릭터, 배경, 아이템)을 추출하고,
기존 카드 라이브러리와 매칭합니다.

반환 형식 (JSON):
{
  "recommendedCards": [
    {
      "matchedCardId": "기존 카드 ID 또는 null",
      "name": "캐릭터/배경/아이템 이름",
      "type": "character | background | item",
      "description": "영문 시각적 설명 (이미지 프롬프트용)",
      "reason": "추천 이유 (한국어)"
    }
  ],
  "sceneMatching": {
    "scene-1": ["카드ID1", "카드ID2"],
    "scene-2": ["카드ID1", "카드ID3"],
    ...
  }
}
```

### 유저 프롬프트

```
## 대본
{fullScript}

## 씬 목록
{scenes.map(s => `${s.id}: ${s.text}`).join('\n')}

## 기존 카드 라이브러리
{cardLibrary.map(c => `${c.id} [${c.type}] ${c.name}: ${c.description}`).join('\n')}

## 지시사항
1. 대본에서 주요 캐릭터, 배경, 아이템을 추출하세요.
2. 기존 카드 중 매칭되는 것이 있으면 matchedCardId에 ID를 넣으세요.
3. 매칭되는 카드가 없으면 matchedCardId를 null로 하고, 새 카드를 제안하세요.
4. description은 영문으로, 이미지 생성 AI가 사용할 수 있는 구체적 시각 묘사를 작성하세요.
5. 각 씬에 등장하는 카드를 sceneMatching에 매핑하세요.
6. 캐릭터는 최대 5명, 배경 최대 3개, 아이템 최대 3개로 제한하세요.
```

---

## 7. 관련 파일 목록

| 파일 | 역할 | 수정 필요 |
|------|------|----------|
| `src/pages/StoryboardPage.tsx` | handleAiAnalysis 교체 | **핵심** |
| `src/hooks/useGenerationPrompts.ts` | initPrompts의 assignRandom 교체 | **핵심** |
| `src/services/ai-llm.ts` | analyzeScript 함수 추가 | **핵심** |
| `src/store/projectStore.ts` | 카드 라이브러리 + 씬 씨드 상태 | 변경 없음 (기존 구조 활용) |
| `src/services/prompt-builder.ts` | buildImagePrompt/buildVideoPrompt | 변경 없음 |
| `src/hooks/useDeck.ts` | 덱 관리 | 변경 없음 |
| `src/components/storyboard/AiAnalysisModal.tsx` | 분석 중 UI | 소규모 수정 |
| `src/components/storyboard/CastSetupPhase.tsx` | 추천 결과 표시 | 소규모 수정 |
| `src/data/mockData.ts` | Mock 분석 결과 추가 | 추가 |
| `src/services/ai-quota.ts` | 쿼터 관리 | 변경 없음 |
