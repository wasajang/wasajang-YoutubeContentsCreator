/**
 * ScriptPanel — Vrew 스타일 대본 편집 패널
 * - 씬별 대본 텍스트 표시 + 직접 편집
 * - 이미지 → 영상 미디어 플로우 표시
 * - 영상 다시 만들기 버튼
 * - 클릭 → 해당 시점으로 이동
 * - 현재 재생 씬 자동 하이라이트
 */
import React, { useCallback, useRef, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import type { EditorClip } from './types';

interface ScriptPanelProps {
  clips: EditorClip[];
  currentClipIndex: number;
  onClipSelect: (index: number) => void;
  onTextChange: (clipId: string, text: string) => void;
  aspectRatio?: string;
  // 미디어 플로우 관련
  sceneVideos?: Record<string, string[]>;
  onRegenerateVideo?: (sceneId: string) => void;
  isRegenerating?: (sceneId: string) => boolean;
  // 씬 삽입
  onInsertScene?: (afterIndex: number) => void;
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
  aspectRatio = '16:9',
  sceneVideos,
  onRegenerateVideo,
  isRegenerating,
  onInsertScene,
}) => {
  const aspectClass = aspectRatio === '9:16' ? 'portrait'
    : aspectRatio === '1:1' ? 'square' : 'landscape';
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
          const videoUrl = sceneVideos?.[clip.sceneId]?.[0] || clip.videoUrl || '';
          const regenActive = isRegenerating?.(clip.sceneId) ?? false;

          return (
            <React.Fragment key={clip.id}>
            <div
              className={`vrew-script-panel__item${isActive ? ' vrew-script-panel__item--active' : ''}`}
              onClick={() => onClipSelect(index)}
            >
              {/* 컴팩트: 헤더 + 미디어를 한 줄로 */}
              <div className="vrew-script-panel__compact-row">
                {/* 미디어 썸네일 (작은 크기) */}
                <div className="vrew-script-panel__media-compact">
                  <div className={`vrew-script-panel__thumb-sm vrew-script-panel__thumb-sm--${aspectClass}`}>
                    {clip.imageUrl ? (
                      <img src={clip.imageUrl} alt={clip.label} />
                    ) : (
                      <span className="vrew-script-panel__no-media">—</span>
                    )}
                  </div>
                  <span className="vrew-script-panel__arrow-sm">→</span>
                  <div className={`vrew-script-panel__thumb-sm vrew-script-panel__thumb-sm--${aspectClass}`}>
                    {videoUrl ? (
                      <video src={videoUrl} muted className="vrew-script-panel__thumb-video-sm" />
                    ) : (
                      <span className="vrew-script-panel__no-media">—</span>
                    )}
                  </div>
                </div>

                {/* 텍스트 영역 */}
                <div className="vrew-script-panel__text-area">
                  <div className="vrew-script-panel__item-header">
                    <span className="vrew-script-panel__item-label">{clip.label}</span>
                    <span className="vrew-script-panel__item-time">
                      {formatTime(clip.audioStartTime)}–{formatTime(clip.audioEndTime)}
                    </span>
                    {onRegenerateVideo && (
                      <button
                        className="vrew-script-panel__regen-btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRegenerateVideo(clip.sceneId);
                        }}
                        disabled={regenActive || !!clip.isEdited}
                        title={clip.isEdited ? '편집됨' : regenActive ? '생성 중...' : '영상 다시 만들기'}
                      >
                        <RefreshCw size={10} className={regenActive ? 'spin' : ''} />
                      </button>
                    )}
                  </div>
                  <textarea
                    className="vrew-script-panel__textarea"
                    value={clip.text}
                    onChange={(e) => handleTextChange(clip.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    rows={Math.max(1, Math.ceil(clip.text.length / 50))}
                  />
                </div>
              </div>
            </div>

            {/* 씬 사이 삽입 버튼 */}
            {onInsertScene && (
              <div
                className="vrew-script-panel__insert-line"
                onClick={(e) => {
                  e.stopPropagation();
                  onInsertScene(index);
                }}
              >
                <span className="vrew-script-panel__insert-btn">+</span>
              </div>
            )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default ScriptPanel;
