/**
 * useEditorPlayback — 듀얼 모드 재생 훅
 *
 * - 나레이션 모드 (audioUrl 있음): HTML Audio 기반 재생
 * - 시네마틱 모드 (audioUrl 없음): requestAnimationFrame 타이머 기반 재생
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import type { EditorClip } from '../components/editor/types';
import type { NarrationClip } from '../store/projectStore';
import { findCurrentClip } from '../utils/narration-sync';

interface UseEditorPlaybackOptions {
  clips: EditorClip[];
  audioUrl: string;
  /** GPU 가속 플레이헤드를 위한 DOM ref (직접 transform 업데이트) */
  playheadRef?: React.RefObject<HTMLDivElement | null>;
  /** 현재 타임라인의 pixelsPerSecond 값을 반환하는 콜백 */
  getTimelinePxPerSec?: () => number;
  /** 외부에서 총 재생 시간을 실시간 참조 (시네마틱 모드용) */
  getDuration?: () => number;
}

interface UseEditorPlaybackReturn {
  currentClipIndex: number;
  setCurrentClipIndex: (index: number) => void;
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seekToClip: (index: number) => void;
  seekToTime: (time: number) => void;
}

export function useEditorPlayback({
  clips,
  audioUrl,
  playheadRef,
  getTimelinePxPerSec,
  getDuration,
}: UseEditorPlaybackOptions): UseEditorPlaybackReturn {
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const tickRef = useRef<() => void>(() => {});

  // 시네마틱 타이머용 ref
  const timerStartRef = useRef<number>(0);      // performance.now() 기준점
  const playStartTimeRef = useRef<number>(0);   // 재생 시작 시 currentTime
  const currentTimeRef = useRef<number>(0);     // stale closure 방지
  const isPlayingRef = useRef(false);           // stale closure 방지

  // ref 동기화
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  const clipsBasedDuration = clips.length > 0
    ? Math.max(...clips.map((c) => c.audioEndTime))
    : 0;
  const totalDuration = clipsBasedDuration || (getDuration?.() ?? 0);

  // totalDurationRef: tick에서 항상 최신 값을 읽도록 (getDuration 포함)
  const totalDurationRef = useRef(totalDuration);
  // 매 렌더마다 갱신 (getDuration이 반환하는 값이 변할 수 있으므로)
  totalDurationRef.current = clipsBasedDuration || (getDuration?.() ?? 0);

  // clips ref (tick에서 최신 클립 참조)
  const clipsRef = useRef(clips);
  useEffect(() => { clipsRef.current = clips; }, [clips]);

  // requestAnimationFrame tick — 현재 시간 추적 + 클립 인덱스 동기화
  const tick = useCallback(() => {
    let time: number;
    const dur = totalDurationRef.current;

    if (audioUrl && audioRef.current) {
      // 나레이션: Audio 기반
      time = audioRef.current.currentTime;
    } else {
      // 시네마틱: rAF 타이머
      const elapsed = (performance.now() - timerStartRef.current) / 1000;
      time = playStartTimeRef.current + elapsed;
      if (dur > 0 && time >= dur) {
        // 끝 도달 시 정지
        setCurrentTime(dur);
        setIsPlaying(false);
        cancelAnimationFrame(animFrameRef.current);
        return;
      }
      // duration이 0이면 재생 불가 — 다음 프레임까지 대기
      if (dur <= 0) {
        animFrameRef.current = requestAnimationFrame(tickRef.current);
        return;
      }
    }

    setCurrentTime(time);

    // GPU 가속 플레이헤드 직접 DOM 업데이트 (60fps, React 리렌더 없이)
    if (playheadRef?.current && getTimelinePxPerSec) {
      playheadRef.current.style.transform = `translateX(${time * getTimelinePxPerSec()}px)`;
    }

    // 클립 인덱스 동기화
    const currentClips = clipsRef.current;
    if (currentClips.length > 0) {
      const clip = findCurrentClip(time, currentClips as unknown as NarrationClip[]);
      if (clip) {
        const idx = currentClips.findIndex((c) => c.id === clip.id);
        if (idx !== -1) setCurrentClipIndex(idx);
      }
    }

    animFrameRef.current = requestAnimationFrame(tickRef.current);
  }, [audioUrl, playheadRef, getTimelinePxPerSec]);

  tickRef.current = tick;

  // Audio 엘리먼트 초기화 / 정리
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    if (audioUrl) audio.src = audioUrl;

    const handleEnded = () => {
      setIsPlaying(false);
      cancelAnimationFrame(animFrameRef.current);
    };
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [audioUrl]);

  const play = useCallback(() => {
    if (audioUrl) {
      // 나레이션: Audio 기반 재생
      if (!audioRef.current) return;
      audioRef.current.play().catch(console.error);
    } else {
      // 시네마틱: rAF 타이머 시작
      timerStartRef.current = performance.now();
      playStartTimeRef.current = currentTimeRef.current;
    }
    setIsPlaying(true);
    animFrameRef.current = requestAnimationFrame(tickRef.current);
  }, [audioUrl]);

  const pause = useCallback(() => {
    if (audioUrl) {
      audioRef.current?.pause();
    }
    // 시네마틱: currentTimeRef에 이미 최신 시간 저장됨
    setIsPlaying(false);
    cancelAnimationFrame(animFrameRef.current);
  }, [audioUrl]);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const seekToClip = useCallback(
    (index: number) => {
      setCurrentClipIndex(index);
      const clip = clips[index];
      if (!clip) return;

      if (audioUrl && audioRef.current) {
        audioRef.current.currentTime = clip.audioStartTime;
      }
      setCurrentTime(clip.audioStartTime);
      currentTimeRef.current = clip.audioStartTime;

      // 시네마틱 재생 중이면 타이머 기준점 리셋
      if (isPlayingRef.current && !audioUrl) {
        timerStartRef.current = performance.now();
        playStartTimeRef.current = clip.audioStartTime;
      }
    },
    [clips, audioUrl]
  );

  const seekToTime = useCallback((time: number) => {
    if (audioUrl && audioRef.current) {
      audioRef.current.currentTime = time;
    }
    setCurrentTime(time);
    currentTimeRef.current = time;

    // 시네마틱 재생 중이면 타이머 기준점 리셋
    if (isPlayingRef.current && !audioUrl) {
      timerStartRef.current = performance.now();
      playStartTimeRef.current = time;
    }
  }, [audioUrl]);

  return {
    currentClipIndex,
    setCurrentClipIndex,
    isPlaying,
    currentTime,
    totalDuration,
    play,
    pause,
    togglePlay,
    seekToClip,
    seekToTime,
  };
}
