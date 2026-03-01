# 011 UX & Data Architecture Design

> 작성: CPO 유나 (Yuna) | 2026-02-28
> 요청: CTO 일론 경유, CEO 직접 지시
> 상태: CEO 검토 대기

---

## 0. CEO 지시 요약

CEO가 정의한 핵심 구조:

1. **4가지 시작 방법**: 템플릿 / 대본부터 / 스타일부터 / 캐스트부터
2. **템플릿**: 모든 설정이 사전 정의된 "원클릭 시작"
3. **각 진입점**: 서로 다른 순서로 동일한 설정을 채워감
4. **비율 설정**: 16:9, 9:16, 1:1
5. **초기 템플릿 5개**: 타임슬립 시네마틱 드라마, 해외감동사연, 무협지1, 무협지2, 해골 쇼츠

---

## 1. 4가지 진입점 워크플로우

### 1.1 용어 정리

| 용어 | 의미 |
|------|------|
| **템플릿 (Template)** | 모든 설정이 사전에 채워진 패키지. 사용자는 아이디어만 입력하면 됨 |
| **스타일 프리셋 (Style Preset)** | 아트 스타일 + 프롬프트 규칙만 정의된 것 (대본/캐스트는 비어 있음) |
| **아트 스타일 (Art Style)** | 시각적 화풍 (Cinematic, Anime, Oil Painting 등) |
| **캐스트 (Cast)** | 캐릭터/배경/아이템 카드 모음 |
| **모드 (Mode)** | cinematic / narration |

### 1.2 공통 원칙

**모든 진입점의 목표는 동일**: 아래 "전체 설정 목록"(섹션 5)을 100% 채우는 것.
어떤 순서로 채우든 상관없다. 빠진 항목이 있으면 다음 단계 진행 시 경고/안내를 표시한다.

### 1.3 진입점별 워크플로우

---

#### [A] 템플릿으로 시작

> 사용자 프로필: 초보자, 빨리 결과를 보고 싶은 사람

```
HomePage: 템플릿 카드 클릭
  |
  v
[자동 설정 적용] ── 템플릿에 포함된 모든 설정이 store에 로드됨
  - mode (cinematic / narration)
  - aspectRatio (16:9, 9:16, 1:1)
  - artStyle (아트 스타일 ID)
  - 대본 생성 규칙 프롬프트 (scriptSystemPrompt)
  - 씬 분할 규칙 (sceneSplitRules)
  - 이미지 프롬프트 규칙 (imagePromptRules)
  - 영상 프롬프트 규칙 (videoPromptRules)
  - 추천 캐스트 구성 (recommendedCast)
  - 기본 AI 모델 선택
  - negativePrompt
  |
  v
IdeaPage (SCRIPT 탭)
  - 아이디어 입력만 하면 됨 (대본 생성 규칙이 이미 적용되어 있으므로)
  - "이 템플릿은 OOO 스타일입니다" 안내 배너 표시
  - STYLE 탭에서 아트 스타일 확인/변경 가능
  |
  v
StoryboardPage
  - Cast 자동 추천 (템플릿의 recommendedCast 기반)
  - 씬 분할 규칙 자동 적용
  |
  v
Generate --> Animate --> Export
```

**핵심 가치**: 사용자가 건드려야 할 것이 최소화됨. 아이디어 하나만 쓰면 끝.

---

#### [B] 대본부터 시작

> 사용자 프로필: 이미 대본이나 아이디어가 있는 사람

```
HomePage: "대본부터" 카드 클릭
  |
  v
모드 선택 오버레이
  - 시네마틱 / 나레이션 선택
  |
  v
IdeaPage (SCRIPT 탭)
  - 대본 직접 입력 or 아이디어 -> AI 대본 생성
  - [필수] 씬 분할 (씬 수 지정)
  |
  v
IdeaPage (STYLE 탭) 또는 다음 단계 진행 시 자동 안내
  - 아트 스타일 선택 (필수, 아직 미선택이면 알림)
  - 비율 선택 (16:9 기본)
  |
  v
StoryboardPage
  - 캐스팅 (AI 추천 or 수동)
  - 시드 매칭 -> 이미지/영상 생성
  |
  v
Animate --> Export
```

**사용자가 채워야 할 항목 순서**:
1. 모드 (cinematic/narration)
2. 대본 (직접 입력 or AI 생성)
3. 아트 스타일
4. 비율 (기본값 16:9 있으므로 선택사항)
5. 캐스트 (StoryboardPage에서)

---

#### [C] 스타일부터 시작

> 사용자 프로필: "이런 느낌의 영상을 만들고 싶어"로 시작하는 사람

```
HomePage: "스타일부터" 카드 클릭
  |
  v
스타일 프리셋 그리드 확장
  - 프리셋 카드 선택 (각 프리셋에 mode, artStyle, aspectRatio, 프롬프트 규칙 포함)
  |
  v
[부분 설정 적용]
  - mode, artStyle, aspectRatio, 프롬프트 규칙 적용
  - 대본은 비어 있음, 캐스트도 비어 있음
  |
  v
IdeaPage
  - 프리셋 정보 모달 표시 (현재 구현됨)
  - SCRIPT 탭: 대본 입력
  - STYLE 탭: 선택된 스타일 확인 (변경 가능)
  |
  v
StoryboardPage
  - 캐스팅 (프리셋의 recommendedCast 참조)
  |
  v
Generate --> Animate --> Export
```

**사용자가 채워야 할 항목 순서**:
1. 스타일 프리셋 선택 (mode + artStyle + aspectRatio + 프롬프트 규칙 자동 설정)
2. 대본 (직접 or AI)
3. 캐스트
4. (비율은 프리셋에서 이미 설정됨, 변경 가능)

---

#### [D] 캐스트부터 시작

> 사용자 프로필: 특정 캐릭터/세계관이 이미 있는 사람

```
HomePage: "Cast부터" 카드 클릭
  |
  v
CastPage (/cast?mode=project)
  - 캐릭터/배경/아이템 생성 및 선택
  - 선택 완료 -> selectedDeck에 저장
  |
  v
HomePage 복귀 or 직접 모드 선택
  - 영상 스타일 선택 (아트 스타일)
  - 모드 선택 (cinematic / narration)
  |
  v
IdeaPage
  - STYLE 탭: 아트 스타일 확인
  - SCRIPT 탭: 대본 입력
  - 비율 선택
  |
  v
StoryboardPage
  - 이미 캐스트가 있으므로 Cast Setup 단계 빠르게 진행
  |
  v
Generate --> Animate --> Export
```

