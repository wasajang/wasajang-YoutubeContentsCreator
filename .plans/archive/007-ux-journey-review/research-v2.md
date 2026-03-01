# 007 UX 여정 + AI 프롬프트 파이프라인 정밀 리서치 (v2)

> 작성: CTO 일론 | 2026-02-28
> v1 대비 추가: **AI 워크플로우 전 단계 프롬프트 추적**, **프리셋-프롬프트 연결 구조 분석**

---

## 핵심 인사이트 (CEO 피드백 반영)

CEO의 핵심 지적:
> "4가지 진입점은 순서만 다를 뿐, 결국 같은 파이프라인을 거친다.
> 각 스텝에서 AI가 뭘 하는지(프롬프트)가 빠져있고, 이걸 프리셋으로 관리해서
> 나중에 GEMS처럼 판매해야 한다."

**발견:** 현재 프리셋에 `promptPrefix.image/video/script`가 정의되어 있지만,
**6개 AI 터치포인트 중 0개**에 연결되어 있음. 완전한 Dead Data.

---

## 1. 완전한 AI 파이프라인 맵

영상 1개를 만들기까지 AI가 개입하는 **모든 지점**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Content Creation Pipeline                │
├──────────┬──────────────────────┬───────────┬──────────────┤
│  Step    │  AI 작업             │ 프롬프트  │ 프리셋 연결   │
├──────────┼──────────────────────┼───────────┼──────────────┤
│ ① 대본   │ LLM 대본 생성        │ system +  │ ❌ 미연결     │
│  생성    │ (ai-llm.ts)          │ user      │ script 무시   │
├──────────┼──────────────────────┼───────────┼──────────────┤
│ ② 대본   │ LLM 캐릭터/장소 추출 │ (없음)    │ ❌ Mock만     │
│  분석    │ StoryboardPage mock  │           │ setTimeout   │
├──────────┼──────────────────────┼───────────┼──────────────┤
│ ③ 이미지 │ 씬별 이미지 생성     │ prefix +  │ ❌ 미연결     │
│  생성    │ (ai-image.ts)        │ scene     │ image 무시    │
├──────────┼──────────────────────┼───────────┼──────────────┤
│ ④ 영상   │ 이미지→영상 변환     │ prefix +  │ ❌ 미연결     │
│  생성    │ (ai-video.ts)        │ scene     │ video 무시    │
├──────────┼──────────────────────┼───────────┼──────────────┤
│ ⑤ TTS   │ 텍스트→음성 변환     │ text only │ ❌ voice 설정 │
│  생성    │ (ai-tts.ts)          │           │ 없음          │
├──────────┼──────────────────────┼───────────┼──────────────┤
│ ⑥ 카드   │ 캐스트 에셋 이미지   │ raw desc  │ ❌ 스타일     │
│  생성    │ (ai-image.ts 재사용)  │ only      │ 미적용        │
└──────────┴──────────────────────┴───────────┴──────────────┘
```

---

## 2. 각 AI 스텝 상세 분석

### ① 대본 생성 (ai-llm.ts)

**호출 위치:** `IdeaPage.tsx:127-164`
```typescript
const result = await generateScript({
    idea: ideaText,
    sceneCount,
    style: selectedStyle,         // artStyle 이름 (예: 'Cinematic')
    model: aiModelPreferences.script,
});
```

**현재 System Prompt:** (`ai-llm.ts:237-254`)
```
당신은 YouTube 영상 시나리오 작가입니다.
사용자의 아이디어를 기반으로 시네마틱 영상 대본을 작성합니다.
규칙:
- 정확히 N개의 씬으로 나누어 작성
- 아트 스타일: ${req.style}
```

**문제:**
- 프리셋의 `promptPrefix.script`가 **전혀 반영 안 됨**
  - 예: `"당신은 무협 소설가입니다. 강호의 전설을 나레이션 형식으로..."` ← Dead
- 나레이션형/시네마틱형 구분 없이 동일 프롬프트 사용
- 장르(`genre`)는 `ScriptGenerationRequest`에 정의만 되어있고 UI에서 전달 안 함
- `mode` 전달 안 함 → 나레이션형인데 "시네마틱 대본"이라고 지시

**이상적 구조:**
```
system prompt = 기본 틀 + preset.promptPrefix.script + 모드별 지시
→ 프리셋이 "당신은 무협 소설가입니다" → LLM이 무협 스타일 대본 생성
→ 프리셋이 "해골 캐릭터 나레이터입니다" → LLM이 코미디 공포 대본 생성
```

---

### ② 대본 분석 (현재: Mock)

**호출 위치:** `StoryboardPage.tsx:46-99`
```typescript
// FAKE: setTimeout 2.5초 + cardLibrary에서 앞에서부터 슬라이싱
setTimeout(() => {
    const libChars = cardLibrary.filter(c => c.type === 'character').slice(0, 3);
    // ...
}, 2500);
```

**현재 상태:** AI 호출 **없음**. 순수 mock.

**이상적 구조:**
```
LLM에게 대본 전체 전달 → 등장인물, 장소, 소품 추출
→ 기존 cardLibrary와 매칭
→ 새로운 캐릭터 자동 생성 제안
```

**프리셋 연결:** 프리셋에 분석 지시 프롬프트 추가 가능
- 예: 무협지 프리셋 → "내공, 무공, 문파 등 무협 용어를 캐릭터 속성으로 추출"

---

### ③ 이미지 생성

**프롬프트 조립:** `prompt-builder.ts:31-72`
```typescript
// 현재 체인:
[stylePromptPrefix[ctx.style]]    // mockData.ts에서 가져옴 (artStyle 기반)
+ [scene.text OR mockScenePrompts] // 씬 대본 또는 하드코딩된 mock 프롬프트
+ [camera angle]
+ [location]
+ [seed card descriptions]
```

**문제:**
1. `stylePromptPrefix`는 artStyle 이름(대문자 "Cinematic")으로 조회
   - 프리셋이 `selectedStyle: 'cinematic'`(소문자) 설정 → **undefined** → 기본 Cinematic 폴백
2. 프리셋의 `promptPrefix.image`가 사용 안 됨
   - 무협지 프리셋: `"wuxia, martial arts, ancient chinese fantasy, dramatic pose..."` ← Dead
3. `negativePrompt` 함수가 정의되어 있지만 어디에서도 호출 안 함
4. `aspectRatio`가 `generateImage()`에 전달 안 됨

**호출 위치:** `useGeneration.ts:67-95`
```typescript
const prompt = buildImagePrompt({
    style: selectedStyle,
    sceneText: scene.text,
    seedCards,
    customImagePrompt: mockScenePrompts[sceneId]?.imagePrompt, // mock 우선!
    cameraAngle: scene.cameraAngle,
    location: scene.location,
});
await generateImage({ prompt, seed: seedCards[0]?.seed, model: imageModel });
// ← width/height 미전달!
```

---

### ④ 영상 생성

**시네마틱 모드:** `useGeneration.ts:108-139`
```typescript
const prompt = buildVideoPrompt({
    style: selectedStyle,
    sceneText: scene.text,
    seedCards,
    cameraAngle: scene.cameraAngle,
});
await generateVideo({ imageUrl, prompt, duration: 5, sceneId, model: videoModel });
```

**나레이션 모드:** `NarrationVideoStep.tsx:99-105`
```typescript
await generateVideo({
    imageUrl: clip.imageUrl,
    prompt: clip.text,          // ← buildVideoPrompt 미사용! Raw 텍스트 직접 전달!
    duration: Math.min(6, Math.ceil(clip.duration)),
    sceneId: clip.sceneId,
    model: aiModelPreferences.video,
});
```

**문제:**
1. 나레이션 모드에서 `buildVideoPrompt()` 스킵 → 스타일 prefix 없음
2. 프리셋 `promptPrefix.video` 미사용
3. 시네마틱 모드에서도 프리셋 video prefix 미사용 (artStyle prefix만 사용)

---

### ⑤ TTS 생성

**시네마틱:** `TimelinePage.tsx:276-306`
```typescript
await generateTTS({ text: clip.text, clipId: clip.id, model: aiModelPreferences.tts });
```

**나레이션:** `NarrationVoiceStep.tsx:42-86`
```typescript
await generateTTS({ text: fullScript, clipId: 'narrative', model: aiModelPreferences.tts });
```

**문제:**
- `voiceId` 미전달 → Fish Speech의 화자 선택 불가
- `speed` 미전달 → 읽기 속도 조절 불가
- 프리셋에 TTS 관련 설정(voiceId, speed, tone) 필드 자체가 없음
- 해골 쇼츠: 해골 캐릭터 목소리가 필요하지만 voice 설정 수단 없음

---

### ⑥ 카드(캐스트) 이미지 생성

**CastPage:** `CastPage.tsx:76-109`
```typescript
await generateImage({ prompt: genPrompt }); // raw 사용자 입력, 스타일 적용 없음
```

**useDeck:** `useDeck.ts:85-103`
```typescript
await generateImage({
    prompt: `${card.description}, high quality portrait`,
    seed: card.seed,
});
```

**문제:** 프로젝트 스타일(cinematic, anime 등)이 카드 이미지에 반영 안 됨

---

## 3. 프리셋이 "실제로" 하는 것 vs "해야 하는" 것

### 현재: "적용" 버튼 클릭 시 (`PresetInfoModal.tsx:36-44`)

```typescript
setSelectedStyle(preset.style);           // artStyle 설정 ✅
setAspectRatio(preset.aspectRatio);       // 비율 설정 ✅
setAiModelPreference('script', ...);      // 모델 ID들 설정 ✅
setAiModelPreference('image', ...);
setAiModelPreference('video', ...);
setAiModelPreference('tts', ...);
```

→ **설정되는 것:** artStyle, aspectRatio, 모델 4종
→ **설정 안 되는 것:** promptPrefix 3종 (image, video, script), voice 설정

### 프리셋이 커버해야 할 전체 범위:

| 카테고리 | 현재 | 필요 |
|---------|------|------|
| 워크플로우 모드 | ✅ mode | ✅ |
| 비주얼 스타일 | ✅ artStyle | ✅ |
| 이미지 비율 | ✅ aspectRatio | ✅ |
| AI 모델 선택 | ✅ 4종 | ✅ |
| 대본 생성 지시 | ❌ | promptPrefix.script → system prompt |
| 이미지 프롬프트 접두사 | ❌ | promptPrefix.image → buildImagePrompt |
| 영상 프롬프트 접두사 | ❌ | promptPrefix.video → buildVideoPrompt |
| 대본 분석 지시 | ❌ | (신규) promptPrefix.analysis |
| TTS 화자 ID | ❌ | (신규) voiceId |
| TTS 속도/톤 | ❌ | (신규) voiceSpeed, voiceTone |
| 네거티브 프롬프트 | ❌ | (신규) negativePrompt |
| 카메라 기본값 | ❌ | (신규) defaultCameraAngle |

---

## 4. 설정의 3가지 레이어 (CEO 요청)

### Layer 1: 고정값 (하드코딩)
변하지 않는 시스템 기본값:
- 씬 JSON 출력 형식
- 카메라 앵글 선택지 목록
- 네거티브 프롬프트 기본값
- 크레딧 비용 테이블

### Layer 2: 유저 선택에 따라 자동 관리
유저가 UI에서 선택하면 store에 저장되고 이후 AI 호출에 자동 반영:
- artStyle (`selectedStyle`) → 이미지/영상 프롬프트 prefix 자동 결정
- aspectRatio → 이미지 크기 자동 결정
- 모델 선택 (`aiModelPreferences`) → 어떤 AI 엔진 사용할지
- 프리셋 선택 → 위 설정들을 한번에 세팅

### Layer 3: 프리셋 프롬프트 (LLM 지시)
**프리셋의 핵심 가치 — 이것이 미래 GEMS 상품**:
- `promptPrefix.script`: "당신은 무협 소설가입니다..." → 대본 스타일 결정
- `promptPrefix.image`: "wuxia, martial arts, dramatic pose..." → 비주얼 톤 결정
- `promptPrefix.video`: "wuxia action, slow motion martial arts..." → 모션 톤 결정
- `promptPrefix.analysis`: (신규) 대본 분석 시 추출할 요소 지시
- `voiceConfig`: (신규) TTS 화자/속도 설정

**이 Layer 3이 현재 100% 비어있음 (Dead Data)**

---

## 5. 4가지 진입점 수렴 분석

### 진입점별 "선택 순서"만 다름

```
                    ┌──── 대본 입력 ────┐
