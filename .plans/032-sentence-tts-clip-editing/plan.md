# 032 구현 계획: 문장별 TTS + 클립 편집 개선

> 상태: CEO 승인 완료 (2026-03-05)
> 범위: A~D 4개 항목
> 용어: 편집 부분에서만 "씬" → "클립" 표기 변경

---

## A. 문장별 개별 TTS 생성

### 변경 파일
- `src/components/narration/NarrationVoiceStep.tsx`
- `src/store/projectStore.ts` (SentenceTiming에 audioUrl 필드 추가)

### 구현 내용
1. 전체 텍스트 1회 호출 → **문장별 개별 TTS 호출**로 변경
2. 병렬 호출 (Promise.all) + 429 에러 시 순차 폴백
3. 각 문장의 실제 오디오 길이 측정 (추정 아닌 실측)
4. SentenceTiming에 `audioUrl` 필드 추가

```typescript
// SentenceTiming 확장
interface SentenceTiming {
  index: number;
  text: string;
  startTime: number;
  endTime: number;
  audioUrl?: string;       // ← 추가: 문장별 개별 오디오 URL
  words?: WordTiming[];
}
```

```typescript
// 변경: 문장별 개별 TTS 호출
const sentences = text.match(/[^.!?。\n]+[.!?。]?/g) || [text];
const results = await Promise.all(
  sentences.map((s, i) => generateTTS({
    text: s.trim(),
    clipId: `sentence-${i}`,
    voiceId: activePreset?.voice?.voiceId,
  }))
);

// 실제 측정된 길이로 타이밍 계산
let currentTime = 0;
const timings = results.map((r, i) => {
  const timing = {
    index: i,
    text: sentences[i].trim(),
    startTime: currentTime,
    endTime: currentTime + r.estimatedDuration,
    audioUrl: r.audioUrl,
  };
  currentTime += r.estimatedDuration;
  return timing;
});
```

---

## B. 문장별 재생/재생성 UI

### 변경 파일
- `src/components/narration/NarrationVoiceStep.tsx`

### 구현 내용
1. 문장별 **개별 재생 버튼** (▶) — 해당 문장의 audioUrl 재생
2. 문장별 **재생성 버튼** (🔄) — 해당 문장만 TTS 재호출
3. 재생성 시 크레딧 1 차감 (개별), 일괄 생성 시 크레딧 2 차감

### UI 변경
```
문장별 타이밍 (4개)

[▶] 00:00 — 00:02  안녕하세요           [🔄 재생성]
[▶] 00:02 — 00:04  이것은 테스트입니다.   [🔄 재생성]
[▶] 00:04 — 00:06  잘되기를 기원합니다.   [🔄 재생성]
[▶] 00:06 — 00:07  잘될까요?            [🔄 재생성]
```

---

## C. "여기서 나누기" 버그 수정

### 변경 파일
- `src/components/editor/VrewClipTokens.tsx`

### 원인
- `useEffect`가 `selectedSplitIndex === null`일 때 keydown 리스너를 등록하지 않음
- React 비동기 렌더링과 리스너 등록 타이밍 충돌

### 수정
```typescript
// 리스너를 항상 등록, 내부에서 조건 체크
useEffect(() => {
  const handleKey = (e: KeyboardEvent) => {
    if (selectedSplitIndex === null) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      onSplitAfterWord(selectedSplitIndex);
      setSelectedSplitIndex(null);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSelectedSplitIndex(null);
    }
  };
  document.addEventListener('keydown', handleKey);
  return () => document.removeEventListener('keydown', handleKey);
}, [selectedSplitIndex, onSplitAfterWord]);
```

---

## D. 편집 UI 용어 변경 (편집 부분에서만)

### 변경 파일
- `src/components/editor/VrewClipCard.tsx`
- `src/components/editor/VrewClipList.tsx`
- `src/components/editor/VrewEditor.tsx`
- `src/components/editor/EditorTimeline.tsx`
- `src/pages/TimelinePage.tsx`

### 규칙
- **편집 관련 UI 텍스트만** "씬" → "클립"으로 변경
- 코드 변수명/타입명은 변경하지 않음 (안정성)
- 나레이션 모드 편집 화면에만 적용

---

## 구현 순서

| 순서 | 항목 | 담당 | 의존성 |
|------|------|------|--------|
| 1 | C: 버그 수정 | 린 | 없음 |
| 2 | A: 문장별 TTS | 린 | 없음 |
| 3 | B: 재생/재생성 UI | 린 | A 완료 후 |
| 4 | D: 용어 변경 | 누리 | 없음 |
| 5 | QA 검증 | 타로 | 전체 완료 후 |

---

## 크레딧 정책

| 동작 | 크레딧 |
|------|--------|
| 일괄 TTS 생성 (최초) | 2 |
| 개별 문장 재생성 | 1 |

---

*CEO 승인: 2026-03-05, 범위 A~D, 편집 부분만 용어 변경*
