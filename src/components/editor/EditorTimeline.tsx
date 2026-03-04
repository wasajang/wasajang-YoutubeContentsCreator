/**
 * EditorTimeline — 3트랙 가로 타임라인 (영상 + 음성 + 자막)
 */
import React from 'react';
import { Film, Volume2, Type } from 'lucide-react';
import type { EditorClip } from './types';

interface EditorTimelineProps {
  clips: EditorClip[];
  currentClipIndex: number;
  currentTime: number;
  totalDuration: number;
  onClipSelect: (index: number) => void;
}

const EditorTimeline: React.FC<EditorTimelineProps> = ({
  clips,
  currentClipIndex,
  currentTime,
  totalDuration,
  onClipSelect,
}) => {
  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="vrew-timeline">
      {/* Playhead */}
      <div className="vrew-timeline__playhead-track">
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
              className={`vrew-timeline__block vrew-timeline__block--video${
                index === currentClipIndex ? ' vrew-timeline__block--active' : ''
              }`}
              style={{ flex: clip.duration }}
              onClick={() => onClipSelect(index)}
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
              <span className="vrew-timeline__block-dur">
                {clip.duration.toFixed(1)}s
              </span>
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
              className={`vrew-timeline__block vrew-timeline__block--audio${
                index === currentClipIndex ? ' vrew-timeline__block--active' : ''
              }${clip.audioUrl ? ' vrew-timeline__block--has-audio' : ''}`}
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
              className={`vrew-timeline__block vrew-timeline__block--subtitle${
                index === currentClipIndex ? ' vrew-timeline__block--active' : ''
              }`}
              style={{ flex: clip.duration }}
              onClick={() => onClipSelect(index)}
            >
              <span className="vrew-timeline__block-text">
                {clip.text.length > 20 ? clip.text.slice(0, 20) + '…' : clip.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EditorTimeline;