대본부터    → 모드 → │                  │
                    │  IdeaPage        │
스타일부터  → 프리셋 → 모드/스타일 자동  → │  (Script/Style)   │
                    │                  │
캐스트부터  → 카드 → 프리셋 → 모드 자동 → │                  │
                    │                  │
템플릿      → 모드 → 제목/장르 자동    → │                  │
                    └────────┬─────────┘
                             ↓
                    ┌────────────────────┐
                    │  Storyboard        │
                    │  (분석/카드/생성)    │
                    └────────┬───────────┘
                             ↓
                    ┌────────────────────┐
                    │  Timeline          │
                    │  (TTS/편집/Export)  │
                    └────────────────────┘
```

**핵심:** 어떤 진입점이든 IdeaPage 도달 시점에 아래 설정이 확정되어야 함:
1. `mode` (cinematic / narration) ← 워크플로우 분기
2. `selectedPreset` ← 프롬프트 프리셋 ID
3. `selectedStyle` ← artStyle (비주얼 스타일)
4. `aspectRatio` ← 이미지/영상 비율
5. `selectedDeck` ← 선택된 캐스트 카드 (캐스트부터만)
6. `title` ← 프로젝트 제목

### 진입점별 현재 설정 상태

| 설정 | 대본부터 | 스타일부터 | 캐스트부터 | 템플릿 |
|------|---------|-----------|-----------|--------|
| mode | ✅ 선택 | ✅ 자동 | ✅ 자동 | ✅ 선택 |
| preset | ❌ null | ✅ 선택 | ✅ 선택 | ❌ null |
| style | 기본값 | ✅ 자동 | ✅ 자동 | 기본값 |
| ratio | 기본값 | ✅ 자동 | ✅ 자동 | 기본값 |
| deck | 빈배열 | 빈배열 | ⚠️ 버그 | 빈배열 |
| title | 'Untitled' | 프리셋명 | 프리셋명 | ❌ 미저장 |

→ "대본부터"와 "템플릿"에서는 프리셋 미선택 → IdeaPage에서 선택 유도 필요

---

## 6. "프리셋 = GEMS 상품" 관점에서의 설계

### 프리셋이 판매 가능하려면 포함해야 하는 것:

```typescript
interface StylePreset {
    // ── 기본 메타 ──
    id: string;
    name: string;
    description: string;
    thumbnail: string;
    category: string;

