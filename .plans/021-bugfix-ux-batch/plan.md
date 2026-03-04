# 021 — 버그 수정 + 선택 UX 개선

> **상태:** 계획 작성 완료 — CEO 검토 대기
> **브랜치:** `feat/009-preset-pipeline`
> **예상 수정 파일:** 4~5개

---

## A. 분할 후 경고 기준 수정 (버그 #1)

### 문제
- 씬 분할 후 7.9초/9.6초인데 경고가 사라짐
- 원인: 경고 기준이 `WARN_DURATION = 10`으로 설정되어 있음
- 사용자가 선택한 `maxDuration`(기본 5초)과 무관하게 항상 10초 기준

### 수정 내용

**파일:** `src/components/narration/NarrationSplitStep.tsx`

```tsx
// 변경 전 (line 128)
const WARN_DURATION = 10;

// 변경 후: 삭제 — 사용자가 선택한 maxDuration을 경고 기준으로 사용

// 변경 전 (line 402)
const isOverDuration = group.duration > WARN_DURATION;

// 변경 후: 사용자가 선택한 기준 초과 시 경고
const isOverDuration = group.duration > maxDuration;

// 변경 전 (line 415)
<AlertTriangle size={10} /> 10초 초과

// 변경 후: 기준값 반영
<AlertTriangle size={10} /> {maxDuration}초 초과
```

**효과:** 사용자가 "5초 기준"을 선택했으면 5초 초과 씬에 경고 표시

---

## B. 이미지 생성 멈춤 수정 (버그 #4 → #2 자동 해결)

### 문제
- 10개쯤에서 이미지 생성이 멈춤
- 원인: `setTimeout`으로 비동기 스케줄만 하고, 완료 추적 없음
- 이전 배치 응답이 안 왔는데 다음 배치가 시작 → 브라우저 연결 포화

### 수정 내용

**파일:** `src/hooks/useGeneration.ts` — `generateAllScenes` 함수 (line 271~314)

```tsx
// 변경 전: setTimeout 기반 (완료 추적 없음)
const BATCH_SIZE = 4;
const BATCH_DELAY = 2500;
tasks.forEach((task, i) => {
    const batchIndex = Math.floor(i / BATCH_SIZE);
    const withinBatch = i % BATCH_SIZE;
    const delay = batchIndex * BATCH_DELAY + withinBatch * 400;
    setTimeout(() => generateSubImage(task.sceneId, task.subIndex), delay);
});

// 변경 후: async 순차 배치 (이전 배치 완료 후 다음 배치 실행)
const generateAllScenes = useCallback(async () => {   // ← async 추가
    // ... 기존 tasks 생성 + 크레딧 로직 동일 ...

    const BATCH_SIZE = 3;  // 안전하게 3개로 축소
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
        const batch = tasks.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
            batch.map((task) => generateSubImage(task.sceneId, task.subIndex))
        );
    }
}, [dependencies]);
```

**핵심 변경:**
1. `setTimeout` → `async/await` + `Promise.allSettled`
2. 배치 크기 4 → 3 (브라우저 연결 여유 확보)
3. 이전 배치 **완료 후** 다음 배치 시작 (겹침 방지)
4. `allSettled` 사용 → 일부 실패해도 나머지 계속 진행

**2번 버그 자동 해결:** 모든 이미지가 정상 생성되면 `allImagesDone = true` → "다음: 영상화" 버튼 표시

---

## C. 영상 선택 UX 개선 (#3)

### C-1. 시네마틱 전체 선택/해제 버튼 추가

**파일:** `src/hooks/useGeneration.ts`

```tsx
// 추가: 전체 선택/해제 토글 함수
const toggleAllVideoSelection = useCallback(() => {
    setSelectedForVideo((prev) => {
        // 전체 선택 상태면 → 전체 해제
        const allKeys = new Set<string>();
        scenes.forEach((s) => {
            const vc = videoCountPerScene[s.id] || 1;
            for (let i = 0; i < vc; i++) allKeys.add(`${s.id}-${i}`);
        });
        if (prev.size === allKeys.size) return new Set();
        return allKeys;
    });
}, [scenes, videoCountPerScene]);
```

**파일:** `src/components/storyboard/SeedCheckPhase.tsx` — 영상 선택 영역에 버튼 추가

```tsx
<button onClick={genApi.toggleAllVideoSelection}>
    {allSelected ? '전체 해제' : '전체 선택'}
</button>
```

### C-2. Shift+클릭 범위 선택

**적용 대상:** 나레이션 NarrationVideoStep + 시네마틱 SeedCheckPhase

```tsx
// 공통 패턴: lastClickedIndex 기억 + Shift 감지
const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

const handleCheckWithShift = (index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedIndex !== null) {
        // lastClickedIndex ~ index 사이 모두 선택
        const start = Math.min(lastClickedIndex, index);
        const end = Math.max(lastClickedIndex, index);
        const rangeIds = items.slice(start, end + 1).map(item => item.id);
        setCheckedIds(prev => {
            const next = new Set(prev);
            rangeIds.forEach(id => next.add(id));
            return next;
        });
    } else {
        // 일반 클릭: 기존 토글 로직
        handleToggleCheck(items[index].id);
    }
    setLastClickedIndex(index);
};
```

**파일 수정:**
- `src/components/narration/NarrationVideoStep.tsx` — handleToggleCheck에 Shift 로직 추가
- `src/hooks/useGeneration.ts` — toggleVideoSelection에 Shift 로직 추가
- `src/components/storyboard/SceneRow.tsx` — 클릭 이벤트에 MouseEvent 전달

---

## 수정 파일 요약

| 파일 | 수정 항목 |
|------|----------|
| `NarrationSplitStep.tsx` | A: 경고 기준 maxDuration으로 변경 |
| `useGeneration.ts` | B: 배치 처리 async 전환 / C: 전체 선택 + Shift 선택 |
| `NarrationVideoStep.tsx` | C: 전체 선택/해제 + Shift 범위 선택 |
| `SeedCheckPhase.tsx` | C: 전체 선택 버튼 UI 추가 |
| `SceneRow.tsx` | C: 클릭 이벤트 MouseEvent 전달 |

---

## 구현 순서

1. **A** — 경고 기준 수정 (5분)
2. **B** — 이미지 배치 생성 수정 (15분)
3. **C-1** — 전체 선택/해제 (10분)
4. **C-2** — Shift 범위 선택 (15분)
5. **빌드 검증** — `npm run build`
