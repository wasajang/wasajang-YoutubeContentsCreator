# 033 리서치: 시네마틱 멀티트랙 타임라인 에디터

> 작성: CTO 일론 | 날짜: 2026-03-05

---

## CEO 요구사항 5가지

| # | 요구 | 핵심 변경 |
|---|------|----------|
| 1 | 씬 추가 시 빈 이미지 플레이스홀더 + 영상 길이 선택(5/6/8/10/15초) | ClipDetailPanel + types.ts |
| 2 | 영상/음성/자막 트랙을 독립적으로 분리 (캡컷처럼) | EditorTimeline 전면 개편 |
| 3 | 음성 트랙에 마우스 오버 → TTS 생성 팝업 | 새 컴포넌트 + ai-tts 연동 |
| 4 | 자막 트랙에 텍스트 추가 + 드래그 리사이즈 | 새 컴포넌트 + 인라인 편집 |
| 5 | 미리보기 작게 + 타임라인 크게 (캡컷 비율) | CSS 레이아웃 변경 |

---

## 현재 아키텍처 문제점

### 1. 5초 하드코딩 (4곳)
- `types.ts:29` — `scenesToEditorClips()` 내 `const duration = 5`
- `VrewEditor.tsx:365-366` — `handleInsertScene()` 내 `duration: 5, audioEndTime: +5`
- `useVideoRegeneration.ts:39` — `generateVideo()` 호출 시 `duration: 5`
- `useNarrationClipGeneration.ts:158` — 동일

### 2. 3트랙이 클립에 잠김
현재 EditorTimeline의 음성/자막 트랙은 영상 트랙의 EditorClip 배열을 그대로 렌더링.
같은 폭, 같은 위치. 독립 아이템 불가.

### 3. 레이아웃 비율
- 상단 (미리보기+패널): `flex: 1` (나머지 전부)
- 하단 (타임라인): `flex-shrink: 0` (콘텐츠 높이만큼)
→ 미리보기가 너무 크고 타임라인이 너무 작음

### 4. ClipDetailPanel에 빈 이미지 처리 없음
`sceneImageUrl`이 빈 문자열이면 "시작 이미지" 카드가 통째로 사라짐.
→ "아직 이미지가 없습니다" 플레이스홀더 필요

---

## 관련 파일 목록

| 파일 | 수정 필요도 | 변경 내용 |
|------|------------|----------|
| `types.ts` | 높음 | AudioItem, SubtitleItem 타입 추가 |
| `EditorTimeline.tsx` | 매우 높음 | 멀티트랙 독립 아이템 렌더링 |
| `VrewEditor.tsx` | 높음 | 오디오/자막 아이템 상태 관리 + 레이아웃 비율 |
| `ClipDetailPanel.tsx` | 중간 | 빈 이미지 플레이스홀더 + 영상 길이 선택 |
| `EditorPreview.tsx` | 낮음 | 자막 아이템 기반 렌더링 |
| `useEditorPlayback.ts` | 중간 | 멀티 오디오 재생 |
| `index.css` | 높음 | 레이아웃 비율 + 새 스타일 |

---

## 구현 접근법

### AudioItem / SubtitleItem 타입
```typescript
interface AudioItem {
  id: string;
  startTime: number;  // 타임라인 절대 시간 (초)
  endTime: number;
  audioUrl: string;
  text: string;        // TTS 생성 시 사용된 텍스트
}

interface SubtitleItem {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  style?: 'default' | 'bold' | 'italic';
}
```

### 트랙 독립 렌더링
- 영상 트랙: 기존 EditorClip 배열 → 변경 없음
- 음성 트랙: AudioItem[] → startTime 기준 위치, 독립 폭
- 자막 트랙: SubtitleItem[] → startTime 기준 위치, 독립 폭 + 리사이즈

### TTS 생성 팝업
- 음성 트랙 빈 영역에 마우스 오버 → 1초 간격 + 버튼 표시
- 클릭 → 모달 팝업 (텍스트 입력 + 음성 선택 + 생성 버튼)
- 생성 완료 → AudioItem 추가 → 트랙에 렌더링

### 자막 추가
- 자막 트랙 빈 영역에 마우스 오버 → 1초 간격 + 버튼 표시
- 클릭 → 인라인 텍스트 입력
- 양쪽 끝 드래그로 길이(시간) 조절
