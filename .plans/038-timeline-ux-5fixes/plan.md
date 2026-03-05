# 038: 타임라인 UX 5가지 개선 — 구현 계획

> CTO 일론 | 2026-03-05

---

## 요약

CEO가 보고한 시네마틱 편집기 + 영상화 단계의 5가지 UX 문제를 수정합니다.

---

## Fix 1: 재생바 드래그 시 실시간 이동

### 현재 동작
- 눈금자를 **클릭**하면 재생 위치가 순간이동
- 드래그로 실시간 이동 불가

### 수정 후 동작
- 눈금자를 **mousedown** → 즉시 해당 위치로 이동
- **mousemove** 중 → 실시간으로 재생바 위치 업데이트
- **mouseup** → 드래그 종료

### 수정 파일
- `src/components/editor/EditorTimeline.tsx`

### 코드 변경

```tsx
// 기존: handleRulerClick (onClick)
// 변경: handleRulerMouseDown (onMouseDown)

const isRulerDragging = useRef(false);

const calcTimeFromEvent = useCallback((e: MouseEvent | React.MouseEvent) => {
  const ruler = scrollRef.current?.querySelector('.vrew-timeline__ruler');
  if (!ruler || totalDuration <= 0) return null;
  const rect = ruler.getBoundingClientRect();
  const px = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
  return Math.max(0, Math.min(totalDuration, px / pixelsPerSecond));
}, [totalDuration, pixelsPerSecond]);

const handleRulerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  const time = calcTimeFromEvent(e);
  if (time === null) return;
  onSeek?.(time);
  isRulerDragging.current = true;

  const handleMove = (me: MouseEvent) => {
    const t = calcTimeFromEvent(me);
    if (t !== null) onSeek?.(t);
  };
  const handleUp = () => {
    isRulerDragging.current = false;
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup', handleUp);
  };
  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleUp);
}, [calcTimeFromEvent, onSeek]);

// JSX: onClick={handleRulerClick} → onMouseDown={handleRulerMouseDown}
```

---

## Fix 2: 씬 선택 없이 자르기

### 현재 동작
- 자르기 버튼은 `canSplit`이 true일 때만 활성화
- `canSplit`: 재생바가 현재 클립의 시작+0.1초 ~ 끝-0.1초 사이
- 문제: 재생바를 드래그로 이동해도 `handleTimelineSeek`가 `setCurrentClipIndex`를 자동 호출

### 분석
- 실제로 재생바 위치에 해당하는 클립은 자동으로 `currentClipIndex`에 설정됨
- CEO 의도: 대본 패널(ScriptPanel)에서 씬을 직접 클릭하지 않아도 자르기 가능해야 함
- 이미 구현되어 있을 가능성 높음 → 확인 후 0.1초 버퍼를 축소하여 더 쉽게 자르기 가능하도록

### 수정 파일
- `src/hooks/useCinematicEditor.ts`

### 코드 변경

```tsx
// 기존: 0.1초 버퍼
const canSplit = useMemo(() => {
  if (!currentClip) return false;
  return (
    currentTime > currentClip.audioStartTime + 0.1 &&
    currentTime < currentClip.audioEndTime - 0.1
  );
}, [currentClip, currentTime]);

// 변경: 0.01초 버퍼 (거의 경계에서도 자르기 가능)
const canSplit = useMemo(() => {
  if (!currentClip) return false;
  return (
    currentTime > currentClip.audioStartTime + 0.01 &&
    currentTime < currentClip.audioEndTime - 0.01
  );
}, [currentClip, currentTime]);
```

---

## Fix 3: 재생바 세로 전체 트랙 관통

### 현재 동작
- playhead가 `.vrew-timeline__ruler` 안에서만 렌더링
- ruler 높이(약 24px)만큼만 보임

### 수정 후 동작
- playhead가 ruler + 영상 + 음성 + 자막 트랙 전체를 관통하는 세로선

### 수정 파일
- `src/components/editor/EditorTimeline.tsx` — playhead 위치를 `.vrew-timeline__inner`로 이동
- `src/index.css` — playhead 높이를 100%로

### 코드 변경

EditorTimeline.tsx에서 playhead를 ruler 밖, `.vrew-timeline__inner` 안의 최상위로 이동:

