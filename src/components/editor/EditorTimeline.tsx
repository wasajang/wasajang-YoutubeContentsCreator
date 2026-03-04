/**
 * EditorTimeline — CapCut 스타일 3트랙 가로 타임라인
 *
 * - 시간 눈금자 (5초 간격)
 * - 플레이헤드 (클릭 이동)
 * - 영상 / 음성 / 자막 3트랙
 * - 클립 드래그 이동 (HTML5 DnD)
 * - 클립 삭제 (호버 시 X 버튼)
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Film, Volume2, Type, Trash2 } from 'lucide-react';
import type { EditorClip } from './types';

interface EditorTimelineProps {
  clips: EditorClip[];
  currentClipIndex: number;
  currentTime: number;
  totalDuration: number;
  onClipSelect: (index: number) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onDeleteClip?: (index: number) => void;
  onSeek?: (time: number) => void;
}

const formatTime = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const EditorTimeline: React.FC<EditorTimelineProps> = ({
  clips,
  currentClipIndex,
  currentTime,
  totalDuration,
  onClipSelect,
  onReorder,
  onDeleteClip,
  onSeek,
}) => {
  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // 드래그 상태
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // 시간 눈금자 마커 (5초 간격)
  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const step = totalDuration <= 30 ? 5 : totalDuration <= 120 ? 10 : 30;
    for (let t = 0; t <= totalDuration; t += step) {
      markers.push(t);
    }
    return markers;
  }, [totalDuration]);

  // 드래그 핸들러
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== toIndex && onReorder) {
      onReorder(dragIndex, toIndex);
    }
    setDragIndex(null);
    setDropIndex(null);
  }, [dragIndex, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  // 눈금자 클릭 → 시간 이동
  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || totalDuration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * totalDuration);
  }, [onSeek, totalDuration]);

  // 블록 클래스 생성 (공통)
  const getBlockClass = (base: string, index: number, extra?: string) => {
    let cls = `vrew-timeline__block ${base}`;
    if (index === currentClipIndex) cls += ' vrew-timeline__block--active';
    if (index === dragIndex) cls += ' vrew-timeline__block--dragging';
    if (index === dropIndex && index !== dragIndex) cls += ' vrew-timeline__block--drag-over';
    if (extra) cls += ` ${extra}`;
    return cls;
  };

  return (
    <div className="vrew-timeline">
      {/* 시간 눈금자 */}
      <div className="vrew-timeline__ruler" onClick={handleRulerClick}>
        {timeMarkers.map((t) => (
          <div
            key={t}
            className="vrew-timeline__ruler-mark"
            style={{ left: `${totalDuration > 0 ? (t / totalDuration) * 100 : 0}%` }}
          >
            <span>{formatTime(t)}</span>
          </div>
        ))}
        {/* Playhead on ruler */}
        <div
          className="vrew-timeline__playhead"
          style={{ left: `${progressPercent}%` }}
        />
      </div>

      {/* 영상 트랙 */}
      <div className="vrew-timeline__track">
        <div className="vrew-timeline__track-label">
          <Film size={12} /> 영상
        </div>
        <div className="vrew-timeline__track-content">
          {clips.map((clip, index) => (
            <div
              key={`v-${clip.id}`}
              className={getBlockClass('vrew-timeline__block--video', index)}
              style={{ flex: clip.duration }}
              onClick={() => onClipSelect(index)}
              draggable={!!onReorder}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              {clip.imageUrl ? (
                <img
                  src={clip.imageUrl}
                  alt={clip.label}
                  className="vrew-timeline__block-thumb"
                />
              ) : (
                <span className="vrew-timeline__block-num">{index + 1}</span>
              )}
              {/* 영상 생성됨 표시 */}
              {clip.videoUrl && (
                <span className="vrew-timeline__block-video-badge">▶</span>
              )}
              <span className="vrew-timeline__block-dur">
                {clip.duration.toFixed(1)}s
              </span>
              {/* 삭제 버튼 */}
              {onDeleteClip && (
                <button
                  className="vrew-timeline__block-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteClip(index);
                  }}
                  title="클립 삭제"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 음성 트랙 */}
      <div className="vrew-timeline__track">
        <div className="vrew-timeline__track-label">
          <Volume2 size={12} /> 음성
        </div>
        <div className="vrew-timeline__track-content">
          {clips.map((clip, index) => (
            <div
              key={`a-${clip.id}`}
              className={getBlockClass(
                'vrew-timeline__block--audio',
                index,
                clip.audioUrl ? 'vrew-timeline__block--has-audio' : ''
              )}
              style={{ flex: clip.duration }}
              onClick={() => onClipSelect(index)}
            >
              <span className="vrew-timeline__block-text">
                {clip.audioUrl ? 'TTS' : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 자막 트랙 */}
      <div className="vrew-timeline__track">
        <div className="vrew-timeline__track-label">
          <Type size={12} /> 자막
        </div>
        <div className="vrew-timeline__track-content">
          {clips.map((clip, index) => (
            <div
              key={`s-${clip.id}`}
              className={getBlockClass('vrew-timeline__block--subtitle', index)}
              style={{ flex: clip.duration }}
              onClick={() => onClipSelect(index)}
            >
              <span className="vrew-timeline__block-text">
                {clip.text.length > 20 ? clip.text.slice(0, 20) + '\u2026' : clip.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EditorTimeline;
