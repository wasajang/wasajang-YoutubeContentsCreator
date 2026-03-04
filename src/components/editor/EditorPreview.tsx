/**
 * EditorPreview — 미리보기 영역
 * NarrationPreview와 동일한 패턴 + 씬 라벨 표시
 */
import React from 'react';
import type { EditorClip } from './types';

interface EditorPreviewProps {
  clip: EditorClip | null;
  currentTime: number;
  isPlaying: boolean;
}

const EditorPreview: React.FC<EditorPreviewProps> = ({
  clip,
  currentTime,
  isPlaying,
}) => {
  if (!clip) {
    return (
      <div className="vrew-preview">
        <div className="vrew-preview__placeholder">
          <span>씬을 선택하세요</span>
        </div>
      </div>
    );
  }

  // 현재 시간에 해당하는 자막 찾기
  let subtitleText = '';
  for (const s of clip.sentences) {
    if (currentTime >= s.startTime && currentTime < s.endTime) {
      subtitleText = s.text;
      break;
    }
  }

  const isVideo = clip.isVideoEnabled && Boolean(clip.videoUrl);
  const effectClass = clip.effect !== 'none' ? `ken-burns-${clip.effect}` : '';

  return (
    <div className="vrew-preview">
      <div className="vrew-preview__media">
        {isVideo ? (
          <video
            className="vrew-preview__video"
            src={clip.videoUrl}
            loop
            muted
            playsInline
            autoPlay={isPlaying}
          />
        ) : clip.imageUrl ? (
          <div className="vrew-preview__image-wrap">
            <img
              className={`vrew-preview__image${effectClass ? ` ${effectClass}` : ''}`}
              style={{ animationDuration: `${clip.duration}s` }}
              src={clip.imageUrl}
              alt={clip.label}
            />
          </div>
        ) : (
          <div className="vrew-preview__placeholder">
            <span>이미지 없음</span>
          </div>
        )}

        {/* 씬 라벨 */}
        <div className="vrew-preview__label">{clip.label}</div>

        {/* 자막 오버레이 */}
        {subtitleText && (
          <div className="vrew-preview__subtitle">{subtitleText}</div>
        )}
      </div>
    </div>
  );
};

export default EditorPreview;
