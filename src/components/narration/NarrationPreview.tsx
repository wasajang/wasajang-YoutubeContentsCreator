/**
 * NarrationPreview — 현재 선택된 클립의 이미지/영상 미리보기 + 자막 오버레이
 *
 * - clip.isVideoEnabled && clip.videoUrl → <video> 태그
 * - 그 외 → <img> + Ken Burns CSS 클래스
 * - findCurrentSentence()로 현재 자막 텍스트 표시
 */
import React from 'react';
import type { NarrationClip } from '../../store/projectStore';
import { findCurrentSentence } from '../../utils/narration-sync';

interface NarrationPreviewProps {
  clip: NarrationClip | null;
  currentTime: number;
  isPlaying: boolean;
}

const NarrationPreview: React.FC<NarrationPreviewProps> = ({
  clip,
  currentTime,
  isPlaying: _isPlaying,
}) => {
  if (!clip) {
    return (
      <div className="narration-preview">
        <div className="narration-preview__placeholder">
          <span>씬을 선택하세요</span>
        </div>
      </div>
    );
  }

  const currentSentence = findCurrentSentence(currentTime, clip);
  const subtitleText = currentSentence?.text ?? '';

  const isVideo = clip.isVideoEnabled && Boolean(clip.videoUrl);

  // Ken Burns 효과 클래스
  const effectClass = clip.effect !== 'none' ? `ken-burns-${clip.effect}` : '';

  return (
    <div className="narration-preview">
      <div className="narration-preview__media">
        {isVideo ? (
          <video
            className="narration-preview__video"
            src={clip.videoUrl}
            loop
            muted
            playsInline
            autoPlay={_isPlaying}
          />
        ) : clip.imageUrl ? (
          <div className="narration-preview__image-wrap">
            <img
              className={`narration-preview__image${effectClass ? ` ${effectClass}` : ''}`}
              style={{ animationDuration: `${clip.duration}s` }}
              src={clip.imageUrl}
              alt={`씬 ${clip.sceneId} 미리보기`}
            />
          </div>
        ) : (
          <div className="narration-preview__placeholder">
            <span>이미지 없음</span>
          </div>
        )}

        {/* 자막 오버레이 */}
        {subtitleText && (
          <div className="narration-preview__subtitle">
            {subtitleText}
          </div>
        )}
      </div>
    </div>
  );
};

export default NarrationPreview;
