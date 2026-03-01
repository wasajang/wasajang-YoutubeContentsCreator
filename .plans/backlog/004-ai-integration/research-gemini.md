# 004 - Gemini API 리서치 보고서

> 작성일: 2026-02-28
> 목적: AntiGravity 프로젝트에서 Gemini API를 이미지 생성 + 텍스트 생성에 활용하기 위한 기술 조사

---

## 1. 개요

Google Gemini API는 `generativelanguage.googleapis.com` 도메인을 통해 REST API를 제공한다.
우리 프로젝트에서 사용할 두 가지 모델:

| 용도 | 모델 ID | 별명 | 비고 |
|------|---------|------|------|
| 이미지 생성 | `gemini-2.5-flash-image` | Nano Banana | 이미지+텍스트 입출력 |
| 텍스트 생성 (대본, 프롬프트) | `gemini-2.5-flash` | - | 텍스트 전용, 1M 토큰 컨텍스트 |

> **최신 모델 참고:** 2026년 2월 기준으로 `gemini-3.1-flash-image-preview`, `gemini-3-pro-image-preview` 등 더 새로운 이미지 모델이 Preview로 나와 있으나, 안정 버전은 `gemini-2.5-flash-image`이다.

---

## 2. REST API 엔드포인트

### 기본 URL 패턴

```
POST https://generativelanguage.googleapis.com/v1beta/models/{MODEL_ID}:generateContent
```

### 텍스트 생성 (gemini-2.5-flash)

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
```

### 이미지 생성 (gemini-2.5-flash-image)

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent
```

> **중요:** 이미지 생성도 `generateContent` 엔드포인트를 사용한다. Imagen과 달리 별도의 `generateImages` 엔드포인트가 아님.

---

## 3. 인증 방식

### 방법 1: HTTP 헤더 (권장)

```
x-goog-api-key: YOUR_API_KEY
```

### 방법 2: URL 쿼리 파라미터 (비권장 — 보안 위험)

```
?key=YOUR_API_KEY
```

### 방법 3: OpenAI 호환 엔드포인트 (대안)

```
Authorization: Bearer YOUR_API_KEY
```

URL: `https://generativelanguage.googleapis.com/v1beta/chat/completions`

### API 키 발급

