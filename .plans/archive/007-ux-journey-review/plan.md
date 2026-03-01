# 007 UX 여정 + AI 프롬프트 파이프라인 — 구현 계획 (v2.1)

> 작성: CTO 일론 | 2026-02-28
> 기반: `research-v2.md` + CEO 피드백 (프리셋 카드 시각화, UGC 구조)
> 상태: **CEO 검토 대기**

---

## 핵심 목표

1. **프리셋 → AI 파이프라인 연결**: 프리셋의 promptPrefix가 실제 AI 호출에 반영되도록
2. **4진입점 수렴**: 어떤 진입점이든 같은 파이프라인을 거치도록
3. **설정 3레이어 구분**: 고정값 / 유저선택 자동관리 / 프리셋 프롬프트
4. **GEMS 기반 구조**: 프리셋이 미래 마켓플레이스 상품이 될 수 있는 구조
5. **프리셋 카드 시각화**: Admin에서 dev가 각 프리셋의 AI 프롬프트를 한눈에 확인·편집
6. **UGC 프리셋 준비**: 유저 생성 프리셋은 다음 버전, 인터페이스만 확장 가능하게

---

## 전체 구조: 프리셋 → AI 연결 맵

```
StylePreset
  ├→ prompts.script ──────→ ai-llm.ts (대본 생성 시스템 프롬프트)
  ├→ prompts.imagePrefix ─→ prompt-builder.ts (이미지 프롬프트 접두사)
  ├→ prompts.videoPrefix ─→ prompt-builder.ts (영상 프롬프트 접두사)
  ├→ prompts.negativePrompt → generateImage() (네거티브)
  ├→ voice.voiceId ────────→ generateTTS() (화자)
  ├→ defaultModels ────────→ aiModelPreferences (모델 선택) ← 이미 구현됨
  ├→ mode ─────────────────→ 워크플로우 분기 ← 이미 구현됨
  ├→ aspectRatio ──────────→ 이미지 크기 전달 (width/height)
  └→ style ────────────────→ artStyle 폴백 ← 이미 구현됨
```

---

## Phase 1: 프리셋 데이터 구조 정규화

> 프리셋 필드명 리네이밍 + TTS/네거티브 필드 추가

### 1-1. `src/data/stylePresets.ts` 인터페이스 확장

```typescript
export interface StylePreset {
    id: string;
    name: string;
    category: string;
    description: string;
    thumbnail?: string;
    visibility: 'public' | 'soon' | 'hidden';

    // ── 워크플로우 설정 ──
    mode: 'cinematic' | 'narration';
    style: string;                     // artStyle id 매핑
    aspectRatio: '16:9' | '9:16' | '1:1';

    // ── AI 프롬프트 (핵심) ──
    prompts: {
        script: string;                // 대본 생성 LLM 시스템 프롬프트 추가 지시
        imagePrefix: string;           // 이미지 프롬프트 접두사
        videoPrefix: string;           // 영상 프롬프트 접두사
        negativePrompt?: string;       // 이미지 네거티브 (없으면 기본값)
    };

    // ── TTS 설정 ──
    voice?: {
        voiceId?: string;              // 기본 화자 ID (Fish Speech reference_id)
        speed?: number;                // 읽기 속도 (0.5~2.0)
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
}
```

### 1-2. UGC 확장 준비 (인터페이스만)

현재 MVP: 5개 프리셋은 `stylePresets.ts`에 하드코딩.
다음 버전에서 유저가 프리셋을 생성/판매(GEMS)할 수 있도록 인터페이스에 UGC 필드를 **선언만** 해둠:

```typescript
export interface StylePreset {
    // ...기존 필드...

    // ── UGC 마켓 (v2 — 현재 미사용, 구조만 준비) ──
    authorId?: string;               // 작성자 user ID (공식 = undefined)
    authorName?: string;             // 작성자 표시명
    price?: number;                  // 마켓 판매가 (크레딧, 0 = 무료)
    downloads?: number;              // 다운로드 수
    rating?: number;                 // 평점 (1~5)
    isOfficial?: boolean;            // 공식 프리셋 여부 (기본: true)
}
```

v1에서는 이 필드를 **사용하지 않음**. 다음 버전에서 DB 테이블(`style_presets`)로 이전할 때 활용.

### 1-3. 기존 프리셋 데이터 마이그레이션

