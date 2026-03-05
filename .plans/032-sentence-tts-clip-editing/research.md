# 032 리서치: 문장별 TTS + Vrew 스타일 클립 편집

> 작성: CTO 일론 | 날짜: 2026-03-05

---

## CEO 요구사항 정리

| # | 요구사항 | 유형 |
|---|---------|------|
| 1 | TTS 성공 확인 | ✅ 완료 |
| 2 | 문장별 개별 음성 생성 (통째로→개별로) | 기능 개선 |
| 3 | "여기서 나누기" 엔터 작동 안 함 | 버그 |
| 4 | Vrew 스타일 칩/클립 단위 이미지·영상 적용 | 신규 기능 |
| 5 | 편집 단계 이미지·영상 적용 범위를 클립 단위로 | 신규 기능 |

---

## 1. 문장별 TTS — 현재 vs 필요

### 현재 방식 (문제)
- `NarrationVoiceStep.tsx`: **전체 대본을 1회 TTS API 호출**
- 결과 오디오를 글자 수 비율로 문장별 타이밍 추정
- → 추정이 부정확 → 문장별 재생 시 이상하게 들림

### 필요한 변경
- 문장별 **개별 TTS 호출** (병렬 가능)
- 각 문장 실제 오디오 길이 측정
- 문장별 개별 오디오 URL → 재생/재생성 가능

### 관련 파일
| 파일 | 역할 | 변경 필요 |
|------|------|----------|
| `src/components/narration/NarrationVoiceStep.tsx` | TTS 호출 로직 | 🔴 핵심 변경 |
| `src/services/ai-tts.ts` | TTS API 호출 | 변경 없음 |
| `src/store/projectStore.ts` | sentenceTimings 저장 | 🟡 audioUrl 필드 추가 |

### 트레이드오프
| 항목 | 현재 (통째로) | 변경 (문장별) |
|------|-------------|-------------|
| API 호출 수 | 1회 | N회 (문장 수) |
| 타이밍 정확도 | ❌ 글자수 추정 | ✅ 실제 측정 |
| 개별 재생 | ❌ 시간대 자르기 | ✅ 독립 오디오 |
| 개별 재생성 | ❌ 전체 재생성 | ✅ 문장만 재생성 |
| 처리 시간 | 빠름 (1회) | 비슷 (병렬 시) |

---

## 2. "여기서 나누기" 버그

### 현재 구현
- `VrewClipTokens.tsx`: 단어 gap 클릭 → Enter 누르면 분할
- `handleKeyDown` → `onSplitAfterWord()` 호출

### 버그 원인 (추정)
- `useEffect`가 `selectedSplitIndex === null`일 때 리스너 미등록
- 리스너 등록/해제 타이밍과 React 비동기 렌더링 충돌 가능
- 또는 다른 컴포넌트가 Enter 키를 가로채는 문제

### 수정 방안
- 리스너를 항상 등록하고, 내부에서 조건 체크
- 또는 gap 클릭 시 바로 분할 (Enter 확인 단계 제거)

---

## 3. 클립 단위 이미지/영상 적용 — 현재 상태

### 현재 데이터 구조
```typescript
interface NarrationClip {
  imageUrl: string;     // 클립 전체에 1개 이미지
  videoUrl: string;     // 클립 전체에 1개 영상
  sentences: SentenceTiming[];
}
```

### 현재 지원 범위
| 수준 | 지원 여부 | 설명 |
|------|----------|------|
| 씬 단위 | ✅ | sceneImages/sceneVideos |
| 클립 단위 | ✅ 부분 | NarrationClip.imageUrl |
| 문장 단위 | ❌ | 미구현 |
| 단어(칩) 단위 | ❌ | 미구현 |

### CEO가 원하는 것 (Vrew 참조)
- 클립 = 단어 칩들이 자막으로 한번에 나오는 단위
- 클립별로 이미지/영상 교체 가능
- 우클릭 → 채우기, 교체, 적용 범위 변경 등
- 이미지/영상 적용 범위를 클립/칩 단위로 세밀 조정

---

## 4. 구현 완성도 요약

| 요구사항 | 완성도 | 핵심 변경 파일 |
|---------|--------|--------------|
| 문장별 TTS | 10% | NarrationVoiceStep.tsx |
| 여기서 나누기 버그 | 85% (수정 필요) | VrewClipTokens.tsx |
| 클립 단위 이미지 적용 | 60% | VrewClipCard.tsx, projectStore.ts |
| 편집 적용 범위 | 70% | VrewEditor.tsx |

### 이미 잘 되어있는 것 ✅
- `splitClipAtWord()` — 단어 위치에서 클립 분할 함수
- `NarrationClip` — 클립별 imageUrl/videoUrl 필드
- `VrewClipCard` — 클립별 이미지/영상 생성 버튼
- `enrichWithWordTimings()` — 단어별 타이밍 자동 추가

---

## CPO 분석

> (유나 분석 완료 시 여기에 통합)

---

## 다음 단계

1. CPO 분석 통합 후 **plan.md 작성**
2. CEO 검토 및 승인
3. 구현 (승인 후)
