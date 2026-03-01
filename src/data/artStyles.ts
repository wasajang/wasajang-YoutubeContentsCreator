// ========== Art Style Data ==========
// mockData.ts의 artStyles + stylePromptPrefix를 통합한 확장형 데이터
// 프리셋 확장 시 이 배열에만 항목 추가하면 됨 (코드 변경 최소화)

export interface ArtStyle {
  id: string;
  name: string;
  nameKo: string;
  thumbnail: string;
  color: string;
  imagePromptPrefix: string;
  imagePromptSuffix: string;
  negativePrompt: string;
  videoPromptPrefix: string;
  category: 'realistic' | 'illustration' | 'stylized' | 'traditional';
  tags: string[];
  isDefault?: boolean;
}

export const artStyles: ArtStyle[] = [
  {
    id: 'cinematic',
    name: 'Cinematic',
    nameKo: '시네마틱',
    thumbnail: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=400&q=80',
    color: '#3a2518',
    imagePromptPrefix: 'photorealistic cinematic still, anamorphic lens, dramatic lighting, film grain, 4K,',
    imagePromptSuffix: 'award-winning cinematography, shallow depth of field',
    negativePrompt: 'blurry, low quality, distorted, deformed, ugly, watermark, text, logo, anime, cartoon, oversaturated',
    videoPromptPrefix: 'cinematic, slow motion, dramatic camera movement,',
    category: 'realistic',
    tags: ['영화', '실사', '드라마'],
    isDefault: true,
  },
  {
    id: 'ink-wash',
    name: 'Ink Wash',
    nameKo: '수묵화',
    thumbnail: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=400&q=80',
    color: '#2d2a1e',
    imagePromptPrefix: 'ink wash painting, traditional asian brush painting, flowing ink, rice paper texture, monochrome with subtle color accents, sumi-e style,',
    imagePromptSuffix: 'ethereal atmosphere, misty mountains, zen composition, traditional east asian art',
    negativePrompt: 'blurry, low quality, distorted, deformed, ugly, watermark, text, logo, modern, photorealistic, 3d render',
    videoPromptPrefix: 'ink wash animation, flowing brush strokes, traditional asian art in motion, gentle transitions,',
    category: 'traditional',
    tags: ['동양', '수묵', '전통', '무협'],
  },
  {
    id: 'dark-cartoon',
    name: 'Dark Cartoon',
    nameKo: '다크 카툰',
    thumbnail: 'https://images.unsplash.com/photo-1509557965875-b88c97052f0e?auto=format&fit=crop&w=400&q=80',
    color: '#1a1a2e',
    imagePromptPrefix: 'dark cartoon style, bold outlines, spooky cute, neon accents on dark background, TikTok viral aesthetic, eye-catching colors,',
    imagePromptSuffix: 'social media optimized, high contrast, vibrant on dark, pop art influence',
    negativePrompt: 'blurry, low quality, distorted, deformed, watermark, text, logo, realistic gore, disturbing, photorealistic',
    videoPromptPrefix: 'dark cartoon animation, bold movements, spooky atmosphere, neon glow effects,',
    category: 'stylized',
    tags: ['카툰', '다크', '쇼츠', '코미디'],
  },
];

// ========== Helper Functions ==========

export function getArtStyleById(id: string): ArtStyle | undefined {
  return artStyles.find((style) => style.id === id);
}

export function getArtStylePromptPrefix(id: string): string {
  const style = getArtStyleById(id);
  if (style) return style.imagePromptPrefix;
  // id로 찾지 못한 경우 cinematic(기본값) 반환
  const defaultStyle = artStyles.find((s) => s.isDefault);
  return defaultStyle?.imagePromptPrefix ?? artStyles[0].imagePromptPrefix;
}