- Google AI Studio (https://aistudio.google.com) 에서 무료 발급
- 신용카드 불필요 (무료 티어)
- 환경변수로 관리: `GEMINI_API_KEY` 또는 `GOOGLE_API_KEY`

---

## 4. 텍스트 생성 (gemini-2.5-flash) — 대본 생성 & 프롬프트 빌더용

### 요청 형식

```bash
curl -s -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{"text": "다음 아이디어로 10개 씬의 영상 대본을 작성해주세요: ..."}]
    }],
    "generationConfig": {
      "temperature": 0.8,
      "maxOutputTokens": 4000
    }
  }'
```

### 요청 구조 상세

```typescript
interface GeminiRequest {
  contents: Array<{
    role?: 'user' | 'model';  // 멀티턴 대화 시 사용
    parts: Array<{
      text?: string;
      // 이미지 입력도 가능
      inline_data?: {
        mime_type: string;
        data: string;  // base64
      };
    }>;
  }>;
  generationConfig?: {
    temperature?: number;        // 0.0~2.0 (기본 1.0)
    topP?: number;               // nucleus sampling
    topK?: number;               // top-k sampling
    maxOutputTokens?: number;    // 최대 출력 토큰
    stopSequences?: string[];    // 정지 시퀀스
    responseMimeType?: string;   // 'application/json' 가능
  };
  systemInstruction?: {          // 시스템 프롬프트
    parts: Array<{ text: string }>;
  };
}
```

### 응답 형식

```typescript
interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text?: string;
      }>;
      role: 'model';
    };
    finishReason: string;  // 'STOP', 'MAX_TOKENS', 'SAFETY', ...
    safetyRatings: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}
```

### 텍스트 추출

```typescript
const text = response.candidates[0].content.parts[0].text;
```

### JSON 출력 강제 (대본 파싱에 유용)

```json
{
  "generationConfig": {
    "responseMimeType": "application/json"
  }
}
```

> `responseMimeType: "application/json"` 설정 시 모델이 순수 JSON만 출력하므로, 우리 프로젝트의 `parseScriptResponse()`에서 마크다운 코드블록 파싱 로직이 필요 없어진다.

---

## 5. 이미지 생성 (gemini-2.5-flash-image) — 씬 이미지 생성용

### 요청 형식

```bash
curl -s -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{"text": "Cinematic, a young Korean soldier in 1950s, snow battlefield, shallow depth of field, 35mm film"}]
    }],
    "generationConfig": {
      "responseModalities": ["IMAGE"],
      "imageConfig": {
        "aspectRatio": "16:9",
        "imageSize": "1K"
      }
    }
  }'
```

### 핵심 파라미터: generationConfig

```typescript
interface ImageGenerationConfig {
  // 출력 모달리티 — 이미지만 원하면 ["IMAGE"], 텍스트+이미지면 ["TEXT", "IMAGE"]
  responseModalities: ('TEXT' | 'IMAGE')[];

  imageConfig?: {
    // 가로세로 비율
    aspectRatio?: '1:1' | '1:4' | '1:8' | '2:3' | '3:2' | '3:4' | '4:1' | '4:3' |
                  '4:5' | '5:4' | '8:1' | '9:16' | '16:9' | '21:9';

    // 이미지 해상도
    imageSize?: '512px' | '1K' | '2K' | '4K';
  };
}
```

### 응답 형식 (이미지)

```typescript
interface GeminiImageResponse {
  candidates: Array<{
    content: {
      parts: Array<
        | { text: string }           // 텍스트 파트
        | { inline_data: {           // 이미지 파트
            mime_type: 'image/png';
            data: string;            // ★ base64 인코딩된 PNG 데이터
          }}
      >;
      role: 'model';
    };
  }>;
}
```

### 이미지 추출 코드 (TypeScript)

```typescript
// 응답에서 이미지 base64 추출
function extractImageFromResponse(response: GeminiImageResponse): string | null {
  for (const part of response.candidates[0].content.parts) {
    if ('inline_data' in part) {
      // data:image/png;base64,{data} 형식으로 변환
      return `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
    }
  }
  return null;
}
```

### 중요 사항

1. **응답은 base64 이미지** — URL이 아니라 base64 인코딩된 PNG 바이너리가 직접 온다
2. **1회 요청 = 1장 이미지** — `numberOfImages` 파라미터 없음
3. **SynthID 워터마크** — 모든 생성 이미지에 보이지 않는 디지털 워터마크 포함
4. **이미지 편집도 가능** — 기존 이미지를 `inline_data`로 보내고 텍스트로 편집 지시 가능
5. **Thinking 미지원** — `gemini-2.5-flash-image`는 thinking/reasoning 기능 미지원

---

## 6. 무료 티어 Rate Limit

### gemini-2.5-flash (텍스트 생성)

| 지표 | 무료 티어 | 유료 Tier 1 |
|------|-----------|-------------|
| RPM (분당 요청) | 10 | 1,000 |
| RPD (일당 요청) | 250 | 무제한 |
| TPM (분당 토큰) | 250,000 | 4,000,000 |

### gemini-2.5-flash-image (이미지 생성)

| 지표 | 무료 티어 | 유료 Tier 1 |
|------|-----------|-------------|
| RPM (분당 요청) | 10 | 300 |
| RPD (일당 요청) | ~20-250 (변동) | 10,000 |
| IPM (분당 이미지) | ⚠️ **0** (차단됨) | 활성화 |

### ⚠️ 핵심 발견: 무료 티어 이미지 생성 제한

> **무료 티어에서 `gemini-2.5-flash-image`의 이미지 생성(IPM)이 0으로 차단되어 있다는 보고가 있다.**
>
> - 2025년 12월 Google이 무료 티어 한도를 50~80% 대폭 축소
> - 이미지 생성은 유료 결제(Billing) 활성화 후 사용 가능
> - 텍스트 생성은 무료 티어에서 정상 동작 (10 RPM, 250 RPD)

### 대안: 유료 결제 시 가격

| 항목 | 비용 |
|------|------|
| 텍스트 입력 | $0.30 / 1M tokens |
| 텍스트 출력 | $2.50 / 1M tokens |
| 이미지 생성 | **$0.039 / 장** (1290 output tokens) |

> 이미지 1장당 약 50원 (환율 1300원 기준). 하루 100장 = 약 5,000원.

### RPD 리셋 시각

- **태평양 시간 자정** (한국 시간 오후 4시 또는 5시) 에 리셋

---

## 7. CORS 이슈 (프론트엔드 직접 호출)

### 현재 상태: CORS 미지원 (공식)

> `generativelanguage.googleapis.com`은 **CORS 헤더를 반환하지 않는다**.
> 브라우저에서 직접 `fetch()` 호출 시 preflight (OPTIONS) 요청이 차단된다.

### 증거

- Google AI Developers Forum에서 다수의 CORS 에러 보고
- 공식적으로 CORS 지원 여부에 대한 Google 응답 없음
- 공식 문서는 서버 사이드(Python, Node.js, Go) 사용만 권장

### 그러나: 실제로 작동하는 경우가 있음

- **API 키를 URL 쿼리 파라미터(`?key=`)로 전달하면** preflight 없이 simple request로 처리되어 CORS 우회 가능할 수 있음
- `@google/genai` SDK의 브라우저 버전이 존재하며, 초기화 코드가 동일하다고 문서에 명시
- Google 공식 문서: "Calling the Gemini API directly from your web app using the Google Gen AI SDK is only for **prototyping** and exploring"

### 우리 프로젝트에서의 접근 방식

**현재:** 백엔드 없는 프론트엔드 프로토타입 단계

**옵션 A: `?key=` URL 파라미터로 직접 호출 (프로토타입용)**
- 장점: 백엔드 불필요, 빠른 구현
- 단점: API 키가 노출됨 (BYOK 사용자의 키)
- 적합: 개발/프로토타입 단계

**옵션 B: `@google/genai` SDK 사용 (프로토타입용)**
- 장점: 타입 지원, 편리한 API
- 단점: 번들 크기 증가, 여전히 키 노출
- 적합: 개발/프로토타입 단계

**옵션 C: 백엔드 프록시 (프로덕션)**
- 장점: API 키 보안, CORS 문제 없음
- 단점: 서버 필요
- 적합: 프로덕션 배포 시

> **추천:** 현재 프로토타입 단계에서는 **옵션 A (직접 REST 호출, `?key=` 파라미터)** 로 빠르게 진행.
> BYOK 패턴이므로 사용자의 키가 사용자 본인의 브라우저에서만 사용됨.
> 프로덕션에서는 옵션 C로 전환 필요.

---

## 8. 에러 처리 & Rate Limit 대응

### 429 (RESOURCE_EXHAUSTED) 에러

```typescript
// 429 응답 헤더
{
  'Retry-After': '30',                // 재시도까지 대기 시간 (초)
  'X-RateLimit-Limit': '10',          // 최대 RPM
  'X-RateLimit-Remaining': '0',       // 남은 요청
  'X-RateLimit-Reset': '1709100000',  // 리셋 시각 (Unix timestamp)
}
```

### Exponential Backoff 구현

```typescript
async function callGeminiWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.status === 429 && attempt < maxRetries) {
        // Retry-After 헤더가 있으면 사용, 없으면 exponential backoff
        const retryAfter = error.headers?.get('Retry-After');
        const delay = retryAfter
          ? parseInt(retryAfter) * 1000
          : baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000; // jitter 추가

        console.warn(`[Gemini] 429 Rate Limit. ${delay}ms 후 재시도 (${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('최대 재시도 횟수 초과');
}
```

### 주요 에러 코드

| HTTP | 의미 | 대응 |
|------|------|------|
| 400 | 잘못된 요청 | 요청 형식 확인 |
| 403 | 인증 실패 / API 미활성화 | API 키 확인 |
| 404 | 모델 없음 | 모델 ID 확인 |
| 429 | Rate Limit 초과 | Exponential Backoff |
| 500 | 서버 오류 | 재시도 |
| 503 | 서비스 과부하 | 재시도 |

---

## 9. 우리 프로젝트 통합 분석

### 현재 코드 구조 (Provider 패턴)

```
src/services/
├── ai-image.ts      — ImageProvider { generate() }  → mock, replicate
├── ai-llm.ts        — LLMProvider { generateScript() }  → mock, openai, anthropic
├── ai-video.ts      — 영상 생성
├── ai-tts.ts        — TTS
└── prompt-builder.ts — 프롬프트 조립
```

### 추가해야 할 것

**1. `ai-image.ts`에 Gemini 이미지 Provider 추가**

```typescript
const geminiImageProvider: ImageProvider = {
  name: 'gemini',
  generate: async (req) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');

    const startTime = Date.now();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: req.prompt }] }],
          generationConfig: {
            responseModalities: ['IMAGE'],
            imageConfig: {
              aspectRatio: req.width && req.height
                ? (req.width > req.height ? '16:9' : req.width < req.height ? '9:16' : '1:1')
                : '16:9',
              imageSize: '1K',
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API 오류: ${response.status} - ${error.error?.message}`);
    }

    const data = await response.json();

    // base64 이미지 추출
    const imagePart = data.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inline_data
    );
    if (!imagePart) throw new Error('이미지 생성 응답에 이미지가 없습니다.');

    const dataUrl = `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;

    return {
      imageUrl: dataUrl,   // ★ base64 data URL
      seed: req.seed ?? Math.floor(Math.random() * 99999),
      provider: 'gemini',
      durationMs: Date.now() - startTime,
    };
  },
};
```

