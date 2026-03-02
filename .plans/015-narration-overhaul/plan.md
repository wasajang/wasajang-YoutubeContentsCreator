# 015 이미지 생성 버그 수정 + 나레이션 UX 개선

> 작성: CTO 일론 (2026-03-02)
> 상태: CEO 검토 대기
> 근거: research.md

---

## 수정 항목 요약

| # | 문제 | 수정 |
|---|------|------|
| 1 | 나레이션 씬이 전부 필터링되어 이미지 생성 불가 | checked 필터 로직 수정 |
| 2 | 나레이션 IdeaPage에 불필요한 씬 개수 선택기 | 나레이션 모드 숨김 |
| 3 | 나레이션 Step 5 하단에 "AI 분석" 버튼 없음 | 이전 수정 확인 + 보완 |
| 4 | 이미지 선택 후 영상 생성 기능 없음 | 이미지 선택 → 영상 생성 UI |

---

## Phase 1: 이미지 생성 버그 수정 (긴급)

### 1-1. StoryboardPage 필터 로직 수정

**파일:** `src/pages/StoryboardPage.tsx:45`

```tsx
// 현재 — 나레이션 씬 전부 필터됨
const scenes = allScenes.filter(s => s.checked !== false);

// 수정 — 나레이션 모드에서는 필터 스킵
const scenes = mode === 'narration'
    ? allScenes
    : allScenes.filter(s => s.checked !== false);
```

### 1-2. useGeneration sceneGenStatus 안정화

**파일:** `src/hooks/useGeneration.ts`

scenes가 늦게 바뀌어도 sceneGenStatus에 반영되도록 useEffect 추가:

```tsx
// useState 초기화 이후 추가
useEffect(() => {
    setSceneGenStatus((prev) => {
        const updated = { ...prev };
        scenes.forEach((s) => {
            if (!(s.id in updated)) {
                updated[s.id] = s.imageUrl ? 'done' : 'idle';
            }
        });
        return updated;
    });
}, [scenes]);
```

---

## Phase 2: 나레이션 IdeaPage 개선

### 2-1. 나레이션 모드에서 씬 개수 선택기 숨김

**파일:** `src/pages/IdeaPage.tsx` — 2열 설정 패널

```tsx
{/* 씬 개수 선택 — 시네마틱에서만 */}
{mode !== 'narration' && (
    <div className="idea-settings-section">
        <div className="idea-settings-label">씬 개수</div>
        ...
    </div>
)}
```

### 2-2. 나레이션 모드 "다음" 버튼 텍스트

```tsx
// 현재: "다음: 나레이션 생성 →"
// 수정: "다음: 음성 생성 →" (더 명확)
```

---

## Phase 3: 이미지 선택 → 영상 생성 UI

### 3-1. SeedCheckPhase에 이미지 선택 기능

이미지 생성 완료 후, 각 이미지에 체크박스 추가.
선택한 이미지만 영상 생성 대상으로 지정.

**접근 방식 2가지:**

**A안: 인라인 체크박스 (추천)**
- SceneFilmstrip의 각 프레임에 체크박스 추가
- 기본: 전체 선택
- 하단 버튼: "선택한 N개 영상 생성" + "전체 영상 생성"

**B안: 팝업 선택 (CEO 제안)**
- "영상 생성" 버튼 클릭 시 팝업
- 팝업 내에서 이미지 그리드 + 체크박스
- "선택 생성" / "전체 생성" 버튼

**추천: A안 + 전체 생성 시 확인 팝업**
- 기본 UI는 인라인 (추가 클릭 없이 빠른 선택)
- "전체 영상 생성" 클릭 시 크레딧 안내 팝업

### 3-2. 구현 상세

**useGeneration에 선택 상태 추가:**
```tsx
const [selectedForVideo, setSelectedForVideo] = useState<Set<string>>(new Set());

// 이미지 생성 완료 시 자동 선택
useEffect(() => {
    if (allImagesDone) {
        setSelectedForVideo(new Set(scenes.map(s => s.id)));
    }
}, [allImagesDone]);

// 선택된 씬만 영상 생성
const generateSelectedVideos = useCallback(() => {
    const targets = scenes.filter(s => selectedForVideo.has(s.id));
    targets.forEach((scene, i) => {
        setTimeout(() => generateSingleVideo(scene.id), i * 800);
    });
}, [selectedForVideo, scenes, generateSingleVideo]);
```

**SceneFilmstrip에 체크박스:**
```tsx
{allImagesDone && (
    <input
        type="checkbox"
        checked={selectedForVideo.has(frame.sceneId)}
        onChange={() => toggleVideoSelection(frame.sceneId)}
    />
)}
```

**하단 버튼:**
```tsx
// 이미지 완료 후
<button onClick={generateSelectedVideos}>
    선택한 {selectedForVideo.size}개 영상 생성
</button>
```

---

## 수정 파일 목록

| 파일 | Phase | 변경 |
|------|-------|------|
| `src/pages/StoryboardPage.tsx` | 1 | 나레이션 필터 스킵 |
| `src/hooks/useGeneration.ts` | 1, 3 | sceneGenStatus 동기화 + 영상 선택 |
| `src/pages/IdeaPage.tsx` | 2 | 나레이션 씬 개수 숨김 |
| `src/components/storyboard/SeedCheckPhase.tsx` | 3 | 영상 선택 UI |
| `src/components/storyboard/SceneFilmstrip.tsx` | 3 | 체크박스 |

---

## 구현 순서

```
Phase 1 (긴급) → 빌드 확인 → Phase 2 → Phase 3 → 전체 테스트
```

Phase 1만 수정해도 이미지 생성 문제는 해결됩니다.
Phase 2-3은 UX 개선입니다.

---

*CEO 검토 후 구현을 시작합니다.*