**사용자가 채워야 할 항목 순서**:
1. 캐스트 선택/생성
2. 아트 스타일
3. 모드 (cinematic / narration)
4. 대본
5. 비율

---

### 1.4 진입점별 설정 자동 완성 비교표

| 설정 항목 | 템플릿 | 대본부터 | 스타일부터 | 캐스트부터 |
|-----------|--------|---------|-----------|-----------|
| mode | AUTO | 사용자 선택 | AUTO (프리셋) | 사용자 선택 |
| aspectRatio | AUTO | 기본 16:9 | AUTO (프리셋) | 사용자 선택 |
| artStyle | AUTO | 사용자 선택 | AUTO (프리셋) | 사용자 선택 |
| 대본 | 사용자 입력 | 사용자 입력 | 사용자 입력 | 사용자 입력 |
| scriptSystemPrompt | AUTO | 기본값 | AUTO (프리셋) | 기본값 |
| sceneSplitRules | AUTO | 기본값 | AUTO (프리셋) | 기본값 |
| imagePromptRules | AUTO | 기본값 (artStyle 기반) | AUTO (프리셋) | 기본값 |
| videoPromptRules | AUTO | 기본값 | AUTO (프리셋) | 기본값 |
| negativePrompt | AUTO | 기본값 | AUTO (프리셋) | 기본값 |
| cast | AI 추천 | AI 추천 | AI 추천 | 사용자 선택 |
| AI 모델 | AUTO (변경 가능) | 기본값 (변경 가능) | AUTO (변경 가능) | 기본값 (변경 가능) |

---

## 2. 템플릿 데이터 구조

### 2.1 Template 인터페이스 (신규)

CEO가 말한 "모든 게 다 정해져 있는 상태"를 데이터로 표현한 것.
기존 `StylePreset`을 확장하되, 템플릿 전용 필드를 추가한다.

```typescript
/**
 * Template = StylePreset + 추가 규칙(프롬프트 체계) + 추천 캐스트 상세
 *
 * 기존 StylePreset과의 관계:
 * - StylePreset: 스타일/프롬프트 규칙 중심 (대본이나 캐스트는 비어 있을 수 있음)
 * - Template: StylePreset의 모든 것 + 대본 생성 규칙 + 씬 분할 규칙 + 캐스트 상세
 *
 * Template은 StylePreset을 상속하므로, 스타일 프리셋으로도 사용 가능.
 */

export interface TemplatePromptRules {
  /** 아이디어 -> 대본 변환 시 AI에게 줄 시스템 프롬프트 */
  scriptSystemPrompt: string;

  /** 씬 분할 시 AI에게 줄 규칙 (몇 개로 나눌지, 각 씬의 길이 기준 등) */
  sceneSplitRules: {
    /** 기본 씬 개수 */
    defaultSceneCount: number;
    /** 최소 씬 개수 */
    minSceneCount: number;
    /** 최대 씬 개수 */
    maxSceneCount: number;
    /** 씬당 목표 길이 (초) */
    targetDurationPerScene: number;
    /** 분할 기준 설명 (AI에게 전달) */
    splitInstruction: string;
  };

  /** 씬 대본 -> 이미지 프롬프트 변환 규칙 */
  imagePromptRules: {
    /** 프롬프트 앞에 항상 붙는 prefix */
    prefix: string;
    /** 프롬프트 뒤에 항상 붙는 suffix */
    suffix: string;
    /** 네거티브 프롬프트 */
    negativePrompt: string;
    /** 추가 지시사항 (AI 프롬프트 빌더에게 전달) */
    instruction: string;
  };

  /** 이미지 -> 영상 프롬프트 변환 규칙 */
  videoPromptRules: {
    /** 프롬프트 앞에 항상 붙는 prefix */
    prefix: string;
    /** 프롬프트 뒤에 항상 붙는 suffix */
    suffix: string;
    /** 기본 영상 길이 (초) */
    defaultDuration: number;
    /** 추가 지시사항 */
    instruction: string;
  };
}

export interface TemplateCastPreset {
  /** 캐릭터 카드 목록 (사전 정의) */
  characters: TemplateCastCard[];
  /** 배경 카드 목록 (사전 정의) */
  backgrounds: TemplateCastCard[];
  /** 아이템 카드 목록 (사전 정의) */
  items: TemplateCastCard[];
}

export interface TemplateCastCard {
  /** 카드 이름 */
  name: string;
  /** 카드 설명 (이미지 생성 프롬프트로도 사용) */
  description: string;
  /** 참조 이미지 URL (있으면) */
  referenceImageUrl?: string;
  /** 필수 여부 (true면 덱에서 제거 불가) */
  isRequired: boolean;
}

export interface Template {
  // ── 기본 식별 ──
  id: string;
  name: string;                    // '타임슬립 시네마틱 드라마'
  description: string;             // 한 줄 설명
  category: string;                // 'FILM', 'YOUTUBE SHORTS', 'MARTIAL ARTS' 등

  // ── 핵심 설정 (자동 적용) ──
  mode: 'cinematic' | 'narration';
  aspectRatio: '16:9' | '9:16' | '1:1';
  artStyleId: string;              // artStyles 배열의 id 참조 (예: 'cinematic', 'anime')

  // ── 프롬프트 규칙 체계 ──
  promptRules: TemplatePromptRules;

  // ── 추천 캐스트 (사전 정의된 카드) ──
  castPreset: TemplateCastPreset;

  // ── AI 모델 기본값 ──
  defaultModels: {
    script: string;    // 대본 AI 모델 ID
    image: string;     // 이미지 AI 모델 ID
    video: string;     // 영상 AI 모델 ID
    tts: string;       // TTS 모델 ID
  };

  // ── 음성 설정 ──
  voice?: {
    voiceId?: string;  // 기본 음성 ID
    speed?: number;    // 속도 (0.5~2.0)
    tone?: string;     // 톤 설명 ('차분한', '긴장감 있는' 등)
  };

  // ── 예시 데이터 ──
  sampleIdea?: string;             // "이런 아이디어를 넣어보세요" 플레이스홀더
  sampleScript?: string;           // 예시 대본 (미리보기용)

  // ── UI/UX ──
  thumbnail?: string;              // 카드 썸네일 이미지 URL
  tags: string[];                  // 검색/필터용 태그
  difficulty: 'beginner' | 'intermediate' | 'advanced';

  // ── 관리 ──
  visibility: 'public' | 'soon' | 'hidden';
  isOfficial: boolean;
  version: number;                 // 템플릿 버전 (업데이트 추적)
  createdAt: string;
  updatedAt: string;

  // ── UGC 확장 (Phase 2) ──
  authorId?: string;
  authorName?: string;
  price?: number;                  // 0 = 무료
  downloads?: number;
  rating?: number;
}
```

