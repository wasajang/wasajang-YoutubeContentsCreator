/**
 * narration-sync.ts
 * 나레이션 오디오-영상 동기화 유틸리티
 *
 * 순수 TypeScript — React 의존성 없음, 외부 라이브러리 없음.
 *
 * NOTE: SentenceTiming, NarrationClip 타입은 projectStore에서 import.
 * 만약 Phase A 진행 전이라 store에 타입이 없다면,
 * 아래 import 라인 대신 로컬 타입 정의 섹션을 활성화하세요.
 */
import type { SentenceTiming, NarrationClip, WordTiming } from '../store/projectStore';

// ─────────────────────────────────────────────────────────────────
// [로컬 타입 폴백]
// store에서 import가 불가능한 경우 아래 주석을 해제하세요.
// Phase A 완료 후에는 위 import를 사용하고 이 블록은 삭제합니다.
// ─────────────────────────────────────────────────────────────────
// export interface SentenceTiming {
//   index: number;
//   text: string;
//   startTime: number;
//   endTime: number;
// }
//
// export interface NarrationClip {
//   id: string;
//   sceneId: string;
//   text: string;
//   sentences: SentenceTiming[];
//   imageUrl: string;
//   videoUrl: string;
//   isVideoEnabled: boolean;
//   effect: 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right';
//   audioStartTime: number;
//   audioEndTime: number;
//   duration: number;
//   order: number;
//   isModified: boolean;
// }

// ─────────────────────────────────────────────────────────────────
// 헬퍼: SentenceTiming duration 계산 (store 타입에는 duration 필드 없음)
// ─────────────────────────────────────────────────────────────────
/** 단일 문장의 duration(초)을 반환합니다. */
export function sentenceDuration(s: SentenceTiming): number {
  return s.endTime - s.startTime;
}

// ─────────────────────────────────────────────────────────────────
// 헬퍼: 클립 기본값 (새 클립 생성 시 반복 코드 제거)
// ─────────────────────────────────────────────────────────────────
function makeClipDefaults(): Pick<
  NarrationClip,
  'imageUrl' | 'videoUrl' | 'isVideoEnabled' | 'effect' | 'isModified'
> {
  return {
    imageUrl: '',
    videoUrl: '',
    isVideoEnabled: false,
    effect: 'none',
    isModified: false,
  };
}

// ─────────────────────────────────────────────────────────────────
// 1. findCurrentClip
// ─────────────────────────────────────────────────────────────────

/**
 * 현재 오디오 재생 시간에 해당하는 클립 찾기.
 *
 * @param currentTime - 현재 재생 위치 (초)
 * @param clips       - NarrationClip 배열 (order 기준 정렬 권장)
 * @returns 해당 클립 또는 null (범위 외)
 *
 * 구현: 이진 탐색 (O(log n)) — 클립 수가 많을 때 성능 보장.
 * clips이 audioStartTime 순으로 정렬되어 있다고 가정.
 */
