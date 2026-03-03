# 020 - 나레이션 씬 분할 개선 + 미리듣기 리서치

> 작성일: 2026-03-03 | 작성: 린 (FE 아키텍트)
> 요청: CEO - "씬 분할 나누기 기능 + 미리듣기"

---

## 1. 현재 구조 분석

### A. 데이터 흐름 (TTS 생성 -> 씬 분할)

```
[NarrationVoiceStep] TTS 생성
    |
    |-- generateTTS(text) --> audioUrl (Blob URL)
    |-- 문장 분리: text.match(/[^.!?\n]+[.!?\n]?/g)
    |-- 타이밍 추정: 한국어 4자/초 기반으로 startTime/endTime 계산
    |-- store에 저장: narrativeAudioUrl, sentenceTimings[]
    |
    v
[NarrationSplitStep] 씬 분할
    |-- sentenceTimings[]를 읽어서 autoSplit(timings, maxDuration)
    |-- maxDuration (5/6/8/10/15초) 기준으로 SplitGroup[] 생성
    |-- 나누기(Scissors): group.sentences.length >= 2일 때만 활성
    |-- 합치기(Merge): 인접 그룹 병합
    |-- "다음" 클릭 시 scenes[] + narrationClips[] store 업데이트
```

### B. sentenceTimings가 "비어있는" 문제 - 진짜 원인

CEO가 보고한 "sentenceTimings가 비어있어서 모든 씬이 문장 1개"라는 문제는 **잘못된 진단**입니다.

실제로는:
1. `NarrationVoiceStep.tsx:71-86`에서 TTS 생성 후 **프론트엔드에서 문장 분리 + 타이밍 추정**을 수행합니다.
2. `text.match(/[^.!?\n]+[.!?\n]?/g)` 정규식으로 문장을 분리합니다.
3. 각 문장에 대해 `length / 4` (한국어 4자/초)로 duration을 추정합니다.

따라서 sentenceTimings는 **비어있지 않고 항상 생성됩니다**. 다만:
- 대본에 마침표(`.`)나 물음표(`?`)가 없으면 전체가 하나의 문장으로 인식됩니다.
- 결과적으로 `sentenceTimings.length === 1`이 되어 나누기 버튼이 비활성됩니다.

### C. 핵심 문제: 타이밍 추정의 부정확성

| 항목 | 현재 상태 | 문제 |
|------|----------|------|
| 문장 분리 | 정규식 기반 (`.!?\n`) | 마침표 없는 대본은 1문장으로 인식 |
| 타이밍 계산 | `length / 4` (추정) | 실제 오디오 길이와 다를 수 있음 |
| TTS API 반환값 | audioUrl만 (타이밍 없음) | Mock: 1초 무음 WAV, Fish Speech: 타이밍 미포함 |
| 오디오 실제 길이 | 알 수 없음 | estimatedDuration은 추정값, 실제 Blob 길이와 다름 |

### D. TTS Provider 분석 (`ai-tts.ts`)

```
Mock Provider:
  - 1초짜리 무음 WAV Blob 생성
  - estimatedDuration = text.length / 4 (추정)
  - sentenceTimings: API 아닌 VoiceStep에서 프론트엔드 계산

Fish Speech Provider:
  - POST /v1/tts → 오디오 바이너리(mp3) 반환
  - 타이밍 데이터 없음 (API가 word/sentence level timing 미지원)
  - estimatedDuration = text.length / 4 (추정)
```

**결론:** 어떤 TTS Provider를 사용하든 정확한 sentence-level 타이밍 데이터는 없습니다.

---

## 2. CEO 요구사항 분석

### 요구사항 1: "5초 단위로 끊어서 씬 만들기"

**현재 상태:** `autoSplit()` 함수가 이미 존재하고 정확히 이 기능을 수행합니다.
- `NarrationSplitStep.tsx:26-54`: maxDuration 기준으로 sentenceTimings를 그룹핑
- `narration-sync.ts:147-193`: `autoSplitToClips()` 유틸도 동일 기능

**문제:** sentenceTimings의 타이밍이 추정값이므로 실제 오디오와 불일치합니다.
- Mock: 1초 무음이므로 아무 의미 없음
- Real API: 실제 오디오 길이를 모르므로 5초 단위 분할이 부정확

**해결 방향:** HTML5 Audio의 `duration` 속성으로 실제 오디오 길이를 알아낸 후, 문장 비율로 타이밍을 보정하면 더 정확해집니다.

### 요구사항 2: "미리듣기 (해당 씬 구간 오디오 재생)"

**현재 상태:**
- `NarrationVoiceStep`: 전체 오디오 미리듣기만 지원 (Play/Pause)
- `NarrationSplitStep`: 미리듣기 기능 없음
- `NarrationEditView`: 전체 재생 + 클립 클릭 시 해당 시간으로 점프 기능 있음

**구현 가능 여부:** 높음
- `narrativeAudioUrl` (Blob URL)을 `new Audio()`로 로드
- `audio.currentTime = group.audioStartTime`으로 시작 지점 설정
- `timeupdate` 이벤트에서 `audio.currentTime >= group.audioEndTime`이면 정지
- HTML5 Audio API로 구간 재생이 완전히 가능합니다.

**단, Mock Provider에서는 1초 무음이므로 미리듣기가 무의미합니다.**

### 요구사항 3: "단어/문장 단위 씬 분할"

**현재 상태:**
- SentenceTiming에는 `text`, `startTime`, `endTime`만 있음
- word-level 데이터 없음
- 나누기는 `sentences.length >= 2`일 때만 가능 (문장 단위)

