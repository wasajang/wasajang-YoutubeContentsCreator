/**
 * useEditorPlayback — 오디오 재생 + 자막 동기화 커스텀 훅
 * NarrationEditView에서 추출한 공용 훅
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

  const totalDuration =
    clips.length > 0
      ? Math.max(...clips.map((c) => c.audioEndTime))
      : 0;

  // requestAnimationFrame tick — 현재 시간 추적 + 클립 인덱스 동기화
  const tick = useCallback(() => {
    if (!audioRef.current) return;
    const time = audioRef.current.currentTime;
    setCurrentTime(time);

    // EditorClip → NarrationClip 호환 (audioStartTime/audioEndTime/id 동일 구조)
    const clip = findCurrentClip(time, clips as unknown as NarrationClip[]);
    if (clip) {
      const idx = clips.findIndex((c) => c.id === clip.id);
      if (idx !== -1) setCurrentClipIndex(idx);
    }

    animFrameRef.current = requestAnimationFrame(tickRef.current);
  }, [clips]);

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
    if (!audioRef.current || !audioUrl) return;
    audioRef.current.play().catch(console.error);
    setIsPlaying(true);
    animFrameRef.current = requestAnimationFrame(tickRef.current);
  }, [audioUrl]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const seekToClip = useCallback(
    (index: number) => {
      setCurrentClipIndex(index);
      const clip = clips[index];
      if (clip && audioRef.current) {
        audioRef.current.currentTime = clip.audioStartTime;
        setCurrentTime(clip.audioStartTime);
      }
    },
    [clips]
  );

  const seekToTime = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

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
