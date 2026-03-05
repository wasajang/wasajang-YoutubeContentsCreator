/**
 * EditorControls — 재생 컨트롤 + 편집 도구바
 */
import React from 'react';
import {
  Play, Pause, SkipBack, SkipForward,
  Scissors, Trash2, Undo2, Redo2,
} from 'lucide-react';

interface EditorControlsProps {
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  currentClipIndex: number;
  clipCount: number;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSplit: () => void;
  onDelete: () => void;
  canSplit: boolean;
  canDelete: boolean;
  mode?: 'cinematic' | 'narration';
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
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
  onTogglePlay,
  onPrev,
  onNext,
  onSplit,
  onDelete,
  canSplit,
  canDelete,
  mode,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  const label = mode === 'narration' ? '클립' : '씬';
  return (
    <div className="vrew-controls">
      {/* 재생 컨트롤 */}
      <div className="vrew-controls__playback">
        <button
          className="vrew-controls__btn"
          onClick={onPrev}
          disabled={currentClipIndex <= 0}
          title={`이전 ${label}`}
        >
          <SkipBack size={16} />
        </button>
        <button
          className="vrew-controls__btn vrew-controls__btn--play"
          onClick={onTogglePlay}
          title={isPlaying ? '일시정지' : '재생'}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          className="vrew-controls__btn"
          onClick={onNext}
          disabled={currentClipIndex >= clipCount - 1}
          title={`다음 ${label}`}
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
        {onUndo && (
          <button
            className="vrew-controls__tool-btn"
            onClick={onUndo}
            disabled={!canUndo}
            title="되돌리기 (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
        )}
        {onRedo && (
          <button
            className="vrew-controls__tool-btn"
            onClick={onRedo}
            disabled={!canRedo}
            title="다시실행 (Ctrl+Shift+Z)"
          >
            <Redo2 size={14} />
          </button>
        )}
        <button
          className="vrew-controls__tool-btn"
          onClick={onSplit}
          disabled={!canSplit}
          title="자르기"
        >
          <Scissors size={14} /> 자르기
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
