/**
 * 스타일 프리셋 데이터
 *
 * 각 프리셋은 영상 스타일, AI 모델 기본값, 프롬프트 prefix 등을 포함.
 * 나중에 DB 테이블로 이전 가능한 구조.
 */

export interface StylePreset {
    id: string;
    name: string;                    // '시네마틱 드라마'
    category: string;                // 'FILM'
    style: string;                   // 'cinematic' (artStyles의 id와 매핑)
    aspectRatio: '16:9' | '9:16' | '1:1';
    mode: 'cinematic' | 'narration'; // 제작 방식
    description: string;
    promptPrefix: {
        image: string;               // 이미지 생성 프롬프트 prefix
        video: string;               // 영상 생성 프롬프트 prefix
        script: string;              // 대본 생성 AI에게 줄 지시
    };
    recommendedCast: {
        characters: number;
        backgrounds: number;
        items: number;
    };
    defaultModels: {
        script: string;
        image: string;
        video: string;
        tts: string;
    };
    thumbnail?: string;
    visibility: 'public' | 'soon' | 'hidden';
}

export const stylePresets: StylePreset[] = [
    {
        id: 'cinematic-drama',
        name: '시네마틱 드라마',
        category: 'FILM',
        style: 'cinematic',
        aspectRatio: '16:9',
        mode: 'cinematic',
        description: '영화적 드라마. 자연광과 감성적 색감으로 표현되는 인간 이야기.',
        promptPrefix: {
            image: 'cinematic photography, dramatic, natural lighting, film grain, emotional, award-winning,',
            video: 'cinematic, slow motion, handheld camera, emotional score, golden hour,',
            script: '당신은 드라마 영화 각본가입니다. 인물의 감정과 갈등에 집중한 씬을 작성하세요.',
        },
        recommendedCast: { characters: 2, backgrounds: 2, items: 0 },
        defaultModels: { script: 'gpt-4o-mini', image: 'flux-schnell', video: 'runway-gen3', tts: 'fish-speech' },
        thumbnail: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=400&q=80',
        visibility: 'public',
    },
    {
        id: 'overseas-touching-story',
        name: '해외감동사연',
        category: 'STORY',
        style: 'cinematic',
        aspectRatio: '16:9',
        mode: 'narration',
        description: '해외 감동 실화를 나레이션으로 전달하는 스토리텔링 영상.',
        promptPrefix: {
            image: 'photorealistic, emotional, warm tones, real life story, documentary style, heartwarming,',
            video: 'documentary style, emotional narration, gentle camera movement, warm color grading,',
            script: '당신은 감동 실화 나레이터입니다. 시청자의 감정을 자극하는 따뜻한 이야기를 작성하세요. 나레이션 형식으로 작성하세요.',
        },
        recommendedCast: { characters: 2, backgrounds: 2, items: 0 },
        defaultModels: { script: 'gpt-4o-mini', image: 'flux-schnell', video: 'runway-gen3', tts: 'fish-speech' },
        thumbnail: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=400&q=80',
        visibility: 'public',
    },
    {
        id: 'martial-arts',
        name: '무협지',
        category: 'MARTIAL ARTS',
        style: 'cinematic',
        aspectRatio: '16:9',
        mode: 'narration',
        description: '동양 판타지 무협 세계. 나레이션으로 풀어가는 무림 이야기.',
        promptPrefix: {
            image: 'wuxia, martial arts, ancient chinese fantasy, dramatic pose, flowing robes, mountain scenery, ink wash painting style,',
            video: 'wuxia action, slow motion martial arts, flowing movements, epic landscapes,',
            script: '당신은 무협 소설가입니다. 강호의 전설을 나레이션 형식으로 풀어가세요. 웅장하고 서사적인 톤으로 작성하세요.',
        },
        recommendedCast: { characters: 3, backgrounds: 2, items: 1 },
        defaultModels: { script: 'gpt-4o-mini', image: 'flux-schnell', video: 'runway-gen3', tts: 'fish-speech' },
        thumbnail: 'https://images.unsplash.com/photo-1528164344885-947ce28b5791?auto=format&fit=crop&w=400&q=80',
        visibility: 'public',
    },
    {
        id: 'martial-arts-cinematic',
        name: '무협지2',
        category: 'MARTIAL ARTS',
        style: 'cinematic',
        aspectRatio: '16:9',
        mode: 'cinematic',
        description: '시네마틱 무협 액션. 화려한 무술과 영화적 연출.',
        promptPrefix: {
            image: 'wuxia cinematic, martial arts action, dynamic composition, dramatic lighting, epic battle, flying swords,',
            video: 'cinematic wuxia, wire-fu action, sweeping camera, dramatic score, slow motion combat,',
            script: '당신은 무협 영화 감독입니다. 화려한 액션과 드라마틱한 장면을 씬별로 작성하세요.',
        },
        recommendedCast: { characters: 3, backgrounds: 2, items: 2 },
        defaultModels: { script: 'gpt-4o-mini', image: 'flux-schnell', video: 'runway-gen3', tts: 'fish-speech' },
        thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80',
        visibility: 'public',
    },
    {
        id: 'skeleton-shorts',
        name: '해골 쇼츠',
        category: 'YOUTUBE SHORTS',
        style: 'cinematic',
        aspectRatio: '9:16',
        mode: 'narration',
        description: '해골 캐릭터가 나레이션하는 짧은 공포/코미디 쇼츠.',
        promptPrefix: {
            image: 'skeleton character, dark humor, spooky cute, vertical composition, 9:16, eerie lighting, fun horror,',
            video: 'vertical video, skeleton animation, dark comedy, spooky atmosphere, jump scare elements,',
            script: '당신은 해골 캐릭터입니다. 무섭지만 웃긴 톤으로 짧은 이야기를 나레이션하세요. 30초~1분 분량.',
        },
        recommendedCast: { characters: 1, backgrounds: 1, items: 0 },
        defaultModels: { script: 'gpt-4o-mini', image: 'flux-schnell', video: 'runway-gen3', tts: 'fish-speech' },
        thumbnail: 'https://images.unsplash.com/photo-1509557965875-b88c97052f0e?auto=format&fit=crop&w=400&q=80',
        visibility: 'public',
    },
];

/** ID로 프리셋 조회 */
export function getPresetById(id: string): StylePreset | undefined {
    return stylePresets.find((p) => p.id === id);
}

/** 카테고리별 프리셋 조회 */
export function getPresetsByCategory(category: string): StylePreset[] {
    return stylePresets.filter((p) => p.category === category && p.visibility === 'public');
}

/** 공개 프리셋만 반환 */
export function getPublicPresets(): StylePreset[] {
    return stylePresets.filter((p) => p.visibility === 'public');
}

/** 모드별 프리셋 반환 */
export function getPresetsByMode(mode: 'cinematic' | 'narration'): StylePreset[] {
    return stylePresets.filter((p) => p.mode === mode && p.visibility === 'public');
}