export function findCurrentClip(
  currentTime: number,
  clips: NarrationClip[]
): NarrationClip | null {
  if (clips.length === 0) return null;

  let lo = 0;
  let hi = clips.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const clip = clips[mid];

    if (currentTime < clip.audioStartTime) {
      hi = mid - 1;
    } else if (currentTime >= clip.audioEndTime) {
      lo = mid + 1;
    } else {
      // audioStartTime <= currentTime < audioEndTime
      return clip;
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────
// 2. findCurrentSentence
// ─────────────────────────────────────────────────────────────────

/**
 * 현재 시간에 해당하는 자막(문장) 찾기.
 *
 * @param currentTime - 현재 재생 위치 (초, 전체 오디오 기준)
 * @param clip        - 검색 대상 클립
 * @returns 해당 SentenceTiming 또는 null
 *
 * 구현: 순차 탐색 — 한 클립 내 문장 수는 보통 1~10개로 적음.
 */
export function findCurrentSentence(
  currentTime: number,
  clip: NarrationClip
): SentenceTiming | null {
  for (const sentence of clip.sentences) {
    if (currentTime >= sentence.startTime && currentTime < sentence.endTime) {
      return sentence;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// 3. autoSplitToClips
// ─────────────────────────────────────────────────────────────────

/**
 * SentenceTiming[] 배열을 기반으로 씬을 자동 분할하여 NarrationClip[] 생성.
 *
 * @param timings     - TTS 분석 결과 문장 타이밍 배열
 * @param maxDuration - 클립 최대 길이(초), 기본값 5초
 * @returns NarrationClip 배열
 *
 * 분할 규칙:
 *  - 현재 그룹에 문장을 추가했을 때 총 duration이 maxDuration을 초과하면
 *    새 그룹을 시작한다.
 *  - 단, 그룹이 비어있으면 초과하더라도 해당 문장을 현재 그룹에 포함시킨다
 *    (단일 문장이 maxDuration보다 긴 경우 처리).
 */
export function autoSplitToClips(
  timings: SentenceTiming[],
  maxDuration: number = 5
): NarrationClip[] {
  if (timings.length === 0) return [];

  const groups: SentenceTiming[][] = [];
  let currentGroup: SentenceTiming[] = [];

  for (const sentence of timings) {
    const groupStart =
      currentGroup.length > 0 ? currentGroup[0].startTime : sentence.startTime;
    const projectedDuration = sentence.endTime - groupStart;

    if (currentGroup.length > 0 && projectedDuration > maxDuration) {
      // 현재 그룹 마감, 새 그룹 시작
      groups.push(currentGroup);
      currentGroup = [sentence];
    } else {
      // 현재 그룹에 추가 (그룹이 비어있으면 무조건 추가)
      currentGroup.push(sentence);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups.map((sentences, index) => {
    const first = sentences[0];
    const last = sentences[sentences.length - 1];
    const audioStartTime = first.startTime;
    const audioEndTime = last.endTime;

    return {
      ...makeClipDefaults(),
      id: `narr-clip-${index}`,
      sceneId: `scene-${index}`,
      text: sentences.map((s) => s.text).join(' '),
      sentences,
      audioStartTime,
      audioEndTime,
      duration: audioEndTime - audioStartTime,
      order: index,
    };
  });
}

// ─────────────────────────────────────────────────────────────────
// 4. splitClip
// ─────────────────────────────────────────────────────────────────

/**
 * 클립을 두 개로 나누기.
 *
 * @param clip                   - 분할할 클립
 * @param splitAfterSentenceIndex - 이 인덱스(포함)까지가 첫 번째 클립,
 *                                  그 이후가 두 번째 클립
 * @returns [앞 클립, 뒤 클립] 튜플
 * @throws splitAfterSentenceIndex가 유효하지 않으면 에러
 */
export function splitClip(
  clip: NarrationClip,
  splitAfterSentenceIndex: number
): [NarrationClip, NarrationClip] {
  const { sentences } = clip;

  if (
    splitAfterSentenceIndex < 0 ||
    splitAfterSentenceIndex >= sentences.length - 1
  ) {
    throw new RangeError(
      `splitAfterSentenceIndex(${splitAfterSentenceIndex})는 0 이상 ${sentences.length - 2} 이하여야 합니다.`
    );
  }

  const sentencesA = sentences.slice(0, splitAfterSentenceIndex + 1);
  const sentencesB = sentences.slice(splitAfterSentenceIndex + 1);

  const firstA = sentencesA[0];
  const lastA = sentencesA[sentencesA.length - 1];
  const firstB = sentencesB[0];
  const lastB = sentencesB[sentencesB.length - 1];

  const clipA: NarrationClip = {
    ...clip,
    ...makeClipDefaults(),
    id: `${clip.id}-a`,
    text: sentencesA.map((s) => s.text).join(' '),
    sentences: sentencesA,
    audioStartTime: firstA.startTime,
    audioEndTime: lastA.endTime,
    duration: lastA.endTime - firstA.startTime,
    isModified: true,
  };

  const clipB: NarrationClip = {
    ...clip,
    ...makeClipDefaults(),
    id: `${clip.id}-b`,
    text: sentencesB.map((s) => s.text).join(' '),
    sentences: sentencesB,
    audioStartTime: firstB.startTime,
    audioEndTime: lastB.endTime,
    duration: lastB.endTime - firstB.startTime,
    order: clip.order + 1,
    isModified: true,
  };

  return [clipA, clipB];
}

// ─────────────────────────────────────────────────────────────────
// 5. mergeClips
// ─────────────────────────────────────────────────────────────────

/**
 * 두 인접 클립 합치기.
 *
 * @param clipA - 앞 클립 (이미지/영상 소스로 사용)
 * @param clipB - 뒤 클립
 * @returns 합쳐진 단일 NarrationClip
 *
 * 규칙:
 *  - sentences: clipA + clipB 순서로 합산
 *  - audioStartTime: clipA.audioStartTime
 *  - audioEndTime: clipB.audioEndTime
 *  - duration: 두 클립 duration 합산
 *  - imageUrl / videoUrl: clipA 우선 (비어있으면 clipB 폴백)
 *  - order: clipA.order 유지
 */
export function mergeClips(
  clipA: NarrationClip,
  clipB: NarrationClip
): NarrationClip {
  const mergedSentences = [...clipA.sentences, ...clipB.sentences];

  return {
    id: clipA.id,
    sceneId: clipA.sceneId,
    text: [clipA.text, clipB.text].filter(Boolean).join(' '),
    sentences: mergedSentences,
    imageUrl: clipA.imageUrl || clipB.imageUrl,
    videoUrl: clipA.videoUrl || clipB.videoUrl,
    isVideoEnabled: clipA.isVideoEnabled || clipB.isVideoEnabled,
    effect: clipA.effect,
    audioStartTime: clipA.audioStartTime,
    audioEndTime: clipB.audioEndTime,
    duration: clipA.duration + clipB.duration,
    order: clipA.order,
    isModified: true,
  };
}

// ─────────────────────────────────────────────────────────────────
// 6. removeClip
// ─────────────────────────────────────────────────────────────────

/**
 * 클립 삭제 후 order 재정렬.
 *
 * @param clips  - 전체 클립 배열
 * @param clipId - 삭제할 클립 ID
 * @returns clipId가 제거되고 order가 0부터 재할당된 새 배열
 */
export function removeClip(
  clips: NarrationClip[],
  clipId: string
): NarrationClip[] {
  return clips
    .filter((c) => c.id !== clipId)
    .map((c, index) => ({ ...c, order: index }));
}

// ─────────────────────────────────────────────────────────────────
// 7. syncScenesImageToClips (핵심)
// ─────────────────────────────────────────────────────────────────

/**
 * scenes[] -> narrationClips[] 이미지 동기화.
 * Step 5(이미지 생성) → Step 6(나레이션 클립 편집) 전환 시 호출.
 *
 * @param scenes - sceneId와 imageUrl을 가진 씬 배열
 * @param clips  - 현재 나레이션 클립 배열
 * @returns imageUrl이 갱신된 새 클립 배열 (불변 업데이트)
 */
export function syncScenesImageToClips(
  scenes: Array<{ id: string; imageUrl: string }>,
  clips: NarrationClip[]
): NarrationClip[] {
  return clips.map((clip) => {
    const scene = scenes.find((s) => s.id === clip.sceneId);
    return scene ? { ...clip, imageUrl: scene.imageUrl } : clip;
  });
}

// ─────────────────────────────────────────────────────────────────
// 8. reorderClips (보너스 유틸리티)
// ─────────────────────────────────────────────────────────────────

/**
 * 클립 배열의 순서를 재정렬하고 order 필드를 갱신.
 * drag-and-drop 등 순서 변경 후 호출.
 *
 * @param clips - 새 순서로 정렬된 클립 배열
 * @returns order 필드가 0부터 재할당된 새 배열
 */
export function reorderClips(clips: NarrationClip[]): NarrationClip[] {
  return clips.map((c, index) => ({ ...c, order: index }));
}

// ─────────────────────────────────────────────────────────────────
// 9. getTotalDuration (보너스 유틸리티)
// ─────────────────────────────────────────────────────────────────

/**
 * 전체 클립 배열의 총 오디오 길이 계산.
 *
 * @param clips - NarrationClip 배열
 * @returns 총 재생 시간(초). clips가 비어있으면 0.
 */
export function getTotalDuration(clips: NarrationClip[]): number {
  if (clips.length === 0) return 0;
  const sorted = [...clips].sort((a, b) => a.audioStartTime - b.audioStartTime);
  const last = sorted[sorted.length - 1];
  return last.audioEndTime;
}

// ─────────────────────────────────────────────────────────────────
// 10. splitClipAtWord — 단어 위치에서 클립 분할
// ─────────────────────────────────────────────────────────────────

/**
 * 클립을 단어 위치에서 분할.
 *
 * @param clip - 분할할 클립
 * @param sentenceIndex - 분할점이 속한 문장의 인덱스
 * @param wordIndexInSentence - 해당 문장 내 단어 인덱스 (이 단어 **뒤**에서 분할)
 * @returns [앞 클립, 뒤 클립] 튜플
 *
 * 시나리오 A: 분할점이 문장의 마지막 단어 → 문장 경계 분할 (splitClip 활용)
 * 시나리오 B: 분할점이 문장 중간 → 문장을 2개로 분리 + words 재분배
 */
export function splitClipAtWord(
  clip: NarrationClip,
  sentenceIndex: number,
  wordIndexInSentence: number,
): [NarrationClip, NarrationClip] {
  const sentence = clip.sentences[sentenceIndex];
  if (!sentence) throw new RangeError('유효하지 않은 sentenceIndex');

  const words = sentence.words;

  // words가 없거나 비어있으면 문장 단위 분할로 폴백
  if (!words || words.length === 0) {
    // 문장이 1개뿐이면 분할 불가 — 기존 splitClip은 에러 발생
    if (clip.sentences.length <= 1) {
      throw new RangeError('분할할 수 없습니다: 문장이 1개이고 단어 타이밍이 없습니다.');
    }
    return splitClip(clip, sentenceIndex);
  }

  const isLastWordInSentence = wordIndexInSentence >= words.length - 1;
  const isLastSentence = sentenceIndex >= clip.sentences.length - 1;

  // 시나리오 A: 마지막 단어 뒤 = 문장 경계 → 기존 splitClip 활용
  if (isLastWordInSentence && !isLastSentence) {
    return splitClip(clip, sentenceIndex);
  }

  // 시나리오 B: 문장 중간 분할
  const wordsA = words.slice(0, wordIndexInSentence + 1);
  const wordsB = words.slice(wordIndexInSentence + 1);

  if (wordsA.length === 0 || wordsB.length === 0) {
    throw new RangeError('분할 결과가 빈 클립이 됩니다');
  }

  const splitTime = wordsA[wordsA.length - 1].endTime;

  // 원본 문장을 두 문장으로 분리
  const sentenceA: SentenceTiming = {
    index: sentence.index,
    text: wordsA.map((w) => w.text).join(' '),
    startTime: sentence.startTime,
    endTime: splitTime,
    words: wordsA,
  };
  const sentenceB: SentenceTiming = {
    index: sentence.index + 1,
    text: wordsB.map((w) => w.text).join(' '),
    startTime: splitTime,
    endTime: sentence.endTime,
    words: wordsB.map((w, i) => ({ ...w, index: i })),
  };

  // 앞 클립: sentenceIndex까지의 문장들 + sentenceA
  const sentencesPartA = [
    ...clip.sentences.slice(0, sentenceIndex),
    sentenceA,
  ];
  // 뒤 클립: sentenceB + sentenceIndex 이후 문장들
  const sentencesPartB = [
    sentenceB,
    ...clip.sentences.slice(sentenceIndex + 1),
  ];

  const clipA: NarrationClip = {
    ...clip,
    ...makeClipDefaults(),
    id: `${clip.id}-a`,
    text: sentencesPartA.map((s) => s.text).join(' '),
    sentences: sentencesPartA,
    audioStartTime: sentencesPartA[0].startTime,
    audioEndTime: sentencesPartA[sentencesPartA.length - 1].endTime,
    duration:
      sentencesPartA[sentencesPartA.length - 1].endTime -
      sentencesPartA[0].startTime,
    imageUrl: clip.imageUrl,
    videoUrl: '',
    isVideoEnabled: false,
    isModified: true,
  };

  const clipB: NarrationClip = {
    ...clip,
    ...makeClipDefaults(),
    id: `${clip.id}-b`,
    text: sentencesPartB.map((s) => s.text).join(' '),
    sentences: sentencesPartB,
    audioStartTime: sentencesPartB[0].startTime,
    audioEndTime: sentencesPartB[sentencesPartB.length - 1].endTime,
    duration:
      sentencesPartB[sentencesPartB.length - 1].endTime -
      sentencesPartB[0].startTime,
    order: clip.order + 1,
    isModified: true,
  };

  return [clipA, clipB];
}

// ─────────────────────────────────────────────────────────────────
// 11. findCurrentWord — 현재 재생 시간의 단어 찾기
// ─────────────────────────────────────────────────────────────────

/**
 * 현재 재생 시간에 해당하는 단어를 찾기.
 * 클립 내 모든 문장의 words를 순회.
 *
 * @param currentTime - 현재 재생 위치 (초, 전체 오디오 기준)
 * @param clip - 검색 대상 클립
 * @returns 해당 WordTiming 또는 null
 */
export function findCurrentWord(
  currentTime: number,
  clip: NarrationClip,
): WordTiming | null {
  for (const sentence of clip.sentences) {
    if (!sentence.words) continue;
    for (const word of sentence.words) {
      if (currentTime >= word.startTime && currentTime < word.endTime) {
        return word;
      }
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// sentenceDuration은 export되어 있으며 외부에서도 사용할 수 있습니다.
//   예) const dur = sentenceDuration(sentence);
// ─────────────────────────────────────────────────────────────────
