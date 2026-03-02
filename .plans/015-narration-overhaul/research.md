# 015 리서치: 이미지 생성 버그 + 나레이션 워크플로우

## 이미지 생성 버그 — 근본 원인

### 원인: checked 필드 불일치

나레이션 모드에서 TimelinePage의 Step 3(Split)이 씬을 자동 생성할 때 `checked: false`로 설정합니다.
StoryboardPage는 `allScenes.filter(s => s.checked !== false)`로 필터링합니다.

**결과:** 나레이션 모드의 씬이 전부 필터링되어 useGeneration에 0~4개만 전달됨.

| 모드 | 씬 생성 위치 | checked 값 | 필터 결과 |
|------|-------------|-----------|----------|
| 시네마틱 | IdeaPage | `true` | 통과 |
| 나레이션 | TimelinePage Step 3 | `false` | **제거됨** |

### 영향 범위
- useGeneration의 sceneGenStatus 초기화도 필터링된 씬만 포함
- generateAllScenes의 pending 목록도 축소됨
- doneSceneCount / allImagesDone 판정도 잘못됨

## 나레이션 워크플로우 현황

### 이미 구현된 것 (8스텝)
1. Script (IdeaPage) — 대본 + 스타일
2. Voice (TimelinePage) — TTS 생성 + 문장 타이밍
3. Split (TimelinePage) — 자동 씬 분할
4. Direct (StoryboardPage) — 카드 선택
5. Image (StoryboardPage) — 이미지 생성
6. Video (TimelinePage) — 영상 생성 + Ken Burns
7. Edit (TimelinePage) — 편집
8. Export — 미구현

### CEO 요구사항과의 차이
- IdeaPage에서 씬 개수 선택기가 나레이션에서도 보임 → 제거 필요
- Step 5에서 하단 푸터에 "AI 분석" 버튼 없이 바로 이미지 생성 버튼 → 이전 커밋에서 수정 시도했으나 확인 필요
- 이미지 선택 → 영상 생성 흐름이 없음 → 현재는 일괄만
