# 033 구현 계획: 시네마틱 멀티트랙 타임라인 에디터

> 상태: **CEO 검토 대기**
> 범위: A~E 5개 항목 (시네마틱 모드 전용)
> 예상 수정 파일: 8개

---

## 전체 변경 요약 (CEO용 쉬운 설명)

| 항목 | 변경 내용 (쉬운 설명) |
|------|---------------------|
| A | 씬 추가하면 "이미지 없음" 박스가 항상 보이고, 영상 길이(5~15초)를 선택할 수 있게 |
| B | 타임라인에서 영상/음성/자막이 각각 따로 움직이게 (캡컷처럼) |
| C | 음성 트랙 빈 곳에 마우스 대면 + 버튼 → 클릭하면 TTS 생성 팝업 |
| D | 자막 트랙 빈 곳에 마우스 대면 + 버튼 → 클릭하면 텍스트 입력, 드래그로 길이 조절 |
| E | 미리보기 영역 작게, 타임라인 영역 크게 (캡컷 비율 참고) |

---

## A. 씬 추가 시 빈 이미지 플레이스홀더 + 영상 길이 선택

### 변경 파일
1. `src/components/editor/ClipDetailPanel.tsx`
2. `src/components/editor/types.ts`
3. `src/components/editor/VrewEditor.tsx`

### A-1. 빈 이미지 플레이스홀더

**현재:** `sceneImageUrl`이 없으면 "시작 이미지" 카드가 통째로 안 보임
**변경:** 항상 "시작 이미지" 카드를 표시하되, 이미지가 없으면 회색 플레이스홀더

```tsx
// ClipDetailPanel.tsx — 시작 이미지 영역 변경
<div className="clip-detail__setting-card">
  <span className="clip-detail__setting-label">시작 이미지</span>
  <div className="clip-detail__setting-thumb">
    {sceneImageUrl ? (
      <img src={sceneImageUrl} alt="시드 이미지" />
    ) : (
      <div className="clip-detail__thumb-placeholder">
        아직 이미지가 없습니다
      </div>
    )}
  </div>
</div>
```

### A-2. 영상 길이 선택

**현재:** `duration: 5` 하드코딩 (4곳)
**변경:** EditorClip에 duration을 동적으로 설정 가능 + ClipDetailPanel에 드롭다운

```tsx
// ClipDetailPanel.tsx — 영상 길이 드롭다운 추가
const DURATION_OPTIONS = [5, 6, 8, 10, 15]; // 초

<div className="clip-detail__header">
  <span className="clip-detail__scene-label">{clip.label}</span>
  <select
    className="clip-detail__duration-select"
    value={clip.duration}
    onChange={(e) => onDurationChange?.(Number(e.target.value))}
  >
    {DURATION_OPTIONS.map(d => (
      <option key={d} value={d}>{d}초</option>
    ))}
  </select>
</div>
```

```typescript
// types.ts — scenesToEditorClips에서 duration 파라미터 지원
// 기본값 5초, 씬별 duration이 있으면 사용
export function scenesToEditorClips(
  scenes: Scene[],
  sceneDurations?: Record<string, number>  // sceneId → duration (초)
): EditorClip[] {
  let acc = 0;
  return scenes.map((s, i) => {
    const duration = sceneDurations?.[s.id] ?? 5;
    // ... 이하 동일, acc += duration
  });
}
```

```typescript
// VrewEditor.tsx — sceneDurations 로컬 상태 추가
const [sceneDurations, setSceneDurations] = useState<Record<string, number>>({});

// duration 변경 핸들러
const handleDurationChange = useCallback((sceneId: string, duration: number) => {
  setSceneDurations(prev => ({ ...prev, [sceneId]: duration }));
  // cinematicClips 재계산은 scenesToEditorClips가 sceneDurations를 참조하므로 자동
}, []);

// handleInsertScene에서도 sceneDurations 참조
const handleInsertScene = useCallback((afterIndex: number) => {
  // ... 기존 로직, duration: 5 대신 기본값 5 유지
  // 새 씬의 duration은 디폴트 5초
}, [/* ... */]);
```

---

