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

  const totalDuration =
    clips.length > 0
      ? Math.max(...clips.map((c) => c.audioEndTime))
      : 0;

  // requestAnimationFrame tick — 현재 시간 추적 + 클립 인덱스 동기화
  const tick = useCallback(() => {
    let time: number;

    if (audioUrl && audioRef.current) {
      // 나레이션: Audio 기반
      time = audioRef.current.currentTime;
    } else {
      // 시네마틱: rAF 타이머
      const elapsed = (performance.now() - timerStartRef.current) / 1000;
      time = playStartTimeRef.current + elapsed;
      if (time >= totalDuration) {
        // 끝 도달 시 정지
        setCurrentTime(totalDuration);
        setIsPlaying(false);
        cancelAnimationFrame(animFrameRef.current);
        return;
      }
    }

    setCurrentTime(time);

    // 클립 인덱스 동기화
    const clip = findCurrentClip(time, clips as unknown as NarrationClip[]);
    if (clip) {
      const idx = clips.findIndex((c) => c.id === clip.id);
      if (idx !== -1) setCurrentClipIndex(idx);
    }

    animFrameRef.current = requestAnimationFrame(tickRef.current);
  }, [clips, audioUrl, totalDuration]);

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