```tsx
// 기존: ruler 내부에 playhead 렌더링
<div className="vrew-timeline__ruler" ...>
  {timeMarkers.map(...)}
  <div ref={playheadRef} className="vrew-timeline__playhead--gpu" ... />
</div>

// 변경: inner 컨테이너 최상위에 playhead 렌더링
<div className="vrew-timeline__inner" style={{ width: totalWidth }}>
  {/* 전체 높이 관통 playhead */}
  <div
    ref={playheadRef}
    className="vrew-timeline__playhead vrew-timeline__playhead--gpu"
    style={{ transform: `translateX(${playheadPx}px)` }}
  />

  {/* 눈금자 */}
  <div className="vrew-timeline__ruler" ...>
    {timeMarkers.map(...)}
  </div>

  {/* 트랙들... */}
</div>
```

CSS:
```css
.vrew-timeline__playhead--gpu {
  position: absolute;
  top: 0;
  bottom: 0;     /* ← ruler 높이 대신 전체 높이 */
  width: 2px;
  background: #ff4757;
  z-index: 20;
  pointer-events: none;
  will-change: transform;
}
```

---

## Fix 4: Shift 선택 시 클릭한 클립까지 포함

### 현재 동작
- Shift+클릭 시 `start...end` 범위가 inclusive이지만
- CEO 보고: 클릭한 클립이 포함되지 않음

### 원인 분석
- `useGenerationStatus.ts`의 `toggleVideoSelection`에서 `lastClickedSceneIndex` 업데이트 시점 문제
- Shift+클릭 시 `lastClickedSceneIndex`가 업데이트되지 않으면 다음 Shift+클릭에 영향

### 수정 파일
- `src/hooks/useGenerationStatus.ts`

### 코드 변경

```tsx
// 기존: Shift 클릭 시 lastClickedSceneIndex 업데이트 없음
if (shiftKey && lastClickedSceneIndex !== null && sceneIndex != null) {
  const start = Math.min(lastClickedSceneIndex, sceneIndex);
  const end = Math.max(lastClickedSceneIndex, sceneIndex);
  // ... select range
}

// 변경: Shift 클릭 후에도 lastClickedSceneIndex 업데이트
if (shiftKey && lastClickedSceneIndex !== null && sceneIndex != null) {
  const start = Math.min(lastClickedSceneIndex, sceneIndex);
  const end = Math.max(lastClickedSceneIndex, sceneIndex);
  for (let si = start; si <= end; si++) { ... }
  setLastClickedSceneIndex(sceneIndex);  // ← 추가
} else {
  // 일반 클릭
  setLastClickedSceneIndex(sceneIndex ?? null);  // ← 이미 있는지 확인
}
```

---

## Fix 4-1: Ken Burns 효과 일괄 적용

### 현재 동작
- Ken Burns 기능 미구현

### 수정 후 동작
- Step 6 (영상화)에서 각 씬에 Ken Burns 효과 드롭다운 (효과 없음/줌인/줌아웃/패닝 좌→우)
- "Ken Burns 일괄 적용" 버튼으로 선택된 모든 씬에 동일 효과 적용
- 효과 설정은 store에 저장 → 이후 영상 생성 프롬프트에 반영

### 수정 파일
- `src/store/projectStore.ts` — `kenBurnsPerScene: Record<string, string>` 추가
- `src/components/storyboard/SceneRow.tsx` — Ken Burns 드롭다운 UI
- `src/components/storyboard/SeedCheckPhase.tsx` — 일괄 적용 버튼
- `src/hooks/useGenerationStatus.ts` — Ken Burns 상태 관리
- `src/index.css` — 드롭다운 스타일

### 코드 설계

```tsx
// projectStore.ts에 추가
kenBurnsPerScene: Record<string, string>;  // sceneId → 'none'|'zoom-in'|'zoom-out'|'pan-lr'
setKenBurnsForScene: (sceneId: string, effect: string) => void;
setKenBurnsForAll: (effect: string) => void;

// SceneRow에 드롭다운 추가
<select value={kenBurns} onChange={e => setKenBurnsForScene(scene.id, e.target.value)}>
  <option value="none">효과 없음</option>
  <option value="zoom-in">줌인</option>
  <option value="zoom-out">줌아웃</option>
  <option value="pan-lr">패닝 (좌→우)</option>
</select>

// SeedCheckPhase 하단에 일괄 버튼
<button onClick={() => setKenBurnsForAll('zoom-in')}>
  Ken Burns 일괄 적용 ▾
</button>
```