## B. 영상/음성/자막 트랙 분리 (독립 아이템)

### 변경 파일
1. `src/components/editor/types.ts` — AudioItem, SubtitleItem 타입 추가
2. `src/components/editor/EditorTimeline.tsx` — 멀티트랙 독립 렌더링
3. `src/components/editor/VrewEditor.tsx` — 오디오/자막 아이템 상태 관리

### B-1. 새 타입 추가 (types.ts)

```typescript
/** 독립 음성 아이템 (시네마틱 모드 타임라인) */
export interface AudioItem {
  id: string;
  startTime: number;   // 타임라인 절대 시간 (초)
  endTime: number;
  audioUrl: string;
  text: string;         // TTS 생성에 사용된 텍스트
}

/** 독립 자막 아이템 (시네마틱 모드 타임라인) */
export interface SubtitleItem {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}
```

### B-2. EditorTimeline 변경

**현재:** 음성/자막 트랙이 clips 배열 기반으로 동일 폭 렌더링
**변경:** 시네마틱 모드일 때 음성/자막 트랙을 독립 아이템 기반으로 렌더링

```tsx
// EditorTimeline 새 props 추가
interface EditorTimelineProps {
  // ... 기존 props
  audioItems?: AudioItem[];       // 독립 음성 아이템
  subtitleItems?: SubtitleItem[]; // 독립 자막 아이템
  onAddAudio?: (startTime: number) => void;    // + 클릭 시
  onAddSubtitle?: (startTime: number) => void; // + 클릭 시
  onMoveAudio?: (id: string, newStartTime: number) => void;   // 드래그 이동
  onMoveSubtitle?: (id: string, newStartTime: number) => void;
  onResizeSubtitle?: (id: string, newEndTime: number) => void; // 자막 리사이즈
  onDeleteAudio?: (id: string) => void;
  onDeleteSubtitle?: (id: string) => void;
}
```

**음성 트랙 렌더링 방식 변경:**

```tsx
{/* 음성 트랙 — 시네마틱 모드: 독립 아이템 기반 */}
<div className="vrew-timeline__track vrew-timeline__track--audio">
  {mode === 'cinematic' && audioItems ? (
    <div className="vrew-timeline__absolute-track" style={{ width: `${totalWidth}px` }}>
      {/* 배경: 1초 간격 + 버튼 (마우스 오버 시) */}
      <TimelineAddZones
        totalDuration={totalDuration}
        pixelsPerSecond={pixelsPerSecond}
        existingItems={audioItems}
        onAdd={onAddAudio}
        type="audio"
      />
      {/* 오디오 아이템들 */}
      {audioItems.map(item => (
        <div
          key={item.id}
          className="vrew-timeline__audio-item"
          style={{
            left: `${item.startTime * pixelsPerSecond}px`,
            width: `${(item.endTime - item.startTime) * pixelsPerSecond}px`,
          }}
          draggable
          // 드래그로 이동 가능
        >
          <span>🔊 {item.text.slice(0, 10)}</span>
          <button onClick={() => onDeleteAudio?.(item.id)}>×</button>
        </div>
      ))}
    </div>
  ) : (
    // 나레이션 모드: 기존 클립 기반 렌더링 (변경 없음)
    clips.map((clip, index) => (/* 기존 코드 */))
  )}
</div>
```

**자막 트랙도 동일 패턴.**

### B-3. TimelineAddZones 서브 컴포넌트 (EditorTimeline 내부)

마우스 오버 시 1초 간격으로 + 버튼을 표시하는 컴포넌트.
기존 아이템이 있는 영역에는 버튼이 안 나옴.