> **주의:** Gemini는 base64 data URL을 반환한다. Replicate는 https URL을 반환.
> `imageUrl` 필드가 data URL도 수용 가능하도록 하위 호환 확인 필요 (`<img src>` 태그는 data URL 지원).

**2. `ai-llm.ts`에 Gemini 텍스트 Provider 추가**

```typescript
const geminiProvider: LLMProvider = {
  name: 'gemini',
  generateScript: async (req) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');

    const start = Date.now();
    const systemPrompt = buildSystemPrompt(req);
    const userPrompt = buildUserPrompt(req);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 4000,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API 에러: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return parseScriptResponse(content, 'gemini', Date.now() - start, req);
  },
};
```

**3. `aiModels.ts` 레지스트리 업데이트**

```typescript
// 기존 항목 수정 + 신규 추가
{ id: 'gemini-2.5-flash',       name: 'Gemini 2.5 Flash',       provider: 'google', category: 'script', creditCost: 0, isDefault: true },
{ id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', provider: 'google', category: 'image',  creditCost: 1 },
```

**4. 환경변수 추가**

```env
VITE_GEMINI_API_KEY=your_key_here
VITE_LLM_API_PROVIDER=gemini       # 또는 mock/openai/anthropic
VITE_IMAGE_API_PROVIDER=gemini     # 또는 mock/replicate
```

