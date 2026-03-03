/**
 * getSceneGradient — 씬 인덱스에 따른 그라디언트 반환
 *
 * StoryboardPage, GeneratePage, TimelinePage에서 공통 사용.
 * 이미지가 없는 씬의 폴백 배경으로 활용.
 */

const SCENE_GRADIENTS = [
    'linear-gradient(135deg, #1a0533, #2d1b3d, #0f2027)',
    'linear-gradient(135deg, #0f2027, #1a1a2e, #2d1b3d)',
    'linear-gradient(135deg, #3a2518, #1a0f0a, #2d1b3d)',
    'linear-gradient(135deg, #1e2a3a, #0a1520, #1a0533)',
    'linear-gradient(135deg, #2d1b3d, #3a2518, #0f2027)',
    'linear-gradient(135deg, #1a1a2e, #0f2027, #3a2518)',
];

export function getSceneGradient(index: number): string {
    return SCENE_GRADIENTS[index % SCENE_GRADIENTS.length];
}
