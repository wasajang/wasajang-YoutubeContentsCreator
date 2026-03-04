/**
 * ScriptPanel — Vrew 스타일 대본 편집 패널
 * - 씬별 대본 텍스트 표시 + 직접 편집
 * - 클릭 → 해당 시점으로 이동
 * - 현재 재생 씬 자동 하이라이트
 */
import React, { useCallback, useRef, useEffect } from 'react';
import type { EditorClip } from './types';

interface ScriptPanelProps {
  clips: EditorClip[];
  currentClipIndex: number;
  onClipSelect: (index: number) => void;
  onTextChange: (clipId: string, text: string) => void;
}

const formatTime = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const ScriptPanel: React.FC<ScriptPanelProps> = ({
  clips,
  currentClipIndex,
  onClipSelect,
  onTextChange,
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  // 현재 클립이 바뀌면 스크롤 자동 이동
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector('.vrew-script-panel__item--active');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentClipIndex]);

  const handleTextChange = useCallback(
    (clipId: string, e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onTextChange(clipId, e.target.value);
    },
    [onTextChange]
  );

  return (
    <div className="vrew-script-panel">
      <div className="vrew-script-panel__header">
        <span className="vrew-script-panel__title">대본</span>
        <span className="vrew-script-panel__count">{clips.length}개 씬</span>
      </div>

      <div className="vrew-script-panel__list" ref={listRef}>
        {clips.map((clip, index) => {
          const isActive = index === currentClipIndex;
          return (
            <div
              key={clip.id}
              className={`vrew-script-panel__item${isActive ? ' vrew-script-panel__item--active' : ''}`}
              onClick={() => onClipSelect(index)}
            >
              <div className="vrew-script-panel__item-header">
                <span className="vrew-script-panel__item-label">{clip.label}</span>
                <span className="vrew-script-panel__item-time">
                  {formatTime(clip.audioStartTime)} — {formatTime(clip.audioEndTime)}
                </span>
              </div>
              <textarea
                className="vrew-script-panel__textarea"
                value={clip.text}
                onChange={(e) => handleTextChange(clip.id, e)}
                onClick={(e) => e.stopPropagation()}
                rows={Math.max(2, Math.ceil(clip.text.length / 40))}
              />
              {clip.imageUrl && (
                <div className="vrew-script-panel__thumb">
                  <img src={clip.imageUrl} alt={clip.label} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScriptPanel;
