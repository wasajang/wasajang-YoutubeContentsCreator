/**
 * EditorControls — 재생 컨트롤 + 편집 도구바
 */
import React from 'react';
import {
  Play, Pause, SkipBack, SkipForward,
  Scissors, Merge, Trash2, ArrowUp, ArrowDown,
} from 'lucide-react';

interface EditorControlsProps {
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  currentClipIndex: number;
  clipCount: number;
  hasAudio: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSplit: () => void;
  onMerge: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canSplit: boolean;
  canMerge: boolean;
  canDelete: boolean;
}

const formatTime = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const EditorControls: React.FC<EditorControlsProps> = ({
  isPlaying,
  currentTime,
  totalDuration,
  currentClipIndex,
  clipCount,
  hasAudio,
  onTogglePlay,
  onPrev,
  onNext,
  onSplit,
  onMerge,
  onDelete,
  onMoveUp,
  onMoveDown,
  canSplit,
  canMerge,
  canDelete,
}) => {
  return (
    <div className="vrew-controls">
      {/* 재생 컨트롤 */}
      <div className="vrew-controls__playback">
        <button
          className="vrew-controls__btn"
          onClick={onPrev}
          disabled={currentClipIndex <= 0}
          title="이전 씬"
        >
          <SkipBack size={16} />
        </button>
        <button
          className="vrew-controls__btn vrew-controls__btn--play"
          onClick={onTogglePlay}
          disabled={!hasAudio}
          title={hasAudio ? (isPlaying ? '일시정지' : '재생') : '오디오 없음'}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          className="vrew-controls__btn"
          onClick={onNext}
          disabled={currentClipIndex >= clipCount - 1}
          title="다음 씬"
        >
          <SkipForward size={16} />
        </button>
        <span className="vrew-controls__time">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>
      </div>

      {/* 구분선 */}
      <div className="vrew-controls__divider" />

      {/* 편집 도구 */}
      <div className="vrew-controls__tools">
        <button
          className="vrew-controls__tool-btn"
          onClick={onSplit}
          disabled={!canSplit}
          title="자르기"
        >
          <Scissors size={14} /> 자르기
        </button>
        <button
          className="vrew-controls__tool-btn"
          onClick={onMerge}
          disabled={!canMerge}
          title="합치기"
        >
          <Merge size={14} /> 합치기
        </button>
        <button
          className="vrew-controls__tool-btn"
          onClick={onMoveUp}
          disabled={currentClipIndex <= 0}
          title="앞으로"
        >
          <ArrowUp size={14} />
        </button>
        <button
          className="vrew-controls__tool-btn"
          onClick={onMoveDown}
          disabled={currentClipIndex >= clipCount - 1}
          title="뒤로"
        >
          <ArrowDown size={14} />
        </button>
        <button
          className="vrew-controls__tool-btn vrew-controls__tool-btn--danger"
          onClick={onDelete}
          disabled={!canDelete}
          title="삭제"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default EditorControls;