기존 `promptPrefix: { image, video, script }` → `prompts: { script, imagePrefix, videoPrefix }` 리네이밍.
기능 변경 없이 필드명만 변경 + `negativePrompt`, `voice` 필드 추가.

```typescript
// 예: 시네마틱 드라마 프리셋
{
    id: 'cinematic-drama',
    name: '시네마틱 드라마',
    // ...기존 필드...
    prompts: {
        script: '당신은 드라마 영화 각본가입니다. 인물의 감정과 갈등에 집중한 씬을 작성하세요.',
        imagePrefix: 'cinematic photography, dramatic, natural lighting, film grain, emotional, award-winning,',
        videoPrefix: 'cinematic, slow motion, handheld camera, emotional score, golden hour,',
        negativePrompt: 'blurry, low quality, cartoon, anime, text, watermark',
    },
    voice: {
        speed: 1.0,
    },
    isOfficial: true,
    // ...
}

// 예: 해골 쇼츠 프리셋
{
    id: 'skeleton-shorts',
    name: '해골 쇼츠',
    // ...
    prompts: {
        script: '당신은 해골 캐릭터입니다. 무섭지만 웃긴 톤으로 짧은 이야기를 나레이션하세요. 30초~1분 분량.',
        imagePrefix: 'skeleton character, dark humor, spooky cute, vertical composition, eerie lighting, fun horror,',
        videoPrefix: 'vertical video, skeleton animation, dark comedy, spooky atmosphere,',
        negativePrompt: 'realistic human, bright cheerful, text, watermark',
    },
    voice: {
        speed: 1.1,  // 쇼츠는 약간 빠르게
    },
    isOfficial: true,
    // ...
}
```

### 1-4. 관련 코드 참조 업데이트

`promptPrefix.image` → `prompts.imagePrefix` 등 참조 변경:
- `PresetInfoModal.tsx` (프리셋 정보 표시)
- `HomePage.tsx` (프리셋 카드 표시)
- `CastPage.tsx` (스타일 선택)

### 수정 파일
- `src/data/stylePresets.ts` — 인터페이스 + 데이터 수정
- `src/components/PresetInfoModal.tsx` — 필드명 참조 업데이트

---

## Phase 1.5: Admin 프리셋 카드 시각화

> dev가 각 프리셋의 AI 프롬프트·설정을 한눈에 확인하고 편집할 수 있는 카드 UI

### 현재 Admin 프리셋 관리 (문제)

```
[썸네일] [이름/카테고리] [공개상태 드롭다운]
```
→ 이름과 visibility만 보임. **프롬프트 내용, 모드, 비율, 모델 등 핵심 정보가 안 보임.**
→ 프롬프트 편집 불가. dev가 코드를 직접 수정해야 함.

### 목표 UI: 프리셋 상세 카드

각 프리셋을 **펼쳐 볼 수 있는 카드**로 표시. 클릭하면 상세 정보가 아코디언으로 열림.

```
┌─────────────────────────────────────────────────────────┐
│ [썸네일]                                                │
│ 시네마틱 드라마         FILM    공개 ▼                    │
│ 시네마틱형 · 16:9 · Cinematic                           │
│                                                         │
│ ▼ AI 프롬프트 (펼치기/접기)                              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📝 대본 지시                                        │ │
│ │ ┌───────────────────────────────────────────────┐   │ │
│ │ │ 당신은 드라마 영화 각본가입니다. 인물의 감정과  │   │ │
│ │ │ 갈등에 집중한 씬을 작성하세요.                  │   │ │
│ │ └───────────────────────────────────────────────┘   │ │
│ │                                                     │ │
│ │ 🖼 이미지 접두사                                    │ │
│ │ ┌───────────────────────────────────────────────┐   │ │
│ │ │ cinematic photography, dramatic, natural      │   │ │
│ │ │ lighting, film grain, emotional, ...          │   │ │
│ │ └───────────────────────────────────────────────┘   │ │
│ │                                                     │ │
│ │ 🎬 영상 접두사                                      │ │
│ │ ┌───────────────────────────────────────────────┐   │ │
│ │ │ cinematic, slow motion, handheld camera, ...  │   │ │
│ │ └───────────────────────────────────────────────┘   │ │
│ │                                                     │ │
│ │ 🚫 네거티브                                        │ │
│ │ ┌───────────────────────────────────────────────┐   │ │
│ │ │ blurry, low quality, cartoon, anime, text     │   │ │
│ │ └───────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ▼ 모델·음성 설정                                        │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 대본: gpt-4o-mini  이미지: flux-schnell             │ │
│ │ 영상: runway-gen3  TTS: fish-speech                 │ │
│ │ 음성 속도: 1.0                                      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ▼ 캐스트 추천                                           │
│ 배우 2명 · 배경 2개 · 소품 0개                           │
│                                                         │
│                              [저장] [리셋]               │
└─────────────────────────────────────────────────────────┘
```

