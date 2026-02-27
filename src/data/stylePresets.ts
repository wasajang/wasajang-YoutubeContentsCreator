/**
 * 스타일 프리셋 데이터
 *
 * 각 프리셋은 영상 스타일, AI 모델 기본값, 프롬프트 prefix 등을 포함.
 * 나중에 DB 테이블로 이전 가능한 구조.
 */

export interface StylePreset {
    id: string;
    name: string;                    // 'Sci-Fi Trailer'
    category: string;                // 'SCI-FI'
    style: string;                   // 'Cinematic' (artStyles의 id와 매핑)
    aspectRatio: '16:9' | '9:16' | '1:1';
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
        id: 'sci-fi-trailer',
        name: 'Sci-Fi Trailer',
        category: 'SCI-FI',
        style: 'cinematic',
        aspectRatio: '16:9',
        description: '미래 세계관의 시네마틱 트레일러. 우주, 로봇, 미래 도시 배경.',
        promptPrefix: {
            image: 'cinematic sci-fi, futuristic, epic scale, dramatic lighting, 8K, hyperrealistic,',
            video: 'cinematic trailer, sci-fi atmosphere, dynamic camera movement, lens flare,',
            script: '당신은 할리우드 SF 트레일러 작가입니다. 극적이고 웅장한 톤으로 작성하세요.',
        },
        recommendedCast: { characters: 2, backgrounds: 2, items: 1 },
        defaultModels: { script: 'gpt-4o-mini', image: 'flux-schnell', video: 'runway-gen3', tts: 'fish-speech' },
        thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=80',
        visibility: 'public',
    },
    {
        id: 'anime-drama',
        name: 'Anime Drama',
        category: 'ANIME',
        style: 'anime',
        aspectRatio: '16:9',
        description: '일본 애니메이션 스타일의 감성적인 드라마. 캐릭터 중심의 이야기.',
        promptPrefix: {
            image: 'anime style, high quality, detailed, vibrant colors, studio quality, illustrated,',
            video: 'anime style, smooth animation, emotional, character focused,',
            script: '당신은 일본 애니메이션 각본 작가입니다. 감성적이고 캐릭터 중심의 대사를 작성하세요.',
        },
        recommendedCast: { characters: 3, backgrounds: 1, items: 1 },
        defaultModels: { script: 'gpt-4o-mini', image: 'flux-schnell', video: 'runway-gen3', tts: 'fish-speech' },
        thumbnail: 'https://images.unsplash.com/photo-1578632292335-df3abbb0d586?auto=format&fit=crop&w=400&q=80',
        visibility: 'public',
    },
    {
        id: 'cinematic-drama',
        name: 'Cinematic Drama',
        category: 'FILM',
        style: 'cinematic',
        aspectRatio: '16:9',
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
        id: 'cyberpunk-action',
        name: 'Cyberpunk Action',
        category: 'SCI-FI',
        style: 'cinematic',
        aspectRatio: '16:9',
        description: '네온 불빛의 미래 도시. 빠른 액션과 강렬한 색감.',
        promptPrefix: {
            image: 'cyberpunk, neon lights, rain-soaked streets, high contrast, futuristic city, cinematic,',
            video: 'cyberpunk action, fast cuts, neon reflections, electronic music, high energy,',
            script: '당신은 사이버펑크 액션 각본가입니다. 빠른 템포와 강렬한 액션으로 작성하세요.',
        },
        recommendedCast: { characters: 2, backgrounds: 2, items: 1 },
        defaultModels: { script: 'gpt-4o-mini', image: 'flux-schnell', video: 'runway-gen3', tts: 'fish-speech' },
        thumbnail: 'https://images.unsplash.com/photo-1605806616949-1e87b487fc2f?auto=format&fit=crop&w=400&q=80',
        visibility: 'public',
    },
    {
        id: 'youtube-shorts',
        name: 'YouTube Shorts',
        category: 'YOUTUBE SHORTS',
        style: 'cinematic',
        aspectRatio: '9:16',
        description: '세로형 쇼트 영상. 30초~1분 분량의 임팩트 있는 콘텐츠.',
        promptPrefix: {
            image: 'vertical composition, 9:16, vibrant, eye-catching, social media ready,',
            video: 'vertical video, fast paced, engaging, scroll-stopping, mobile optimized,',
            script: '당신은 YouTube Shorts 크리에이터입니다. 처음 3초 안에 시청자를 사로잡는 스크립트를 작성하세요.',
        },
        recommendedCast: { characters: 1, backgrounds: 1, items: 0 },
        defaultModels: { script: 'gpt-4o-mini', image: 'flux-schnell', video: 'runway-gen3', tts: 'fish-speech' },
        thumbnail: 'https://images.unsplash.com/photo-1494173853739-c21f58b16055?auto=format&fit=crop&w=400&q=80',
        visibility: 'public',
    },
    {
        id: 'historical-epic',
        name: 'Historical Epic',
        category: 'HISTORICAL',
        style: 'cinematic',
        aspectRatio: '16:9',
        description: '역사적 배경의 대서사시. 장엄한 스케일과 시대적 고증.',
        promptPrefix: {
            image: 'historical epic, period accurate, cinematic, detailed costumes, dramatic lighting, massive scale,',
            video: 'historical epic, sweeping cinematography, orchestral, vast landscapes, dramatic,',
            script: '당신은 역사 대서사시 각본가입니다. 역사적 사실을 바탕으로 장엄하고 웅장한 이야기를 작성하세요.',
        },
        recommendedCast: { characters: 3, backgrounds: 2, items: 2 },
        defaultModels: { script: 'gpt-4o-mini', image: 'flux-schnell', video: 'runway-gen3', tts: 'fish-speech' },
        thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=400&q=80',
        visibility: 'public',
    },
    {
        id: 'kids-adventure',
        name: "Kids Adventure",
        category: 'KIDS',
        style: 'children-illustration',
        aspectRatio: '16:9',
        description: '어린이용 모험 이야기. 밝고 컬러풀한 세계관.',
        promptPrefix: {
            image: "children's illustration, colorful, cute, friendly, bright colors, cartoon style,",
            video: 'kids animation, cheerful, bright, simple movements, fun music,',
            script: '당신은 어린이 애니메이션 작가입니다. 밝고 교육적이며 재미있는 이야기를 작성하세요.',
        },
        recommendedCast: { characters: 2, backgrounds: 1, items: 1 },
        defaultModels: { script: 'gpt-4o-mini', image: 'flux-schnell', video: 'runway-gen3', tts: 'fish-speech' },
        thumbnail: 'https://images.unsplash.com/photo-1515569067071-ec3b51335ec0?auto=format&fit=crop&w=400&q=80',
        visibility: 'public',
    },
    {
        id: 'music-video',
        name: 'Music Video',
        category: 'MUSIC',
        style: 'cinematic',
        aspectRatio: '16:9',
        description: '뮤직비디오 스타일. 리듬에 맞는 빠른 컷 편집과 강렬한 비주얼.',
        promptPrefix: {
            image: 'music video aesthetic, stylish, high fashion, dramatic lighting, artistic, editorial,',
            video: 'music video, beat-synced cuts, stylish, artistic, dynamic, urban or surreal setting,',
            script: '당신은 뮤직비디오 감독입니다. 음악에 맞는 시각적이고 비유적인 씬을 작성하세요.',
        },
        recommendedCast: { characters: 1, backgrounds: 2, items: 1 },
        defaultModels: { script: 'gpt-4o-mini', image: 'flux-schnell', video: 'runway-gen3', tts: 'fish-speech' },
        thumbnail: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=400&q=80',
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