### 2.2 초기 템플릿 5개 데이터

```typescript
export const templates: Template[] = [
  // ──────────────────────────────────────
  // 1. 타임슬립 시네마틱 드라마
  // ──────────────────────────────────────
  {
    id: 'timeslip-cinematic-drama',
    name: '타임슬립 시네마틱 드라마',
    description: '시간 여행을 소재로 한 웅장한 시네마틱 영상. 과거와 현재가 교차하는 드라마.',
    category: 'FILM',
    mode: 'cinematic',
    aspectRatio: '16:9',
    artStyleId: 'cinematic',
    promptRules: {
      scriptSystemPrompt:
        '당신은 시간 여행/타임슬립 전문 영화 각본가입니다.\n'
        + '과거와 현재(또는 미래)가 교차하는 드라마틱한 장면을 작성하세요.\n'
        + '시각적으로 대비가 뚜렷한 두 시대의 충돌을 강조하고,\n'
        + '인물들의 감정 변화(놀람, 경외, 결의)를 섬세하게 묘사하세요.\n'
        + '각 씬은 독립된 영상 컷으로 촬영 가능해야 합니다.',
      sceneSplitRules: {
        defaultSceneCount: 10,
        minSceneCount: 5,
        maxSceneCount: 20,
        targetDurationPerScene: 5,
        splitInstruction:
          '각 씬은 하나의 독립된 시각적 장면입니다.\n'
          + '장소 이동이나 시간 변화가 있으면 새 씬으로 분할하세요.\n'
          + '액션 장면은 짧게(3-4초), 감정 장면은 길게(5-7초) 구성하세요.',
      },
      imagePromptRules: {
        prefix: 'photorealistic cinematic still, anamorphic lens, dramatic lighting, film grain, 4K,',
        suffix: 'award-winning cinematography, golden hour lighting, shallow depth of field',
        negativePrompt: 'blurry, low quality, distorted, deformed, ugly, watermark, text, logo, anime, cartoon, oversaturated',
        instruction:
          '두 시대의 대비를 시각적으로 강조하세요.\n'
          + '과거 장면: 차가운 색감, 거친 질감, 눈보라\n'
          + '현대 장면: 선명한 디지털 색감, 깨끗한 장비\n'
          + '교차 장면: 두 시대의 요소가 한 프레임에 공존',
      },
      videoPromptRules: {
        prefix: 'cinematic, slow motion, dramatic camera movement,',
        suffix: 'epic orchestral score, atmospheric sound design',
        defaultDuration: 5,
        instruction:
          '카메라 움직임을 적극 활용하세요.\n'
          + '전투 장면: 빠른 패닝, 저앵글\n'
          + '감정 장면: 느린 줌인, 셸로우 DOF\n'
          + '전환 장면: 천천히 상승하는 크레인 샷',
      },
    },
    castPreset: {
      characters: [
        { name: '현대 군인', description: 'modern Korean soldier, digital camouflage uniform, confident expression, tactical gear', isRequired: true },
        { name: '과거 군인', description: '1950s Korean War soldier, tattered olive drab uniform, weary but determined face', isRequired: true },
        { name: '지휘관', description: 'military commander, stern expression, medals on chest, authoritative presence', isRequired: false },
      ],
      backgrounds: [
        { name: '전장', description: 'frozen battlefield, snow-covered trenches, distant explosions, blizzard', isRequired: true },
        { name: '시간 포털', description: 'massive blue-white energy portal, electric arcs, swirling temporal rift', isRequired: true },
      ],
      items: [
        { name: '현대 전차', description: 'K2 Black Panther main battle tank, digital camouflage, modern military vehicle', isRequired: false },
      ],
    },
    defaultModels: {
      script: 'gemini-2.5-flash',
      image: 'gemini-2.0-flash-exp-image-generation',
      video: 'runway-gen3',
      tts: 'fish-speech',
    },
    voice: { speed: 1.0, tone: '웅장하고 서사적인' },
    sampleIdea: '1950년대 한국전쟁 중 미래에서 온 현대 군대가 타임포털을 통해 나타나 전세를 바꾼다. K2 전차와 아파치 헬기가 등장하며 두 시대의 병사들이 연대한다.',
    thumbnail: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=400&q=80',
    tags: ['시간여행', '전쟁', '밀리터리', 'SF', '드라마', '시네마틱'],
    difficulty: 'intermediate',
    visibility: 'public',
    isOfficial: true,
    version: 1,
    createdAt: '2026-02-28',
    updatedAt: '2026-02-28',
  },

  // ──────────────────────────────────────
  // 2. 해외감동사연
  // ──────────────────────────────────────
  {
    id: 'overseas-touching-story',
    name: '해외감동사연',
    description: '해외 감동 실화를 따뜻한 나레이션으로 전달하는 스토리텔링 영상.',
    category: 'STORY',
    mode: 'narration',
    aspectRatio: '16:9',
    artStyleId: 'cinematic',
    promptRules: {
      scriptSystemPrompt:
        '당신은 감동 실화 전문 나레이터입니다.\n'
        + '해외에서 일어난 따뜻한 실화를 시청자에게 직접 이야기하듯 서술하세요.\n'
        + '감정을 자극하되 과장하지 않고, 진심이 느껴지는 톤으로 작성하세요.\n'
        + '각 씬은 나레이션의 자연스러운 호흡 단위로 구성합니다.\n'
        + '영상은 16:9 가로 비율이며, 배경 이미지 위에 나레이션이 흐르는 형태입니다.',
      sceneSplitRules: {
        defaultSceneCount: 8,
        minSceneCount: 5,
        maxSceneCount: 15,
        targetDurationPerScene: 8,
        splitInstruction:
          '나레이션의 호흡 단위로 분할하세요.\n'
          + '한 씬 = 하나의 감정적 장면(기승전결 중 하나).\n'
          + '도입(2씬) -> 전개(3-4씬) -> 클라이맥스(1-2씬) -> 마무리(1씬) 구조 권장.',
      },
      imagePromptRules: {
        prefix: 'photorealistic, emotional, warm tones, real life story, documentary style, heartwarming,',
        suffix: 'soft natural lighting, gentle bokeh, magazine quality photography',
        negativePrompt: 'blurry, low quality, distorted, deformed, ugly, watermark, text, logo, anime, cartoon, dark, horror',
        instruction:
          '따뜻하고 감성적인 분위기를 강조하세요.\n'
          + '자연광, 부드러운 색감, 인물의 표정에 집중.\n'
          + '실화 다큐멘터리 느낌의 사실적인 이미지.',
      },
      videoPromptRules: {
        prefix: 'documentary style, gentle camera movement, warm color grading,',
        suffix: 'emotional piano music, soft focus transitions',
        defaultDuration: 8,
        instruction:
          '느리고 부드러운 카메라 움직임.\n'
          + '줌인으로 감정을 강조하고, 패닝으로 장소를 설명.\n'
          + '전환은 크로스 디졸브 또는 페이드.',
      },
    },
    castPreset: {
      characters: [
        { name: '주인공', description: 'ordinary person, genuine expression, warm smile, casual clothing', isRequired: true },
        { name: '조력자', description: 'kind stranger, compassionate eyes, helping gesture, everyday hero', isRequired: false },
      ],
      backgrounds: [
        { name: '일상 공간', description: 'warm everyday setting, cozy room or gentle street, golden hour lighting', isRequired: true },
        { name: '감동 장소', description: 'meaningful location, hospital room or community center, emotional atmosphere', isRequired: false },
      ],
      items: [],
    },
    defaultModels: {
      script: 'gemini-2.5-flash',
      image: 'gemini-2.0-flash-exp-image-generation',
      video: 'runway-gen3',
      tts: 'fish-speech',
    },
    voice: { speed: 0.9, tone: '따뜻하고 차분한' },
    sampleIdea: '아프리카 시골 마을에서 한 소년이 매일 10km를 걸어서 학교에 다녔다. 어느 날 한 여행자가 이 사실을 알게 되고, SNS에 올린 글이 전 세계로 퍼지며 소년의 인생이 바뀐다.',
    thumbnail: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=400&q=80',
    tags: ['감동', '실화', '나레이션', '해외', '스토리텔링', '다큐'],
    difficulty: 'beginner',
    visibility: 'public',
    isOfficial: true,
    version: 1,
    createdAt: '2026-02-28',
    updatedAt: '2026-02-28',
  },

  // ──────────────────────────────────────
  // 3. 무협지1 (나레이션)
  // ──────────────────────────────────────
  {
    id: 'martial-arts-narration',
    name: '무협지1',
    description: '동양 판타지 무협 세계. 나레이션으로 풀어가는 무림의 전설.',
    category: 'MARTIAL ARTS',
    mode: 'narration',
    aspectRatio: '16:9',
    artStyleId: 'cinematic',
    promptRules: {
      scriptSystemPrompt:
        '당신은 무협 소설의 나레이터입니다.\n'
        + '강호의 전설을 나레이션 형식으로 풀어가세요.\n'
        + '웅장하고 서사적인 한문체 톤을 섞되, 현대 독자도 이해할 수 있게 작성합니다.\n'
        + '"그 날, 무림의 하늘에 검기가 일었다..." 같은 서사적 도입을 활용하세요.\n'
        + '무술 장면은 시각적으로 묘사하되, 나레이션답게 관찰자 시점으로 서술합니다.',
      sceneSplitRules: {
        defaultSceneCount: 10,
        minSceneCount: 6,
        maxSceneCount: 15,
        targetDurationPerScene: 6,
        splitInstruction:
          '무협 서사의 기승전결에 맞춰 분할하세요.\n'
          + '도입(강호 배경 설명 1-2씬)\n'
          + '전개(주인공 등장, 갈등 2-3씬)\n'
          + '절정(무술 대결 3-4씬)\n'
          + '결말(여운 1-2씬)',
      },
      imagePromptRules: {
        prefix: 'wuxia, martial arts, ancient chinese fantasy, dramatic pose, flowing robes, mountain scenery, ink wash painting influence,',
        suffix: 'epic composition, dramatic clouds, volumetric lighting, martial arts movie still',
        negativePrompt: 'blurry, low quality, distorted, deformed, ugly, watermark, text, logo, modern, contemporary, western, guns',
        instruction:
          '동양 판타지 미학을 강조하세요.\n'
          + '산수화 느낌의 배경, 나부끼는 도복, 검기 표현.\n'
          + '인물은 동양인 외모, 고전 복장.',
      },
      videoPromptRules: {
        prefix: 'wuxia action, slow motion martial arts, flowing movements, epic landscapes,',
        suffix: 'traditional korean/chinese music, wind sound effects, bamboo forest atmosphere',
        defaultDuration: 6,
        instruction:
          '무술 장면: 슬로우모션 + 와이어액션 느낌.\n'
          + '풍경 장면: 천천히 패닝하는 산수화 같은 구도.\n'
          + '대결 장면: 빠른 컷 전환과 줌인.',
      },
    },
    castPreset: {
      characters: [
        { name: '주인공 협객', description: 'young martial artist, flowing white robes, determined eyes, sword on back, ancient Chinese warrior', isRequired: true },
        { name: '숙적', description: 'dark martial arts master, black robes, menacing aura, scar across face, antagonist', isRequired: true },
        { name: '사부', description: 'elderly martial arts master, white beard, serene expression, bamboo staff, wise mentor', isRequired: false },
      ],
      backgrounds: [
        { name: '무림 산맥', description: 'misty mountain peaks, ancient martial arts temples, bamboo forest, wuxia landscape', isRequired: true },
        { name: '결투 장소', description: 'ancient stone arena on mountain cliff, dramatic sky, autumn leaves falling', isRequired: true },
      ],
      items: [
        { name: '명검', description: 'legendary sword, glowing blade, ancient runes, martial arts weapon, qi energy', isRequired: false },
      ],
    },
    defaultModels: {
      script: 'gemini-2.5-flash',
      image: 'gemini-2.0-flash-exp-image-generation',
      video: 'runway-gen3',
      tts: 'fish-speech',
    },
    voice: { speed: 0.85, tone: '웅장하고 고풍스러운' },
    sampleIdea: '무림 최고의 검객이었던 아버지를 잃은 청년이 복수를 위해 강호에 나선다. 천하제일대회에서 아버지의 원수와 마주하지만, 진짜 적은 따로 있었다.',
    thumbnail: 'https://images.unsplash.com/photo-1528164344885-947ce28b5791?auto=format&fit=crop&w=400&q=80',
    tags: ['무협', '동양판타지', '나레이션', '검술', '강호', '서사'],
    difficulty: 'intermediate',
    visibility: 'public',
    isOfficial: true,
    version: 1,
    createdAt: '2026-02-28',
    updatedAt: '2026-02-28',
  },

  // ──────────────────────────────────────
  // 4. 무협지2 (시네마틱)
  // ──────────────────────────────────────
  {
    id: 'martial-arts-cinematic',
    name: '무협지2',
    description: '시네마틱 무협 액션. 화려한 무술과 영화적 연출로 보여주는 강호의 이야기.',
    category: 'MARTIAL ARTS',
    mode: 'cinematic',
    aspectRatio: '16:9',
    artStyleId: 'cinematic',
    promptRules: {
      scriptSystemPrompt:
        '당신은 무협 영화 감독입니다.\n'
        + '화려한 액션과 드라마틱한 장면을 씬별로 작성하세요.\n'
        + '각 씬은 하나의 카메라 샷으로 촬영 가능한 시각적 장면입니다.\n'
        + '대사보다는 시각적 묘사에 집중하세요.\n'
        + '"검이 빛을 가르며 허공을 찢는다" 같은 액션 묘사를 풍부하게 넣으세요.',
      sceneSplitRules: {
        defaultSceneCount: 12,
        minSceneCount: 8,
        maxSceneCount: 20,
        targetDurationPerScene: 4,
        splitInstruction:
          '시네마틱 무협은 빠른 컷이 핵심입니다.\n'
          + '액션 장면: 3-4초의 짧은 컷으로 분할.\n'
          + '풍경/감정 장면: 5-6초의 여유 있는 컷.\n'
          + '결투 클라이맥스: 여러 개의 짧은 컷으로 긴장감 구축.',
      },
      imagePromptRules: {
        prefix: 'wuxia cinematic, martial arts action, dynamic composition, dramatic lighting, epic battle, flying swords,',
        suffix: 'wire-fu aesthetics, rain and wind effects, epic movie poster quality',
        negativePrompt: 'blurry, low quality, distorted, deformed, ugly, watermark, text, logo, modern weapons, guns',
        instruction:
          '영화적 구도와 조명을 강조하세요.\n'
          + '역광, 실루엣, 빗속 결투, 화염 효과 등.\n'
          + '한 장면 한 장면이 영화 포스터가 될 수 있는 퀄리티.',
      },
      videoPromptRules: {
        prefix: 'cinematic wuxia, wire-fu action, sweeping camera, dramatic score, slow motion combat,',
        suffix: 'epic orchestral music, sword clash sound effects, wind howling',
        defaultDuration: 4,
        instruction:
          '액션: 슬로우모션 + 빠른 복귀.\n'
          + '검기 효과: 빛나는 궤적.\n'
          + '카메라: 360도 회전, 크레인 샷, 추적 샷 활용.',
      },
    },
    castPreset: {
      characters: [
        { name: '주인공 검객', description: 'young martial artist hero, dynamic pose, ancient warrior armor, determined expression, sword drawn', isRequired: true },
        { name: '여전사', description: 'female martial artist, elegant fighting stance, flowing silk robes, dual swords', isRequired: true },
        { name: '최종 보스', description: 'dark lord of martial arts, imposing figure, dark qi aura, throne of swords', isRequired: true },
      ],
      backgrounds: [
        { name: '대결 절벽', description: 'dramatic cliff edge, storm clouds, lightning strikes, wuxia battleground at dusk', isRequired: true },
        { name: '무림 성채', description: 'ancient martial arts fortress, grand hall with weapons, torchlit corridors', isRequired: true },
      ],
      items: [
        { name: '전설의 검', description: 'legendary glowing sword, ancient inscriptions, qi energy emanating, celestial weapon', isRequired: true },
        { name: '비급 두루마리', description: 'ancient martial arts scroll, mysterious symbols, glowing text, secret technique manual', isRequired: false },
      ],
    },
    defaultModels: {
      script: 'gemini-2.5-flash',
      image: 'gemini-2.0-flash-exp-image-generation',
      video: 'runway-gen3',
      tts: 'fish-speech',
    },
    voice: { speed: 1.0, tone: '긴장감 넘치는' },
    sampleIdea: '무림맹주의 자리를 두고 세 검파가 격돌한다. 주인공은 사라진 스승의 비급을 찾아 최종 대결에 나서고, 숨겨진 진실이 드러나며 진정한 무림의 의미를 깨닫는다.',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80',
    tags: ['무협', '시네마틱', '액션', '검술', '영화', '판타지'],
    difficulty: 'intermediate',
    visibility: 'public',
    isOfficial: true,
    version: 1,
    createdAt: '2026-02-28',
    updatedAt: '2026-02-28',
  },

  // ──────────────────────────────────────
  // 5. 해골 쇼츠
  // ──────────────────────────────────────
  {
    id: 'skeleton-shorts',
    name: '해골 쇼츠',
    description: '해골 캐릭터가 나레이션하는 짧은 공포/코미디 YouTube Shorts.',
    category: 'YOUTUBE SHORTS',
    mode: 'narration',
    aspectRatio: '9:16',
    artStyleId: 'cinematic',
    promptRules: {
      scriptSystemPrompt:
        '당신은 해골 캐릭터입니다. 1인칭 시점으로 이야기합니다.\n'
        + '무섭지만 웃긴, 공포+코미디 톤으로 짧은 이야기를 나레이션하세요.\n'
        + '30초~1분 분량의 YouTube Shorts에 적합한 길이입니다.\n'
        + '훅(놀라움)으로 시작해서, 반전으로 끝나는 구조를 권장합니다.\n'
        + '"어이, 이거 아는 사람?" 같은 시청자 참여 유도 문구를 활용하세요.',
      sceneSplitRules: {
        defaultSceneCount: 4,
        minSceneCount: 3,
        maxSceneCount: 6,
        targetDurationPerScene: 8,
        splitInstruction:
          'Shorts용이므로 총 30초~60초 분량.\n'
          + '씬 1: 훅 (3-5초, 시선 끌기)\n'
          + '씬 2-3: 이야기 전개 (각 8-12초)\n'
          + '씬 4: 반전/펀치라인 (5-8초)',
      },
      imagePromptRules: {
        prefix: 'skeleton character, dark humor, spooky cute, vertical composition 9:16, eerie lighting, fun horror,',
        suffix: 'TikTok viral aesthetic, bold colors on dark background, eye-catching vertical frame',
        negativePrompt: 'blurry, low quality, distorted, deformed, watermark, text, logo, realistic gore, disturbing, horizontal',
        instruction:
          '세로 9:16 비율에 맞는 구도.\n'
          + '해골 캐릭터가 항상 프레임 중심.\n'
          + '밝은 네온 색감 + 어두운 배경 대비.\n'
          + '표정이 읽히도록 눈/턱 부분 강조.',
      },
      videoPromptRules: {
        prefix: 'vertical video 9:16, skeleton animation, dark comedy, spooky atmosphere,',
        suffix: 'jump scare elements, TikTok style transitions, bass-boosted sound effects',
        defaultDuration: 8,
        instruction:
          '세로 영상에 최적화.\n'
          + '빠른 줌인/아웃으로 긴장감 조성.\n'
          + '점프스케어 타이밍에 화면 흔들림 효과.\n'
          + '마지막 씬에서 해골이 카메라를 직접 보는 구도.',
      },
    },
    castPreset: {
      characters: [
        { name: '해골', description: 'cute but spooky skeleton character, glowing eyes, expressive skull, dark hood, narrator persona', isRequired: true },
      ],
      backgrounds: [
        { name: '으스스한 배경', description: 'dark spooky setting, graveyard or haunted house, moonlit, vertical composition, foggy atmosphere', isRequired: true },
      ],
      items: [],
    },
    defaultModels: {
      script: 'gemini-2.5-flash',
      image: 'gemini-2.0-flash-exp-image-generation',
      video: 'runway-gen3',
      tts: 'fish-speech',
    },
    voice: { speed: 1.1, tone: '장난스럽고 으스스한' },
    sampleIdea: '어느 날 밤, 누군가 내 무덤 위에 와이파이 공유기를 설치했다. 덕분에 나는 세상에서 가장 행복한 해골이 되었는데... 문제는 비밀번호가 매일 바뀐다는 것.',
    thumbnail: 'https://images.unsplash.com/photo-1509557965875-b88c97052f0e?auto=format&fit=crop&w=400&q=80',
    tags: ['쇼츠', '공포', '코미디', '해골', '유튜브', '세로영상'],
    difficulty: 'beginner',
    visibility: 'public',
    isOfficial: true,
    version: 1,
    createdAt: '2026-02-28',
    updatedAt: '2026-02-28',
  },
];
```