### 구현: AdminPage 프리셋 섹션 전면 개편

**파일:** `src/pages/AdminPage.tsx`

```typescript
// 프리셋별 편집 상태 관리
const [expandedPresetId, setExpandedPresetId] = useState<string | null>(null);
const [editedPrompts, setEditedPrompts] = useState<Record<string, StylePreset['prompts']>>({});

// 각 프리셋 카드
{stylePresets.map((preset) => {
    const isExpanded = expandedPresetId === preset.id;
    const currentPrompts = editedPrompts[preset.id] ?? preset.prompts;

    return (
        <div key={preset.id} className="admin-preset-detail-card">
            {/* ── 카드 헤더 (항상 표시) ── */}
            <div className="admin-preset-detail-card__header"
                 onClick={() => setExpandedPresetId(isExpanded ? null : preset.id)}>
                {preset.thumbnail && (
                    <img src={preset.thumbnail} className="admin-preset-detail-card__thumb" />
                )}
                <div className="admin-preset-detail-card__meta">
                    <span className="admin-preset-detail-card__name">{preset.name}</span>
                    <span className="admin-preset-detail-card__tags">
                        <span className={`admin-preset-tag admin-preset-tag--${preset.mode}`}>
                            {preset.mode === 'cinematic' ? '시네마틱형' : '나레이션형'}
                        </span>
                        <span className="admin-preset-tag">{preset.aspectRatio}</span>
                        <span className="admin-preset-tag">{preset.style}</span>
                    </span>
                </div>
                <select /* visibility 드롭다운 (기존) */ />
                <span className="admin-preset-detail-card__toggle">
                    {isExpanded ? '▲' : '▼'}
                </span>
            </div>

            {/* ── 펼침 영역 (아코디언) ── */}
            {isExpanded && (
                <div className="admin-preset-detail-card__body">
                    {/* AI 프롬프트 섹션 */}
                    <div className="admin-preset-prompts">
                        <h4>AI 프롬프트</h4>

                        <label>📝 대본 생성 지시</label>
                        <textarea
                            className="admin-textarea"
                            rows={3}
                            value={currentPrompts.script}
                            onChange={(e) => setEditedPrompts(prev => ({
                                ...prev,
                                [preset.id]: { ...currentPrompts, script: e.target.value }
                            }))}
                        />

                        <label>🖼 이미지 프롬프트 접두사</label>
                        <textarea
                            className="admin-textarea"
                            rows={2}
                            value={currentPrompts.imagePrefix}
                            onChange={/* 동일 패턴 */}
                        />

                        <label>🎬 영상 프롬프트 접두사</label>
                        <textarea rows={2} value={currentPrompts.videoPrefix} /* ... */ />

                        <label>🚫 네거티브 프롬프트</label>
                        <textarea rows={2} value={currentPrompts.negativePrompt ?? ''} /* ... */ />
                    </div>

                    {/* 모델·음성 설정 */}
                    <div className="admin-preset-models">
                        <h4>모델 · 음성</h4>
                        <div className="admin-preset-models__grid">
                            <span>대본: {preset.defaultModels.script}</span>
                            <span>이미지: {preset.defaultModels.image}</span>
                            <span>영상: {preset.defaultModels.video}</span>
                            <span>TTS: {preset.defaultModels.tts}</span>
                            <span>음성 속도: {preset.voice?.speed ?? 1.0}</span>
                        </div>
                    </div>

                    {/* 캐스트 추천 */}
                    <div className="admin-preset-cast">
                        <h4>추천 캐스트</h4>
                        배우 {preset.recommendedCast.characters}명 ·
                        배경 {preset.recommendedCast.backgrounds}개 ·
                        소품 {preset.recommendedCast.items}개
                    </div>

                    {/* 저장/리셋 */}
                    <div className="admin-preset-detail-card__actions">
                        <button className="btn-secondary" onClick={() => {
                            setEditedPrompts(prev => { const n = {...prev}; delete n[preset.id]; return n; });
                        }}>리셋</button>
                        <button className="btn-primary" onClick={() => handleSavePreset(preset.id)}>
                            저장
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
})}
```

