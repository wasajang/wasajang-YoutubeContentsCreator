/**
 * 템플릿 데이터
 *
 * Template = StylePreset의 상위 집합.
 * 모든 설정(모드, 비율, 아트 스타일, 프롬프트 규칙, 추천 캐스트, AI 모델)이 사전 정의된 "원클릭 시작" 패키지.
 * 나중에 Supabase 테이블로 이전 가능한 구조.
 */

import { getCustomTemplates } from '../services/template-store';

const TEMPLATE_OVERRIDE_KEY = 'antigravity-template-overrides';

// ── 인터페이스 정의 ──────────────────────────────────────

export interface TemplatePromptRules {
  /** 아이디어 -> 대본 변환 시 AI에게 줄 시스템 프롬프트 */
  scriptSystemPrompt: string;

  /** 씬 분할 시 AI에게 줄 규칙 */
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

export interface TemplateCastPreset {
  /** 캐릭터 카드 목록 */
  characters: TemplateCastCard[];
  /** 배경 카드 목록 */
  backgrounds: TemplateCastCard[];
  /** 아이템 카드 목록 */
  items: TemplateCastCard[];
}

export interface Template {
  // ── 기본 식별 ──
  id: string;
  name: string;
  description: string;
  category: string;

  // ── 핵심 설정 (자동 적용) ──
  mode: 'cinematic' | 'narration';
  aspectRatio: '16:9' | '9:16' | '1:1';
  artStyleId: string;

  // ── 프롬프트 규칙 체계 ──
  promptRules: TemplatePromptRules;

  // ── 추천 캐스트 ──
  castPreset: TemplateCastPreset;

  // ── AI 모델 기본값 ──
  defaultModels: {
    script: string;
    image: string;
    video: string;
    tts: string;
  };

  // ── 음성 설정 ──
  voice?: {
    voiceId?: string;
    speed?: number;
    tone?: string;
  };

  // ── 예시 데이터 ──
  sampleIdea?: string;
  sampleScript?: string;

  // ── UI/UX ──
  thumbnail?: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';

  // ── 관리 ──
  visibility: 'public' | 'soon' | 'hidden';
  isOfficial: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;