---

## 3. 아트 스타일 데이터 구조

### 3.1 ArtStyle 인터페이스 (개선)

현재 `artStyles`는 단순 목록이지만, 프롬프트 연동을 위해 구조를 보강해야 합니다.

```typescript
export interface ArtStyle {
  // ── 기본 식별 ──
  id: string;                      // 'cinematic', 'anime', 'oil-painting' 등
  name: string;                    // UI에 표시될 이름
  nameKo: string;                  // 한국어 이름

  // ── 시각 ──
  thumbnail: string;               // 카드 썸네일 이미지 URL
  color: string;                   // 폴백 배경 색상 (그라디언트용)

  // ── 프롬프트 연동 ──
  imagePromptPrefix: string;       // 이미지 생성 시 자동 앞에 붙는 프롬프트
  imagePromptSuffix: string;       // 이미지 생성 시 자동 뒤에 붙는 프롬프트
  negativePrompt: string;          // 기본 네거티브 프롬프트
  videoPromptPrefix: string;       // 영상 생성 시 자동 앞에 붙는 프롬프트

  // ── 메타 ──
  category: 'realistic' | 'illustration' | 'stylized' | 'traditional';
  tags: string[];
  isDefault?: boolean;             // 기본 선택 여부
}
```

### 3.2 템플릿과 아트 스타일의 관계