### 참고: "저장" 동작 (MVP)

현재 프리셋은 하드코딩(`stylePresets.ts`)이므로, Admin에서 편집한 내용은:
- **MVP**: `localStorage`에 오버라이드 저장 → 앱 재시작 시에도 유지
- **다음 버전**: DB(`style_presets` 테이블)에 저장 → 유저 생성 프리셋과 통합

```typescript
// 프리셋 오버라이드 저장 (localStorage)
const PRESET_OVERRIDE_KEY = 'antigravity-preset-overrides';

function savePresetOverride(presetId: string, prompts: StylePreset['prompts']) {
    const overrides = JSON.parse(localStorage.getItem(PRESET_OVERRIDE_KEY) || '{}');
    overrides[presetId] = prompts;
    localStorage.setItem(PRESET_OVERRIDE_KEY, JSON.stringify(overrides));
}

// getPresetById 수정: 오버라이드 우선 적용
export function getPresetById(id: string): StylePreset | undefined {
    const base = stylePresets.find(p => p.id === id);
    if (!base) return undefined;
    const overrides = JSON.parse(localStorage.getItem(PRESET_OVERRIDE_KEY) || '{}');
    if (overrides[id]) {
        return { ...base, prompts: { ...base.prompts, ...overrides[id] } };
    }
    return base;
}
```

이렇게 하면:
- dev가 Admin에서 프롬프트를 실시간 수정/테스트 가능
- 코드를 다시 배포하지 않아도 프롬프트 튜닝 가능
- 리셋 버튼으로 하드코딩 원본 복원 가능

### 수정 파일
- `src/pages/AdminPage.tsx` — 프리셋 카드 전면 개편
- `src/data/stylePresets.ts` — getPresetById에 오버라이드 로직
- `src/index.css` — 프리셋 상세 카드 CSS

---

## Phase 2: 프리셋 프롬프트 → AI 서비스 연결

> **핵심 Phase**: 프리셋의 프롬프트가 실제 AI 호출에 주입되는 배관 작업

### 2-1. 대본 생성에 프리셋 script 프롬프트 주입

**파일:** `src/services/ai-llm.ts`

```typescript
// ScriptGenerationRequest에 presetId 추가
export interface ScriptGenerationRequest {
    idea: string;
    genre?: string;
    sceneCount?: number;
    targetDuration?: number;
    style?: string;
    model?: string;
    presetId?: string;        // ← 신규
    mode?: 'cinematic' | 'narration';  // ← 신규
}

// buildSystemPrompt 수정
function buildSystemPrompt(req: ScriptGenerationRequest): string {
    // 프리셋 스크립트 프롬프트 가져오기
    let presetInstruction = '';
    if (req.presetId) {
        const preset = getPresetById(req.presetId);
        if (preset) presetInstruction = preset.prompts.script;
    }

    // 모드별 기본 지시
    const modeInstruction = req.mode === 'narration'
        ? '나레이션 형식으로 작성하세요. 화자가 이야기를 들려주는 톤으로.'
        : '시네마틱 영화 대본 형식으로 작성하세요. 시각적 묘사가 풍부하게.';

    return `당신은 YouTube 영상 시나리오 작가입니다.
${presetInstruction ? presetInstruction + '\n' : ''}
${modeInstruction}

규칙:
- 정확히 ${req.sceneCount || 10}개의 씬으로 나누어 작성
- 각 씬은 JSON 형식의 배열로 출력
- 각 씬에는 text(대본), location(촬영장소), cameraAngle(카메라앵글) 포함
- 카메라 앵글: Wide Angle, Close Up, Medium Shot, Low Angle, Extreme Long Shot, Pan Up, Over The Shoulder 중 선택
- 대본은 한국어로, 생동감 있고 시각적 묘사가 풍부하게 작성
${req.style ? `- 아트 스타일: ${req.style}` : ''}
${req.genre ? `- 장르: ${req.genre}` : ''}

출력 형식 (JSON만 출력, 다른 텍스트 없이):
[
  {"text": "씬 대본...", "location": "장소명", "cameraAngle": "앵글명"},
  ...
]`;
}
```

**호출부 수정:** `IdeaPage.tsx`