    // ── 워크플로우 설정 ──
    mode: 'cinematic' | 'narration';
    aspectRatio: '16:9' | '9:16' | '1:1';
    style: string;                    // artStyle 매핑

    // ── AI 프롬프트 (핵심 상품 가치) ──
    prompts: {
        script: string;              // 대본 생성 LLM 시스템 프롬프트
        analysis: string;            // 대본 분석 LLM 프롬프트 (캐릭터/장소 추출)
        imagePrefix: string;         // 이미지 생성 프롬프트 접두사
        videoPrefix: string;         // 영상 생성 프롬프트 접두사
        negativePrompt: string;      // 이미지 네거티브 프롬프트
    };

    // ── TTS/보이스 설정 ──
    voice: {
        voiceId?: string;            // 기본 화자 ID
        speed?: number;              // 읽기 속도
    };

    // ── AI 모델 추천 ──
    defaultModels: {
        script: string;
        image: string;
        video: string;
        tts: string;
    };

    // ── 캐스트 추천 ──
    recommendedCast: {
        characters: number;
        backgrounds: number;
        items: number;
    };

    // ── UGC/마켓 메타 ──
    visibility: 'public' | 'soon' | 'hidden';
    authorId?: string;               // UGC 시 작성자
    price?: number;                  // 마켓 판매가 (크레딧)
}
```

### 프리셋 → AI 호출 연결 맵

```
프리셋 선택
  ↓
  ├→ prompts.script ──→ ai-llm.ts buildSystemPrompt() 주입
  ├→ prompts.analysis ─→ (신규) 대본 분석 LLM 호출
  ├→ prompts.imagePrefix → prompt-builder.ts buildImagePrompt() prefix
  ├→ prompts.videoPrefix → prompt-builder.ts buildVideoPrompt() prefix
  ├→ prompts.negativePrompt → generateImage() negativePrompt 파라미터
  ├→ voice.voiceId ────→ generateTTS() voiceId 파라미터
  ├→ voice.speed ──────→ generateTTS() speed 파라미터
  ├→ defaultModels ────→ aiModelPreferences (이미 구현됨 ✅)
  ├→ mode ─────────────→ 워크플로우 분기 (이미 구현됨 ✅)
  ├→ aspectRatio ──────→ 이미지 크기 (이미 저장됨, 전달 미구현)
  └→ style ────────────→ artStyle 기본 선택 (이미 구현됨 ✅)