```
Template.artStyleId  ──references──>  ArtStyle.id
```

- 템플릿은 `artStyleId`로 하나의 기본 아트 스타일을 지정
- 사용자는 언제든 아트 스타일을 변경할 수 있음
- **프롬프트 우선순위**: 템플릿의 `promptRules.imagePromptRules.prefix` > ArtStyle의 `imagePromptPrefix`
  - 템플릿이 선택된 경우: 템플릿의 프롬프트 규칙이 우선
  - 템플릿 없이 아트 스타일만 선택된 경우: ArtStyle의 프롬프트 사용
  - 둘 다 있는 경우: 템플릿 규칙이 ArtStyle을 오버라이드

### 3.3 프롬프트 합성 순서

최종 이미지 프롬프트 조합:

```
[Template imagePromptRules.prefix OR ArtStyle.imagePromptPrefix]
+ [씬 대본에서 추출한 시각 묘사]
+ [캐스트 카드 description (해당 씬에 배치된 카드)]
+ [Template imagePromptRules.suffix OR ArtStyle.imagePromptSuffix]
```

최종 네거티브 프롬프트:

```
[Template imagePromptRules.negativePrompt OR ArtStyle.negativePrompt]
```

---

## 4. 캐스트 카드 데이터 구조

### 4.1 현재 구조 (유지)

