# 038: 타임라인 UX 5가지 개선 — 리서치

> CTO 일론 | 2026-03-05

---

## CEO 요구사항 정리

| # | 요구사항 | 현재 상태 |
|---|---------|----------|
| 1 | 재생바 드래그 시 실시간 이동 | 눈금자 클릭 → 순간이동만 가능. 드래그 미구현 |
| 2 | 씬 선택 없이 자르기 | `canSplit`이 `currentClip` 존재 + 범위 내 여부로 판단. 씬 미선택 시 비활성 |
| 3 | 재생바 세로로 전체 트랙 관통 | playhead가 ruler div 안에만 렌더링. 높이가 ruler만큼 |
| 4 | Shift 선택 시 클릭한 클립까지 포함 | `end = Math.max(lastClicked, current)` 범위가 맞지만, 실제 동작에서 off-by-one 가능성 |
| 4-1 | Ken Burns 효과 일괄 적용 버튼 | Ken Burns 기능 자체가 미구현 |
| 5 | 에셋 적용범위 드래그 확장/축소 | 인라인 에셋 인디케이터에 드래그 핸들 없음 |

---

## 상세 코드 분석

### 1. 재생바 드래그 (EditorTimeline.tsx)

**현재 구현:**
- `handleRulerClick` (line 172-179): 눈금자 클릭 시 `px / pixelsPerSecond` → `onSeek(time)`
- 단일 클릭만 처리, mousedown→mousemove→mouseup 드래그 패턴 없음

**필요한 변경:**
- `handleRulerClick` → `handleRulerMouseDown`으로 변경
- mousedown 시 즉시 seek + mousemove 리스너 등록
- mousemove 시 실시간 seek (throttle 없이, RAF로 처리)
- mouseup 시 리스너 해제

**관련 파일:**
- `EditorTimeline.tsx` (line 172-179) — 눈금자 클릭 핸들러
- `useEditorPlayback.ts` (line 191-203) — seekToTime 함수
- `useCinematicEditor.ts` (line 319-330) — handleTimelineSeek (클립 인덱스 동기화)

### 2. 씬 선택 없이 자르기 (useCinematicEditor.ts)

**현재 구현:**
- `canSplit` (line 472-478): `currentClip` 존재 + 시간 범위 내
- `handleSplit` (line 243-287): `cinematicClips[currentClipIndex]` 사용
- 문제: `currentClipIndex`가 항상 유효한 값을 가지므로, 실제 문제는 canSplit 조건

**분석:**
- `currentClipIndex`는 `useEditorPlayback`에서 `findCurrentClip()`으로 자동 계산됨
- 재생바 위치에 해당하는 클립은 항상 존재 → `currentClip`은 항상 유효
- 실제 문제: 재생바가 클립 경계 근처(±0.1초)일 때 비활성화

**필요한 변경:**
- `canSplit`의 0.1초 버퍼를 0.05초로 줄이거나 제거
- 또는 `handleTimelineSeek`가 `setCurrentClipIndex`를 자동으로 호출하는지 확인

### 3. 재생바 세로 전체 관통 (EditorTimeline.tsx)

**현재 구현:**
- playhead는 `.vrew-timeline__ruler` 안에 렌더링 (line 358-369)
- `.vrew-timeline__playhead` CSS: `position: absolute; top: 0` — ruler 내부에만 표시

**필요한 변경:**
- playhead를 ruler가 아닌 `.vrew-timeline__inner` (전체 트랙을 감싸는 컨테이너) 안으로 이동
- 또는 `height: 100vh` + `pointer-events: none`으로 전체 높이 관통

### 4. Shift 선택 범위 수정 (useGenerationStatus.ts)

**현재 구현 (line 91-104):**
```js
const start = Math.min(lastClickedSceneIndex, sceneIndex)
const end = Math.max(lastClickedSceneIndex, sceneIndex)
for (let si = start; si <= end; si++) { ... }
```
- 범위는 `start...end` inclusive로 보임
- CEO 보고: "shift 누르고 선택하면 해당 클립 위에까지만 선택돼"

**가능한 원인:**
- `lastClickedSceneIndex`가 업데이트되지 않거나
- sceneIndex 전달값이 off-by-one이거나
- 단순 toggle이 아닌 "기존 선택 유지 + 범위 추가" 로직 필요

**확인 필요:** SeedCheckPhase에서 `toggleVideoSelection` 호출 시 `index` 값 정확성

### 4-1. Ken Burns 일괄 적용

**현재:** 미구현
**접근:**
- `EditorClip.effect` 필드에 'ken-burns-in' | 'ken-burns-out' 추가
- GeneratePage Step 6에 "Ken Burns 일괄 적용" 토글 버튼
- 각 씬에 Ken Burns 드롭다운 (효과 없음/줌인/줌아웃)

### 5. 에셋 적용범위 드래그 (VrewClipList.tsx)

**현재 구현:**
- 인라인 에셋 인디케이터에 아이콘+세로선만 표시
- 드래그 핸들 없음
- `onMediaRangeResize` prop은 존재하지만 UI 미연결

**Vrew 참고 (CEO 스크린샷):**
- 에셋 아이콘 위/아래에 가로 바(핸들)가 있음
- 위 핸들 드래그 → 위 클립으로 범위 확장
- 아래 핸들 드래그 → 아래 클립으로 범위 확장/축소
- 마우스 오버 시 핸들이 애니메이션으로 나타남

**필요한 변경:**
- 에셋 인디케이터 `--start` / `--end` 위치에 드래그 핸들 추가
- mousedown → mousemove → mouseup 패턴으로 인접 클립으로 확장
- 가장 가까운 클립 경계로 스냅

---

## 구현 난이도 평가

| # | 작업 | 난이도 | 수정 파일 수 |
|---|------|--------|------------|
| 1 | 재생바 드래그 | 중 | 1 (EditorTimeline) |
| 2 | 씬 선택 없이 자르기 | 하 | 1 (useCinematicEditor) |
| 3 | 재생바 세로 관통 | 하 | 1 (EditorTimeline) + CSS |
| 4 | Shift 선택 수정 | 하 | 1 (useGenerationStatus) |
| 4-1 | Ken Burns 일괄 | 중 | 3+ (types, GeneratePage, SceneRow, CSS) |
| 5 | 에셋 드래그 확장 | 중 | 1 (VrewClipList) + CSS |