```

---

## 7. 설정이 AI에 도달하는 현재 vs 이상적 경로

### 이미지 생성 흐름

**현재:**
```
유저 선택 → store.selectedStyle ('cinematic')
→ prompt-builder → stylePromptPrefix['cinematic'] → undefined!
→ 폴백: stylePromptPrefix['Cinematic'] → 프롬프트 적용
→ mockScenePrompts[sceneId] 있으면 → 씬 텍스트 무시, 하드코딩 프롬프트 사용
→ generateImage({ prompt }) → width/height 미전달
```

**이상적:**
```
유저 선택 → store.selectedPreset → presetId로 프리셋 조회
→ prompt-builder:
  1. preset.prompts.imagePrefix (프리셋 이미지 접두사) [우선]
  2. 없으면 → stylePromptPrefix[style] (artStyle 접두사) [폴백]
  3. + scene.text (AI가 생성한 씬 대본)
  4. + camera, location, seed cards
  5. + preset.prompts.negativePrompt
→ generateImage({ prompt, negativePrompt, width, height })
```

### 대본 생성 흐름

**현재:**
```
유저 입력 → generateScript({ idea, style, sceneCount, model })
→ buildSystemPrompt: 고정된 "시네마틱 작가" 역할
→ style은 한 줄짜리 "아트 스타일: Cinematic" 추가만
```

**이상적:**
```
유저 입력 → generateScript({ idea, style, sceneCount, model, presetId })
→ buildSystemPrompt:
  1. 기본 틀 (JSON 출력 형식 등)
  2. + preset.prompts.script ("당신은 무협 소설가입니다...")
  3. + mode에 따른 추가 지시 (나레이션형 → "나레이션 형식으로 작성")
  4. + scene 수, 길이 등 기본 규칙
