/**
 * 단어 단위 타이밍 유틸리티
 * - 텍스트 → 단어 배열 분리 (공백 기준)
 * - 문장 타이밍 → 단어 타이밍 추정 (글자수 비율)
 * - SentenceTiming 배열에 words 자동 추가
 */

import type { SentenceTiming, WordTiming } from '../store/projectStore';

/**
 * 텍스트를 공백 기준으로 단어 배열로 분리.
 * 한국어는 형태소 분석 없이 공백 분리 (MVP 수준).
 */
export function tokenizeText(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * 문장의 시작/종료 시간과 텍스트를 기반으로 단어 타이밍을 추정.
 * 각 단어의 글자 수 비율에 따라 시간을 분배한다.
 *
 * @param sentenceText - 문장 텍스트
 * @param startTime - 문장 시작 시간(초)
 * @param endTime - 문장 종료 시간(초)
 * @returns 추정된 단어 타이밍 배열
 */
export function estimateWordTimings(
  sentenceText: string,
  startTime: number,
  endTime: number,
): WordTiming[] {
  const words = tokenizeText(sentenceText);
  if (words.length === 0) return [];

  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  if (totalChars === 0) return [];

  const totalDuration = endTime - startTime;
  let currentTime = startTime;

  return words.map((word, index) => {
    const ratio = word.length / totalChars;
    const duration = totalDuration * ratio;
    const wt: WordTiming = {
      index,
      text: word,
      startTime: Math.round(currentTime * 1000) / 1000,
      endTime: Math.round((currentTime + duration) * 1000) / 1000,
    };
    currentTime += duration;
    return wt;
  });
}

/**
 * SentenceTiming 배열에 단어 타이밍(words)을 자동 추가.
 * 이미 words가 있는 문장은 건너뛴다.
 *
 * @param timings - 기존 SentenceTiming 배열
 * @returns words가 보강된 SentenceTiming 배열
 */
export function enrichWithWordTimings(
  timings: SentenceTiming[],
): SentenceTiming[] {
  return timings.map((s) => ({
    ...s,
    words: s.words ?? estimateWordTimings(s.text, s.startTime, s.endTime),
  }));
}