---

## 10. 주요 차이점 비교 (기존 Provider vs Gemini)

| 항목 | OpenAI / Replicate | Gemini |
|------|-------------------|--------|
| 인증 | `Authorization: Bearer` 헤더 | `x-goog-api-key` 헤더 또는 `?key=` URL |
| 이미지 응답 | URL (https://) | **base64 inline_data** |
| 이미지 생성 엔드포인트 | 별도 (replicate: /predictions) | `generateContent` 동일 엔드포인트 |
| 시스템 프롬프트 | `messages[0].role='system'` | `systemInstruction` 별도 필드 |
| JSON 출력 | 프롬프트로 지시 | `responseMimeType: 'application/json'` |
| 폴링 필요 | Replicate: Yes (비동기) | **No (동기 응답)** |
| CORS | OpenAI: 지원, Anthropic: 특수 헤더 | **미지원 (공식)**, `?key=` 우회 가능 |
| 무료 티어 | 없음 | **있음** (텍스트: 250 RPD, 이미지: 제한적) |
| 이미지 비용 | DALL-E 3: ~$0.04/장 | $0.039/장 (유사) |

---

## 11. 제약사항 & 리스크

### 이미지 생성 무료 티어 불확실성

- 일부 보고에서 무료 티어의 IPM=0 (이미지 생성 차단)
- Google이 무료 한도를 수시로 변경하는 패턴 (2025년 12월 대폭 축소)
- **결론:** 이미지 생성은 유료 결제 활성화 필요할 가능성 높음

### base64 이미지 크기

- 1K 해상도 PNG → base64로 약 1~3MB
- 많은 이미지를 localStorage에 저장하면 용량 이슈 가능
- 대안: 생성 후 Supabase Storage에 업로드 → URL로 변환

### CORS 리스크

- `?key=` URL 파라미터 방식이 항상 동작한다는 보장 없음
- Google이 정책 변경 시 갑자기 차단될 수 있음
- 장기적으로 백엔드 프록시 (Supabase Edge Function 등) 필요

### Content Safety

- Gemini는 생성 콘텐츠에 안전성 필터를 적용
- 폭력적/선정적 프롬프트는 차단될 수 있음
- `finishReason: 'SAFETY'`로 응답 시 처리 로직 필요

---

## 12. @google/genai SDK (대안 — 참고용)

### 설치

```bash
npm i @google/genai
```

### 텍스트 생성 예시

```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: 'YOUR_KEY' });

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Write a story about a cat.',
});
console.log(response.text);
```

### 이미지 생성 예시 (generateContent 사용)

```typescript
import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: 'YOUR_KEY' });

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash-image',
  contents: 'Generate a cinematic image of a Korean soldier in snow.',
  config: {
    responseModalities: [Modality.IMAGE],
  },
});

// 이미지 추출
for (const part of response.candidates[0].content.parts) {
  if (part.inlineData) {
    const dataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    // img.src = dataUrl;
  }
}
```

### SDK vs REST API 비교

| 항목 | REST API 직접 호출 | @google/genai SDK |
|------|-------------------|-------------------|
| 번들 크기 | 0 (fetch만 사용) | ~50KB+ |
| 타입 안전성 | 직접 정의 | 내장 타입 |
| 브라우저 지원 | `?key=` 방식 | 공식 지원 (프로토타입) |
| 에러 처리 | 직접 구현 | 내장 |
| 우리 프로젝트 | **기존 Provider 패턴과 일관** | 새 패턴 도입 필요 |

> **추천:** 기존 `fetch()` 기반 Provider 패턴을 유지하고 REST API 직접 호출.
> SDK 도입은 번들 크기 증가 + 기존 패턴 불일치로 비추천.

---

## 13. 결론 및 추천

### 즉시 사용 가능한 것

1. **gemini-2.5-flash 텍스트 생성** — 무료 티어 (250 RPD, 10 RPM) 로 대본 생성 + 프롬프트 빌더에 바로 사용 가능
2. 기존 `ai-llm.ts`에 `geminiProvider` 추가하면 됨

### 확인 필요한 것

1. **gemini-2.5-flash-image 이미지 생성** — 무료 티어에서 실제 동작하는지 테스트 필요
2. 동작하지 않으면 유료 결제 활성화 ($0.039/장) 또는 다른 무료 대안 검토
3. CORS 동작 여부 — `?key=` URL 파라미터 방식으로 브라우저에서 테스트 필요

### 구현 우선순위 제안

```
1단계: gemini-2.5-flash 텍스트 Provider 추가 (확실히 무료)
2단계: 브라우저에서 CORS 테스트 (실제 동작 확인)
3단계: gemini-2.5-flash-image 이미지 Provider 추가
4단계: Rate Limit 처리 + 에러 핸들링
5단계: 환경변수 + BYOK 연동
```

---

## 참고 자료

- [Gemini API 공식 문서](https://ai.google.dev/gemini-api/docs)
- [이미지 생성 가이드](https://ai.google.dev/gemini-api/docs/image-generation)
- [Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [API Key 사용법](https://ai.google.dev/gemini-api/docs/api-key)
- [Gemini 2.5 Flash Image 모델 정보](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-image)
- [CORS 이슈 포럼 스레드](https://discuss.ai.google.dev/t/gemini-api-cors-error-with-openai-compatability/58619)
- [Gemini API Free Tier Rate Limits 가이드](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-rate-limits)
- [@google/genai SDK](https://github.com/googleapis/js-genai)
- [Google Developers Blog - Gemini 2.5 Flash Image](https://developers.googleblog.com/introducing-gemini-2-5-flash-image/)
