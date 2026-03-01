# 004 - AI 실 연동 + 듀얼 모드 리서치

> 작성: CTO 일론 | 날짜: 2026-02-28
> 리서치 범위: Gemini API + 현재 AI 서비스 분석 + 듀얼 모드 아키텍처

---

## 1. Gemini API 리서치 요약

### 1.1 사용 가능한 모델

| 모델 | 용도 | 무료 제한 | 엔드포인트 |
|------|------|----------|-----------|
| `gemini-2.5-flash` | 텍스트(대본) 생성 | 250 RPD, 10 RPM | `generateContent` |
| `gemini-2.5-flash` | 이미지 생성 | 10 RPM, ~100회 남음 | `generateContent` (responseModalities: IMAGE) |

### 1.2 공통 엔드포인트

```
POST https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}
```

- 인증: URL 파라미터 `?key=` (프로토타입용, CORS 우회 가능)
- 헤더 인증: `x-goog-api-key` (프로덕션, CORS 문제 있음)

### 1.3 텍스트 생성 요청/응답

```json
// 요청
{
  "contents": [{ "parts": [{ "text": "프롬프트" }] }],
  "systemInstruction": { "parts": [{ "text": "시스템 프롬프트" }] },
  "generationConfig": {
    "temperature": 0.8,
    "maxOutputTokens": 4000,
    "responseMimeType": "application/json"  // JSON 출력 강제 가능
  }
}

// 응답
{
  "candidates": [{
    "content": {
      "parts": [{ "text": "생성된 텍스트" }],
      "role": "model"
    }
  }]
}
```

### 1.4 이미지 생성 요청/응답

```json
// 요청
{
  "contents": [{ "parts": [{ "text": "이미지 프롬프트" }] }],
  "generationConfig": {
    "responseModalities": ["IMAGE"],
    "imageConfig": {
      "aspectRatio": "16:9"   // 14종 지원: 1:1, 16:9, 9:16 등
    }
  }
}

// 응답 — base64 인코딩 PNG (URL 아님!)
{
  "candidates": [{
    "content": {
      "parts": [{
        "inline_data": {
          "mime_type": "image/png",
          "data": "iVBORw0KGgo..."  // base64
        }
      }]
    }
  }]
}
```

사용법: `data:image/png;base64,${data}` → `<img src>`에 바로 사용

### 1.5 CORS 이슈

- `generativelanguage.googleapis.com`은 공식 CORS 미지원
- **`?key=` URL 파라미터 사용 시 simple request로 동작 가능** (프로토타입용)
- 프로덕션에서는 백엔드 프록시 필요 (MVP 이후)
- 현재 Anthropic도 `anthropic-dangerous-direct-browser-access` 헤더로 동일 이슈

### 1.6 Rate Limit

| 모델 | RPM | RPD | 비고 |
|------|-----|-----|------|
| gemini-2.5-flash (텍스트) | 10 | 250 | 안정적 |
| gemini-2.5-flash (이미지) | 10 | ~100 남음 | 제한적 |

→ 개발/테스트 시 Rate Limit 고려 필요 (10 RPM = 6초 간격)

---

## 2. 현재 AI 서비스 코드 분석

### 2.1 Provider 패턴 (공통 구조)

```
┌─ 공개 함수 (generateImage, generateScript 등)
├─ getCurrentProvider() → 환경변수 읽기
├─ Provider 객체 선택 (mock / replicate / openai 등)
└─ Provider.generate(req) → Promise<Result>
```

### 2.2 서비스별 현황

| 서비스 | 파일 | 줄수 | Mock | 실 Provider | Gemini |
|--------|------|------|------|------------|--------|
| 이미지 | `ai-image.ts` | 167 | ✅ Unsplash | Replicate (Flux) | ❌ 없음 |
| 대본 | `ai-llm.ts` | 308 | ✅ 템플릿 | OpenAI + Anthropic | ❌ 없음 |
| 영상 | `ai-video.ts` | 171 | ✅ GCS 샘플 | Runway Gen-3 | N/A |
| TTS | `ai-tts.ts` | 223 | ✅ 무음 WAV | Fish Speech | N/A |
| 프롬프트 | `prompt-builder.ts` | 102 | N/A | 문자열 조합 | N/A |

### 2.3 핵심 인터페이스

```typescript
// ai-image.ts
interface ImageGenerationRequest {
  prompt: string; negativePrompt?: string;
  width?: number; height?: number; seed?: number;
  style?: string; model?: string;
}

// ai-llm.ts
interface ScriptGenerationRequest {
  idea: string; genre?: string; sceneCount?: number;
  targetDuration?: number; style?: string; model?: string;
}

// ai-tts.ts
interface TTSRequest {
  text: string; clipId?: string; voiceId?: string;
  format?: 'mp3' | 'wav' | 'opus'; speed?: number; model?: string;
}
```

### 2.4 환경변수 전환

```bash
VITE_IMAGE_API_PROVIDER=gemini    # ← .env에 이미 설정됨
VITE_LLM_API_PROVIDER=gemini      # ← .env에 이미 설정됨
VITE_GEMINI_API_KEY=AIzaSy...     # ← .env에 저장됨
```

### 2.5 수정 필요 파일