기존 `AssetCard` 인터페이스는 잘 설계되어 있음. 약간의 확장만 필요.

```typescript
// 기존 (projectStore.ts에 정의됨)
export interface AssetCard {
  id: string;
  name: string;
  type: AssetType;           // 'character' | 'background' | 'item'
  description: string;       // 이미지 생성 프롬프트로도 사용됨
  imageUrl: string;
  seed: number;
  status: 'pending' | 'generating' | 'done' | 'failed';
  isRequired?: boolean;
  isFavorite?: boolean;
  source?: 'ai' | 'manual' | 'template';  // 'template' 추가
}
```

### 4.2 타입별 필드 가이드

모든 타입이 동일한 `AssetCard` 인터페이스를 공유하되, `description` 필드의 내용이 타입별로 다른 역할을 함.

#### 캐릭터 (character)

| 필드 | 역할 | 예시 |
|------|------|------|
| name | 캐릭터 이름 | '현대 군인', '민수 (Minsoo)' |
| description | 외모/복장 묘사 (이미지 프롬프트로 직접 사용) | 'modern Korean soldier, digital camouflage uniform, confident expression' |
| imageUrl | 생성된 캐릭터 참조 이미지 | (AI 생성 또는 업로드) |
| seed | 일관성 유지용 시드값 | 42891 |

#### 배경 (background)

| 필드 | 역할 | 예시 |
|------|------|------|
| name | 장소 이름 | '전장', '얼어붙은 압록강' |
| description | 장소/분위기 묘사 (이미지 프롬프트로 직접 사용) | 'frozen battlefield, snow-covered trenches, distant explosions' |
| imageUrl | 생성된 배경 참조 이미지 | (AI 생성 또는 업로드) |
| seed | 일관성 유지용 시드값 | 11234 |