```typescript
const result = await generateScript({
    idea: ideaText,
    sceneCount,
    style: selectedStyle,
    model: aiModelPreferences.script,
    presetId: selectedPreset ?? undefined,   // ← 추가
    mode,                                     // ← 추가
});
```

### 2-2. 이미지 프롬프트에 프리셋 imagePrefix 주입

**파일:** `src/services/prompt-builder.ts`

```typescript
import { stylePromptPrefix } from '../data/mockData';
import { getPresetById } from '../data/stylePresets';

export interface PromptContext {
    style: string;
    sceneText: string;
    seedCards: AssetCard[];
    customImagePrompt?: string;
    cameraAngle?: string;
    location?: string;
    presetId?: string;          // ← 신규
}

export function buildImagePrompt(ctx: PromptContext): string {
    const parts: string[] = [];

    // 1. 스타일 prefix (프리셋 우선 → artStyle 폴백)
    let prefix = '';
    if (ctx.presetId) {
        const preset = getPresetById(ctx.presetId);
        if (preset) prefix = preset.prompts.imagePrefix;
    }
    if (!prefix) {
        // 대소문자 정규화: 'cinematic' → 'Cinematic' 으로도 조회
        prefix = stylePromptPrefix[ctx.style]
            || stylePromptPrefix[ctx.style.charAt(0).toUpperCase() + ctx.style.slice(1)]
            || stylePromptPrefix['Cinematic']
            || '';
    }
    if (prefix) parts.push(prefix);

    // 2~4 기존 동일...
    return parts.join('. ').replace(/\.\./g, '.').trim();
}

export function buildVideoPrompt(ctx: PromptContext): string {
    const parts: string[] = [];

    // 프리셋 video prefix 우선
    let prefix = '';
    if (ctx.presetId) {
        const preset = getPresetById(ctx.presetId);
        if (preset) prefix = preset.prompts.videoPrefix;
    }
    if (!prefix) {
        prefix = stylePromptPrefix[ctx.style]
            || stylePromptPrefix[ctx.style.charAt(0).toUpperCase() + ctx.style.slice(1)]
            || '';
    }
    if (prefix) parts.push(prefix);

    // 나머지 동일...
}

// 비율 → 픽셀 변환 유틸
export function aspectRatioToSize(ratio: string): { width: number; height: number } {
    switch (ratio) {
        case '9:16': return { width: 768, height: 1344 };
        case '1:1':  return { width: 1024, height: 1024 };
        case '16:9':
        default:     return { width: 1344, height: 768 };
    }
}

// 네거티브 프롬프트 (프리셋 우선)
export function getNegativePrompt(presetId?: string): string {
    if (presetId) {
        const preset = getPresetById(presetId);
        if (preset?.prompts.negativePrompt) return preset.prompts.negativePrompt;
    }
    return 'blurry, low quality, distorted, deformed, ugly, watermark, text, logo, oversaturated';
}
```

### 2-3. 이미지/영상 생성 호출부에 presetId + aspectRatio 전달

**파일:** `src/hooks/useGeneration.ts`

```typescript
// UseGenerationParams에 추가
interface UseGenerationParams {
    // ...기존...
    presetId?: string;      // ← 추가
    aspectRatio?: string;   // ← 추가
}

// generateSingleScene 수정
const prompt = buildImagePrompt({
    style: selectedStyle,
    sceneText: scene.text,
    seedCards,
    customImagePrompt: mockScenePrompts[sceneId]?.imagePrompt,
    cameraAngle: scene.cameraAngle,
    location: scene.location,
    presetId,                // ← 추가
});

const { width, height } = aspectRatioToSize(aspectRatio || '16:9');
const negPrompt = getNegativePrompt(presetId);

const result = await generateImage({
    prompt,
    seed: seedCards[0]?.seed,
    model: imageModel,
    width,                   // ← 추가
    height,                  // ← 추가
    negativePrompt: negPrompt, // ← 추가
});

// generateSingleVideo 수정
const prompt = buildVideoPrompt({
    style: selectedStyle,
    sceneText: scene.text,
    seedCards,
    cameraAngle: scene.cameraAngle,
    presetId,                // ← 추가
});
```

### 2-4. 나레이션 영상 프롬프트에도 스타일 적용

**파일:** `src/components/narration/NarrationVideoStep.tsx`