**Word-level 분할 방법:**
1. **프론트엔드 텍스트 파싱:** 각 문장을 단어로 쪼개고, 문장 duration을 단어 수 비율로 재분배
2. **SentenceTiming 확장:** `words?: WordTiming[]` 필드 추가 (선택적)
3. **분할 UI:** 문장 내 단어 클릭 시 해당 지점에서 분할

---

## 3. 관련 코드 상세 분석

### 파일별 역할

| 파일 | 역할 | 수정 필요 |
|------|------|----------|
| `NarrationVoiceStep.tsx` | TTS 생성 + 문장 분리 + 타이밍 추정 | 오디오 실제 길이 보정 추가 |
| `NarrationSplitStep.tsx` | 씬 분할 UI + autoSplit + 나누기/합치기 | 미리듣기 버튼 추가, 단어 분할 UI |
| `projectStore.ts` | SentenceTiming 타입, store 상태 | 타입 확장 불필요 (기존 구조 활용) |
| `ai-tts.ts` | TTS API 호출 | 변경 불필요 (타이밍은 프론트에서 계산) |
| `narration-sync.ts` | 유틸: autoSplitToClips, splitClip, mergeClips 등 | 이미 충분히 완성됨 |
| `index.css` | narration-split-step 스타일 | 미리듣기 버튼 스타일 추가 |

### NarrationSplitStep 현재 UI 구조

```
narration-split-step
  ├── header (제목 + 분할 기준 5/6/8/10/15초)
  ├── list
  │   └── group-wrapper (반복)
  │       ├── scene
  │       │   ├── scene-header (씬 번호 + 시간 + 나누기 버튼)
  │       │   ├── scene-text (대본 텍스트)
  │       │   └── sentence-count (문장 N개)
  │       └── boundary (합치기 버튼)
  └── footer (이전/다음 버튼)
```

### NarrationEditView의 오디오 재생 패턴 (참고용)

```typescript
// Audio 초기화
const audioRef = useRef<HTMLAudioElement | null>(null);
useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.src = narrativeAudioUrl;
    // ...
}, [narrativeAudioUrl]);

// 특정 시간으로 점프
audioRef.current.currentTime = clip.audioStartTime;

// requestAnimationFrame으로 시간 추적
const tick = () => {
    setCurrentTime(audioRef.current.currentTime);
    animFrameRef.current = requestAnimationFrame(tick);
};
```

---

## 4. 구현 방안 정리

### 방안 A: 최소 구현 (미리듣기만)

| 항목 | 내용 |
|------|------|
| 범위 | NarrationSplitStep에 미리듣기(Play) 버튼 추가 |
| 수정 파일 | NarrationSplitStep.tsx, index.css |
| 복잡도 | 낮음 (1-2시간) |
| 제약 | Mock Provider에서는 무음 재생 |

**구현:**
- 각 씬 카드에 Play 버튼 추가
- `new Audio(narrativeAudioUrl)` → `currentTime = audioStartTime` → play
- `timeupdate` 이벤트에서 `audioEndTime` 도달 시 pause

### 방안 B: 미리듣기 + 오디오 길이 보정

| 항목 | 내용 |
|------|------|
| 범위 | 방안 A + TTS 생성 후 실제 오디오 길이로 타이밍 보정 |
| 수정 파일 | NarrationVoiceStep.tsx, NarrationSplitStep.tsx, index.css |
| 복잡도 | 중간 (2-3시간) |
| 장점 | 5초 분할이 실제 오디오 기준으로 정확해짐 |

**구현:**
- TTS 생성 후 `Audio.onloadedmetadata`로 실제 duration 획득
- `realDuration / estimatedDuration` 비율로 모든 sentenceTimings 보정
- NarrationSplitStep에 미리듣기 추가

### 방안 C: 미리듣기 + 오디오 보정 + 단어 단위 분할

| 항목 | 내용 |
|------|------|
| 범위 | 방안 B + 문장 내 단어 클릭으로 분할 지점 선택 |
| 수정 파일 | NarrationVoiceStep.tsx, NarrationSplitStep.tsx, narration-sync.ts, projectStore.ts, index.css |
| 복잡도 | 높음 (4-6시간) |
| 장점 | 가장 세밀한 분할 제어 |

**구현:**
- SentenceTiming 내부에 word-level 분할 지원
- 씬 텍스트 클릭 시 해당 단어 위치에서 분할
- splitClip 함수 확장 (단어 레벨)

---

## 5. 추천 및 주의사항

### 추천: 방안 B

이유:
1. 미리듣기는 필수 (CEO 직접 요청)
2. 오디오 길이 보정은 "5초 단위 분할"의 정확성을 위해 필요
3. 단어 단위 분할은 복잡도 대비 효용이 낮음 (문장 단위로 충분)
4. Mock Provider 상태에서도 구조는 올바르게 작동 (Real API 전환 시 즉시 활용)

### 주의사항

1. **Mock Provider 한계:** 현재 Mock은 1초 무음 WAV를 반환하므로, 미리듣기/보정 기능이 실제로는 무음입니다. Real API 전환 전까지는 "구조적 준비"의 의미만 있습니다.
2. **Blob URL 수명:** `URL.createObjectURL()`로 만든 Blob URL은 페이지 리로드 시 사라집니다. localStorage에 저장된 `narrativeAudioUrl`은 리로드 후 무효화됩니다.
3. **sentenceTimings 정규식:** 한국어 특성상 마침표 없이 쉼표로 구분하는 대본이 많습니다. 정규식에 쉼표(`,`) 구분을 추가하면 분할 정밀도가 올라갑니다.
4. **NarrationEditView tick 버그:** 018 리서치에서 발견된 `tick` 자기참조 문제가 있으므로, 미리듣기 구현 시 동일 패턴을 피해야 합니다.