#### 아이템 (item)

| 필드 | 역할 | 예시 |
|------|------|------|
| name | 아이템 이름 | 'K2 전차', '명검' |
| description | 아이템 외형 묘사 (이미지 프롬프트로 직접 사용) | 'K2 Black Panther main battle tank, digital camouflage' |
| imageUrl | 생성된 아이템 참조 이미지 | (AI 생성 또는 업로드) |
| seed | 일관성 유지용 시드값 | 34567 |

### 4.3 템플릿 캐스트 -> AssetCard 변환

템플릿의 `castPreset`에 정의된 `TemplateCastCard`는 프로젝트 시작 시 `AssetCard`로 변환됨:

```typescript
function templateCastToAssetCard(
  tc: TemplateCastCard,
  type: AssetType,
  index: number
): AssetCard {
  return {
    id: `tmpl-${type}-${index}`,
    name: tc.name,
    type,
    description: tc.description,
    imageUrl: tc.referenceImageUrl || '',  // 없으면 AI가 생성
    seed: Math.floor(Math.random() * 99999),
    status: tc.referenceImageUrl ? 'done' : 'pending',
    isRequired: tc.isRequired,
    source: 'template',
  };
}
```

---

## 5. "모든 설정"의 전체 목록

영상을 만들기 위해 최종적으로 필요한 **모든** 설정 항목.

### 5.1 프로젝트 레벨 설정 (전체 영상에 공통 적용)

| # | 설정 항목 | 타입 | 기본값 | 설정 시점 | 필수 |
|---|-----------|------|--------|-----------|------|
| 1 | **프로젝트 제목** | string | 'Untitled Project' | 프로젝트 생성 시 | Y |
| 2 | **모드** (cinematic / narration) | enum | - | 진입점 선택 시 | Y |
| 3 | **화면 비율** (16:9, 9:16, 1:1) | enum | '16:9' | IdeaPage 또는 템플릿 | Y |
| 4 | **아트 스타일** | ArtStyle.id | - | STYLE 탭 또는 템플릿 | Y |
| 5 | **템플릿 ID** (사용 시) | string or null | null | HomePage 템플릿 선택 시 | N |
| 6 | **진입점** | enum | - | HomePage | N (추적용) |

### 5.2 AI 모델 설정

| # | 설정 항목 | 타입 | 기본값 | 설정 시점 | 필수 |
|---|-----------|------|--------|-----------|------|
| 7 | **대본 AI 모델** | string | 'gemini-2.5-flash' | Settings 또는 템플릿 | Y |
| 8 | **이미지 AI 모델** | string | 'gemini-2.0-flash-exp-image-generation' | Settings 또는 템플릿 | Y |
| 9 | **영상 AI 모델** | string | 'runway-gen3' | Settings 또는 템플릿 | Y |
| 10 | **TTS 모델** | string | 'fish-speech' | Settings 또는 템플릿 | Y |

### 5.3 프롬프트 규칙 (내부 -- 사용자에게 직접 노출되지 않음)

| # | 설정 항목 | 타입 | 기본값 | 출처 |
|---|-----------|------|--------|------|
| 11 | **대본 생성 시스템 프롬프트** | string | 기본 지시문 | 템플릿 or 기본값 |
| 12 | **씬 분할 규칙** | object | { defaultSceneCount: 10, ... } | 템플릿 or 기본값 |
| 13 | **이미지 프롬프트 prefix** | string | ArtStyle에서 가져옴 | 템플릿 > ArtStyle |
| 14 | **이미지 프롬프트 suffix** | string | '' | 템플릿 or 빈 문자열 |
| 15 | **이미지 네거티브 프롬프트** | string | 기본 네거티브 | 템플릿 > ArtStyle |
| 16 | **이미지 프롬프트 추가 지시** | string | '' | 템플릿 |
| 17 | **영상 프롬프트 prefix** | string | '' | 템플릿 or 빈 문자열 |
| 18 | **영상 프롬프트 suffix** | string | '' | 템플릿 or 빈 문자열 |
| 19 | **영상 기본 길이** | number | 5 (초) | 템플릿 or 기본값 |
| 20 | **영상 프롬프트 추가 지시** | string | '' | 템플릿 |

### 5.4 대본 설정

| # | 설정 항목 | 타입 | 기본값 | 설정 시점 | 필수 |
|---|-----------|------|--------|-----------|------|
| 21 | **대본 텍스트** (전체) | string | '' | IdeaPage SCRIPT 탭 | Y |
| 22 | **씬 수** | number | 10 | IdeaPage (씬 수 선택기) | Y |
| 23 | **분할된 씬 목록** | Scene[] | [] | 대본 분할 후 | Y |

### 5.5 캐스트 설정

| # | 설정 항목 | 타입 | 기본값 | 설정 시점 | 필수 |
|---|-----------|------|--------|-----------|------|
| 24 | **카드 라이브러리** (전역) | AssetCard[] | [] | CastPage 또는 StoryboardPage | N (전역) |
| 25 | **프로젝트 덱** (선택된 카드) | string[] | [] | StoryboardPage Cast Setup | Y |
| 26 | **씬별 카드 배치** | Record<sceneId, cardId[]> | {} | StoryboardPage Seed Match | Y |

### 5.6 생성 설정 (씬 레벨)

| # | 설정 항목 | 타입 | 기본값 | 설정 시점 | 필수 |
|---|-----------|------|--------|-----------|------|
| 27 | **씬별 영상 개수** | Record<sceneId, 1\|2\|3> | 1 | StoryboardPage Cut Split | Y |
| 28 | **씬별 이미지 프롬프트** | Record<sceneId, string> | (자동 생성) | Generate 단계 | Y |
| 29 | **씬별 영상 프롬프트** | Record<sceneId, string> | (자동 생성) | Generate 단계 | Y |
| 30 | **씬별 생성된 이미지** | Scene.imageUrl | '' | Generate 단계 | Y |
| 31 | **씬별 생성된 영상** | (timeline clips) | - | Generate 단계 | Y |

### 5.7 음성/나레이션 설정