```tsx
// EditorTimeline.tsx 내부 정의
const TimelineAddZones: React.FC<{
  totalDuration: number;
  pixelsPerSecond: number;
  existingItems: { startTime: number; endTime: number }[];
  onAdd?: (startTime: number) => void;
  type: 'audio' | 'subtitle';
}> = ({ totalDuration, pixelsPerSecond, existingItems, onAdd, type }) => {
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const time = Math.floor(px / pixelsPerSecond); // 1초 단위 스냅
    // 기존 아이템과 겹치는지 체크
    const overlaps = existingItems.some(
      item => time >= item.startTime && time < item.endTime
    );
    setHoverTime(overlaps ? null : time);
  };

  return (
    <div
      className="vrew-timeline__add-zones"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverTime(null)}
      style={{ width: '100%', height: '100%', position: 'absolute' }}
    >
      {hoverTime !== null && (
        <button
          className="vrew-timeline__add-btn"
          style={{ left: `${hoverTime * pixelsPerSecond}px` }}
          onClick={() => onAdd?.(hoverTime)}
        >
          <Plus size={10} />
        </button>
      )}
    </div>
  );
};
```

---

## C. 음성 TTS 생성 팝업

### 변경 파일
1. `src/components/editor/EditorTimeline.tsx` — 팝업 트리거 (B에서 통합)
2. `src/components/editor/VrewEditor.tsx` — TTS 생성 로직 + audioItems 상태

### C-1. TTS 생성 팝업 (VrewEditor 내부 상태)

```tsx
// VrewEditor.tsx
const [ttsPopup, setTtsPopup] = useState<{ startTime: number } | null>(null);
const [ttsText, setTtsText] = useState('');
const [isTtsGenerating, setIsTtsGenerating] = useState(false);

// 음성 트랙 + 클릭 핸들러
const handleAddAudio = useCallback((startTime: number) => {
  setTtsPopup({ startTime });
  setTtsText('');
}, []);

// TTS 생성 실행
const handleGenerateTts = useCallback(async () => {
  if (!ttsPopup || !ttsText.trim()) return;
  setIsTtsGenerating(true);
  try {
    const result = await generateTTS({ text: ttsText, clipId: `tts-${Date.now()}` });
    const newItem: AudioItem = {
      id: `audio-${Date.now()}`,
      startTime: ttsPopup.startTime,
      endTime: ttsPopup.startTime + result.estimatedDuration,
      audioUrl: result.audioUrl,
      text: ttsText,
    };
    setAudioItems(prev => [...prev, newItem].sort((a, b) => a.startTime - b.startTime));
    setTtsPopup(null);
  } finally {
    setIsTtsGenerating(false);
  }
}, [ttsPopup, ttsText]);
```

### C-2. 팝업 UI

```tsx
{/* TTS 생성 팝업 — VrewEditor 내부 */}
{ttsPopup && (
  <div className="tts-popup-overlay" onClick={() => setTtsPopup(null)}>
    <div className="tts-popup" onClick={(e) => e.stopPropagation()}>
      <h3>음성 생성 (TTS)</h3>
      <p>시작 시점: {formatTime(ttsPopup.startTime)}</p>
      <textarea
        value={ttsText}
        onChange={(e) => setTtsText(e.target.value)}
        placeholder="음성으로 변환할 텍스트를 입력하세요..."
        rows={3}
      />
      <div className="tts-popup__actions">
        <button onClick={() => setTtsPopup(null)}>취소</button>
        <button
          onClick={handleGenerateTts}
          disabled={isTtsGenerating || !ttsText.trim()}
        >
          {isTtsGenerating ? '생성 중...' : '음성 생성'}
        </button>
      </div>
    </div>
  </div>
)}
```

---

## D. 자막 트랙에 텍스트 추가 + 드래그 리사이즈

### 변경 파일
1. `src/components/editor/EditorTimeline.tsx` — 자막 아이템 렌더링 + 리사이즈 핸들
2. `src/components/editor/VrewEditor.tsx` — subtitleItems 상태 관리
3. `src/components/editor/EditorPreview.tsx` — 자막 아이템 기반 렌더링

### D-1. 자막 추가

```tsx
// VrewEditor.tsx
const [subtitleItems, setSubtitleItems] = useState<SubtitleItem[]>([]);

const handleAddSubtitle = useCallback((startTime: number) => {
  const newItem: SubtitleItem = {
    id: `sub-${Date.now()}`,
    startTime,
    endTime: startTime + 3, // 기본 3초
    text: '자막 텍스트',
  };
  setSubtitleItems(prev => [...prev, newItem].sort((a, b) => a.startTime - b.startTime));
}, []);
```

### D-2. 자막 리사이즈 (드래그)