```

---

## 8. 발견 문제 전체 정리 (v1 + v2 통합)

### P0 — 데이터 유실 / 기능 미작동
| # | 문제 | 영향 |
|---|------|------|
| 1 | 프리셋 promptPrefix 6곳 모두 미연결 | AI 생성물 품질 = 프리셋 무관 |
| 2 | Cast selectedDeck 리셋 | 캐스트부터 플로우 완전 고장 |
| 3 | 스타일 대소문자 불일치 | 이미지 프롬프트 prefix undefined |
| 4 | 템플릿 데이터 미캡처 | 템플릿 진입점 무의미 |

### P1 — AI 품질 / UX
| # | 문제 | 영향 |
|---|------|------|
| 5 | 나레이션 모드 영상 프롬프트 raw | 영상 품질 저하 (스타일 없음) |
| 6 | 대본 분석 Mock (AI 없음) | 캐릭터 추출 부정확 |
| 7 | 크레딧 부족 복구 경로 없음 | UX 단절 |
| 8 | aspectRatio 이미지에 미반영 | 비율 설정 무의미 |
| 9 | negativePrompt 미사용 | 이미지 품질 저하 |
| 10 | TTS voiceId/speed 미전달 | 목소리 선택 불가 |
| 11 | 카드 이미지 스타일 미적용 | 비주얼 불일치 |

### P2 — 구조 개선
| # | 문제 | 영향 |
|---|------|------|
| 12 | IdeaPage STYLE 탭 혼란 | 프리셋 vs artStyle 이중 UI |
| 13 | CastPage 모드 구분 없음 | 관리/프로젝트 모드 혼재 |
| 14 | 프로젝트 로드 시 mode 유실 | DB 스키마 부재 |
| 15 | mockScenePrompts 하드코딩 | 실 사용 시 제거 필요 |