```typescript
// 현재: prompt: clip.text (raw)
// 수정: buildVideoPrompt 사용
import { buildVideoPrompt } from '../../services/prompt-builder';

const result = await generateVideo({
    imageUrl: clip.imageUrl,
    prompt: buildVideoPrompt({                    // ← 변경
        style: selectedStyle,
        sceneText: clip.text,
        seedCards: [],
        presetId: selectedPreset ?? undefined,
    }),
    duration: Math.min(6, Math.ceil(clip.duration)),
    sceneId: clip.sceneId,
    model: aiModelPreferences.video,
});
```

### 2-5. TTS에 프리셋 voice 설정 전달

**파일:** `TimelinePage.tsx`, `NarrationVoiceStep.tsx`

```typescript
// 프리셋에서 voice 설정 가져오기
const preset = selectedPreset ? getPresetById(selectedPreset) : null;

const result = await generateTTS({
    text: clip.text,
    clipId: clip.id,
    model: aiModelPreferences.tts,
    voiceId: preset?.voice?.voiceId,     // ← 추가
    speed: preset?.voice?.speed,         // ← 추가
});
```

### 수정 파일
- `src/services/ai-llm.ts` — ScriptGenerationRequest 확장, buildSystemPrompt 수정
- `src/services/prompt-builder.ts` — PromptContext에 presetId, 프리셋 우선 로직
- `src/hooks/useGeneration.ts` — presetId/aspectRatio 전달, 네거티브 프롬프트
- `src/pages/IdeaPage.tsx` — generateScript 호출에 presetId/mode 추가
- `src/components/narration/NarrationVideoStep.tsx` — buildVideoPrompt 사용
- `src/pages/TimelinePage.tsx` — TTS voice 설정 전달
- `src/components/narration/NarrationVoiceStep.tsx` — TTS voice 설정 전달

---

## Phase 3: 진입점 버그 수정

### 3-1. Cast selectedDeck 리셋 버그 (P0 #2)

**파일:** `src/store/projectStore.ts`

```typescript
startNewProject: (title, mode = 'cinematic', options?: { keepDeck?: boolean }) =>
    set((state) => ({
        projectId: null,
        title,
        hasActiveProject: true,
        currentPhase: 1,
        scenes: [],
        selectedStyle: 'Cinematic',
        aspectRatio: '16:9',
        timelineClips: [],
        entryPoint: null,
        selectedPreset: null,
        selectedDeck: options?.keepDeck ? state.selectedDeck : [],
        aiModelPreferences: { ...DEFAULT_AI_MODELS },
        mode,
        narrativeAudioUrl: '',
        sentenceTimings: [],
        narrationClips: [],
        narrationStep: 1,
    })),
```

**파일:** `src/pages/CastPage.tsx`

```typescript
const handlePresetSelect = (preset: StylePreset) => {
    startNewProject(preset.name, preset.mode, { keepDeck: true });
    setEntryPoint('cast');
    // ...나머지 동일
};
```

### 3-2. 템플릿 데이터 캡처 (P0 #4)

**파일:** `src/pages/HomePage.tsx`

```typescript
const [pendingTemplate, setPendingTemplate] = useState<typeof templateCards[0] | null>(null);

const handleTemplateSelect = (template: typeof templateCards[0]) => {
    setPendingTemplate(template);
    setShowModeSelect(true);
};

const handleModeSelect = (mode: ProjectMode) => {
    startNewProject(
        pendingTemplate ? pendingTemplate.title : 'Untitled Project',
        mode
    );
    setEntryPoint('script');
    setShowModeSelect(false);
    setPendingTemplate(null);
    navigate('/project/idea');
};

// 템플릿 카드 onClick 변경
{filteredTemplates.map((t) => (
    <div key={t.id} onClick={() => handleTemplateSelect(t)}>
```

### 3-3. 스타일 대소문자 정규화 (P0 #3)

Phase 2-2에서 `prompt-builder.ts`의 대소문자 정규화로 해결됨.
추가로 `startNewProject`의 기본값도 확인:

```typescript
// projectStore.ts — 이미 'Cinematic' (대문자)으로 설정됨 ✅
selectedStyle: 'Cinematic',
```

프리셋에서 `style: 'cinematic'` (소문자) → `setSelectedStyle(preset.style)` 시 소문자 설정됨.
prompt-builder의 정규화 로직으로 이제 소문자도 정상 조회됨.

### 수정 파일
- `src/store/projectStore.ts` — startNewProject 옵션 추가
- `src/pages/CastPage.tsx` — keepDeck 전달
- `src/pages/HomePage.tsx` — 템플릿 핸들러 분리