---

## Fix 5: 에셋 적용범위 드래그 확장/축소

### 현재 동작
- 인라인 에셋 인디케이터에 아이콘+세로선만 표시
- 드래그 핸들 없음

### 수정 후 동작
- 에셋 범위의 첫 클립/마지막 클립 위치에 드래그 핸들 표시
- 핸들을 위/아래로 드래그 → 인접 클립으로 범위 확장/축소
- 마우스 오버 시 핸들이 나타남 (평소에는 숨김)

### 수정 파일
- `src/components/editor/VrewClipList.tsx` — 드래그 핸들 렌더링 + 드래그 로직
- `src/index.css` — 드래그 핸들 스타일

### 코드 설계

```tsx
// VrewClipList에서 에셋 인디케이터 위/아래에 핸들 추가:

{isRangeStart && range && (
  <div
    className="vrew-clip-list__asset-resize-handle vrew-clip-list__asset-resize-handle--top"
    onMouseDown={(e) => startAssetResize(e, range.id, 'top')}
  />
)}

{isRangeEnd && range && (
  <div
    className="vrew-clip-list__asset-resize-handle vrew-clip-list__asset-resize-handle--bottom"
    onMouseDown={(e) => startAssetResize(e, range.id, 'bottom')}
  />
)}
```

드래그 로직:
- mousedown 시 현재 range의 start/end 인덱스 저장
- mousemove 시 마우스 Y 위치로 가장 가까운 클립 인덱스 계산
  - 각 클립 카드의 getBoundingClientRect() 중앙값과 비교
  - top 핸들: startClipIndex 변경 (0 ~ endClipIndex)
  - bottom 핸들: endClipIndex 변경 (startClipIndex ~ clipCount-1)
- mouseup 시 `onMediaRangeResize(rangeId, newStart, newEnd)` 호출

---

## 구현 순서 (의존성 기반)

```
Step 1 (병렬): Fix 2 (canSplit 버퍼 축소) + Fix 4 (Shift 선택)
Step 2: Fix 1 (재생바 드래그) + Fix 3 (재생바 세로 관통) — 같은 파일
Step 3: Fix 5 (에셋 드래그)
Step 4: Fix 4-1 (Ken Burns)
Step 5: 빌드 + QA
```

---

## 수정 파일 총 목록

| # | 파일 | 변경 |
|---|------|------|
| 1 | `EditorTimeline.tsx` | Fix 1 (드래그 seek) + Fix 3 (playhead 전체 높이) |
| 2 | `useCinematicEditor.ts` | Fix 2 (canSplit 버퍼 축소) |
| 3 | `useGenerationStatus.ts` | Fix 4 (Shift 선택 범위 수정) |
| 4 | `VrewClipList.tsx` | Fix 5 (에셋 드래그 핸들) |
| 5 | `projectStore.ts` | Fix 4-1 (kenBurnsPerScene 상태) |
| 6 | `SceneRow.tsx` | Fix 4-1 (Ken Burns 드롭다운) |
| 7 | `SeedCheckPhase.tsx` | Fix 4-1 (일괄 적용 버튼) |
| 8 | `index.css` | Fix 3 (playhead CSS) + Fix 5 (핸들 CSS) + Fix 4-1 (KB 드롭다운) |

**수정 7개 + CSS 1개 = 총 8파일**

---

## 검증 체크리스트

- [ ] `npm run build` 에러 없음
- [ ] 시네마틱 모드: 눈금자 드래그 → 재생바 실시간 이동
- [ ] 시네마틱 모드: 재생바 멈추고 자르기 → 어디서든 활성화
- [ ] 시네마틱 모드: 재생바가 영상+음성+자막 트랙 전체 관통
- [ ] 영상화 단계: Shift+클릭 → 클릭한 씬까지 포함 선택
- [ ] 영상화 단계: Ken Burns 드롭다운 + 일괄 적용
- [ ] 나레이션 모드: 에셋 핸들 위/아래 드래그 → 범위 확장/축소
- [ ] 기존 기능 정상 작동