| 파일 | 작업 | 난이도 |
|------|------|--------|
| `ai-llm.ts` | geminiProvider 추가 | 중 |
| `ai-image.ts` | geminiProvider 추가 (base64 처리) | 중 |
| `aiModels.ts` | gemini-image 모델 등록 | 낮 |
| `settingsStore.ts` | ApiProvider에 'google' 추가 | 낮 |

---

## 3. 듀얼 모드 아키텍처 분석

### 3.1 두 모드의 워크플로우

```
【시네마틱 (현재)】
Idea(대본분할) → Storyboard(카드+컷+생성) → Timeline(편집+TTS)

【나레이션 우선 (신규)】
Idea(전체대본) → Timeline(TTS+타이밍) → Storyboard(시간기반 생성) → Timeline(최종편집)
```

### 3.2 공통 부분 (변경 없음)

- AI 서비스 (ai-image, ai-llm, ai-video, ai-tts) — 그대로 사용
- 카드/덱 시스템 (useDeck, cardLibrary)
- 크레딧 시스템 (useCredits)
- CastSetupPhase, SeedCheckPhase
- NavBar, ErrorBoundary, CSS
- Supabase 동기화

### 3.3 모드별로 달라지는 부분

| 영역 | 시네마틱 | 나레이션 |
|------|---------|---------|
| **IdeaPage** | 대본 → 씬 분할 (sceneCount) | 전체 나레이션 (분할 X) |
| **다음 이동** | → StoryboardPage | → TimelinePage (TTS 먼저) |
| **TimelinePage** | TTS는 마지막 추가 | TTS 먼저 → 타이밍 분석 |
| **StoryboardPage** | 수동 컷 분할 | 시간 기반 자동 분할 (5초 단위) |
| **WorkflowSteps** | Idea→Storyboard→Generate→Animate | Idea→Animate→Storyboard→Animate |

### 3.4 Store 확장 (v5)

```typescript
// projectStore.ts에 추가할 필드
mode: 'cinematic' | 'narration';           // 프로젝트 모드
narrativeText: string;                      // 나레이션 전체 텍스트
narrativeAudioUrl: string;                  // TTS 생성된 오디오 URL
audioTimings: AudioTiming[];                // 타이밍 정보

interface AudioTiming {
  wordIndex: number;
  word: string;
  startTime: number;  // 초
  endTime: number;    // 초
}
```

### 3.5 TTS 타이밍 추출 방법

현재 `ai-tts.ts`는 추정 길이만 반환 (`text.length / 4`).
나레이션 모드에서는 정밀 타이밍이 필요:

**방법 A: 텍스트 기반 추정 (MVP용)**
- 한국어 평균 발화 속도 (4자/초) 기반 문장별 시간 계산
- 정확도 낮지만 구현 간단

**방법 B: Gemini로 타이밍 추정**
- TTS 생성 후, Gemini에게 "이 텍스트를 읽으면 각 문장이 몇 초에 시작/끝나는지" 추정 요청
- Gemini의 텍스트 분석 능력 활용

**방법 C: Web Audio API (정확)**
- TTS 오디오 파일을 Web Audio API로 분석
- 음절 경계 감지 (silence detection)
- 구현 복잡도 높음

→ **MVP 추천: 방법 A (텍스트 기반) + 사용자 수동 조정 가능**

---

## 4. 구현 난이도 종합 평가

### Gemini 연동 (ai-llm + ai-image)
- **난이도:** 중간 (기존 Provider 패턴에 추가만 하면 됨)
- **파일 수:** 4~5개
- **핵심 리스크:** CORS, Rate Limit, 이미지 base64 처리

### 듀얼 모드 추가
- **난이도:** 중간 (대부분 분기 로직 추가)
- **파일 수:** 6~7개
- **핵심 리스크:** Store 마이그레이션, 워크플로우 순서 변경, TTS 타이밍

### 총 영향 파일
- 신규: 0~1개 (NarrativePhase 컴포넌트)
- 수정: 약 10개

---

## 5. CTO 리서치 결론

### 실행 가능성: ✅ 가능

CEO 판단이 맞습니다. 나레이션 모드는 "워크플로우 순서 변경 + TTS 타이밍"이 핵심이고,
AI 서비스 자체는 동일하게 재사용됩니다.

### 추천 구현 순서

```
Phase 1: Gemini 연동 (텍스트 + 이미지) — ai-llm.ts, ai-image.ts
Phase 2: Store 확장 v5 (mode, narrativeText, audioTimings)
Phase 3: 모드 선택 UI (HomePage 또는 IdeaPage)
Phase 4: 나레이션 워크플로우 (IdeaPage → TimelinePage → StoryboardPage 분기)
Phase 5: TTS 타이밍 (텍스트 기반 추정 + 수동 조정)
Phase 6: WorkflowSteps 모드별 분기
Phase 7: 검증 + 에러 처리
```

### 위험 요소

1. **CORS 문제** — `?key=` 파라미터로 우회 가능하나, 프로덕션에서는 프록시 필요
2. **이미지 Rate Limit** — 100회만 남음, 테스트 시 아껴 써야 함
3. **TTS 타이밍 정확도** — MVP에서는 텍스트 기반 추정으로 시작