---

## Phase 4: 크레딧 부족 복구 모달

### 4-1. CreditShortageModal 컴포넌트 (신규)

```typescript
// src/components/CreditShortageModal.tsx
interface Props {
    isOpen: boolean;
    onClose: () => void;
    requiredCredits: number;
    currentCredits: number;
    actionLabel?: string;  // "이미지 생성", "대본 생성" 등
}
```

- "크레딧이 부족합니다" 메시지
- 필요/현재 크레딧 표시
- "충전 후 돌아오면 작업이 그대로 유지됩니다" 안내
- [크레딧 충전하러 가기] → `navigate('/payment')` (히스토리 유지)
- 뒤로가기로 복귀 시 Zustand persist로 상태 보존

### 4-2. 기존 alert() 9곳 → 모달로 교체

| 위치 | 현재 | 수정 |
|------|------|------|
| `useGeneration.ts:68` | alert 이미지 단건 | 모달 |
| `useGeneration.ts:100` | alert 이미지 일괄 | 모달 |
| `useGeneration.ts:110` | alert 영상 단건 | 모달 |
| `useGeneration.ts:144` | alert 영상 일괄 | 모달 |
| `IdeaPage.tsx` | alert 대본 생성 | 모달 |
| `TimelinePage.tsx` | alert TTS | 모달 |
| `NarrationVideoStep.tsx:89` | alert 영상 | 모달 |
| `CastPage.tsx` | setGenError | 모달 |

`useGeneration.ts`에서는 콜백 패턴으로 처리:

```typescript
interface UseGenerationParams {
    // ...기존...
    onCreditShortage?: (required: number, type: string) => void;  // ← 콜백
}

// alert 대신:
if (!canAfford('image')) {
    onCreditShortage?.(getCost('image'), '이미지 생성');
    return;
}
```

### 수정 파일
- `src/components/CreditShortageModal.tsx` (신규)
- `src/index.css` — 모달 CSS
- `src/hooks/useGeneration.ts` — 콜백 패턴
- `src/pages/IdeaPage.tsx` — 모달 추가
- `src/pages/TimelinePage.tsx` — 모달 추가
- `src/pages/CastPage.tsx` — 모달 추가
- `src/components/narration/NarrationVideoStep.tsx` — 모달 추가

---

## Phase 5: UX 정리

### 5-1. CastPage 관리모드 vs 프로젝트모드 (P2 #13)

```typescript
const [searchParams] = useSearchParams();
const isProjectMode = searchParams.get('mode') === 'project';
```

관리모드(`/cast`): 카드 관리만, 프로젝트 시작 UI 숨김
프로젝트모드(`/cast?mode=project`): 덱 선택 + 스타일 선택 + 프로젝트 시작

### 5-2. IdeaPage STYLE 탭 정리 (P2 #12)

프리셋 선택된 상태 → 프리셋 요약 카드 + "변경" 버튼
프리셋 미선택 → artStyles 12개 그리드만 표시

### 수정 파일
- `src/pages/CastPage.tsx` — useSearchParams
- `src/pages/IdeaPage.tsx` — STYLE 탭 조건부 렌더링

---

## Phase별 요약 + 의존성

```
Phase 1 (프리셋 구조 정규화)
  ↓
Phase 1.5 (Admin 카드 시각화) — Phase 1 필요
  ↓
Phase 2 (프리셋 → AI 연결) ← 핵심! 가장 큰 Phase
  │
Phase 3 (진입점 버그) ← 독립, Phase 1과 병렬 가능
  │
Phase 4 (크레딧 모달) ← 독립, Phase 1과 병렬 가능
  │
Phase 5 (UX 정리) ← 독립
```

### 구현 순서 + 담당

```
라운드 1 (병렬):
  ├→ Phase 1 + Phase 1.5 + Phase 2: 카이(AI) — 프리셋 구조 + Admin UI + AI 파이프라인
  ├→ Phase 3: 린(FE) — 진입점 버그 3건
  └→ Phase 4: 린(FE) + 누리(CSS) — 크레딧 모달

라운드 2:
  └→ Phase 5: 린(FE) — UX 정리 2건
```

### 수정 파일 총괄

