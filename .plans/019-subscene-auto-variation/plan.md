# 019 - 서브씬 자동 변형 구현 계획

> 작성일: 2026-03-03 | CTO 일론
> CEO 승인: A-1 자동 변형 방식 + 풀 파이프라인
> 상태: CEO 검토 대기

---

## 목표
컷 분할에서 선택한 서브씬 수(1/2/3)가 Generate 페이지에 정확히 반영되고,
각 서브씬(1-1, 1-2, 1-3)마다 AI가 자동으로 다른 구도/앵글의 프롬프트를 생성

---

## 단계별 구현 계획

### Step 1: videoCountPerScene을 Zustand store에 영속화

**파일:** `src/store/projectStore.ts`

**변경 내용:**
- store에 `videoCountPerScene: Record<string, number>` 필드 추가
- `setVideoCountPerScene` 액션 추가
- persist 마이그레이션 v11 (v10 → v11, videoCountPerScene 빈 객체 초기화)

```typescript
// projectStore.ts에 추가
videoCountPerScene: Record<string, number>;
setVideoCountPerScene: (sceneId: string, count: number) => void;
setVideoCountPerSceneBulk: (data: Record<string, number>) => void;
```

### Step 2: CutSplitPhase에서 store 연동

**파일:** `src/components/storyboard/CutSplitPhase.tsx`

**변경 내용:**
- 서브씬 수 변경 시 `useGeneration`의 로컬 상태 + store 둘 다 업데이트
- 또는: useGeneration의 videoCountPerScene 초기값을 store에서 읽도록 변경

### Step 3: useGeneration 초기화를 store에서 읽기

**파일:** `src/hooks/useGeneration.ts`

**변경 내용:**
- videoCountPerScene 초기값: store에 값이 있으면 store 사용, 없으면 기본값 1

```typescript
// 변경 전
const [videoCountPerScene, setVideoCountPerScene] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    scenes.forEach((s) => { init[s.id] = 1; });
    return init;
});

// 변경 후
const storeVideoCount = useProjectStore((s) => s.videoCountPerScene);
const [videoCountPerScene, setVideoCountPerScene] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    scenes.forEach((s) => { init[s.id] = storeVideoCount[s.id] || 1; });
    return init;
});
```

### Step 4: prompt-builder에 서브인덱스별 자동 변형 추가

**파일:** `src/services/prompt-builder.ts`

**변경 내용:**
- `PromptContext`에 `subIndex?: number` 와 `totalSubScenes?: number` 추가
- subIndex에 따라 카메라 앵글/구도를 자동 변형

```typescript
// PromptContext 확장
export interface PromptContext {
    // ... 기존 필드
    subIndex?: number;        // 0, 1, 2 (서브씬 인덱스)
    totalSubScenes?: number;  // 1, 2, 3 (해당 씬의 총 서브씬 수)
}

// 자동 변형 로직
const SUB_SCENE_VARIATIONS: Record<number, string[]> = {
    2: ['close-up shot, detailed facial expression', 'wide establishing shot, full scene'],
    3: ['close-up shot, detailed facial expression', 'medium shot, character interaction', 'wide establishing shot, full environment'],
};

function getSubSceneVariation(subIndex: number, total: number): string {
    const variations = SUB_SCENE_VARIATIONS[total];
    if (!variations) return '';
    return variations[subIndex] || '';
}
```

- `buildImagePrompt()`에서 subIndex가 있으면 자동 변형 구도 추가
- `buildVideoPrompt()`에서도 동일 적용

### Step 5: useGeneration에서 서브씬별 프롬프트 생성

**파일:** `src/hooks/useGeneration.ts`

**변경 내용:**
- `customPrompts` 구조를 `Record<string, { image: string[]; video: string[] }>` (배열)로 변경
- 또는: 키를 `${sceneId}-${subIndex}` 패턴으로 변경
- `initPrompts()`에서 videoCount > 1인 씬은 subIndex별로 다른 프롬프트 생성

```typescript
// 키 패턴: sceneId 또는 sceneId-subIdx
const promptKey = subIndex > 0 ? `${scene.id}-${subIndex}` : scene.id;

prompts[promptKey] = {
    image: buildImagePrompt({
        ...ctx,
        subIndex,
        totalSubScenes: videoCount,
    }),
    video: buildVideoPrompt({
        ...ctx,
        subIndex,
        totalSubScenes: videoCount,
    }),
};
```

### Step 6: SceneRow UI에서 서브씬별 프롬프트 표시

**파일:** `src/components/storyboard/SceneRow.tsx`

**변경 내용:**
- 서브행(subIdx > 0)에서 각각의 프롬프트 텍스트 표시
- 프롬프트 편집도 서브씬별 독립
- "(자동 변형: 클로즈업)" 등 라벨 표시

---

## 수정 파일 요약

| 파일 | 변경 | 난이도 |
|------|------|--------|
| `src/store/projectStore.ts` | videoCountPerScene 영속화, v11 마이그레이션 | 중 |
| `src/components/storyboard/CutSplitPhase.tsx` | store 연동 | 하 |
| `src/hooks/useGeneration.ts` | store 초기화 + 서브씬별 프롬프트 키 | 상 |
| `src/services/prompt-builder.ts` | subIndex 자동 변형 | 중 |
| `src/components/storyboard/SceneRow.tsx` | 서브씬별 프롬프트 표시 | 중 |
| `src/pages/GeneratePage.tsx` | store 연동 (minor) | 하 |

---

## 검증 시나리오

1. Storyboard 컷 분할에서 씬 1에 서브씬 3개 선택
2. Generate 페이지로 이동 → 씬 1이 3개 행(1-1, 1-2, 1-3)으로 표시
3. 각 행의 이미지 프롬프트가 다른 구도 포함 (클로즈업/미디엄/와이드)
4. 영상 프롬프트도 각각 다름
5. 이미지 생성 시 각 서브씬에 다른 이미지 생성
6. 뒤로가기(Generate → Storyboard) 후 서브씬 수가 유지됨

---

*이 계획은 CEO 검토 후 구현합니다. 아직 구현하지 않습니다.*
