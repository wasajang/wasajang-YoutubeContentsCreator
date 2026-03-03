# 019 - 서브씬 자동 변형 리서치

> 작성일: 2026-03-03 | 출처: 린(FE) 코드 분석 + CTO 브라우저 점검

## 문제 요약

컷 분할에서 서브씬 2개/3개 선택 → Generate 페이지에서 반영 안 됨

## 원인 (3계층)

### 1. 데이터 소멸
- `videoCountPerScene`이 `useGeneration.ts` 내 `useState`에만 존재
- 페이지 이동(Storyboard → Generate) 시 상태 소멸 → 모든 씬 1로 초기화
- **코드 근거:** `useGeneration.ts:93~97` — `useState(() => { scenes.forEach(s => init[s.id] = 1) })`

### 2. 프롬프트 동일
- `customPrompts`의 키가 `sceneId`만 사용 (서브인덱스 없음)
- 서브씬 1-1, 1-2, 1-3이 모두 동일한 프롬프트로 이미지 생성
- **코드 근거:** `useGeneration.ts:167` — `customPrompts[sceneId]?.image`

### 3. 시드카드 동일
- `sceneSeeds`도 씬 단위로만 존재 — 서브씬별 다른 배정 불가
- **코드 근거:** `useGeneration.ts:75~79` — `sceneSeeds[scene.id] = []`

## Scene 타입 (현재)
```typescript
export interface Scene {
  id: string;
  text: string;
  location: string;
  cameraAngle: string;
  imageUrl: string;
  videoUrl?: string;
  characters: string[];
  status: 'pending' | 'generating' | 'done' | 'failed';
  checked: boolean;
}
```
→ `videoCount` 또는 `subSceneCount` 필드 없음

## prompt-builder 현재 구조
- `buildImagePrompt(ctx)` — artStyle prefix + sceneText + cameraAngle + seedCards → 단일 프롬프트
- `buildVideoPrompt(ctx)` — 유사 구조
- 서브인덱스 파라미터 없음

## CEO 선택: A-1 자동 변형
서브씬별로 AI가 구도/앵글을 자동으로 다르게 생성:
- 1-1: 클로즈업 (close-up)
- 1-2: 와이드샷 (wide angle)
- 1-3: 측면/다른 앵글 (side view, low angle, etc.)