| 파일 | Phase | 변경 내용 |
|------|-------|----------|
| `src/data/stylePresets.ts` | 1, 1.5 | 인터페이스 확장, 필드명 변경, 오버라이드 로직 |
| `src/components/PresetInfoModal.tsx` | 1 | 필드명 참조 업데이트 |
| `src/pages/AdminPage.tsx` | **1.5** | **프리셋 카드 전면 개편 (아코디언, 프롬프트 편집)** |
| `src/services/ai-llm.ts` | 2 | Request 확장, buildSystemPrompt 수정 |
| `src/services/prompt-builder.ts` | 2 | presetId, 대소문자, aspectRatioToSize |
| `src/hooks/useGeneration.ts` | 2,4 | presetId/aspectRatio 전달, 크레딧 콜백 |
| `src/pages/IdeaPage.tsx` | 2,4,5 | presetId/mode 전달, 모달, STYLE탭 |
| `src/pages/TimelinePage.tsx` | 2,4 | TTS voice 설정, 모달 |
| `src/components/narration/NarrationVideoStep.tsx` | 2,4 | buildVideoPrompt, 모달 |
| `src/components/narration/NarrationVoiceStep.tsx` | 2 | TTS voice 설정 |
| `src/store/projectStore.ts` | 3 | startNewProject 옵션 |
| `src/pages/HomePage.tsx` | 3 | 템플릿 핸들러 |
| `src/pages/CastPage.tsx` | 3,4,5 | keepDeck, 모달, 모드구분 |
| `src/components/CreditShortageModal.tsx` | 4 | **신규** |
| `src/index.css` | 1.5, 4 | Admin 프리셋 카드 CSS + 모달 CSS |

**총 수정 파일:** ~15개 | **신규 파일:** 1개

---

## 이번 계획에서 제외한 항목

| 항목 | 이유 | 추후 작업 |
|------|------|----------|
| **유저 생성 프리셋 (UGC)** | 인터페이스만 준비, DB+UI는 다음 버전 | Phase 2 (다음 버전) |
| 대본 분석 AI 연동 (P1 #6) | LLM 호출 추가 = API 비용 증가, 별도 설계 필요 | 008 |
| 카드 이미지 스타일 적용 (P1 #11) | CastPage UI 변경 + 재생성 UX 필요 | 008 |
| 프로젝트 로드 시 mode 복원 (P2 #14) | DB migration 필요 | 008 |
| BYOK 키 실제 라우팅 | 서비스 아키텍처 변경 필요 | 009 |
| mockScenePrompts 제거 (P2 #15) | AI 생성 안정화 후 제거 | 008 |
| 프리셋 마켓플레이스 (GEMS) | UGC 인프라 구축 후 | Phase 2 (다음 버전) |

---

## 검증 계획

1. `npm run build` — TypeScript 빌드 성공
2. **Admin 프리셋 카드 시각화:**
   - [ ] `/admin` → 프리셋 카드 5개 표시 (썸네일 + 이름 + 모드/비율 태그)
   - [ ] 카드 클릭 → 아코디언 펼침 (프롬프트 4종 textarea 표시)
   - [ ] 프롬프트 편집 → 저장 → localStorage에 오버라이드 저장 확인
   - [ ] 리셋 → 원본 복원 확인
   - [ ] 저장한 오버라이드가 이미지 생성 프롬프트에 반영되는지 확인
3. 프리셋 프롬프트 연결 검증:
   - [ ] 무협지 프리셋 선택 → 대본 생성 → LLM에 "무협 소설가" 지시 포함 확인 (콘솔 로그)
   - [ ] 이미지 생성 → 프롬프트에 "wuxia, martial arts..." 포함 확인
   - [ ] 영상 생성 → 프롬프트에 "wuxia action..." 포함 확인
4. 진입점 수렴 검증:
   - [ ] 대본부터 → IdeaPage 정상 도달
   - [ ] 스타일부터 → 프리셋 선택 → 프리셋 프롬프트 AI 반영
   - [ ] 캐스트부터 → 카드 선택 유지됨 (selectedDeck 보존)
   - [ ] 템플릿 → 프로젝트 제목 반영
5. 크레딧 복구:
   - [ ] 크레딧 0 → 이미지 생성 → CreditShortageModal 표시
   - [ ] 충전하러 가기 → PaymentPage → 뒤로가기 → 작업 보존
6. UX:
   - [ ] `/cast` → 관리 모드 (프로젝트 시작 UI 없음)
   - [ ] `/cast?mode=project` → 덱 선택 + 프로젝트 시작
