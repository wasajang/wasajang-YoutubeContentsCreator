/**
 * NarrationEditView — Step 7: 나레이션 편집 메인 뷰
 *
 * 레이아웃: 좌(미리보기) + 우(씬 리스트) 2컬럼
 * - HTML5 Audio로 전체 재생/일시정지
 * - requestAnimationFrame으로 현재 재생 위치 추적
 * - findCurrentClip으로 현재 클립 자동 동기화
 * - NarrationPreview + NarrationSceneList 서브 컴포넌트 사용
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import type { NarrationClip } from '../../store/projectStore';
import { findCurrentClip, getTotalDuration } from '../../utils/narration-sync';
import NarrationPreview from './NarrationPreview';
import NarrationSceneList from './NarrationSceneList';

interface NarrationEditViewProps {
  onNext: () => void;
  onPrev?: () => void;
}

const formatTime = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const NarrationEditView: React.FC<NarrationEditViewProps> = ({ onNext, onPrev }) => {
  const narrationClips = useProjectStore((s) => s.narrationClips);
  const setNarrationClips = useProjectStore((s) => s.setNarrationClips);
  const narrativeAudioUrl = useProjectStore((s) => s.narrativeAudioUrl);

  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);

  // tick 함수를 먼저 정의 (useEffect보다 위에)
  const tick = useCallback(() => {
    if (!audioRef.current) return;
    const time = audioRef.current.currentTime;
    setCurrentTime(time);

    const clip = findCurrentClip(time, narrationClips);
    if (clip) {
      const idx = narrationClips.findIndex((c) => c.id === clip.id);
      if (idx !== -1) {
        setCurrentClipIndex(idx);
      }
    }

    animFrameRef.current = requestAnimationFrame(tick);
  }, [narrationClips]);

  // Audio 엘리먼트 초기화
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    if (narrativeAudioUrl) {
      audio.src = narrativeAudioUrl;
    }
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
  }, [narrativeAudioUrl]);

  const handlePlay = useCallback(() => {
    if (!audioRef.current || !narrativeAudioUrl) return;
    audioRef.current.play().catch(console.error);
    setIsPlaying(true);
    animFrameRef.current = requestAnimationFrame(tick);
  }, [narrativeAudioUrl, tick]);

  const handlePause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  }, [isPlaying, handlePlay, handlePause]);

  // 씬 리스트에서 클립 선택 시 오디오 점프
  const handleClipSelect = useCallback(
    (index: number) => {
      setCurrentClipIndex(index);
      const clip = narrationClips[index];
      if (clip && audioRef.current) {
        audioRef.current.currentTime = clip.audioStartTime;
        setCurrentTime(clip.audioStartTime);
      }
    },
    [narrationClips]
  );

  // 씬 편집 후 클립 배열 업데이트
  const handleClipsChange = useCallback(
    (updatedClips: NarrationClip[]) => {
      setNarrationClips(updatedClips);
    },
    [setNarrationClips]
  );

  const currentClip = narrationClips[currentClipIndex] ?? null;
  const totalDuration = getTotalDuration(narrationClips);

  return (
    <div className="narration-edit-view">
      {/* 헤더 */}
      <div className="narration-edit-view__header">
        <h2 className="narration-edit-view__title">
          Step 7: 편집
          <span className="narration-edit-view__beta-badge">Beta</span>
        </h2>
      </div>

      {/* 2컬럼 콘텐츠 */}
      <div className="narration-edit-view__content">
        {/* 좌: 미리보기 */}
        <div className="narration-edit-view__left">
          <NarrationPreview
            clip={currentClip}
            currentTime={currentTime}
            isPlaying={isPlaying}
          />
        </div>

        {/* 우: 씬 리스트 */}
        <div className="narration-edit-view__right">
          <NarrationSceneList
            clips={narrationClips}
            currentClipIndex={currentClipIndex}
            onClipSelect={handleClipSelect}
            onClipsChange={handleClipsChange}
          />
        </div>
      </div>

      {/* 하단 재생 컨트롤 */}
      <div className="narration-edit-view__controls">
        {onPrev && (
          <button
            className="btn-secondary"
            onClick={onPrev}
            style={{ marginRight: 8 }}
          >
            이전
          </button>
        )}

        <button
          className="narration-edit-view__play-btn"
          onClick={handleTogglePlay}
          disabled={!narrativeAudioUrl}
          title={narrativeAudioUrl ? (isPlaying ? '일시정지' : '전체 재생') : '오디오가 없습니다'}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          {isPlaying ? '일시정지' : '전체 재생'}
        </button>

        <span className="narration-edit-view__time">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>

        <div className="narration-edit-view__controls-spacer" />

        <button
          className="narration-edit-view__next-btn"
          onClick={onNext}
          title="다음 단계로 이동"
        >
          다음: 내보내기 &rarr;
        </button>
      </div>
    </div>
  );
};

export default NarrationEditView;