  // ── UGC 확장 (Phase 2) ──
  authorId?: string;
  authorName?: string;
  price?: number;
  downloads?: number;
  rating?: number;
}

// ── 템플릿 데이터 ──────────────────────────────────────

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
        {
          name: '현대 군인',
          description: 'modern Korean soldier, digital camouflage uniform, confident expression, tactical gear',
          isRequired: true,
        },
        {
          name: '과거 군인',
          description: '1950s Korean War soldier, tattered olive drab uniform, weary but determined face',
          isRequired: true,
        },
        {
          name: '지휘관',
          description: 'military commander, stern expression, medals on chest, authoritative presence',
          isRequired: false,
        },
      ],
      backgrounds: [
        {
          name: '전장',
          description: 'frozen battlefield, snow-covered trenches, distant explosions, blizzard',
          isRequired: true,
        },
        {
          name: '시간 포털',
          description: 'massive blue-white energy portal, electric arcs, swirling temporal rift',
          isRequired: true,
        },
      ],
      items: [
        {
          name: '현대 전차',
          description: 'K2 Black Panther main battle tank, digital camouflage, modern military vehicle',
          isRequired: false,
        },
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
        {
          name: '주인공',
          description: 'ordinary person, genuine expression, warm smile, casual clothing',
          isRequired: true,
        },
        {
          name: '조력자',
          description: 'kind stranger, compassionate eyes, helping gesture, everyday hero',
          isRequired: false,
        },
      ],
      backgrounds: [
        {
          name: '일상 공간',
          description: 'warm everyday setting, cozy room or gentle street, golden hour lighting',
          isRequired: true,
        },
        {
          name: '감동 장소',
          description: 'meaningful location, hospital room or community center, emotional atmosphere',
          isRequired: false,
        },
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
    artStyleId: 'ink-wash',
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
        {
          name: '주인공 협객',
          description: 'young martial artist, flowing white robes, determined eyes, sword on back, ancient Chinese warrior',
          isRequired: true,
        },
        {
          name: '숙적',
          description: 'dark martial arts master, black robes, menacing aura, scar across face, antagonist',
          isRequired: true,
        },
        {
          name: '사부',
          description: 'elderly martial arts master, white beard, serene expression, bamboo staff, wise mentor',
          isRequired: false,
        },
      ],
      backgrounds: [
        {
          name: '무림 산맥',
          description: 'misty mountain peaks, ancient martial arts temples, bamboo forest, wuxia landscape',
          isRequired: true,
        },
        {
          name: '결투 장소',
          description: 'ancient stone arena on mountain cliff, dramatic sky, autumn leaves falling',
          isRequired: true,
        },
      ],
      items: [
        {
          name: '명검',
          description: 'legendary sword, glowing blade, ancient runes, martial arts weapon, qi energy',
          isRequired: false,
        },
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
        {
          name: '주인공 검객',
          description: 'young martial artist hero, dynamic pose, ancient warrior armor, determined expression, sword drawn',
          isRequired: true,
        },
        {
          name: '여전사',
          description: 'female martial artist, elegant fighting stance, flowing silk robes, dual swords',
          isRequired: true,
        },
        {
          name: '최종 보스',
          description: 'dark lord of martial arts, imposing figure, dark qi aura, throne of swords',
          isRequired: true,
        },
      ],
      backgrounds: [
        {
          name: '대결 절벽',
          description: 'dramatic cliff edge, storm clouds, lightning strikes, wuxia battleground at dusk',
          isRequired: true,
        },
        {
          name: '무림 성채',
          description: 'ancient martial arts fortress, grand hall with weapons, torchlit corridors',
          isRequired: true,
        },
      ],
      items: [
        {
          name: '전설의 검',
          description: 'legendary glowing sword, ancient inscriptions, qi energy emanating, celestial weapon',
          isRequired: true,
        },
        {
          name: '비급 두루마리',
          description: 'ancient martial arts scroll, mysterious symbols, glowing text, secret technique manual',
          isRequired: false,
        },
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
    artStyleId: 'dark-cartoon',
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
        {
          name: '해골',
          description: 'cute but spooky skeleton character, glowing eyes, expressive skull, dark hood, narrator persona',
          isRequired: true,
        },
      ],
      backgrounds: [
        {
          name: '으스스한 배경',
          description: 'dark spooky setting, graveyard or haunted house, moonlit, vertical composition, foggy atmosphere',
          isRequired: true,
        },
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

// ── 헬퍼 함수 ──────────────────────────────────────

/**
 * ID로 템플릿 조회 (localStorage 오버라이드 반영 + 커스텀 템플릿 포함)
 *
 * 1. 공식 템플릿에서 검색 + 오버라이드 병합
 * 2. 없으면 커스텀 템플릿에서 검색
 */
export function getTemplateById(id: string): Template | undefined {
  // 1. 공식 템플릿 검색 + 오버라이드
  const base = templates.find((t) => t.id === id);
  if (base) {
    try {
      const overrides = JSON.parse(localStorage.getItem(TEMPLATE_OVERRIDE_KEY) || '{}') as Record<string, Partial<Template>>;
      if (overrides[id]) {
        return { ...base, ...overrides[id] };
      }
    } catch {
      // localStorage 접근 실패 시 원본 반환
    }
    return base;
  }
  // 2. 커스텀 템플릿 검색
  const customs = getCustomTemplates();
  return customs.find((t) => t.id === id);
}

/** 공개 템플릿만 반환 (공식 + 커스텀, 오버라이드 반영) */
export function getPublicTemplates(): Template[] {
  const officials = templates
    .filter((t) => t.visibility === 'public')
    .map((t) => getTemplateById(t.id)!);
  const customs = getCustomTemplates()
    .filter((t) => t.visibility === 'public');
  return [...officials, ...customs];
}

/** 모드별 템플릿 반환 (공식 + 커스텀) */
export function getTemplatesByMode(mode: 'cinematic' | 'narration'): Template[] {
  const officials = templates
    .filter((t) => t.mode === mode && t.visibility === 'public')
    .map((t) => getTemplateById(t.id)!);
  const customs = getCustomTemplates()
    .filter((t) => t.mode === mode && t.visibility === 'public');
  return [...officials, ...customs];
}