EditorTimeline에서 자막 블록의 양쪽 끝에 리사이즈 핸들 추가:

```tsx
<div className="vrew-timeline__subtitle-item" style={/* left, width */}>
  {/* 왼쪽 리사이즈 핸들 */}
  <div
    className="vrew-timeline__resize-handle vrew-timeline__resize-handle--left"
    onMouseDown={(e) => handleResizeStart(e, item.id, 'left')}
  />
  {/* 텍스트 (더블클릭으로 편집) */}
  <span
    className="vrew-timeline__subtitle-text"
    onDoubleClick={() => setEditingSubtitle(item.id)}
  >
    {item.text}
  </span>
  {/* 오른쪽 리사이즈 핸들 */}
  <div
    className="vrew-timeline__resize-handle vrew-timeline__resize-handle--right"
    onMouseDown={(e) => handleResizeStart(e, item.id, 'right')}
  />
  {/* 삭제 버튼 */}
  <button onClick={() => onDeleteSubtitle?.(item.id)}>×</button>
</div>
```

### D-3. EditorPreview 자막 변경

**현재:** clip.sentences 기반 자막 렌더링
**변경:** 시네마틱 모드에서는 subtitleItems 기반으로 렌더링

```tsx
// EditorPreview에 새 prop 추가
subtitleItems?: SubtitleItem[];

// 자막 렌더링 로직 변경
const activeSubtitle = subtitleItems?.find(
  s => currentTime >= s.startTime && currentTime < s.endTime
);

// 오버레이에 activeSubtitle.text 표시
```

---

## E. 레이아웃 비율 변경

### 변경 파일
1. `src/index.css`

### E-1. 상단/하단 비율 (미리보기 ↔ 타임라인)

**현재:**
```css
.vrew-editor__main { flex: 1; }           /* 나머지 전부 */
.vrew-timeline { flex-shrink: 0; }         /* 콘텐츠 높이만큼 */
```

**변경:**
```css
.vrew-editor__main { flex: 4; min-height: 0; }  /* 40% */
.vrew-timeline { flex: 6; min-height: 0; }       /* 60% → 타임라인이 더 큼 */
```

### E-2. 3열 비율 조정 (시네마틱)

**현재:** preview(5) : script(2) : detail(3)
**변경:** preview(4) : script(2) : detail(3)  — 미리보기 약간 줄임

### E-3. 트랙 높이 확대

```css
.vrew-timeline__track-label:nth-child(2) { min-height: 60px; }  /* 영상: 40→60 */
.vrew-timeline__track-label:nth-child(3) { min-height: 48px; }  /* 음성: 28→48 */
.vrew-timeline__track-label:nth-child(4) { min-height: 48px; }  /* 자막: 28→48 */
```

---

## 구현 순서

| 순서 | 항목 | 난이도 | 의존성 |
|------|------|--------|--------|
| 1 | E: 레이아웃 비율 | 낮음 | 없음 |
| 2 | A: 빈 이미지 + 영상 길이 선택 | 중간 | 없음 |
| 3 | B: 트랙 분리 (핵심) | 높음 | A |
| 4 | C: TTS 생성 팝업 | 중간 | B |
| 5 | D: 자막 추가 + 리사이즈 | 중간 | B |

---

## 영향 범위

| 영역 | 영향 |
|------|------|
| 시네마틱 모드 타임라인 | 전면 변경 |
| 나레이션 모드 | 변경 없음 (기존 트랙 잠금 유지) |
| 재생 로직 | 멀티 오디오 재생 추가 필요 |
| 스토어 | audioItems/subtitleItems를 저장할지 여부 (로컬 상태로 시작, 추후 스토어 이동) |

---

## 리스크

| 리스크 | 대응 |
|--------|------|
| 타임라인 성능 (아이템 많을 때) | virtualization은 나중에, 우선 20개 이하 |
| 오디오 동시 재생 | Web Audio API 필요할 수 있음 (우선 HTMLAudioElement로 시작) |
| 자막 리사이즈 정밀도 | 0.5초 단위 스냅으로 제한 |

---

*CEO 검토 후 승인 시 구현 시작*