| # | 설정 항목 | 타입 | 기본값 | 설정 시점 | 필수 |
|---|-----------|------|--------|-----------|------|
| 32 | **TTS 음성 ID** | string | 기본 음성 | Animate 또는 나레이션 Voice 단계 | cinematic: N, narration: Y |
| 33 | **TTS 속도** | number | 1.0 | Settings | N |
| 34 | **나레이션 오디오 URL** | string | '' | 나레이션 모드 Voice 단계 | narration만 Y |
| 35 | **문장별 타이밍** | SentenceTiming[] | [] | 나레이션 모드 Split 단계 | narration만 Y |

### 5.8 타임라인/편집 설정

| # | 설정 항목 | 타입 | 기본값 | 설정 시점 | 필수 |
|---|-----------|------|--------|-----------|------|
| 36 | **타임라인 클립 목록** | TimelineClip[] | [] | Animate 단계 | Y |
| 37 | **나레이션 클립 목록** | NarrationClip[] | [] | 나레이션 모드 | narration만 Y |
| 38 | **BGM** | (미구현) | - | Animate 단계 | N |
| 39 | **효과음 (SFX)** | (미구현) | - | Animate 단계 | N |

### 5.9 전체 설정 요약 (총 39개 항목)

```
프로젝트 레벨:   6개 (제목, 모드, 비율, 아트스타일, 템플릿ID, 진입점)
AI 모델:         4개 (대본, 이미지, 영상, TTS)
프롬프트 규칙:  10개 (대본시스템, 씬분할, 이미지prefix/suffix/negative/지시, 영상prefix/suffix/길이/지시)
대본:            3개 (대본텍스트, 씬수, 분할된씬)
캐스트:          3개 (라이브러리, 덱, 씬별배치)
생성:            5개 (영상개수, 이미지프롬프트, 영상프롬프트, 생성이미지, 생성영상)
음성:            4개 (음성ID, 속도, 나레이션URL, 타이밍)
타임라인:        4개 (클립, 나레이션클립, BGM, SFX)
─────────────────────────
합계:           39개
```

---

## 6. 기존 구조와의 차이점 & 마이그레이션 방향

### 6.1 현재 `StylePreset` vs 새로운 `Template`

| 항목 | 기존 StylePreset | 새 Template |
|------|-----------------|-------------|
| 대본 생성 규칙 | `prompts.script` (단일 문자열) | `promptRules.scriptSystemPrompt` (상세 지시) |
| 씬 분할 규칙 | 없음 | `promptRules.sceneSplitRules` (구조화된 객체) |
| 이미지 프롬프트 | `prompts.imagePrefix` (단일 prefix) | `promptRules.imagePromptRules` (prefix + suffix + negative + instruction) |
| 영상 프롬프트 | `prompts.videoPrefix` (단일 prefix) | `promptRules.videoPromptRules` (prefix + suffix + duration + instruction) |
| 캐스트 | `recommendedCast: { characters: N, ... }` (숫자만) | `castPreset: { characters: [...], ... }` (카드 상세 포함) |
| 아트 스타일 | `style: 'Cinematic'` (이름 문자열) | `artStyleId: 'cinematic'` (ID 참조) |

### 6.2 마이그레이션 전략

**Phase 1 (즉시)**: Template 타입 및 데이터 파일 추가. 기존 StylePreset은 당분간 유지.

**Phase 2 (점진)**: StylePreset을 Template의 서브셋으로 통합. `Template`이 `StylePreset`의 상위 집합이 되도록.

**Phase 3 (DB 이전)**: Template 데이터를 Supabase 테이블로 이전. UGC 마켓 준비.

### 6.3 Store 변경 방향

현재 `projectStore`에 추가해야 할 필드:

```typescript
// projectStore에 추가할 필드 (v9)
templateId: string | null;                  // 선택된 템플릿 ID
promptRules: TemplatePromptRules | null;    // 활성 프롬프트 규칙 (템플릿 또는 기본값)
artStyleId: string | null;                  // 선택된 아트 스타일 ID
```

---

## 7. 비즈니스 관점 우선순위 판단

### 7.1 구현 우선순위 (RICE 기반)

| 항목 | Reach | Impact | Confidence | Effort | RICE 점수 | 우선순위 |
|------|-------|--------|------------|--------|-----------|---------|
| Template 데이터 구조 | 높음 | 높음 | 높음 | 중간 | 90 | **P0** |
| 4진입점 워크플로우 | 높음 | 높음 | 높음 | 높음 | 70 | **P0** |
| ArtStyle 구조 보강 | 중간 | 중간 | 높음 | 낮음 | 80 | **P1** |
| 프롬프트 규칙 체계 | 중간 | 높음 | 중간 | 중간 | 60 | **P1** |
| Store v9 마이그레이션 | 높음 | 중간 | 높음 | 중간 | 65 | **P1** |
| UGC 마켓 필드 | 낮음 | 높음 | 낮음 | 낮음 | 30 | **P2** |

### 7.2 핵심 비즈니스 가치

1. **템플릿 = 신규 사용자 전환율 극대화**
   - 초보자가 "뭘 해야 할지 모르겠다" -> 템플릿 클릭 -> 바로 결과물
   - 이탈률 감소, 첫 영상 완성까지의 시간 단축

2. **4진입점 = 다양한 사용자 니즈 포용**
   - 대본이 있는 사람, 스타일이 먼저인 사람, 캐릭터가 먼저인 사람 모두 수용
   - 경쟁사 대비 차별점 (대부분은 대본 -> 영상 단일 경로)

3. **프롬프트 규칙 체계 = UGC 마켓의 기반**
   - 사용자가 자기만의 프롬프트 규칙을 만들면 -> 판매 가능
   - 이것이 AntiGravity의 핵심 해자(moat)

---

## 8. CEO 검토 요청 사항

1. **Template과 StylePreset의 관계**: Template이 StylePreset을 완전히 대체할지, 아니면 두 개념을 공존시킬지?
   - 유나(CPO) 추천: Template이 상위 개념, StylePreset은 "프롬프트 규칙만 있는 가벼운 Template"으로 통합

2. **초기 5개 템플릿의 프롬프트 규칙 내용**: 위에 작성한 것이 방향에 맞는지 검토

3. **캐스트부터 시작 워크플로우**: CastPage -> 다음 단계의 흐름이 자연스러운지?

4. **프롬프트 규칙의 세분화 정도**: 현재 prefix/suffix/instruction/negativePrompt 수준이 적당한지, 더 세분화가 필요한지?

5. **비율(aspectRatio)**: 프로젝트 레벨에서 한 번만 설정하는 것이 맞는지, 씬별로 다를 수 있어야 하는지?

---

*이 문서는 CEO 피드백 후 plan.md로 발전시킬 예정입니다.*
